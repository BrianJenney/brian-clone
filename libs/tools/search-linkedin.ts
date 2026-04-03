import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryLinkedInPosts } from '@/libs/linkedinQuery';

/**
 * Search LinkedIn Posts Tool
 * Uses natural language to filter by semantic similarity, time range, and likes
 */
export const searchLinkedInPostsTool = tool(
	async ({ query }: { query: string }) => {
		try {
			const results = await queryLinkedInPosts(query);

			if (results.length === 0) {
				return 'No LinkedIn posts found matching your query.';
			}

			const formattedResults = results
				.map((result, index) => {
					const payload = result.payload as Record<string, any>;
					const text = String(payload?.text || '').slice(0, 500);
					const likes = payload?.numReactions ?? 'N/A';
					const date = payload?.createdAt
						? new Date(payload.createdAt).toLocaleDateString()
						: 'N/A';

					return `Post ${index + 1} (Score: ${result.score.toFixed(3)})
Likes: ${likes} | Date: ${date}
${text}${text.length >= 500 ? '...' : ''}`;
				})
				.join('\n\n---\n\n');

			return formattedResults;
		} catch (error) {
			console.error('Error searching LinkedIn posts:', error);
			return `Error searching LinkedIn posts: ${error}`;
		}
	},
	{
		name: 'searchLinkedInPosts',
		description: `Search Brian's LinkedIn posts using natural language. Supports filtering by:
- Topic/content (semantic search)
- Time range ("last month", "in 2024", "recent")
- Engagement ("top performing", "more than 50 likes", "viral")

Examples:
- "posts about React from last month with more than 50 likes"
- "top 5 performing TypeScript posts"
- "recent posts about career advice"`,
		schema: z.object({
			query: z
				.string()
				.describe(
					'Natural language query describing what LinkedIn posts to find'
				),
		}),
	}
);
