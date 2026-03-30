const express = require('express');
const router = express.Router();

const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');
const { verifySessionProof } = require('../services/blockchainService');

router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('facultyId', 'name email')
      .populate('pulseCheckId');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const verification = await verifySessionProof(session);

    res.json({
      sessionId: session._id,
      status: session.status,
      verification,
    });
  } catch (err) {
    console.error('VERIFY ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
