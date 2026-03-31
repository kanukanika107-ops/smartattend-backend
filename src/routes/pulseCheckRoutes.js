const express = require('express');
const router = express.Router();

const PulseCheck = require('../models/PulseCheck');
const QuizResponse = require('../models/QuizResponse');
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/pulse-check/create
router.post('/create', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can create pulse checks' });
    }

    const { sessionId, topicKeywords, questions, durationSec } = req.body;

    const normalizedQuestions = Array.isArray(questions)
      ? questions.map((q) => ({ ...q, approved: Boolean(q.approved) }))
      : [];

    const pulseCheck = await PulseCheck.create({
      sessionId,
      topicKeywords,
      questions: normalizedQuestions,
      durationSec: durationSec || 240,
    });

    res.status(201).json({ message: 'Pulse check created', pulseCheck });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pulse-check/:id/questions (teacher edits questions)
router.put('/:id/questions', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can edit pulse checks' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    const updatedQuestions = questions.map((q) => ({ ...q, approved: false }));

    const pulseCheck = await PulseCheck.findByIdAndUpdate(
      req.params.id,
      { questions: updatedQuestions, triggeredAt: null, expiresAt: null },
      { new: true }
    );

    if (!pulseCheck) return res.status(404).json({ error: 'Pulse check not found' });

    res.json({ message: 'Questions updated (approval reset)', pulseCheck });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pulse-check/:id/approve (approve questions)
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can approve pulse checks' });
    }

    const { approveAll, approvedQuestionIndices } = req.body;

    const pulseCheck = await PulseCheck.findById(req.params.id);
    if (!pulseCheck) return res.status(404).json({ error: 'Pulse check not found' });

    if (approveAll) {
      pulseCheck.questions = pulseCheck.questions.map((q) => ({
        ...q.toObject(),
        approved: true,
      }));
    } else if (Array.isArray(approvedQuestionIndices)) {
      pulseCheck.questions = pulseCheck.questions.map((q, idx) => ({
        ...q.toObject(),
        approved: approvedQuestionIndices.includes(idx) ? true : q.approved,
      }));
    } else {
      return res.status(400).json({ error: 'approveAll or approvedQuestionIndices required' });
    }

    await pulseCheck.save();

    res.json({ message: 'Questions approved', pulseCheck });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pulse-check/:id/trigger
router.post('/:id/trigger', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can trigger pulse checks' });
    }

    const pulseCheckForApproval = await PulseCheck.findById(req.params.id);
    if (!pulseCheckForApproval) return res.status(404).json({ error: 'Pulse check not found' });

    const hasUnapproved = pulseCheckForApproval.questions.some((q) => !q.approved);
    if (hasUnapproved) {
      return res.status(400).json({ error: 'Please approve all questions before triggering' });
    }

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
