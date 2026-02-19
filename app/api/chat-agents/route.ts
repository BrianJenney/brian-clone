import { openai } from '@/libs/ai';
import { generateObject, generateText, stepCountIs, streamText } from 'ai';
import {
	searchWritingSamplesTool,
	getBusinessContextTool,
	searchResourcesTool,
	analyzeChannelTool,
	researchTopicTool,
	excalidrawerTool,
} from '@/libs/tools';
import { type AgentName, AGENT_CONFIG } from '@/libs/agents/config';
import { z } from 'zod';

const routerResponseSchema = z.object({
	agents: z.array(
		z.enum(Object.keys(AGENT_CONFIG) as [AgentName, ...AgentName[]]),
	),
	refinedQuery: z.string(),
});

type RouterResponse = z.infer<typeof routerResponseSchema>;

type AgentResponse = {
	agent: AgentName;
	response: string;
};

/**
 * Router: Determines which agents to invoke and creates refined query
 */
async function routeRequest(
	userMessages: { role: 'user' | 'assistant'; content: string }[],
): Promise<RouterResponse> {
	const result = await generateObject({
		model: openai('gpt-4o-mini'),
		schema: routerResponseSchema,
		prompt: `You are a routing assistant for Brian's AI system. Analyze the user's request and determine which agents should handle it.

Available agents:
- videoResearch: Analyze YouTube channel performance, research video topics, suggest video ideas
- businessContext: Fetch business data, audience persona, metrics, performance data
- writingSamples: Search Brian's writing samples to match his style and voice
- resources: Find learning resources, courses, guides, tutorials
- excalidrawer: Draw diagrams and flowcharts

Respond with:
1. agents: Array of agent names to invoke (can be empty, one, or multiple)
2. refinedQuery: A clear, focused query that all selected agents can use (should capture the core intent)

Examples:
- "What videos should I make?" → agents: ["videoResearch"], refinedQuery: "analyze channel performance and suggest video topics"
- "Write a post about React" → agents: ["writingSamples", "resources"], refinedQuery: "React development content"
- "How is my channel doing?" → agents: ["videoResearch", "businessContext"], refinedQuery: "channel and business performance metrics"

User messages: ${userMessages.map((message) => `- ${message.role}: ${message.content}`).join('\n')}`,
	});

	return result.object;
}

/**
 * Video Research Agent
 */
async function videoResearchAgent(query: string): Promise<string> {
	const result = await generateText({
		model: openai('gpt-4o-mini'),
		messages: [
			{
				role: 'system',
				content: `
				You have tools to analyze Brian's YouTube channel performance and research video topics. 
				Use the tools to get data and return the results`,
			},
			{ role: 'user', content: query },
		],
		tools: {
			analyzeChannelTool,
			researchTopicTool,
		},
	});

	return result.text;
}

/**
 * Business Context Agent
 */
async function businessContextAgent(query: string): Promise<string> {
	const result = await generateText({
		model: openai('gpt-4o-mini'),
		stopWhen: stepCountIs(1),
		toolChoice: 'required',
		messages: [
			{
				role: 'system',
				content: `Get business context that matches the user's request.`,
			},
			{ role: 'user', content: query },
		],
		tools: {
			getBusinessContextTool,
		},
	});

	return result.text;
}

/**
 * Writing Samples Agent
 */
async function writingSamplesAgent(query: string): Promise<string> {
	const result = await generateText({
		model: openai('gpt-4o-mini'),
		maxOutputTokens: 1200,
		stopWhen: stepCountIs(1),
		toolChoice: 'required',
		messages: [
			{
				role: 'system',
				content: `Find Brian's writing samples that match the user's request.`,
			},
			{ role: 'user', content: query },
		],
		tools: {
			searchWritingSamplesTool,
		},
	});

	return result.text;
}

/**
 * Excalidrawer Agent
 */
async function excalidrawerAgent(query: string): Promise<string> {
	const result = await generateText({
		model: openai('gpt-4o-mini'),
		maxOutputTokens: 1200,
		stopWhen: stepCountIs(1),
		messages: [
			{
				role: 'system',
				content: `Call the tool to draw a diagram or flowchart. Return raw tool results. This is specifically for excalidraw - you can use Mermaid syntax`,
			},
			{ role: 'user', content: query },
		],
		tools: {
			excalidrawerTool,
		},
	});

	return result.text;
}

/**
 * Resources Agent
 */
