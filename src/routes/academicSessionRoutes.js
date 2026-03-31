const express = require('express');
const router = express.Router();

const AcademicSession = require('../models/AcademicSession');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/academic-sessions
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can create academic sessions' });
    }

    const { label, startYear, endYear, isActive } = req.body;
    if (!label) {
      return res.status(400).json({ error: 'label is required (e.g. 2026-27)' });
    }

    const created = await AcademicSession.create({
      label,
      startYear: startYear || null,
      endYear: endYear || null,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      facultyId: req.user.id,
    });

    res.status(201).json({ message: 'Academic session created', session: created });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Session label already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/academic-sessions
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can view academic sessions' });
    }

    const sessions = await AcademicSession.find({ facultyId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
