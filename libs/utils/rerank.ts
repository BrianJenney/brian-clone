type SearchResult = {
	score: number;
	text: string;
	contentType: string;
};
/**
 * Re-rank search results using Cohere's rerank API
 */
export async function rerank(
	query: string,
	results: SearchResult[],
	limit: number,
): Promise<SearchResult[]> {
	if (results.length <= limit) return results;

	const apiKey = process.env.COHERE_RERANK_API_KEY;

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
		return data.results.map((r: { index: number }) => results[r.index]);
	} catch (error) {
		return results.slice(0, limit);
	}
}
