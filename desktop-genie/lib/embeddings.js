const OpenAI = require('openai');

let openaiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generate embedding for text using OpenAI
 * Uses text-embedding-3-small with 512 dimensions (matching Next.js app)
 */
async function generateEmbedding(text) {
  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 512,
  });

  return response.data[0].embedding;
}

module.exports = {
  generateEmbedding,
  getOpenAI,
};
