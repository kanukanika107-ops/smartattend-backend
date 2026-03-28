const mongoose = require('mongoose');
const sessionSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  subjectId: { type: String, required: true },
  section: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  qrSecret: { type: String, required: true },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  pulseCheckId: { type: mongoose.Schema.Types.ObjectId, ref: 'PulseCheck' },
  blockchainTxHash: String,
}, { timestamps: true });
module.exports = mongoose.model('Session', sessionSchema);