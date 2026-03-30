const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text);

  const vector =
    result?.embedding?.values ||
    result?.embedding ||
    result?.embeddings?.[0]?.values ||
    result?.embeddings?.[0];

  if (!Array.isArray(vector)) {
    throw new Error('Embedding response format was not recognized');
  }

  return vector;
}

module.exports = { getEmbedding };
