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

// Helper function to generate text completions
export async function generateCompletion(
	prompt: string,
	systemMessage: string = 'You are a helpful writing assistant that mimics the writing style of provided examples.'
): Promise<string> {
	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: systemMessage },
				{ role: 'user', content: prompt },
			],
			temperature: 0.7,
			max_tokens: 2000,
		});

		return response.choices[0].message.content || '';
	} catch (error) {
		console.error('Error generating completion:', error);
		throw error;
	}
}
