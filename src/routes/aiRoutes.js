const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AQSRecord = require('../models/AQSRecord');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getEmbedding } = require('../services/embeddingService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const VECTOR_INDEX = process.env.MONGO_VECTOR_INDEX || 'aqs_embedding_index';

function buildRecordText(record) {
  const studentName = record.studentId?.name || 'Unknown Student';
  const rollNo = record.studentId?.rollNo || 'N/A';
  const subjectId = record.sessionId?.subjectId || 'Unknown Subject';
  const startTime = record.sessionId?.startTime
    ? new Date(record.sessionId.startTime).toISOString()
    : 'N/A';

  return [
    `Student: ${studentName}`,
    `Roll No: ${rollNo}`,
    `Subject: ${subjectId}`,
    `Session Time: ${startTime}`,
    `Presence Score: ${record.presenceScore}`,
    `Attempt Score: ${record.attemptScore}`,
    `Correctness Score: ${record.correctnessScore}`,
    `Total AQS: ${record.totalAQS}`,
  ].join(', ');
}

async function runFacultyVectorSearch(queryEmbedding) {
  return AQSRecord.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 50,
        limit: 5,
      },
    },
    {
      $lookup: {
        from: 'students',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student',
      },
    },
    {
      $lookup: {
        from: 'sessions',
        localField: 'sessionId',
        foreignField: '_id',
        as: 'session',
      },
    },
    {
      $project: {
        totalAQS: 1,
        presenceScore: 1,
        attemptScore: 1,
        correctnessScore: 1,
        searchableText: 1,
        score: { $meta: 'vectorSearchScore' },
        student: { $arrayElemAt: ['$student', 0] },
        session: { $arrayElemAt: ['$session', 0] },
      },
    },
  ]);
}

async function runStudentVectorSearch(queryEmbedding, studentId) {
  return AQSRecord.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 50,
        limit: 5,
        filter: {
          studentId: new mongoose.Types.ObjectId(studentId),
        },
      },
    },
    {
      $lookup: {
        from: 'sessions',
        localField: 'sessionId',
        foreignField: '_id',
        as: 'session',
      },
    },
    {
      $project: {
        totalAQS: 1,
        presenceScore: 1,
        attemptScore: 1,
        correctnessScore: 1,
        searchableText: 1,
        score: { $meta: 'vectorSearchScore' },
        session: { $arrayElemAt: ['$session', 0] },
      },
    },
  ]);
}

async function getFacultyFallbackMatches() {
  const records = await AQSRecord.find()
    .populate('studentId', 'name rollNo')
    .populate('sessionId', 'subjectId startTime')
    .sort({ computedAt: -1, createdAt: -1 })
    .limit(5)
    .lean();

  return records.map((record) => ({
    totalAQS: record.totalAQS,
    presenceScore: record.presenceScore,
    attemptScore: record.attemptScore,
    correctnessScore: record.correctnessScore,
    searchableText: record.searchableText,
    score: null,
    student: record.studentId,
    session: record.sessionId,
  }));
}

async function getStudentFallbackMatches(studentId) {
  const records = await AQSRecord.find({ studentId })
    .populate('sessionId', 'subjectId startTime')
    .sort({ computedAt: -1, createdAt: -1 })
    .limit(5)
    .lean();

  return records.map((record) => ({
    totalAQS: record.totalAQS,
    presenceScore: record.presenceScore,
    attemptScore: record.attemptScore,
    correctnessScore: record.correctnessScore,
    searchableText: record.searchableText,
    score: null,
    session: record.sessionId,
  }));
}

function buildFacultyFallbackAnswer(matches) {
  if (!matches.length) {
    return 'No attendance analytics records were found for the requested query.';
  }

  const lowPerformers = matches.filter((match) => Number(match.totalAQS) < 50);
  if (!lowPerformers.length) {
    return `No low-performing students were found in the retrieved records. Total records checked: ${matches.length}.`;
  }

  const names = lowPerformers
    .map((match) => match.student?.name || 'Unknown Student')
    .join(', ');

  return `Low-performing students found: ${names}. Retrieved ${matches.length} relevant record(s), and ${lowPerformers.length} have total AQS below 50.`;
}

