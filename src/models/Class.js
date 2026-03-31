const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  academicSession: { type: String, required: true },
  subjectName: { type: String, required: true },
  classCode: { type: String, required: true },
  section: { type: String, default: 'A' },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
}, { timestamps: true });

classSchema.index({ facultyId: 1, classCode: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
