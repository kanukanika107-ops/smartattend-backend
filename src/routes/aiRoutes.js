const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AQSRecord = require('../models/AQSRecord');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/faculty-query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    const records = await AQSRecord.find()
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime')
      .maxTimeMS(5000)
      .lean();
    const avgAQS = records.reduce((sum, r) => sum + r.totalAQS, 0) / (records.length || 1);
    const lowPerformers = records.filter(r => r.totalAQS < 50);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      You are SmartAttend AI assistant for faculty.
      Database has this attendance data:
      - Total Records: ${records.length}
      - Average AQS Score: ${Math.round(avgAQS)}
      - Low Performers (AQS < 50): ${lowPerformers.length}
      - Student Data: ${JSON.stringify(records.slice(0, 10))}
      Faculty asked: "${query}"
      Give a helpful, concise answer in 2-3 lines based on the data above.
    `;
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();
    res.json({
      query,
      aiResponse,
      summary: `Total records: ${records.length}, Average AQS: ${Math.round(avgAQS)}`,
      lowPerformers: lowPerformers.length,
      data: records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/student-query', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { query } = req.body;
    const records = await AQSRecord.find({ studentId })
      .populate('sessionId', 'subjectId startTime')
      .maxTimeMS(5000)
      .lean();
    const avgAQS = records.reduce((sum, r) => sum + r.totalAQS, 0) / (records.length || 1);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      You are SmartAttend AI assistant for a student.
      Student attendance data:
      - Total Sessions: ${records.length}
      - Average AQS: ${Math.round(avgAQS)}
      - Records: ${JSON.stringify(records)}
      Student asked: "${query}"
      Give encouraging, helpful answer in 2-3 lines.
    `;
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();
    res.json({
      query,
      aiResponse,
      summary: `Average AQS: ${Math.round(avgAQS)}`,
      totalSessions: records.length,
      records,
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
    res.json({ topic, questions, message: 'Questions generated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;