function buildStudentFallbackAnswer(matches) {
  if (!matches.length) {
    return 'No student analytics records were found for this query.';
  }

  const latest = matches[0];
  return `Your latest retrieved attendance record shows a total AQS of ${latest.totalAQS || 0}. Keep attending sessions regularly to improve your score.`;
}

router.post('/sync-embeddings', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can sync embeddings' });
    }

    const records = await AQSRecord.find()
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime')
      .lean();

    let updated = 0;

    for (const record of records) {
      const searchableText = buildRecordText(record);
      const embedding = await getEmbedding(searchableText);

      await AQSRecord.findByIdAndUpdate(record._id, {
        searchableText,
        embedding,
      });

      updated += 1;
    }

    res.json({
      message: 'Embeddings synced successfully',
      updated,
    });
  } catch (err) {
    console.error('SYNC EMBEDDINGS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/faculty-query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const embeddedCount = await AQSRecord.countDocuments({
      embedding: { $exists: true, $ne: [] },
    });

    if (embeddedCount === 0) {
      return res.json({
        query,
        aiResponse: 'No attendance analytics data is available yet. Please generate AQS records and sync embeddings first.',
        retrievedCount: 0,
        matches: [],
      });
    }

    const queryEmbedding = await getEmbedding(query);
    let matches = [];
    let retrievalMode = 'vector';

    try {
      matches = await runFacultyVectorSearch(queryEmbedding);
    } catch (vectorError) {
      console.error('FACULTY VECTOR SEARCH FALLBACK:', vectorError.message);
      matches = await getFacultyFallbackMatches();
      retrievalMode = 'fallback';
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are SmartAttend AI assistant for faculty.

The following records were retrieved from MongoDB vector search as the most relevant context:
${JSON.stringify(matches, null, 2)}

Faculty question:
"${query}"

Answer only from the retrieved context.
Keep the answer concise, clear, and useful.
    `;

    let aiResponse;

    try {
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
    } catch (generationError) {
      console.error('FACULTY GENERATION FALLBACK:', generationError.message);
      aiResponse = buildFacultyFallbackAnswer(matches);
    }

    res.json({
      query,
      aiResponse,
      retrievalMode,
      retrievedCount: matches.length,
      matches,
    });
  } catch (err) {
    console.error('FACULTY QUERY ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/student-query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    const studentId = req.user.id;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const embeddedCount = await AQSRecord.countDocuments({
      studentId,
      embedding: { $exists: true, $ne: [] },
    });

    if (embeddedCount === 0) {
      return res.json({
        query,
        aiResponse: 'No student analytics data is available yet. Please generate AQS records and sync embeddings first.',
        retrievedCount: 0,
        matches: [],
      });
    }

    const queryEmbedding = await getEmbedding(query);
    let matches = [];
    let retrievalMode = 'vector';

    try {
      matches = await runStudentVectorSearch(queryEmbedding, studentId);
    } catch (vectorError) {
      console.error('STUDENT VECTOR SEARCH FALLBACK:', vectorError.message);
      matches = await getStudentFallbackMatches(studentId);
      retrievalMode = 'fallback';
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are SmartAttend AI assistant for a student.

The following records were retrieved from MongoDB vector search for this student:
${JSON.stringify(matches, null, 2)}

Student question:
"${query}"

Answer in a helpful, encouraging, concise way.
Only use the retrieved context.
    `;

    let aiResponse;

    try {
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
    } catch (generationError) {
      console.error('STUDENT GENERATION FALLBACK:', generationError.message);
      aiResponse = buildStudentFallbackAnswer(matches);
    }

    res.json({
      query,
      aiResponse,
      retrievalMode,
      retrievedCount: matches.length,
      matches,
    });
  } catch (err) {
    console.error('STUDENT QUERY ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-questions', authMiddleware, async (req, res) => {
  try {
    const { topic, count } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Generate ${count || 3} MCQ questions about "${topic}".
Return ONLY a JSON array:
[
  {
    "text": "Question?",
    "type": "mcq",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "difficulty": "medium"
  }
]
Return only JSON, no extra text.
    `;

    const result = await model.generateContent(prompt);
    let aiText = result.response.text();
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

    const questions = JSON.parse(aiText);

    res.json({
      topic,
      questions,
      message: 'Questions generated successfully',
    });
  } catch (err) {
    console.error('GENERATE QUESTIONS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
