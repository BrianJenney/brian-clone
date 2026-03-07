import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { chatAgent } from '@/app/actions/chat-graph';
import { getToolDisplayName } from '@/libs/tools/config';
import { getLangSmithConfig } from '@/libs/langsmith';

/**
 * POST /api/chat
 * LangGraph ReAct agent with streaming tool-use events.
 *
 * Stream format (newline-delimited JSON):
 *   { type: "progress", message: "tool display name" }   — tool started
 *   { type: "text",     content: "token..."           }   — LLM token
 *   { type: "error",    message: "..."                }   — error
 */
export async function POST(req: Request) {
	const encoder = new TextEncoder();

	try {
		const body = await req.json();
		const { messages } = body as {
			messages: { role: 'user' | 'assistant'; content: string }[];
		};

		// The system prompt is managed by the agent via `prompt` — only pass conversation messages
		const lgMessages = messages.map((m) =>
			m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
		);

		const stream = new ReadableStream({
			async start(controller) {
				const enqueue = (obj: object) =>
					controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

				try {
					const lastUserMessage = messages.findLast((m) => m.role === 'user')?.content;
					const eventStream = chatAgent.streamEvents(
						{ messages: lgMessages },
						{
							version: 'v2',
							...getLangSmithConfig('chat', { userMessage: lastUserMessage }),
						},
					);

					for await (const event of eventStream) {
						// Stream LLM tokens — restrict to the `agent` node so we don't
						// accidentally emit tool-call generation chunks (those have no text content)
						if (
							event.event === 'on_chat_model_stream' &&
							event.metadata?.langgraph_node === 'agent'
						) {
							const chunk = event.data?.chunk;
							const content =
								typeof chunk?.content === 'string' ? chunk.content : '';
							if (content) {
								enqueue({ type: 'text', content });
							}
						}

						// Show tool progress indicator when a tool starts
						if (event.event === 'on_tool_start') {
							enqueue({
								type: 'progress',
								message: getToolDisplayName(event.name ?? ''),
							});
						}
					}
				} catch (error) {
					console.error('LangGraph stream error:', error);
					enqueue({
						type: 'error',
						message: error instanceof Error ? error.message : 'Unknown error',
					});
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (error) {
		console.error('Error in chat API:', error);
		return new Response('Internal server error', { status: 500 });
	}
}
