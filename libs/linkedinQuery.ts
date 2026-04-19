import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { qdrantClient, COLLECTIONS } from './qdrant';
import { openai, generateEmbedding } from './openai';

export const LinkedInQueryFiltersSchema = z.object({
	searchText: z
		.string()
		.describe('The semantic search query extracted from the user input'),
	timeRange: z
		.object({
			start: z
				.string()
				.nullable()
				.describe('ISO date string for start of range'),
			end: z
				.string()
				.nullable()
				.describe('ISO date string for end of range'),
		})
		.nullable()
		.describe('Time range filter for createdAt field'),
	likes: z
		.object({
			min: z
				.number()
				.nullable()
				.describe('Minimum number of likes')
				.default(20),
			max: z
				.number()
				.describe('Maximum number of likes')
				.nullable()
				.default(Infinity),
		})
		.nullable()
		.describe('Filter by numReactions (likes)'),
	limit: z
		.number()
		.default(10)
		.describe('Number of results to return, default 10'),
});

export type LinkedInQueryFilters = z.infer<typeof LinkedInQueryFiltersSchema>;

const SYSTEM_PROMPT = `You are a query parser that extracts structured filters from natural language queries about LinkedIn posts.

Today's date is: ${new Date().toISOString().split('T')[0]}

Extract the following from the user's query:
1. searchText: The main topic/semantic search query (what the posts should be about)
2. timeRange: Any date/time constraints mentioned
   - Convert relative dates like "last month", "past week", "in 2024" to ISO date strings
   - Use null for open-ended ranges
3. likes: Any constraints on likes/reactions count
   - "top performing" or "popular" = min: 50
   - "viral" = min: 100
   - Specific numbers like "more than 50 likes" = min: 50
4. limit: How many results (default 10, "top 5" = 5, etc.)

Examples:
- "posts about React from last month" -> searchText: "React", timeRange: {start: "2024-02-01", end: "2024-02-29"}, likes: null
- "top performing TypeScript posts" -> searchText: "TypeScript", likes: {min: 50, max: null}
- "recent career advice posts with lots of engagement" -> searchText: "career advice", timeRange: {start: <7 days ago>, end: null}, likes: {min: 50, max: null}

Max should be Infinity if not specified.
Min should be 20 if not specified.

Return valid JSON matching the schema.`;

/**
 * Parse natural language query into structured filters using LLM
 */
export async function parseLinkedInQuery(
	naturalLanguageQuery: string,
): Promise<LinkedInQueryFilters> {
	const result = await openai.responses.parse({
		model: 'gpt-4o-mini',
		temperature: 0,
		input: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: naturalLanguageQuery },
		],
		text: {
			format: zodTextFormat(
				LinkedInQueryFiltersSchema,
				'linkedin_query_filters',
			),
		},
	});

	const output = result.output_parsed;
	if (!output) {
		throw new Error('Failed to parse response');
	}

	return output;
}

/**
 * Convert date string to RFC3339 format for Qdrant datetime
 */
function toRFC3339(dateStr: string, isEnd = false): string {
	if (dateStr.includes('T')) {
		return dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
	}
	const time = isEnd ? 'T23:59:59Z' : 'T00:00:00Z';
	return `${dateStr}${time}`;
}

/**
 * Build Qdrant filter conditions from parsed filters
 */
function buildQdrantFilter(filters: LinkedInQueryFilters): Record<string, any> {
	const must: any[] = [];

	if (filters.timeRange) {
		const range: Record<string, string> = {};
		if (filters.timeRange.start) {
			range.gte = toRFC3339(filters.timeRange.start, false);
		}
		if (filters.timeRange.end) {
			range.lte = toRFC3339(filters.timeRange.end, true);
		}
		if (Object.keys(range).length > 0) {
			must.push({ key: 'createdAt', range });
		}
	}

	if (filters.likes) {
		const range: Record<string, number> = {};
		if (filters.likes.min !== null) {
			range.gte = filters.likes.min;
		}
		if (filters.likes.max !== null) {
			range.lte = filters.likes.max;
		}
		if (Object.keys(range).length > 0) {
			must.push({ key: 'numReactions', range });
		}
	}

	if (must.length === 0) {
		return {};
	}

	return { must };
}

/**
 * Query LinkedIn posts with natural language - returns raw Qdrant results
 */
export async function queryLinkedInPosts(naturalLanguageQuery: string) {
	const filters = await parseLinkedInQuery(naturalLanguageQuery);
	console.log('Parsed filters:', JSON.stringify(filters, null, 2));

	const embedding = await generateEmbedding(filters.searchText);

	const filter = buildQdrantFilter(filters);
	console.log('Qdrant filter:', JSON.stringify(filter, null, 2));

	try {
		return await qdrantClient.search(COLLECTIONS.POSTS, {
			vector: embedding,
			limit: filters.limit,
			with_payload: true,
			...(Object.keys(filter).length > 0 && { filter }),
		});
	} catch (error: any) {
		console.error('Qdrant error details:', error?.data || error);
		throw error;
	}
}

/**
 * Query with pre-parsed filters - returns raw Qdrant results
 */
export async function queryLinkedInPostsWithFilters(
	filters: LinkedInQueryFilters,
) {
	const embedding = await generateEmbedding(filters.searchText);
	const filter = buildQdrantFilter(filters);

	return qdrantClient.search(COLLECTIONS.POSTS, {
		vector: embedding,
		limit: filters.limit,
		with_payload: true,
		...(Object.keys(filter).length > 0 && { filter }),
	});
}
