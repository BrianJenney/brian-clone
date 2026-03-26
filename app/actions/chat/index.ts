import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { getLangSmithConfig } from '@/libs/langsmith';

import { createTypeformGraph } from '../create-typeform';
import type { TypeformFormDesign } from '@/libs/tools/typeform';

import { chatGraph } from './graph';
import { chatStream } from './stream';
import type { StreamEvent } from './types';

// Re-export types and streaming (non-server-action)
export type { StreamEvent, GraphState } from './types';
export { chatStream };

/**
 * Non-streaming chat (server action)
 */
export async function chat(
	messages: { role: string; content: string }[],
	threadId?: string,
): Promise<{
	success: boolean;
	response?: string;
	interrupted?: boolean;
	interruptPayload?: {
		type: string;
		threadId: string;
		formDesign: TypeformFormDesign;
		message: string;
	};
	error?: string;
}> {
	try {
		const lgMessages = messages.map((m) =>
			m.role === 'user'
				? new HumanMessage(m.content)
				: new SystemMessage(m.content),
		);

		const config = {
			configurable: { thread_id: threadId ?? `chat-${Date.now()}` },
			...getLangSmithConfig('chat', {
				messageCount: messages.length,
				lastMessage: messages.at(-1)?.content,
			}),
		};

		const result = await chatGraph.invoke({ messages: lgMessages }, config);

		if (result.typeformState?.interrupted) {
			const payload = JSON.parse(result.finalResponse ?? '{}');
			return {
				success: true,
				interrupted: true,
				interruptPayload: payload,
			};
		}

		return {
			success: true,
			response: result.finalResponse,
		};
	} catch (error) {
		console.error('Chat error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

export async function resumeTypeformInChat(
	typeformThreadId: string,
	approved: boolean,
	feedback?: string,
): Promise<{
	success: boolean;
	response?: string;
	interrupted?: boolean;
	interruptPayload?: {
		type: string;
		threadId: string;
		formDesign: TypeformFormDesign;
		message: string;
	};
	error?: string;
}> {
	try {
		const checkpointConfig = {
			configurable: { thread_id: typeformThreadId },
		};

		await createTypeformGraph.invoke(
			new Command({ resume: { approved, feedback } }),
			{
				...checkpointConfig,
				...getLangSmithConfig('typeform-resume', {
					typeformThreadId,
					approved,
				}),
			},
		);

		const graphState = await createTypeformGraph.getState(checkpointConfig);
		const interrupts = graphState.tasks.flatMap(
			(t: { interrupts?: unknown[] }) => t.interrupts ?? [],
		);

		if (interrupts.length > 0) {
			const payload = interrupts[0].value as {
				formDesign: TypeformFormDesign;
				statusMessage: string;
			};
			return {
				success: true,
				interrupted: true,
				interruptPayload: {
					type: 'typeform_approval',
					threadId: typeformThreadId,
					formDesign: payload.formDesign,
					message: payload.statusMessage,
				},
			};
		}

		const finalState = graphState.values as {
			result?: { id: string; url: string; editUrl: string };
		};
		if (finalState.result) {
			return {
				success: true,
				response: `Form created successfully!\n\nView form: ${finalState.result.url}\nEdit form: ${finalState.result.editUrl}`,
			};
		}

		return {
			success: true,
			response: 'Form creation completed.',
		};
	} catch (error) {
		console.error('Resume typeform error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