async function resourcesAgent(query: string): Promise<string> {
	const result = await generateText({
		model: openai('gpt-4o-mini'),
		messages: [
			{
				role: 'system',
				content: `Call the tool to find resources. Return raw tool results - just list what was found.`,
			},
			{ role: 'user', content: query },
		],
		tools: {
			searchResourcesTool,
		},
	});

	return result.text;
}

/**
 * Execute agents in parallel
 */
async function executeAgents(
	agents: AgentName[],
	refinedQuery: string,
): Promise<AgentResponse[]> {
	const agentMap = {
		videoResearch: videoResearchAgent,
		businessContext: businessContextAgent,
		writingSamples: writingSamplesAgent,
		resources: resourcesAgent,
		excalidrawer: excalidrawerAgent,
	};

	const promises = agents.map(async (agentName) => {
		const agentFn = agentMap[agentName];
		const response = await agentFn(refinedQuery);
		return { agent: agentName, response };
	});

	const results = await Promise.all(promises);

	return results;
}

/**
 * POST /api/chat-agents
 * Agent-based chat endpoint with router → agents → summarizer architecture
 */
export async function POST(req: Request) {
	const encoder = new TextEncoder();

	try {
		const body = await req.json();

		const { messages } = body as {
			messages: { role: 'user' | 'assistant'; content: string }[];
		};
		const lastMessages = messages.slice(-3);

		// Create a readable stream for progress updates
		const stream = new ReadableStream({
			async start(controller) {
				try {
					// Step 1: Route request
					controller.enqueue(
						encoder.encode(
							JSON.stringify({
								type: 'progress',
								message: 'Analyzing request...',
							}) + '\n',
						),
					);

					const { agents: agentsToUse, refinedQuery } =
						await routeRequest(lastMessages);

					console.log(JSON.stringify({ agentsToUse, refinedQuery }));

					if (agentsToUse.length === 0) {
						// No agents needed, just respond directly
						controller.enqueue(
							encoder.encode(
								JSON.stringify({
									type: 'progress',
									message: 'Generating response...',
								}) + '\n',
							),
						);

						const result = streamText({
							model: openai('gpt-5'),
							messages,
						});

						for await (const chunk of result.textStream) {
							controller.enqueue(
								encoder.encode(
									JSON.stringify({
										type: 'text',
										content: chunk,
									}) + '\n',
								),
							);
						}

						controller.close();
						return;
					}

					// Step 2: Execute agents in parallel
					for (const agent of agentsToUse) {
						controller.enqueue(
							encoder.encode(
								JSON.stringify({
									type: 'progress',
									message: `Running ${agent} agent...`,
								}) + '\n',
							),
						);
					}

					const agentResponses = await executeAgents(
						agentsToUse,
						refinedQuery,
					);

					// Step 3: Summarize with gpt-5
					controller.enqueue(
						encoder.encode(
							JSON.stringify({
								type: 'progress',
								message: 'Synthesizing response...',
							}) + '\n',
						),
					);

					const agentContext = agentResponses
						.map(
							(ar) =>
								`[${ar.agent} Agent Response]\n${ar.response}`,
						)
						.join('\n\n');

					const result = streamText({
						model: openai('gpt-5'),
						messages: [
							{
								role: 'system',
								content: `You are Brian's AI assistant. You have received responses from specialized agents. Use this information to provide a comprehensive, helpful answer to the user's original question.

Agent Responses:
${agentContext}

Recent User Messages: ${lastMessages.map((message: { content: string }) => `- ${message.content}`).join('\n')}
Refined Query: ${refinedQuery}

CRITICAL: Use ONLY the actual data from the agent responses. Do NOT make up or suggest new things.

If agents returned resources, list those exact resources with links.
If agents returned channel data, show that exact data.
If agents returned writing samples, reference those samples.

Synthesize the ACTUAL agent data into a clear answer. Maintain Brian's voice: direct, practical, no hype.`,
							},
							...messages,
						],
					});

					// Stream the final response

					let chunkCount = 0;
					for await (const chunk of result.textStream) {
						chunkCount++;
						controller.enqueue(
							encoder.encode(
								JSON.stringify({
									type: 'text',
									content: chunk,
								}) + '\n',
							),
						);
					}

					controller.close();
				} catch (error) {
					console.error('Agent execution error:', error);
					controller.enqueue(
						encoder.encode(
							JSON.stringify({
								type: 'error',
								message:
									error instanceof Error
										? error.message
										: 'Unknown error',
							}) + '\n',
						),
					);
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (error) {
		console.error('Error in chat-agents API:', error);
		return new Response('Internal server error', { status: 500 });
	}
}
