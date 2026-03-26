import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { getLangSmithConfig } from '@/libs/langsmith';

import { chatGraph } from './graph';
import { NODE_DISPLAY_NAMES, type StreamEvent } from './types';

/**
 * Streaming chat with LangGraph events
 */
export async function* chatStream(
	messages: { role: string; content: string }[],
	threadId?: string,
): AsyncGenerator<StreamEvent> {
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

		let isInterrupted = false;
		let interruptPayload: any = null;
		let currentNode = '';

		for await (const event of chatGraph.streamEvents(
			{ messages: lgMessages },
			{ ...config, version: 'v2' },
		)) {
			// Track current node
			if (event.event === 'on_chain_start' && event.name && NODE_DISPLAY_NAMES[event.name]) {
				currentNode = event.name;
				yield { type: 'progress', node: event.name, message: NODE_DISPLAY_NAMES[event.name] };
			}

			// Only stream LLM tokens from generateResponse node
			if (
				event.event === 'on_chat_model_stream' &&
				event.data?.chunk &&
				currentNode === 'generateResponse'
			) {
				const chunk = event.data.chunk;

				// Check for reasoning/thinking content (extended thinking models)
				if (chunk.additional_kwargs?.reasoning_content) {
					yield { type: 'reasoning', content: chunk.additional_kwargs.reasoning_content };
				}

				// Regular content
				if (chunk.content && typeof chunk.content === 'string') {
					yield { type: 'text', content: chunk.content };
				}
			}

			// Chain end - check for typeform interrupts
			if (event.event === 'on_chain_end' && event.name === 'handleTypeform') {
				const output = event.data?.output;
				if (output?.typeformState?.interrupted) {
					isInterrupted = true;
					interruptPayload = {
						type: 'typeform_approval',
						threadId: output.typeformState.threadId,
						formDesign: output.typeformState.formDesign,
						message: 'Please review the form design below and approve or request changes.',
					};
				}
			}

			// Chain end - check for interrupts in generateResponse
			if (event.event === 'on_chain_end' && event.name === 'generateResponse') {
				const output = event.data?.output;
				if (output?.finalResponse) {
					try {
						const parsed = JSON.parse(output.finalResponse);
						if (parsed.type === 'typeform_approval') {
							isInterrupted = true;
							interruptPayload = parsed;
						}
					} catch {
						// Not JSON, regular response
					}
				}
			}
		}

		if (isInterrupted && interruptPayload) {
			yield { type: 'interrupt', payload: interruptPayload };
		}

		yield { type: 'done' };
	} catch (error) {
		console.error('Chat stream error:', error);
		yield { type: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
	}
}
