const express = require('express');
const router = express.Router();

const AQSRecord = require('../models/AQSRecord');
const AttendanceRecord = require('../models/AttendanceRecord');
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateAQS } = require('../services/aqsService');

// GET /api/aqs/analytics/:subjectId
router.get('/analytics/:subjectId', authMiddleware, async (req, res) => {
  try {
    const records = await AQSRecord.find()
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime');

    const filteredRecords = records.filter(
      (record) => record.sessionId && record.sessionId.subjectId === req.params.subjectId
    );

    const avg =
      filteredRecords.reduce((sum, r) => sum + r.totalAQS, 0) / (filteredRecords.length || 1);

    res.json({
      totalRecords: filteredRecords.length,
      averageAQS: Math.round(avg),
      records: filteredRecords,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/aqs/rebuild/:sessionId
router.post('/rebuild/:sessionId', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can rebuild AQS' });
    }

    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const attendees = await AttendanceRecord.find({ sessionId: session._id });

    const results = await Promise.all(
      attendees.map((attendee) =>
        calculateAQS(session._id.toString(), attendee.studentId.toString())
      )
    );

    const records = await AQSRecord.find({ sessionId: session._id })
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime');

    res.json({
      message: 'AQS rebuilt successfully for session',
      sessionId: session._id,
      totalAttendees: attendees.length,
      totalRecords: records.length,
      results,
      records,
    });
  } catch (err) {
    console.error('AQS REBUILD ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/aqs/rebuild-all
router.post('/rebuild-all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can rebuild AQS' });
    }

    const attendanceRecords = await AttendanceRecord.find().lean();
    const uniquePairs = new Map();

    for (const record of attendanceRecords) {
      const key = `${record.sessionId}:${record.studentId}`;
      uniquePairs.set(key, record);
    }

    const results = [];

    for (const record of uniquePairs.values()) {
      const result = await calculateAQS(
        record.sessionId.toString(),
        record.studentId.toString()
      );

      results.push({
        sessionId: record.sessionId,
        studentId: record.studentId,
        ...result,
      });
    }

    res.json({
      message: 'AQS rebuilt successfully for all attendance records',
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error('AQS REBUILD ALL ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/aqs/:studentId/:subjectId
router.get('/:studentId/:subjectId', authMiddleware, async (req, res) => {
  try {
    const records = await AQSRecord.find({
      studentId: req.params.studentId,
    }).populate('sessionId', 'subjectId startTime');

    const filteredRecords = records.filter(
      (record) => record.sessionId && record.sessionId.subjectId === req.params.subjectId
    );

    res.json({ records: filteredRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
