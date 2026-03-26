import { tool } from '@langchain/core/tools';
import { z } from 'zod/v4';

const TYPEFORM_API_BASE = 'https://api.typeform.com';

export const TypeformFieldSchema = z.object({
	type: z.enum([
		'short_text',
		'long_text',
		'multiple_choice',
		'rating',
		'opinion_scale',
		'yes_no',
		'email',
		'number',
		'date',
		'dropdown',
		'ranking',
	]),
	title: z.string().describe('The question/prompt shown to the respondent'),
	ref: z.string().describe('A unique identifier for the field (snake_case)'),
	required: z.boolean().default(false),
	choices: z
		.array(z.object({ label: z.string() }))
		.nullable()
		.default(null)
		.describe('Required for multiple_choice, dropdown, and ranking fields'),
	steps: z
		.number()
		.nullable()
		.default(null)
		.describe('Number of steps for rating/opinion_scale (1-10)'),
});

export type TypeformField = z.infer<typeof TypeformFieldSchema>;

export const TypeformFormDesignSchema = z.object({
	title: z.string().describe('Title of the form'),
	fields: z.array(TypeformFieldSchema),
	welcome_screen: z
		.object({
			title: z.string(),
			description: z.string().nullable().default(null),
		})
		.nullable()
		.default(null),
	thankyou_screen: z
		.object({
			title: z.string(),
			description: z.string().nullable().default(null),
		})
		.nullable()
		.default(null),
});

export type TypeformFormDesign = z.infer<typeof TypeformFormDesignSchema>;

/**
 * Calls the Typeform API to create a form.
 * Returns the form URL and ID on success.
 */
export async function createTypeformForm(
	design: TypeformFormDesign
): Promise<{ id: string; url: string; editUrl: string }> {
	const apiKey = process.env.TYPEFORM_API_KEY;
	if (!apiKey) {
		throw new Error('TYPEFORM_API_KEY environment variable is not set');
	}

	const payload = {
		title: design.title,
		fields: design.fields.map((field) => {
			const base: Record<string, unknown> = {
				type: field.type,
				title: field.title,
				ref: field.ref,
				validations: { required: field.required ?? false },
			};

			if (field.choices) {
				base.properties = { choices: field.choices };
			}

			if (typeof field.steps === 'number') {
				base.properties = { ...(base.properties as object), steps: field.steps };
			}

			return base;
		}),
		...(design.welcome_screen && {
			welcome_screens: [
				{
					title: design.welcome_screen.title,
					properties: {
						description: design.welcome_screen.description ?? '',
						show_button: true,
						button_text: 'Start',
					},
				},
			],
		}),
		...(design.thankyou_screen && {
			thankyou_screens: [
				{
					title: design.thankyou_screen.title,
					properties: {
						description: design.thankyou_screen.description ?? '',
						show_button: false,
					},
				},
			],
		}),
	};

	const response = await fetch(`${TYPEFORM_API_BASE}/forms`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(
			`Typeform API error (${response.status}): ${error}`
		);
	}

	const data = await response.json();
	return {
		id: data.id,
		url: data._links?.display ?? `https://form.typeform.com/to/${data.id}`,
		editUrl: `https://admin.typeform.com/form/${data.id}/create`,
	};
}

/**
 * LangChain tool — signals intent to create a Typeform.
 * Returns the description and flags for human-in-the-loop approval.
 * The actual form design and API call happen in the LangGraph subgraph.
 */
export const createTypeformTool = tool(
	async (args: { description: string }) => {
		return {
			description: args.description,
			requiresApproval: true,
			message: 'Form creation requires human approval. Initiating design workflow.',
		};
	},
	{
		name: 'createTypeformTool',
		description:
			'Design and create a Typeform survey or form based on a description. This triggers a human-in-the-loop workflow where the user can review and approve the form design before creation.',
		schema: z.object({
			description: z
				.string()
				.describe(
					'Natural language description of the form: its purpose, audience, and what information to collect.'
				),
		}),
	}
);
