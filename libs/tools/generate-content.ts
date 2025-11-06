import { tool } from 'ai';
import { GenerateContentToolSchema, ContentType } from '@/libs/schemas';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding, generateCompletion } from '@/libs/openai';
import { getCollectionName } from '@/libs/utils';

/**
 * Generate content tool
 * Generates new content (transcript, article, or post) in Brian's style based on existing examples
 */
export const generateContentTool = tool({
	description:
		"Generate new content (transcript, article, or post) in Brian's style based on existing examples",
	inputSchema: GenerateContentToolSchema,
	execute: async (args: {
		contentType: ContentType;
		topic: string;
		style?: string;
		maxLength?: number;
	}) => {
		const { contentType, topic, style, maxLength = 1000 } = args;
		try {
			const queryEmbedding = await generateEmbedding(
				`${topic} ${contentType}`
			);
			const collectionName = getCollectionName(contentType);

			let styleExamples = '';
			try {
				const examples = await qdrantClient.search(collectionName, {
					vector: queryEmbedding,
					limit: 3,
					with_payload: true,
				});

				styleExamples = examples
					.map((ex) => ex.payload?.text)
					.filter(Boolean)
					.join('\n\n---\n\n');
			} catch (error) {
				console.warn('No existing examples found for style reference');
			}

			const systemMessage = `You are writing as Brian. Generate a ${contentType} about "${topic}".
${style ? `Style notes: ${style}` : ''}
${
	styleExamples
		? `Here are some examples of Brian's writing style:\n\n${styleExamples}`
		: ''
}

Match Brian's voice, tone, and style. Keep it under ${maxLength} words.`;

			const generatedText = await generateCompletion(
				`Write a ${contentType} about: ${topic}`,
				systemMessage
			);

			return {
				generatedText,
				contentType,
				topic,
				wordCount: generatedText.split(/\s+/).length,
			};
		} catch (error) {
			return {
				error: 'Failed to generate content',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			};
		}
	},
});
