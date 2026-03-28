const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  presenceScore: { type: Number, default: 0 },
  attemptScore: { type: Number, default: 0 },
  correctnessScore: { type: Number, default: 0 },
  totalAQS: { type: Number, default: 0 },
  computedAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('AQSRecord', schema);