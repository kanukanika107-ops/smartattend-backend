const express = require('express');
const router = express.Router();

const AQSRecord = require('../models/AQSRecord');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/aqs/analytics/:subjectId  ← yeh PEHLE hona chahiye
router.get('/analytics/:subjectId', authMiddleware, async (req, res) => {
  try {
    const records = await AQSRecord.find()
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime');

    const avg = records.reduce((sum, r) => sum + r.totalAQS, 0) / (records.length || 1);

    res.json({
      totalRecords: records.length,
      averageAQS: Math.round(avg),
      records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/aqs/:studentId/:subjectId  ← yeh BAAD me
router.get('/:studentId/:subjectId', authMiddleware, async (req, res) => {
  try {
    const records = await AQSRecord.find({
      studentId: req.params.studentId,
    }).populate('sessionId', 'subjectId startTime');

    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;