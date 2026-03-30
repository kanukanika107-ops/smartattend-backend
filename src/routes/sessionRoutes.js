const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Session = require('../models/Session');
const AttendanceRecord = require('../models/AttendanceRecord');
const { generateQRToken } = require('../services/qrService');
const { calculateAQS } = require('../services/aqsService');
const { createSessionProof } = require('../services/blockchainService');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/sessions — all sessions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const sessions = await Session.find()
      .populate('facultyId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id — one session detail
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('facultyId', 'name email')
      .populate('pulseCheckId');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/start
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { subjectId, section } = req.body;
    const facultyId = req.user.id;
    const qrSecret = crypto.randomBytes(32).toString('hex');

    const session = await Session.create({
      facultyId, subjectId, section, qrSecret,
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

// GET /api/sessions/:id/qr
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

// POST /api/sessions/:id/close
router.post('/:id/close', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', endTime: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const attendees = await AttendanceRecord.find({ sessionId: session._id });

    const aqsResults = await Promise.all(
      attendees.map((a) => calculateAQS(session._id.toString(), a.studentId.toString()))
    );

    const { proof } = await createSessionProof(session);
    await Session.findByIdAndUpdate(session._id, { blockchainTxHash: proof.txHash });

    res.json({
      message: 'Session closed',
      totalAttendees: attendees.length,
      aqsResults,
      blockchainProof: {
        dataHash: proof.dataHash,
        txHash: proof.txHash,
        blockNumber: proof.blockNumber,
        verifiedAt: proof.verifiedAt,
      },
    });
  } catch (err) {
    console.error('CLOSE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
