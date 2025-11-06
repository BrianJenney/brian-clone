import { NextRequest, NextResponse } from 'next/server';
import {
	SearchRequestSchema,
	SearchResponse,
	SearchResult,
	ContentType,
} from '@/libs/schemas';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { getCollectionName } from '@/libs/utils';

/**
 * POST /api/search
 * Search across collections using semantic search
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		const validationResult = SearchRequestSchema.parse(body);

		const { query, collections, limit, filter } = validationResult;

		const queryEmbedding = await generateEmbedding(query);

		const collectionsToSearch = collections || [
			'transcript',
			'article',
			'post',
		];

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
						chunkIndex: point.payload?.chunkIndex as
							| number
							| undefined,
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

		flatResults.sort((a, b) => b.score - a.score);

		const limitedResults = flatResults.slice(0, limit);

		const response: SearchResponse = {
			success: true,
			results: limitedResults,
			total: limitedResults.length,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error searching content:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to search content',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
