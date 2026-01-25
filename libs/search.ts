import {
	SearchRequest,
	SearchResponse,
	SearchResult,
	ContentType,
} from '@/libs/schemas';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { getCollectionName } from '@/libs/utils';

/**
 * Perform semantic search across content collections
 * Shared function used by both API and CLI
 */
export async function performSearch(
	params: SearchRequest
): Promise<SearchResponse> {
	const { query, collections, limit = 10, filter } = params;

	// Generate embedding for the search query
	const queryEmbedding = await generateEmbedding(query);

	// Default to searching all collections
	const collectionsToSearch: ContentType[] = collections || [
		'transcript',
		'article',
		'post',
	];

	// Build Qdrant filter from search filters
	const qdrantFilter: any = filter ? { must: [] } : undefined;
	if (filter && qdrantFilter) {
		if (filter.title) {
			qdrantFilter.must.push({
				key: 'title',
				match: { value: filter.title },
			});
		}
		if (filter.author) {
			qdrantFilter.must.push({
				key: 'author',
				match: { value: filter.author },
			});
		}
		if (filter.tags && filter.tags.length > 0) {
			qdrantFilter.must.push({
				key: 'tags',
				match: { any: filter.tags },
			});
		}
		if (filter.dateFrom) {
			qdrantFilter.must.push({
				key: 'date',
				range: { gte: filter.dateFrom },
			});
		}
		if (filter.dateTo) {
			qdrantFilter.must.push({
				key: 'date',
				range: { lte: filter.dateTo },
			});
		}
	}

	// Search across all specified collections
	const searchPromises = collectionsToSearch.map(async (contentType) => {
		const collectionName = getCollectionName(contentType);

		try {
			const searchResult = await qdrantClient.search(collectionName, {
				vector: queryEmbedding,
				limit,
				filter: qdrantFilter,
				with_payload: true,
			});

			return searchResult.map((point) => {
				const result: SearchResult = {
					id: point.id,
					score: point.score,
					text: point.payload?.text as string,
					contentType,
					metadata: point.payload as Record<string, any>,
					chunkIndex: point.payload?.chunkIndex as number | undefined,
					totalChunks: point.payload?.totalChunks as
						| number
						| undefined,
				};
				return result;
			});
		} catch (error) {
			console.warn(
				`Collection ${collectionName} not found or error searching:`,
				error
			);
			return [];
		}
	});

	const allResults = await Promise.all(searchPromises);
	const flatResults = allResults.flat();

	// Sort by score descending
	flatResults.sort((a, b) => b.score - a.score);

	// Apply limit
	const limitedResults = flatResults.slice(0, limit);

	return {
		success: true,
		results: limitedResults,
		total: limitedResults.length,
	};
}
