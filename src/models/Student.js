const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  semester: { type: Number, required: true },
  section: { type: String, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  photoUrl: { type: String, default: null },
  deviceId: { type: String, default: null },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
