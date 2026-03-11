const crypto = require('crypto');

// Generate UUID without external dependency
function uuidv4() {
  return crypto.randomUUID();
}
const { qdrantClient, getCollectionName } = require('./qdrant');
const { generateEmbedding } = require('./embeddings');

/**
 * Split text into sentences
 */
function splitIntoSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

/**
 * Chunk text with overlap for articles and transcripts
 */
function chunkTextWithOverlap(text, maxChunkSize = 1500) {
  const sentences = splitIntoSentences(text);
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const sentenceLength = sentence.length;

    if (currentLength + sentenceLength > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));

      // Keep last sentence for overlap
      const lastSentence = currentChunk[currentChunk.length - 1];
      currentChunk = [lastSentence];
      currentLength = lastSentence.length;
    }

    currentChunk.push(sentence.trim());
    currentLength += sentenceLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.map((text, index) => ({
    text,
    index,
    totalChunks: chunks.length,
  }));
}

/**
 * No chunking for posts (store as single unit)
 */
function noChunking(text) {
  return [{ text, index: 0, totalChunks: 1 }];
}

/**
 * Get chunks based on content type
 */
function getChunks(text, contentType) {
  if (contentType === 'post') {
    return noChunking(text);
  }
  return chunkTextWithOverlap(text, 1500);
}

/**
 * Upload content to vector DB
 * @param {string} text - Content text
 * @param {string} contentType - 'article', 'post', or 'transcript'
 * @param {object} metadata - Optional metadata (title, tags, etc.)
 */
async function uploadContent(text, contentType, metadata = {}) {
  const collectionName = getCollectionName(contentType);
  const chunks = getChunks(text, contentType);
  const baseId = uuidv4();
  const chunkIds = [];

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);

    const chunkId = chunks.length > 1 ? `${baseId}-chunk-${chunk.index}` : baseId;
    chunkIds.push(chunkId);

    const payload = {
      text: chunk.text,
      contentType,
      baseId,
      chunkIndex: chunk.index,
      totalChunks: chunk.totalChunks,
      createdAt: new Date().toISOString(),
      ...metadata,
    };

    await qdrantClient.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: chunkId,
          vector: embedding,
          payload,
        },
      ],
    });
  }

  return {
    success: true,
    message: `Uploaded ${chunks.length} chunk(s) to ${collectionName}`,
    chunkIds,
    chunksCreated: chunks.length,
  };
}

module.exports = {
  uploadContent,
  chunkTextWithOverlap,
  noChunking,
};
