const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  timestamp: { type: Date, default: Date.now },
  gpsLat: Number, gpsLng: Number,
  wifiSSID: String, deviceId: String,
  verificationMethod: { type: String, default: 'qr+gps+wifi' },
});
schema.index({ sessionId: 1, studentId: 1 }, { unique: true });
module.exports = mongoose.model('AttendanceRecord', schema);