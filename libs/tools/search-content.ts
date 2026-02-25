import { tool } from 'ai';
import { SearchContentToolSchema, ContentType } from '@/libs/schemas';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { getCollectionName } from '@/libs/utils';

/**
 * Search Writing Samples Tool
 * Searches through Brian's previous writing (transcripts, articles, posts) to match style and tone
 * Use this when creating content to maintain consistent voice and reference similar topics
 */
export const searchWritingSamplesTool = tool({
	description:
		"Search through Brian's previous articles, posts, and transcripts to find writing style examples, tone references, and similar content. Use this when writing new content to match Brian's authentic voice and reference his past work.",
	inputSchema: SearchContentToolSchema,
	execute: async (args: {
		query: string;
		contentTypes?: ContentType[];
		limit?: number;
	}) => {
		const { query, contentTypes, limit = 5 } = args;
		try {
			const queryEmbedding = await generateEmbedding(query);

			const collectionsToSearch = contentTypes || [
				'article',
				'post',
				'transcript',
			];

			const searchPromises = collectionsToSearch.map(
				async (contentType) => {
					const collectionName = getCollectionName(contentType);
					try {
						const results = await qdrantClient.search(
							collectionName,
							{
								vector: queryEmbedding,
								limit,
								with_payload: true,
							},
						);

						return results.map((r) => ({
							score: r.score,
							text: r.payload?.text,
							contentType,
							metadata: r.payload,
						}));
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

			const topResults = flatResults.slice(0, limit);

			const formattedResults = topResults
				.map((result, index) => {
					return `Example ${index + 1} (${
						result.contentType
					}, score: ${result.score.toFixed(3)}):
${result.text}`;
				})
				.join('\n\n---\n\n');

			return formattedResults || 'No relevant writing samples found.';
		} catch (error) {
			return 'Error searching content';
		}
	},
});
