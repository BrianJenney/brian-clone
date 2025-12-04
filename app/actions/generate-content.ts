'use server';

import { graph as contentGenerationGraph } from '@/libs/content-generation';

/**
 * Server action for generating content using LangGraph workflow
 *
 * This action:
 * 1. Analyzes the user message to determine content type
 * 2. Fetches templates, writing samples, and business context in parallel
 * 3. Generates 3 unique posts based on the gathered context
 */
export async function generateContent(
	messages: {
		role: string;
		content: string;
	}[]
) {
	try {
		if (!messages) {
			return {
				success: false,
				error: 'Messages are required',
			};
		}

		const result = await contentGenerationGraph.invoke({
			messages,
		});

		return {
			success: true,
			...result,
		};
	} catch (error) {
		console.error('Generate content error:', error);
		return {
			success: false,
			error: 'Failed to generate content',
			message: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
