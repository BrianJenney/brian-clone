import OpenAI from 'openai';
import { Helicone } from '@helicone/helicone';

if (!process.env.OPENAI_API_KEY) {
	throw new Error('OPENAI_API_KEY is not defined in environment variables');
}

if (!process.env.HELICONE_API_KEY) {
	throw new Error('HELICONE_API_KEY is not defined in environment variables');
}

// Configure OpenAI client with Helicone for caching and monitoring
export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: 'https://oai.helicone.ai/v1',
	defaultHeaders: {
		'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
		'Helicone-Cache-Enabled': 'true',
	},
});

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
