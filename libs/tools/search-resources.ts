import { tool } from '@langchain/core/tools';
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
 */
export const searchResourcesTool = tool(
	async (args: { query: string; category?: string }) => {
		const { query, category } = args;

		try {
			const resourcesPath = path.join(process.cwd(), 'data', 'resources', 'learning-resources.json');
			const resourcesData = await fs.readFile(resourcesPath, 'utf-8');
			const allResources = JSON.parse(resourcesData);

			const filteredResources = category ? allResources.filter((r: any) => r.category === category) : allResources;

			const SYSTEM_PROMPT = `
Given a user query and a list of learning resources, identify the most relevant resources.

User query: ${query}

Available resources:
${JSON.stringify(filteredResources, null, 2)}

Return the titles of the top 3 most relevant resources (or fewer if less than 3 are relevant).
If none are relevant, return an empty array.
`;

			const result = await llm
				.withStructuredOutput(z.object({ resourceTitles: z.array(z.string()) }))
				.invoke([new SystemMessage(SYSTEM_PROMPT)]);

			const relevantResources = filteredResources.filter((resource: any) =>
				result.resourceTitles.includes(resource.title),
			);

			if (relevantResources.length === 0) {
				return 'No relevant resources found for your query.';
			}

			const formattedResults = relevantResources
				.map(
					(resource: any, index: number) =>
						`${index + 1}. **${resource.title}** (${resource.category})\n   ${resource.description}\n   Link: ${resource.url}`,
				)
				.join('\n\n');

			return `Here are the most relevant learning resources:\n\n${formattedResults}`;
		} catch (error) {
			console.error('Error searching resources:', error);
			return 'Error searching learning resources. Please try again.';
		}
	},
	{
		name: 'searchResourcesTool',
		description:
			"Search through Brian's curated learning resources including courses, guides, templates, and tutorials. Use this when users ask for learning materials, career guidance, project templates, or recommendations on how to learn specific topics.",
		schema: SearchResourcesToolSchema,
	},
);
