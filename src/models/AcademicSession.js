const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema({
  label: { type: String, required: true, unique: true }, // e.g. "2026-27"
  startYear: { type: Number, default: null },
  endYear: { type: Number, default: null },
  isActive: { type: Boolean, default: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
}, { timestamps: true });

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
