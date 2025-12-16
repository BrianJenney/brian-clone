import { tool } from 'ai';
import { SearchResourcesToolSchema } from '@/libs/schemas';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

const llm = new ChatOpenAI({ model: 'gpt-5' });

/**
 * Search Learning Resources Tool
 * Searches through Brian's curated learning resources (courses, guides, templates)
 * Use this when users ask about learning paths, resources, tutorials, or need guidance on specific topics
 */
export const searchResourcesTool = tool({
	description:
		"Search through Brian's curated learning resources including courses, guides, templates, and tutorials. Use this when users ask for learning materials, career guidance, project templates, or recommendations on how to learn specific topics (AI, backend, frontend, databases, cloud, etc.).",
	inputSchema: SearchResourcesToolSchema,
	execute: async (args: { query: string; category?: string }) => {
		const { query, category } = args;

		try {
			const resourcesPath = path.join(
				process.cwd(),
				'data',
				'resources',
				'learning-resources.json'
			);
			const resourcesData = await fs.readFile(resourcesPath, 'utf-8');
			const allResources = JSON.parse(resourcesData);

			// Filter by category if provided
			let filteredResources = allResources;
			if (category) {
				filteredResources = allResources.filter(
					(r: any) => r.category === category
				);
			}

			if (filteredResources.length === 0) {
				return 'No resources found for that category.';
			}

			// Use LLM to rank and find most relevant resources
			const SYSTEM_PROMPT = `
			Given a user query and a list of learning resources, identify the most relevant resources.

			User query: ${query}

			Available resources:
			${JSON.stringify(filteredResources, null, 2)}

			Return the titles of the top 3 most relevant resources (or fewer if less than 3 are relevant).
			If none are relevant, return an empty array.
			`;

			const result = await llm
				.withStructuredOutput(
					z.object({ resourceTitles: z.array(z.string()) })
				)
				.invoke([new SystemMessage(SYSTEM_PROMPT)]);

			// Get the full resource objects for the selected titles
			const relevantResources = filteredResources.filter(
				(resource: any) =>
					result.resourceTitles.includes(resource.title)
			);

			if (relevantResources.length === 0) {
				return 'No relevant resources found for your query. Try rephrasing or asking about a different topic.';
			}

			// Format results
			const formattedResults = relevantResources
				.map((resource: any, index: number) => {
					return `${index + 1}. **${resource.title}** (${
						resource.category
					})
   ${resource.description}
   Link: ${resource.url}`;
				})
				.join('\n\n');

			return `Here are the most relevant learning resources:\n\n${formattedResults}`;
		} catch (error) {
			console.error('Error searching resources:', error);
			return 'Error searching learning resources. Please try again.';
		}
	},
});
