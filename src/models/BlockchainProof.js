const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  dataHash: String, txHash: String,
  blockNumber: Number, verifiedAt: Date,
});
module.exports = mongoose.model('BlockchainProof', schema);