import { tool } from 'ai';
import { z } from 'zod';

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
	required: z.boolean().optional().default(false),
	choices: z
		.array(z.object({ label: z.string() }))
		.optional()
		.describe('Required for multiple_choice, dropdown, and ranking fields'),
	steps: z
		.number()
		.optional()
		.describe('Number of steps for rating/opinion_scale (1-10)'),
});

export type TypeformField = z.infer<typeof TypeformFieldSchema>;

export const TypeformFormDesignSchema = z.object({
	title: z.string().describe('Title of the form'),
	fields: z.array(TypeformFieldSchema),
	welcome_screen: z
		.object({
			title: z.string(),
			description: z.string().optional(),
		})
		.optional(),
	thankyou_screen: z
		.object({
			title: z.string(),
			description: z.string().optional(),
		})
		.optional(),
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

			if (field.steps !== undefined) {
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
 * Vercel AI SDK tool — generates a Typeform form design (does NOT submit to API).
 * The actual API call happens after human approval in the LangGraph flow.
 */
export const designTypeformTool = tool({
	description:
		'Design a Typeform survey or form based on a natural language description. Returns a structured form design for human review before creation.',
	inputSchema: z.object({
		description: z
			.string()
			.describe(
				'Natural language description of the form: its purpose, audience, and what information to collect.'
			),
	}),
	execute: async (_args: { description: string }) => {
		// The actual design generation happens in the LangGraph node (designForm).
		// This tool entry exists so it can be referenced in agent configs if needed.
		return { message: 'Use the createTypeform LangGraph action instead.' };
	},
});
