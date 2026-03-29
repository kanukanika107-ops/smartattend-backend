
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AQSRecord = require('../models/AQSRecord');
const Student = require('../models/Student');

// POST /api/ai/faculty-query
router.post('/faculty-query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    const records = await AQSRecord.find()
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime');

    const avgAQS = records.reduce((sum, r) => sum + r.totalAQS, 0) / (records.length || 1);
    const lowPerformers = records.filter(r => r.totalAQS < 50);

    res.json({
      query,
      summary: `Total records: ${records.length}, Average AQS: ${Math.round(avgAQS)}`,
      lowPerformers: lowPerformers.length,
      data: records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/student-query
router.post('/student-query', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { query } = req.body;

    const records = await AQSRecord.find({ studentId })
      .populate('sessionId', 'subjectId startTime');

    const avgAQS = records.reduce((sum, r) => sum + r.totalAQS, 0) / (records.length || 1);

    res.json({
      query,
      summary: `Your average AQS: ${Math.round(avgAQS)}`,
      totalSessions: records.length,
      records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-questions
router.post('/generate-questions', authMiddleware, async (req, res) => {
  try {
    const { topic, count } = req.body;

    // Basic question templates based on topic
    const questions = [];
    for (let i = 1; i <= (count || 3); i++) {
      questions.push({
        text: `Question ${i} about ${topic}?`,
        type: 'mcq',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        difficulty: 'medium',
      });
    }

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