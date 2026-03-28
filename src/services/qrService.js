const crypto = require('crypto');

function generateQRToken(sessionId, qrSecret) {
  const timestamp = Math.floor(Date.now() / 30000);
  const data = `${sessionId}:${timestamp}`;
  return crypto.createHmac('sha256', qrSecret).update(data).digest('hex');
}

function verifyQRToken(sessionId, qrSecret, tokenToCheck) {
  const currentTime = Math.floor(Date.now() / 30000);
  for (let i = 0; i <= 1; i++) {
    const data = `${sessionId}:${currentTime - i}`;
    const token = crypto.createHmac('sha256', qrSecret).update(data).digest('hex');
    if (token === tokenToCheck) return true;
  }
  return false;
}

module.exports = { generateQRToken, verifyQRToken };