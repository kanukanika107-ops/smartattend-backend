const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Session = require('../models/Session');
const { generateQRToken } = require('../services/qrService');
const authMiddleware = require('../middleware/authMiddleware');

// Start a session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { subjectId, section } = req.body;
    const facultyId = req.user.id;
    const qrSecret = crypto.randomBytes(32).toString('hex');

    const session = await Session.create({
      facultyId,
      subjectId,
      section,
      qrSecret,
    });

    const qrToken = generateQRToken(session._id.toString(), qrSecret);

    res.status(201).json({
      message: 'Session started',
      sessionId: session._id,
      qrToken,
    });
  } catch (err) {
    console.error('SESSION ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get current QR token (rotates every 30 sec)
router.get('/:id/qr', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'closed') return res.status(400).json({ error: 'Session is closed' });

    const qrToken = generateQRToken(session._id.toString(), session.qrSecret);
    res.json({ qrToken, sessionId: session._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const AttendanceRecord = require('../models/AttendanceRecord');
const { calculateAQS } = require('../services/aqsService');

// POST /api/sessions/:id/close
router.post('/:id/close', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', endTime: new Date() },
      { new: true }
    );

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Get all students who attended
    const attendees = await AttendanceRecord.find({ sessionId: session._id });

    // Calculate AQS for every student
    const aqsResults = await Promise.all(
      attendees.map((a) => calculateAQS(session._id.toString(), a.studentId.toString()))
    );

    res.json({
      message: 'Session closed',
      totalAttendees: attendees.length,
      aqsResults,
    });
  } catch (err) {
    console.error('CLOSE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;