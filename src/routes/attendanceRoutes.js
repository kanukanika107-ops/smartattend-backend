const express = require('express');
const router = express.Router();

const AttendanceRecord = require('../models/AttendanceRecord');
const Session = require('../models/Session');
const { verifyQRToken } = require('../services/qrService');
const authMiddleware = require('../middleware/authMiddleware');

async function resolveSessionFromRequest(sessionId, qrToken) {
  if (sessionId) {
    const directSession = await Session.findById(sessionId);
    if (directSession) return directSession;
  }

  if (!qrToken) return null;

  const activeSessions = await Session.find({ status: 'active' })
    .sort({ createdAt: -1 })
    .limit(25);

  for (const session of activeSessions) {
    const isValid = verifyQRToken(session._id.toString(), session.qrSecret, qrToken);
    if (isValid) {
      return session;
    }
  }

  return null;
}

// POST /api/attendance/mark
router.post('/mark', authMiddleware, async (req, res) => {
  try {
    const { sessionId, qrToken, gpsLat, gpsLng, wifiSSID, deviceId } = req.body;
    const studentId = req.user.id;

    // 1. Find the session
    const session = await resolveSessionFromRequest(sessionId, qrToken);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'closed') return res.status(400).json({ error: 'Session is closed' });

    // 2. Verify QR token
    const isValidQR = verifyQRToken(session._id.toString(), session.qrSecret, qrToken);
    if (!isValidQR) return res.status(400).json({ error: 'Invalid or expired QR code' });

    // 3. Save attendance
    const record = await AttendanceRecord.create({
      sessionId: session._id,
      studentId,
      gpsLat,
      gpsLng,
      wifiSSID,
      deviceId,
      verificationMethod: 'qr+gps+wifi',
    });

    res.status(201).json({
      message: 'Attendance marked successfully',
      record,
    });

  } catch (err) {
    // Duplicate attendance attempt
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Attendance already marked for this session' });
    }
    console.error('ATTENDANCE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/:sessionId — view who attended
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const records = await AttendanceRecord.find({ sessionId: req.params.sessionId })
      .populate('studentId', 'name rollNo email');

    res.json({ count: records.length, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
