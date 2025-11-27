import { graph as contentGenerationGraph } from '@/libs/content-generation';
import { HumanMessage } from '@langchain/core/messages';

/**
 * POST /api/generate-content
 * Generates 3 posts using LangGraph workflow
 *
 * This endpoint:
 * 1. Analyzes the user message to determine content type
 * 2. Fetches templates, writing samples, and business context in parallel
 * 3. Generates 3 unique posts based on the gathered context
 */
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { message } = body;

		if (!message) {
			return Response.json(
				{ error: 'Message is required' },
				{ status: 400 }
			);
		}

		console.log('Generating content for message:', message);

		const result = await contentGenerationGraph.invoke({
			messages: [new HumanMessage(message)],
		});

		return Response.json(result);
	} catch (error) {
		console.error('Generate content API error:', error);
		return Response.json(
			{
				success: false,
				error: 'Failed to generate content',
				message:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
