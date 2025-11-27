import { tool } from 'ai';
import { FetchTemplatesToolSchema } from '@/libs/schemas';
import { airtableClient } from '@/libs/airtable';

/**
 * Fetch Templates Tool
 * Fetches content templates from Airtable
 * Use this to retrieve post templates that can be matched with writing samples
 */
export const fetchTemplatesTool = tool({
	description:
		'Fetch content templates from Airtable. These templates can be used to create engaging posts based on writing style.',
	inputSchema: FetchTemplatesToolSchema,
	execute: async (args: { filterFormula?: string; limit?: number }) => {
		const { filterFormula, limit } = args;

		try {
			const tableName =
				process.env.AIRTABLE_TABLE_NAME || 'Content Templates';

			let templates;

			if (filterFormula) {
				templates = await airtableClient.fetchFilteredRecords(
					tableName,
					filterFormula
				);
			} else {
				templates = await airtableClient.fetchRecords(tableName);
			}

			if (limit && templates.length > limit) {
				templates = templates.slice(0, limit);
			}

			if (templates.length === 0) {
				return 'No templates found in Airtable. Check your table name and filter formula.';
			}

			const formattedTemplates = templates
				.map((template, index) => {
					const fields = template.fields;
					return `Template ${index + 1} (ID: ${template.id}):
${JSON.stringify(fields, null, 2)}`;
				})
				.join('\n\n---\n\n');

			return `Found ${templates.length} template(s):\n\n${formattedTemplates}`;
		} catch (error) {
			console.error('Error fetching templates:', error);
			return `Error fetching templates from Airtable: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`;
		}
	},
});
