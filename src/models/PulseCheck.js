const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  topicKeywords: String,
  questions: [{
    text: String,
    type: { type: String, enum: ['mcq','tf','fill','short'] },
    options: [String], correctAnswer: String, difficulty: String,
    approved: { type: Boolean, default: false },
  }],
  durationSec: { type: Number, default: 240 },
  triggeredAt: Date, expiresAt: Date,
});
module.exports = mongoose.model('PulseCheck', schema);
