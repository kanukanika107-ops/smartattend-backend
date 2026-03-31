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

// GET /api/academic-sessions/range
// Returns a list of session labels for dropdowns (default 1999-2070)
router.get('/range', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can view academic sessions' });
    }

    const startYear = Number(req.query.startYear || 1999);
    const endYear = Number(req.query.endYear || 2070);

    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
      return res.status(400).json({ error: 'Invalid year range' });
    }

    const sessions = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const label = `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
      sessions.push({
        label,
        startYear: year,
        endYear: year + 1,
      });
    }

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
