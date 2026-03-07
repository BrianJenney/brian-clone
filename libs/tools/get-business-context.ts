import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

const GetBusinessContextSchema = z.object({
	contextType: z
		.enum(['persona', 'business_overview', 'podcast_performance', 'all'])
		.describe(
			'Type of business context to retrieve: persona (target audience personas like Marcus), business_overview (mission, value prop, content strategy), podcast_performance (episode performance metrics and downloads), or all',
		),
	specificPersona: z
		.string()
		.optional()
		.describe('Optional: specific persona name to retrieve (e.g., "marcus-persona")'),
});

/**
 * Get Business Context Tool
 * Retrieves business strategy, target audience personas, value propositions, and podcast performance metrics
 */
export const getBusinessContextTool = tool(
	async (args: {
		contextType: 'persona' | 'business_overview' | 'podcast_performance' | 'all';
		specificPersona?: string;
	}) => {
		const { contextType, specificPersona } = args;

		try {
			const contextDir = path.join(process.cwd(), 'data', 'context');

			if (contextType === 'persona' || contextType === 'all') {
				const personaFile = specificPersona ? `${specificPersona}.json` : 'marcus-persona.json';
				const personaPath = path.join(contextDir, personaFile);

				try {
					const personaData = await fs.readFile(personaPath, 'utf-8');
					const persona = JSON.parse(personaData);

					if (contextType === 'persona') {
						return JSON.stringify(persona, null, 2);
					}

					const overviewPath = path.join(contextDir, 'business-overview.json');
					const overviewData = await fs.readFile(overviewPath, 'utf-8');
					const overview = JSON.parse(overviewData);

					const podcastPath = path.join(contextDir, 'podcast-performance.json');
					const podcastData = await fs.readFile(podcastPath, 'utf-8');
					const podcastPerformance = JSON.parse(podcastData);

					return JSON.stringify({ persona, business_overview: overview, podcast_performance: podcastPerformance }, null, 2);
				} catch (error) {
					console.error('Error reading persona:', error);
					return `Error: Could not find persona "${personaFile}".`;
				}
			}

			if (contextType === 'business_overview') {
				const overviewPath = path.join(contextDir, 'business-overview.json');
				const overviewData = await fs.readFile(overviewPath, 'utf-8');
				return JSON.stringify(JSON.parse(overviewData), null, 2);
			}

			if (contextType === 'podcast_performance') {
				const podcastPath = path.join(contextDir, 'podcast-performance.json');
				const podcastData = await fs.readFile(podcastPath, 'utf-8');
				return JSON.stringify(JSON.parse(podcastData), null, 2);
			}

			return 'Invalid context type requested';
		} catch (error) {
			console.error('Error in getBusinessContextTool:', error);
			return 'Error retrieving business context.';
		}
	},
	{
		name: 'getBusinessContextTool',
		description:
			'Retrieve business context including target audience personas (like Marcus), business mission, value proposition, content strategy, and podcast performance metrics. Use this when providing business advice, analyzing content strategy, understanding the target audience, or analyzing podcast performance. Also retrieve calendly links for meetings.',
		schema: GetBusinessContextSchema,
	},
);
