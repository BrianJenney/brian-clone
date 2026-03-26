import { z } from 'zod';
import { chatStream, type StreamEvent } from '@/app/actions/generate-content';

/**
 * POST /api/chat
 * Streaming LangGraph chat with reasoning support.
 *
 * Stream format (newline-delimited JSON):
 *   { type: "progress",  node: "...", message: "..." }  — node started
 *   { type: "reasoning", content: "..." }               — model reasoning/thinking
 *   { type: "text",      content: "..." }               — response token
 *   { type: "interrupt", payload: {...} }               — typeform approval needed
 *   { type: "error",     message: "..." }               — error
 *   { type: "done" }                                    — stream complete
 */
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const parsedBody = z
			.object({
				messages: z.array(
					z.object({
						role: z.enum(['user', 'assistant', 'system']),
						content: z.string(),
					}),
				),
				threadId: z.string().optional(),
			})
			.parse(body);

		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				try {
					for await (const event of chatStream(
						parsedBody.messages,
						parsedBody.threadId,
					)) {
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
