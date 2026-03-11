const { qdrantClient, getCollectionName } = require('./qdrant');
const { generateEmbedding } = require('./embeddings');

const FETCH_LIMIT = 20;
const RERANK_LIMIT = 5;

/**
 * Re-rank search results using Cohere's rerank API
 */
async function rerank(query, results, limit) {
  if (results.length <= limit) return results;

  const apiKey = process.env.COHERE_RERANK_API_KEY;
  if (!apiKey) {
    console.warn('COHERE_RERANK_API_KEY not set, skipping rerank');
    return results.slice(0, limit);
  }

  try {
    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: results.map((r) => r.text),
        top_n: limit,
      }),
    });

    const data = await response.json();
    return data.results.map((r) => results[r.index]);
  } catch (error) {
    console.error('Rerank error:', error);
    return results.slice(0, limit);
  }
}

/**
 * Search writing samples across all collections
 * @param {string} query - Search query
 * @param {string[]} contentTypes - Optional filter by content type
 * @param {number} limit - Max results to return
 */
async function searchWritingSamples(query, contentTypes = null, limit = RERANK_LIMIT) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const collectionsToSearch = contentTypes || ['article', 'post', 'transcript'];

    const searchPromises = collectionsToSearch.map(async (contentType) => {
      const collectionName = getCollectionName(contentType);
      try {
        const results = await qdrantClient.search(collectionName, {
          vector: queryEmbedding,
          limit: FETCH_LIMIT,
          with_payload: true,
        });

        return results.map((r) => ({
          score: r.score,
          text: String(r.payload?.text || ''),
          contentType,
          title: r.payload?.title || null,
        }));
      } catch (error) {
        console.warn(`Error searching ${collectionName}:`, error.message);
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();
    flatResults.sort((a, b) => b.score - a.score);

    // Take top candidates for re-ranking
    const candidates = flatResults.slice(0, FETCH_LIMIT);

    // Re-rank using Cohere
    const reranked = await rerank(query, candidates, limit);

    return reranked;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

/**
 * Format search results for AI context
 */
function formatWritingSamples(results) {
  if (!results || results.length === 0) {
    return 'No relevant writing samples found.';
  }

  return results
    .map((result, index) => {
      const header = result.title
        ? `Example ${index + 1} - "${result.title}" (${result.contentType})`
        : `Example ${index + 1} (${result.contentType})`;
      return `${header}:\n${result.text}`;
    })
    .join('\n\n---\n\n');
}

module.exports = {
  searchWritingSamples,
  formatWritingSamples,
  rerank,
};
