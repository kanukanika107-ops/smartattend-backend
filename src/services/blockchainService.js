const crypto = require('crypto');

const BlockchainProof = require('../models/BlockchainProof');
const AttendanceRecord = require('../models/AttendanceRecord');
const AQSRecord = require('../models/AQSRecord');

function buildStablePayload(session, attendees, aqsRecords) {
  return {
    sessionId: session._id.toString(),
    subjectId: session.subjectId,
    section: session.section,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    attendees: attendees.map((record) => ({
      studentId: record.studentId.toString(),
      timestamp: record.timestamp,
      verificationMethod: record.verificationMethod,
    })),
    aqsRecords: aqsRecords.map((record) => ({
      studentId: record.studentId.toString(),
      presenceScore: record.presenceScore,
      attemptScore: record.attemptScore,
      correctnessScore: record.correctnessScore,
      totalAQS: record.totalAQS,
    })),
  };
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function createSessionProof(session) {
  const attendees = await AttendanceRecord.find({ sessionId: session._id })
    .sort({ studentId: 1, timestamp: 1 })
    .lean();

  const aqsRecords = await AQSRecord.find({ sessionId: session._id })
    .sort({ studentId: 1, computedAt: 1 })
    .lean();

  const payload = buildStablePayload(session, attendees, aqsRecords);
  const dataHash = sha256(JSON.stringify(payload));

  const txHash = sha256(
    `${dataHash}:${process.env.BLOCKCHAIN_SALT || 'smartattend-local-proof'}`
  );

  const proof = await BlockchainProof.findOneAndUpdate(
    { sessionId: session._id },
    {
      sessionId: session._id,
      dataHash,
      txHash,
      blockNumber: 0,
      verifiedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { proof, payload };
}

async function verifySessionProof(session) {
  const existingProof = await BlockchainProof.findOne({ sessionId: session._id }).lean();
  if (!existingProof) {
    return {
      verified: false,
      reason: 'No blockchain proof found for this session',
    };
  }

  const attendees = await AttendanceRecord.find({ sessionId: session._id })
    .sort({ studentId: 1, timestamp: 1 })
    .lean();

  const aqsRecords = await AQSRecord.find({ sessionId: session._id })
    .sort({ studentId: 1, computedAt: 1 })
    .lean();

  const payload = buildStablePayload(session, attendees, aqsRecords);
  const recalculatedHash = sha256(JSON.stringify(payload));
  const verified = recalculatedHash === existingProof.dataHash;

  return {
    verified,
    reason: verified ? 'Hash matches stored blockchain proof' : 'Hash mismatch detected',
    storedHash: existingProof.dataHash,
    recalculatedHash,
    txHash: existingProof.txHash,
    blockNumber: existingProof.blockNumber,
    verifiedAt: existingProof.verifiedAt,
  };
}

module.exports = {
  createSessionProof,
  verifySessionProof,
};
