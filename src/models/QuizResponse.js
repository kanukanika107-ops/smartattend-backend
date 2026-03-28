const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  pulseCheckId: { type: mongoose.Schema.Types.ObjectId, ref: 'PulseCheck' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  answers: [{ questionIndex: Number, answer: String, correct: Boolean }],
  score: Number, maxScore: Number,
  attemptedAt: { type: Date, default: Date.now },
  timeTakenSec: Number,
});
module.exports = mongoose.model('QuizResponse', schema);