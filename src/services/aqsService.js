const AttendanceRecord = require('../models/AttendanceRecord');
const PulseCheck = require('../models/PulseCheck');
const QuizResponse = require('../models/QuizResponse');
const AQSRecord = require('../models/AQSRecord');

async function calculateAQS(sessionId, studentId) {
  const attendance = await AttendanceRecord.findOne({ sessionId, studentId });
  const presenceScore = attendance ? 40 : 0;

  if (!attendance) {
    await AQSRecord.findOneAndDelete({ sessionId, studentId });
    return { presence: 0, attempt: 0, correctness: 0, total: 0 };
  }

  const pulseCheck = await PulseCheck.findOne({ sessionId });
  if (!pulseCheck) return { presence: 40, attempt: 0, correctness: 0, total: 40 };

  const response = await QuizResponse.findOne({
    pulseCheckId: pulseCheck._id,
    studentId,
  });

  const attemptScore = response ? 30 : 0;
  let correctnessScore = 0;
  if (response) {
    correctnessScore = Math.round((response.score / response.maxScore) * 30);
  }

  const total = presenceScore + attemptScore + correctnessScore;

  await AQSRecord.findOneAndUpdate(
    { sessionId, studentId },
    {
      sessionId,
      studentId,
      presenceScore,
      attemptScore,
      correctnessScore,
      totalAQS: total,
      computedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { presence: presenceScore, attempt: attemptScore, correctness: correctnessScore, total };
}

module.exports = { calculateAQS };
