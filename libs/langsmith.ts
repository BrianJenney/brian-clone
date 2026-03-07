import { Client } from 'langsmith';

/**
 * Shared LangSmith client.
 * Used for programmatic access (e.g., creating datasets, running evals).
 * Automatic run tracing is controlled via LANGCHAIN_TRACING_V2 env var.
 */
export const langSmithClient = new Client({
	apiKey: process.env.LANGCHAIN_API_KEY,
	apiUrl: process.env.LANGCHAIN_ENDPOINT ?? 'https://api.smith.langchain.com',
});

export function isTracingEnabled(): boolean {
	return process.env.LANGCHAIN_TRACING_V2 === 'true' && !!process.env.LANGCHAIN_API_KEY;
}

/**
 * Returns a RunnableConfig fragment with LangSmith metadata.
 * Pass this into `graph.invoke(state, config)` or `graph.streamEvents(input, config)`.
 *
 * When LANGCHAIN_TRACING_V2=true, LangChain/LangGraph automatically sends
 * these details to LangSmith — no explicit tracer callback required.
 */
export function getLangSmithConfig(
	runName: string,
	metadata?: Record<string, unknown>,
): {
	runName: string;
	tags: string[];
	metadata: Record<string, unknown>;
} {
	return {
		runName,
		tags: ['brian-clone', runName],
		metadata: {
			project: process.env.LANGCHAIN_PROJECT ?? 'brian-clone',
			...metadata,
		},
	};
}
