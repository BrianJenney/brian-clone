import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Get Business Context Tool
 * Retrieves all business strategy data and podcast performance metrics
 */
export const getBusinessContextTool = tool(
	async () => {
		try {
			const contextDir = path.join(process.cwd(), 'data', 'context');

			const [overviewData, podcastData] = await Promise.all([
				fs.readFile(path.join(contextDir, 'business-overview.json'), 'utf-8'),
				fs.readFile(path.join(contextDir, 'podcast-performance.json'), 'utf-8'),
			]);

			return JSON.stringify(
				{
					business_overview: JSON.parse(overviewData),
					podcast_performance: JSON.parse(podcastData),
				},
				null,
				2,
			);
		} catch (error) {
			console.error('Error in getBusinessContextTool:', error);
			return 'Error retrieving business context.';
		}
	},
	{
		name: 'getBusinessContextTool',
		description:
			'Retrieve business context including business mission, value proposition, content strategy, and podcast performance metrics. Use this when providing business advice, analyzing content strategy, or analyzing podcast performance.',
		schema: z.object({}),
	},
);
