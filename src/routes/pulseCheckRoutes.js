const express = require('express');
const router = express.Router();

const PulseCheck = require('../models/PulseCheck');
const QuizResponse = require('../models/QuizResponse');
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/pulse-check/create
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { sessionId, topicKeywords, questions, durationSec } = req.body;

    const pulseCheck = await PulseCheck.create({
      sessionId,
      topicKeywords,
      questions,
      durationSec: durationSec || 240,
    });

    res.status(201).json({ message: 'Pulse check created', pulseCheck });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pulse-check/:id/trigger
router.post('/:id/trigger', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const pulseCheck = await PulseCheck.findByIdAndUpdate(
      req.params.id,
      {
        triggeredAt: now,
        expiresAt: new Date(now.getTime() + 240000),
      },
      { new: true }
    );

    await Session.findByIdAndUpdate(pulseCheck.sessionId, {
      pulseCheckId: pulseCheck._id,
    });

    res.json({ message: 'Pulse check triggered', pulseCheck });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pulse-check/:id/submit
router.post('/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { answers, timeTakenSec } = req.body;
    const studentId = req.user.id;

    const pulseCheck = await PulseCheck.findById(req.params.id);
    if (!pulseCheck) return res.status(404).json({ error: 'Pulse check not found' });

    // Auto score answers
    let score = 0;
    const gradedAnswers = answers.map((ans) => {
      const question = pulseCheck.questions[ans.questionIndex];
      const correct = question?.correctAnswer === ans.answer;
      if (correct) score++;
      return { ...ans, correct };
    });

    const response = await QuizResponse.create({
      pulseCheckId: pulseCheck._id,
      studentId,
      answers: gradedAnswers,
      score,
      maxScore: pulseCheck.questions.length,
      timeTakenSec,
    });

    res.status(201).json({
      message: 'Quiz submitted',
      score,
      maxScore: pulseCheck.questions.length,
      response,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;