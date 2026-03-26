import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import {
	StateGraph,
	MessagesZodMeta,
	START,
	END,
	interrupt,
	Command,
	MemorySaver,
} from '@langchain/langgraph';
import { registry } from '@langchain/langgraph/zod';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod/v4';
import {
	TypeformFormDesignSchema,
	type TypeformFormDesign,
	createTypeformForm,
} from '@/libs/tools/typeform';
import { getLangSmithConfig } from '@/libs/langsmith';

const llm = new ChatOpenAI({ model: 'gpt-4o' });

const schema = z.object({
	messages: z.custom<BaseMessage[]>().register(registry, MessagesZodMeta),

	formDescription: z.string(),

	formDesign: TypeformFormDesignSchema.optional(),

	approved: z.boolean().optional(),

	feedback: z.string().optional(),

	result: z
		.object({
			id: z.string(),
			url: z.string(),
			editUrl: z.string(),
		})
		.optional(),

	statusMessage: z.string().optional(),
});

type GraphState = z.infer<typeof schema>;

const designForm = async (state: GraphState): Promise<Partial<GraphState>> => {
	const SYSTEM_PROMPT = `
You are an expert survey designer. Given a description of what the user wants,
design a Typeform survey with clear, concise questions.

Guidelines:
- Use short_text for open-ended short answers
- Use multiple_choice when there are discrete options
- Use rating (1–5 stars) or opinion_scale for satisfaction / intensity
- Use yes_no for binary questions
- Use email / number fields only when explicitly needed
- Include a friendly welcome_screen and thankyou_screen
- Keep the form focused: 4–8 questions unless the description clearly needs more
- Make ref values snake_case and descriptive (e.g. "current_role", "biggest_challenge")

Form description:
${state.formDescription}
`;

	const result = await llm
		.withStructuredOutput(TypeformFormDesignSchema)
		.invoke([new SystemMessage(SYSTEM_PROMPT)]);

	return {
		formDesign: result as TypeformFormDesign,
		statusMessage: 'Form design generated — awaiting your approval.',
	};
};

const humanApproval = (state: GraphState): Partial<GraphState> => {
	const decision = interrupt<
		{ formDesign: TypeformFormDesign; statusMessage: string },
		{ approved: boolean; feedback?: string }
	>({
		formDesign: state.formDesign as TypeformFormDesign,
		statusMessage: state.statusMessage ?? 'Please review the form design.',
	});

	return {
		approved: decision.approved,
		feedback: decision.feedback,
	};
};

const reviseForm = async (state: GraphState): Promise<Partial<GraphState>> => {
	const SYSTEM_PROMPT = `
You are an expert survey designer. The human rejected the previous form design
and provided feedback. Revise the design accordingly.

Original form description:
${state.formDescription}

Previous form design:
${JSON.stringify(state.formDesign, null, 2)}

Human feedback:
${state.feedback ?? 'No specific feedback provided.'}

Produce an improved form design that addresses the feedback.
`;

	const result = await llm
		.withStructuredOutput(TypeformFormDesignSchema)
		.invoke([new SystemMessage(SYSTEM_PROMPT)]);

	return {
		formDesign: result as TypeformFormDesign,
		approved: undefined,
		feedback: undefined,
		statusMessage:
			'Form revised based on your feedback — please review again.',
	};
};

const createForm = async (state: GraphState): Promise<Partial<GraphState>> => {
	const formResult = await createTypeformForm(
		state.formDesign as TypeformFormDesign,
	);

	return {
		result: formResult,
		statusMessage: `Form created! View it at ${formResult.url}`,
	};
};

const routeAfterApproval = (state: GraphState): 'createForm' | 'reviseForm' => {
	return state.approved ? 'createForm' : 'reviseForm';
};

const checkpointer = new MemorySaver();

export const createTypeformGraph = (new StateGraph(schema as any) as any)
	.addNode('designForm', designForm)
	.addNode('humanApproval', humanApproval)
	.addNode('reviseForm', reviseForm)
	.addNode('createForm', createForm)
	.addEdge(START, 'designForm')
	.addEdge('designForm', 'humanApproval')
	.addConditionalEdges('humanApproval', routeAfterApproval)
	.addEdge('reviseForm', 'humanApproval')
	.addEdge('createForm', END)
	.compile({ checkpointer });

export async function startTypeformCreation(
	formDescription: string,
	threadId: string,
): Promise<{
	success: boolean;
	threadId: string;
	interrupted: boolean;
	interruptPayload?: {
		formDesign: TypeformFormDesign;
		statusMessage: string;
	};
	error?: string;
}> {
	try {
		const checkpointConfig = { configurable: { thread_id: threadId } };

		await createTypeformGraph.invoke(
			{
				messages: [],
				formDescription,
				formDesign: undefined,
				approved: undefined,
				feedback: undefined,
				result: undefined,
				statusMessage: undefined,
			},
			{
				...checkpointConfig,
				...getLangSmithConfig('typeform-start', {
					formDescription,
					threadId,
				}),
			},
		);

		const state = await createTypeformGraph.getState(checkpointConfig);
		const interrupts = state.tasks.flatMap(
			(t: { interrupts?: unknown[] }) => t.interrupts ?? [],
		);

		if (interrupts.length > 0) {
			return {
				success: true,
				threadId,
				interrupted: true,
				interruptPayload: interrupts[0].value as {
					formDesign: TypeformFormDesign;
					statusMessage: string;
				},
			};
		}

		return {
			success: true,
			threadId,
			interrupted: false,
		};
	} catch (error) {
		console.error('startTypeformCreation error:', error);
		return {
			success: false,
			threadId,
			interrupted: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

export async function resumeTypeformCreation(
	threadId: string,
	approved: boolean,
	feedback?: string,
): Promise<{
	success: boolean;
	interrupted: boolean;
	interruptPayload?: {
		formDesign: TypeformFormDesign;
		statusMessage: string;
	};
	result?: { id: string; url: string; editUrl: string };
	error?: string;
}> {
	try {
		const checkpointConfig = { configurable: { thread_id: threadId } };

		await createTypeformGraph.invoke(
			new Command({ resume: { approved, feedback } }),
			{
				...checkpointConfig,
				...getLangSmithConfig('typeform-resume', {
					threadId,
					approved,
				}),
			},
		);

		const state = await createTypeformGraph.getState(checkpointConfig);
		const interrupts = state.tasks.flatMap(
			(t: { interrupts?: unknown[] }) => t.interrupts ?? [],
		);

		if (interrupts.length > 0) {
			return {
				success: true,
				interrupted: true,
				interruptPayload: interrupts[0].value as {
					formDesign: TypeformFormDesign;
					statusMessage: string;
				},
			};
		}

		const finalState = state.values as GraphState;
		return {
			success: true,
			interrupted: false,
			result: finalState.result,
		};
	} catch (error) {
		console.error('resumeTypeformCreation error:', error);
		return {
			success: false,
			interrupted: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
