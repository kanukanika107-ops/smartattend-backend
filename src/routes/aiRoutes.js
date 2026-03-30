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
    res.status(500).json({ error: err.message });
  }
});

router.post('/faculty-query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const queryEmbedding = await getEmbedding(query);
    const matches = await runFacultyVectorSearch(queryEmbedding);

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

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    res.json({
      query,
      aiResponse,
      retrievedCount: matches.length,
      matches,
    });
  } catch (err) {
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

    const queryEmbedding = await getEmbedding(query);
    const matches = await runStudentVectorSearch(queryEmbedding, studentId);

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

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    res.json({
      query,
      aiResponse,
      retrievedCount: matches.length,
      matches,
    });
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
