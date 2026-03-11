const { QdrantClient } = require('@qdrant/js-client-rest');

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// Collection names matching the Next.js app
const COLLECTIONS = {
  ARTICLES: 'brian-articles',
  POSTS: 'brian-posts',
  TRANSCRIPTS: 'brian-transcripts',
};

function getCollectionName(contentType) {
  switch (contentType) {
    case 'article':
      return COLLECTIONS.ARTICLES;
    case 'post':
      return COLLECTIONS.POSTS;
    case 'transcript':
      return COLLECTIONS.TRANSCRIPTS;
    default:
      return COLLECTIONS.ARTICLES;
  }
}

module.exports = {
  qdrantClient,
  COLLECTIONS,
  getCollectionName,
};
