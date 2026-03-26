import {
	SystemMessage,
	HumanMessage,
	type BaseMessage,
} from '@langchain/core/messages';
import { END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod/v4';
import { getLangSmithConfig } from '@/libs/langsmith';

import { createTypeformGraph } from '../create-typeform';
import type { TypeformFormDesign } from '@/libs/tools/typeform';

import {
	AVAILABLE_TOOLS,
	TOOL_MAP,
	CHAT_SYSTEM_PROMPT,
	type GraphState,
	type ToolName,
	type ToolInputs,
} from './types';

const llm = new ChatOpenAI({ model: 'gpt-5' });
const llmMini = new ChatOpenAI({ model: 'gpt-4o-mini' });

export const classifyIntent = async (
	state: GraphState,
): Promise<Partial<GraphState>> => {
	const lastMessages = state.messages.slice(-5);

	const SYSTEM_PROMPT = `
Analyze the user's request and determine which tools are needed to respond effectively.

Available tools:
- searchWritingSamples: Use when creating any written content to match Brian's style
- getBusinessContext: Use when discussing business strategy, programs, pricing, or performance data
- getRecentContent: Use when asking what to work on, checking recent publishing activity, or on initial greeting
- searchResources: Use when finding learning materials or tutorials. This should be called during searchWritingSamples
- analyzeChannel: Use when analyzing YouTube channel performance
- researchTopic: Use when researching YouTube video ideas or topics
- excalidrawer: Use when creating diagrams or flowcharts
- createTypeform: Use when creating surveys, forms, or questionnaires
- spotifySearch: Use when searching for podcast episodes or information

Rules:
1. For content creation requests, include searchWritingSamples to match Brian's style
2. For YouTube-related questions, include analyzeChannel and/or researchTopic as appropriate
3. For form/survey requests, include createTypeform
4. For greetings like "hi", "hello", or "what should I work on", use getRecentContent to provide suggestions
5. For general questions that don't need tools, end early with a response to the user's request.
6. You can include multiple tools if the request requires them

Return the tools needed as an array.
`;

	const result = await llmMini
		.withStructuredOutput(
			z.object({
				toolsNeeded: z.array(z.enum(AVAILABLE_TOOLS)),
				reasoning: z.string(),
				refinedQuery: z
					.string()
					.describe(
						"A concise query for the tools to use. Prefer verbose queries that are more specific to the user's request.",
					),
			}),
		)
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	return {
		toolsNeeded: result.toolsNeeded,
		refinedQuery: result.refinedQuery,
	};
};

export const getToolInputs = (
	toolsNeeded: ToolName[],
	refinedQuery: string,
): ToolInputs => {
	const inputs: ToolInputs = {};

	for (const tool of toolsNeeded) {
		switch (tool) {
			case 'searchWritingSamples':
				inputs.searchWritingSamples = { query: refinedQuery };
				break;
			case 'getBusinessContext':
				inputs.getBusinessContext = {};
				break;
			case 'getRecentContent':
				inputs.getRecentContent = {};
				break;
			case 'searchResources':
				inputs.searchResources = { query: refinedQuery };
				break;
			case 'analyzeChannel':
				inputs.analyzeChannel = { maxVideos: 10 };
				break;
			case 'researchTopic':
				inputs.researchTopic = { topic: refinedQuery };
				break;
			case 'excalidrawer':
				inputs.excalidrawer = { request: refinedQuery };
				break;
			case 'createTypeform':
				inputs.createTypeform = { description: refinedQuery };
				break;
		}
	}

	return inputs;
};

export const executeTools = async (
	state: GraphState,
): Promise<Partial<GraphState>> => {
	const toolsNeeded = state.toolsNeeded ?? [];

	const toolsToExecute = toolsNeeded.filter((t) => t !== 'createTypeform');

	if (toolsToExecute.length === 0) {
		return { toolResults: {} };
	}

	const toolInputs = getToolInputs(toolsToExecute, state.refinedQuery ?? '');

	const results = await Promise.all(
		toolsToExecute.map(async (name) => {
			try {
				const tool = TOOL_MAP[name];
				const input = toolInputs[name] ?? {};
				const result = await tool.invoke(input);
				return [name, result];
			} catch (error) {
				console.error(`Error executing tool ${name}:`, error);
				return [
					name,
					`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				];
			}
		}),
	);

	return {
		toolResults: Object.fromEntries(results),
	};
};

export const handleTypeform = async (
	state: GraphState,
): Promise<Partial<GraphState>> => {
	const toolInputs = getToolInputs(
		['createTypeform'],
		state.refinedQuery ?? String(state.messages.at(-1)?.content ?? ''),
	);
	const description =
		toolInputs.createTypeform?.description ?? state.refinedQuery ?? '';

	const threadId = state.typeformState?.threadId ?? `typeform-${Date.now()}`;

	const checkpointConfig = { configurable: { thread_id: threadId } };

	try {
		await createTypeformGraph.invoke(
			{
				messages: [],
				formDescription: description,
				formDesign: undefined,
				approved: undefined,
				feedback: undefined,
				result: undefined,
				statusMessage: undefined,
			},
			{
				...checkpointConfig,
				...getLangSmithConfig('typeform-subgraph', {
					description,
					threadId,
				}),
			},
		);

		const graphState = await createTypeformGraph.getState(checkpointConfig);
		const interrupts = graphState.tasks.flatMap(
			(t: { interrupts?: unknown[] }) => t.interrupts ?? [],
		);

		if (interrupts.length > 0) {
			const payload = interrupts[0].value as {
				formDesign: TypeformFormDesign;
				statusMessage: string;
			};
			return {
				typeformState: {
					threadId,
					interrupted: true,
					formDesign: payload.formDesign,
					formDescription: String(description),
				},
			};
		}

		const finalState = graphState.values as {
			result?: { id: string; url: string; editUrl: string };
		};
		return {
			typeformState: {
				threadId,
				interrupted: false,
				result: finalState.result,
				formDescription: String(description),
			},
		};
	} catch (error) {
		console.error('Typeform subgraph error:', error);
		if (error instanceof Error) {
			console.error('Typeform subgraph error stack:', error.stack);
		}
		return {
			typeformState: {
				threadId,
				interrupted: false,
				formDescription: String(description),
			},
			toolResults: {
				...state.toolResults,
				createTypeform: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			},
		};
	}
};

export const generateResponse = async (
	state: GraphState,
): Promise<Partial<GraphState>> => {
	const lastMessages = state.messages.slice(-5);
	const toolResults = state.toolResults ?? {};
	const typeformState = state.typeformState;

	const contextParts: string[] = [];
	const toolSectionTitles: Record<string, string> = {
		searchWritingSamples:
			"Writing Samples (use these to match Brian's style)",
		getBusinessContext: 'Business Context',
		getRecentContent: 'Recent Publishing Activity',
		searchResources: 'Learning Resources',
		analyzeChannel: 'Channel Analysis',
		researchTopic: 'Topic Research',
		excalidrawer: 'Diagram',
	};

	Object.entries(toolResults)
		.filter(([, result]) => result != null)
		.forEach(([toolName, result]) => {
			const sectionTitle = toolSectionTitles[toolName];
			if (sectionTitle) {
				contextParts.push(`## ${sectionTitle}\n${result}`);
			}
		});

	if (typeformState?.interrupted) {
		return {
			finalResponse: JSON.stringify({
				type: 'typeform_approval',
				threadId: typeformState.threadId,
				formDesign: typeformState.formDesign,
				message:
					'Please review the form design below and approve or request changes.',
			}),
		};
	}

	if (typeformState?.result) {
		contextParts.push(
			`## Typeform Created\nForm URL: ${typeformState.result.url}\nEdit URL: ${typeformState.result.editUrl}`,
		);
	}

	const toolContext =
		contextParts.length > 0
			? `\n\nTOOL RESULTS:\n${contextParts.join('\n\n')}`
			: '';

	const SYSTEM_PROMPT = `${CHAT_SYSTEM_PROMPT}${toolContext}

Based on the tool results above (if any), provide a helpful response to the user's request.
If writing samples were provided, match Brian's writing style closely.
If you created content, present it clearly.
If you analyzed data, summarize the key insights.
Be concise and actionable.
If a lead magnet is appropriate, include a link to the lead magnet in the response. Do not make one up.
`;

	const result = await llm.invoke([
		new SystemMessage(SYSTEM_PROMPT),
		...lastMessages,
	]);

	return {
		finalResponse: String(result.content),
	};
};

export const routeAfterClassification = (state: GraphState): string => {
	const toolsNeeded = state.toolsNeeded ?? [];

	if (toolsNeeded.includes('createTypeform')) {
		return 'handleTypeform';
	}

	if (toolsNeeded.length > 0) {
		return 'executeTools';
	}

	return 'generateResponse';
};

export const routeAfterTypeform = (state: GraphState): string => {
	if (state.typeformState?.interrupted) {
		return END;
	}

	const toolsNeeded = state.toolsNeeded ?? [];
	const otherTools = toolsNeeded.filter((t) => t !== 'createTypeform');

	if (otherTools.length > 0) {
		return 'executeTools';
	}

	return 'generateResponse';
};
