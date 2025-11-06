import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

const GetBusinessContextSchema = z.object({
	contextType: z
		.enum(['persona', 'business_overview', 'all'])
		.describe(
			'Type of business context to retrieve: persona (target audience personas like Marcus), business_overview (mission, value prop, content strategy), or all'
		),
	specificPersona: z
		.string()
		.optional()
		.describe(
			'Optional: specific persona name to retrieve (e.g., "marcus-persona")'
		),
});

/**
 * Get Business Context Tool
 * Retrieves business strategy, target audience personas, value propositions, and content guidelines
 * Use this when giving business advice, content strategy, or audience analysis
 */
export const getBusinessContextTool = tool({
	description:
		"Retrieve business context including target audience personas (like Marcus), business mission, value proposition, and content strategy. Use this when providing business advice, analyzing content strategy, or understanding the target audience.",
	inputSchema: GetBusinessContextSchema,
	execute: async (args: {
		contextType: 'persona' | 'business_overview' | 'all';
		specificPersona?: string;
	}) => {
		const { contextType, specificPersona } = args;

		try {
			const contextDir = path.join(
				process.cwd(),
				'data',
				'context'
			);

			if (contextType === 'persona' || contextType === 'all') {
				const personaFile = specificPersona
					? `${specificPersona}.json`
					: 'marcus-persona.json';
				const personaPath = path.join(contextDir, personaFile);

				try {
					const personaData = await fs.readFile(
						personaPath,
						'utf-8'
					);
					const persona = JSON.parse(personaData);

					if (contextType === 'persona') {
						return JSON.stringify(persona, null, 2);
					}

					// If 'all', continue to get business overview too
					if (contextType === 'all') {
						const overviewPath = path.join(
							contextDir,
							'business-overview.json'
						);
						const overviewData = await fs.readFile(
							overviewPath,
							'utf-8'
						);
						const overview = JSON.parse(overviewData);

						return JSON.stringify(
							{
								persona,
								business_overview: overview,
							},
							null,
							2
						);
					}
				} catch (error) {
					console.error('Error reading persona:', error);
					return `Error: Could not find persona "${personaFile}". Available personas should be in data/context/ directory.`;
				}
			}

			if (contextType === 'business_overview') {
				const overviewPath = path.join(
					contextDir,
					'business-overview.json'
				);
				const overviewData = await fs.readFile(
					overviewPath,
					'utf-8'
				);
				const overview = JSON.parse(overviewData);
				return JSON.stringify(overview, null, 2);
			}

			return 'Invalid context type requested';
		} catch (error) {
			console.error('Error in getBusinessContextTool:', error);
			return 'Error retrieving business context. Please check that context files exist in data/context/';
		}
	},
});
