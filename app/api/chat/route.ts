import { z } from 'zod';
import { chatStream, type StreamEvent } from '@/app/actions/chat';

/**
 * POST /api/chat
 * Streaming chat with native Claude tool-calling.
 *
 * Stream format (newline-delimited JSON):
 *   { type: "progress",    message: "..." }        — tool being used
 *   { type: "tool_use",    name: "...", input: {} } — tool invocation
 *   { type: "tool_result", name: "...", result: "..." } — tool result
 *   { type: "text",        content: "..." }        — response token
 *   { type: "error",       message: "..." }        — error
 *   { type: "done" }                               — stream complete
 */
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const parsedBody = z
			.object({
				messages: z.array(
					z.object({
						role: z.enum(['user', 'assistant']),
						content: z.string(),
					}),
				),
			})
			.parse(body);

		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				try {
					for await (const event of chatStream(parsedBody.messages)) {
						controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
					}
				} catch (error) {
					const errorEvent: StreamEvent = {
						type: 'error',
						message: error instanceof Error ? error.message : 'Unknown error',
					};
					controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/x-ndjson; charset=utf-8',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return new Response(`${JSON.stringify({ type: 'error', message })}\n`, {
			status: 400,
			headers: {
				'Content-Type': 'application/x-ndjson; charset=utf-8',
			},
		});
	}
}
