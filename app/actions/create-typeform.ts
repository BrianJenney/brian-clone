'use server';

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

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------
const llm = new ChatOpenAI({ model: 'gpt-4o' });

// ---------------------------------------------------------------------------
// State schema
// ---------------------------------------------------------------------------
const schema = z.object({
	messages: z.custom<BaseMessage[]>().register(registry, MessagesZodMeta),
	/** Natural language description the user provided */
	formDescription: z.string(),
	/** AI-generated form design, ready for human review */
	formDesign: TypeformFormDesignSchema.optional(),
	/** Human decision: true = approved, false = rejected, undefined = pending */
	approved: z.boolean().optional(),
	/** Optional feedback the human provides when rejecting */
	feedback: z.string().optional(),
	/** Final result after successful creation */
	result: z
		.object({
			id: z.string(),
			url: z.string(),
			editUrl: z.string(),
		})
		.optional(),
	/** Human-readable status for the UI */
	statusMessage: z.string().optional(),
});

type GraphState = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Node: designForm
// Asks the LLM to produce a structured Typeform design from the description.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Node: humanApproval
// Interrupts the graph and surfaces the form design to the human.
// The graph resumes when the caller passes a Command with { approved, feedback }.
// ---------------------------------------------------------------------------
const humanApproval = (state: GraphState): Partial<GraphState> => {
	// interrupt() suspends the graph here.  The value passed to interrupt() is
	// included in the interrupt payload that the caller can inspect.
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

// ---------------------------------------------------------------------------
// Node: reviseForm
// Incorporates human feedback and regenerates the form design.
// ---------------------------------------------------------------------------
const reviseForm = async (
	state: GraphState
): Promise<Partial<GraphState>> => {
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
		approved: undefined, // reset so humanApproval runs again
		feedback: undefined,
		statusMessage: 'Form revised based on your feedback — please review again.',
	};
};

// ---------------------------------------------------------------------------
// Node: createForm
// Calls the Typeform API to publish the approved form.
// ---------------------------------------------------------------------------
const createForm = async (
	state: GraphState
): Promise<Partial<GraphState>> => {
	const formResult = await createTypeformForm(
		state.formDesign as TypeformFormDesign
	);

	return {
		result: formResult,
		statusMessage: `Form created! View it at ${formResult.url}`,
	};
};

// ---------------------------------------------------------------------------
// Conditional routing
// ---------------------------------------------------------------------------
const routeAfterApproval = (
	state: GraphState
): 'createForm' | 'reviseForm' => {
	return state.approved ? 'createForm' : 'reviseForm';
};

// ---------------------------------------------------------------------------
// Graph assembly
// ---------------------------------------------------------------------------
const checkpointer = new MemorySaver();

export const createTypeformGraph = new StateGraph(schema)
	.addNode('designForm', designForm)
	.addNode('humanApproval', humanApproval)
	.addNode('reviseForm', reviseForm)
	.addNode('createForm', createForm)
	.addEdge(START, 'designForm')
	.addEdge('designForm', 'humanApproval')
	.addConditionalEdges('humanApproval', routeAfterApproval)
	.addEdge('reviseForm', 'humanApproval') // loop back until approved
	.addEdge('createForm', END)
	.compile({ checkpointer });

// ---------------------------------------------------------------------------
// Public server actions
// ---------------------------------------------------------------------------

/**
 * Start a new form-creation run.
 * Returns the thread ID (to resume later) and the interrupt payload so the
 * caller can show the form design to the user.
 */
export async function startTypeformCreation(
	formDescription: string,
	threadId: string
): Promise<{
	success: boolean;
	threadId: string;
	interrupted: boolean;
	interruptPayload?: { formDesign: TypeformFormDesign; statusMessage: string };
	error?: string;
}> {
	try {
		const config = { configurable: { thread_id: threadId } };

		const result = await createTypeformGraph.invoke(
			{
				messages: [],
				formDescription,
				formDesign: undefined,
				approved: undefined,
				feedback: undefined,
				result: undefined,
				statusMessage: undefined,
			},
			config
		);

		// Check whether the graph is waiting at an interrupt
		const state = await createTypeformGraph.getState(config);
		const interrupts = state.tasks.flatMap((t) => t.interrupts ?? []);

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

		// Graph ran to completion without interruption (shouldn't happen normally)
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

/**
 * Resume a paused run with the human's decision (approve or reject + feedback).
 */
export async function resumeTypeformCreation(
	threadId: string,
	approved: boolean,
	feedback?: string
): Promise<{
	success: boolean;
	interrupted: boolean;
	interruptPayload?: { formDesign: TypeformFormDesign; statusMessage: string };
	result?: { id: string; url: string; editUrl: string };
	error?: string;
}> {
	try {
		const config = { configurable: { thread_id: threadId } };

		await createTypeformGraph.invoke(
			new Command({ resume: { approved, feedback } }),
			config
		);

		const state = await createTypeformGraph.getState(config);
		const interrupts = state.tasks.flatMap((t) => t.interrupts ?? []);

		// Still interrupted — probably because the human rejected and a revision
		// was made, so we need another review round.
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

		// Completed
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
