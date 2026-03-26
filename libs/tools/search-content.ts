import { tool } from '@langchain/core/tools';
import { SearchContentToolSchema, ContentType } from '@/libs/schemas';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { getCollectionName } from '@/libs/utils';
import { rerank } from '@/libs/utils/rerank';

const FETCH_LIMIT = 20;
const RERANK_LIMIT = 5;

/**
 * Search Writing Samples Tool
 * Fetches 20 candidates, re-ranks with LLM, returns top 5
 */
export const searchWritingSamplesTool = tool(
	async (args: {
		query: string;
		contentTypes?: ContentType[];
		limit?: number;
	}) => {
		const { query, contentTypes, limit = RERANK_LIMIT } = args;
		try {
			const queryEmbedding = await generateEmbedding(query);

			const collectionsToSearch: ContentType[] = contentTypes || [
				'article',
				'post',
				'transcript',
			];

			const searchPromises = collectionsToSearch.map(
				async (contentType) => {
					console.log('contentType', contentType);
					const collectionName = getCollectionName(contentType);
					console.log('collectionName', collectionName);
					try {
						const results = await qdrantClient.search(
							collectionName,
							{
								vector: queryEmbedding,
								limit: FETCH_LIMIT,
								with_payload: true,
							},
						);

						return results.map((r) => {
							const payload = r.payload as Record<string, any>;
							return {
								score: r.score,
								text: String(payload?.text || ''),
								contentType,
								...(contentType === 'post'
									? {
											numImpressions:
												payload?.numImpressions,
										}
									: {}),
							};
						});
					} catch (error) {
						console.warn(
							`Error searching ${collectionName}:`,
							error,
						);
						return [];
					}
				},
			);

			const allResults = await Promise.all(searchPromises);
			const flatResults = allResults.flat();
			flatResults.sort((a, b) => b.score - a.score);

			// Take top 20 candidates for re-ranking
			const candidates = flatResults.slice(0, FETCH_LIMIT);

			const reranked = await rerank(query, candidates, limit);

			const formattedResults = reranked
				.map(
					(result, index) =>
						`Example ${index + 1} (${result.contentType}):\n${result.text}`,
				)
				.join('\n\n---\n\n');

			return formattedResults || 'No relevant writing samples found.';
		} catch {
			return 'Error searching content';
		}
	},
	{
		name: 'searchWritingSamplesTool',
		description:
			"Search through Brian's previous articles, posts, and transcripts to find writing style examples, tone references, and similar content. Use this when writing new content to match Brian's authentic voice and reference his past work.",
		schema: SearchContentToolSchema,
	},
);
