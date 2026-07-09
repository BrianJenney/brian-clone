import OpenAI from 'openai';
import { wrapOpenAI } from 'langsmith/wrappers';

if (!process.env.OPENAI_API_KEY) {
	throw new Error('OPENAI_API_KEY is not defined in environment variables');
}

// Configure OpenAI client. When LANGSMITH_TRACING=true, wrapOpenAI records
// every call as a LangSmith run; otherwise it is a transparent passthrough.
export const openai = wrapOpenAI(
	new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	}),
);

// Helper function to generate embeddings with 512 dimensions
export async function generateEmbedding(text: string): Promise<number[]> {
	try {
		const response = await openai.embeddings.create({
			model: 'text-embedding-3-small',
			input: text,
			dimensions: 512,
		});

		return response.data[0].embedding;
	} catch (error) {
		console.error('Error generating embedding:', error);
		throw error;
	}
}
