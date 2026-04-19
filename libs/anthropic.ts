import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
	throw new Error('ANTHROPIC_API_KEY is not defined in environment variables');
}

export const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});
