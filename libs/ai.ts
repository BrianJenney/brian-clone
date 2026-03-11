import { createOpenAI } from '@ai-sdk/openai';
import assert from 'assert';

assert(
	process.env.OPENAI_API_KEY,
	new Error('OPENAI_API_KEY is not defined in environment variables')
);

/**
 * OpenAI client for AI SDK tool calling and streaming.
 * LangSmith tracing is configured via environment variables.
 * Use this for AI SDK tool calling and streaming
 */
export const openai = createOpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});
