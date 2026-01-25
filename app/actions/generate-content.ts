'use server';

import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { StateGraph, MessagesZodMeta, START, END } from '@langchain/langgraph';
import { registry } from '@langchain/langgraph/zod';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod/v4';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { analyzeChannel, researchTopic } from '@/libs/videoResearch';
import * as fs from 'fs/promises';
import * as path from 'path';

const llm = new ChatOpenAI({ model: 'gpt-5' });

const BRIAN_CHANNEL_ID = 'UC1LJVKQ0hp7sKyfAbKoDHMw';

const schema = z.object({
	messages: z.custom<BaseMessage[]>().register(registry, MessagesZodMeta),
	businessData: z.string(),
	template: z.string(),
	needsBusinessData: z.boolean(),
	writingSamples: z.array(z.string()),
	sources: z.array(z.string()),
	options: z.array(z.string()),
	relevantResources: z.array(
		z.object({
			title: z.string(),
			url: z.string(),
			category: z.string(),
			description: z.string(),
		})
	),
	isVideoResearch: z.boolean(),
	channelStats: z.string().optional(),
	topicResearch: z.string().optional(),
	needsChannelAnalysis: z.boolean().optional(),
	needsTopicResearch: z.boolean().optional(),
	suggestions: z.string().optional(),
});

const generateContentOptions = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);
	const template = state.template;
	const writingSamples = state.writingSamples;
	const businessData = state.businessData;
	const needsBusinessData = state.needsBusinessData;
	const relevantResources = state.relevantResources || [];

	const SYSTEM_PROMPT = `
	You are writing content for Brian targeted at the Marcus persona - career changers and people learning to code.

	CRITICAL: Brian's audience is coders and people learning to code (like Marcus Rivera - a 34-year-old teacher transitioning to coding).

	Template (ONLY for structure/format, NOT content):
	${template}

	Writing samples to match Brian's writing style:
	${writingSamples.join('\n')}

	${
		needsBusinessData
			? "Brian's business context:\n" +
			  JSON.stringify(businessData, null, 2)
			: ''
	}

	${
		relevantResources.length > 0
			? `Relevant learning resource (use sparingly as context, include link if highly relevant):\n${JSON.stringify(
					relevantResources[0],
					null,
					2
			  )}`
			: ''
	}

	INSTRUCTIONS:
	1. Generate 3 content options focused on coding, software development, career transitions into tech, or learning to code
	2. Use the template ONLY for formatting/structure (e.g., if it's a list, use list format; if it's how-to, use how-to structure)
	3. IGNORE the actual topic/content of the template completely - it's for marketers, but Brian's audience is developers/coders
	4. Match Brian's writing style from the samples
	5. Address the Marcus persona: career changers, people learning to code, developers building skills
	6. Topics should relate to: coding tutorials, career advice for developers, learning paths, building projects, tech skills, etc.
	7. If a learning resource is provided and highly relevant, you may reference or link to it (MAX 1 link per content option)

	Generate 3 options for content about coding/development/learning to code.
	`;

	const result = await llm
		.withStructuredOutput(z.object({ options: z.array(z.string()) }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	return { options: result.options, sources: state.sources.flat() };
};

const getBusinessData = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const businessContextOptions = [
		'marcus-persona.json',
		'business_overview.json',
		'podcast_performance.json',
		'all',
	] as const;

	const businessContextOptionsString = businessContextOptions
		.map((option) => `- ${option}`)
		.join('\n');

	const SYSTEM_PROMPT = `
	Determine which business context is most relevant to the message history.

	${businessContextOptionsString}
	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
	`;

	const result = await llm
		.withStructuredOutput(
			z.object({ context: z.enum(businessContextOptions) })
		)
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	if (result.context === 'all') {
		const [personaData, businessOverviewData, podcastPerformanceData] =
			await Promise.all([
				fs.readFile(
					path.join(
						process.cwd(),
						'data',
						'context',
						'marcus-persona.json'
					),
					'utf-8'
				),
				fs.readFile(
					path.join(
						process.cwd(),
						'data',
						'context',
						'business-overview.json'
					),
					'utf-8'
				),
				fs.readFile(
					path.join(
						process.cwd(),
						'data',
						'context',
						'podcast-performance.json'
					),
					'utf-8'
				),
			]);
		return {
			businessData: JSON.stringify({
				persona: JSON.parse(personaData),
				business_overview: JSON.parse(businessOverviewData),
				podcast_performance: JSON.parse(podcastPerformanceData),
			}),
		};
	}

	const businessData = await fs.readFile(
		path.join(process.cwd(), 'data', 'context', `${result.context}`),
		'utf-8'
	);
	return { businessData: JSON.stringify(JSON.parse(businessData)) };
};

const getWritingSamples = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);
	console.log('Last messages:', lastMessages);

	const SYSTEM_PROMPT = `
	Construct a search query to find Brian's writing samples about coding, software development, and learning to code.

	IMPORTANT: Brian writes content for coders and people learning to code (Marcus persona: career changers, developers, tech learners).
	His content focuses on: coding tutorials, career transitions into tech, learning paths, building projects, developer skills, etc.

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}

	Generate a search query to find relevant writing samples about coding/development topics that match this request.
	`;

	const result = await llm
		.withStructuredOutput(z.object({ query: z.string() }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	console.log('Writing samples query:', result.query);

	const queryEmbedding = await generateEmbedding(result.query);

	const writingSamples = await qdrantClient.search('brian-posts', {
		vector: queryEmbedding,
		limit: 10,
		with_payload: true,
	});

	return {
		writingSamples: writingSamples.map(
			(sample) => sample.payload?.text as string
		),
		sources: writingSamples.map(
			(sample) => sample.payload?.sourceUrl as string
		),
	};
};

const fetchRelevantResources = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const QUERY_PROMPT = `
	Construct a search query to find relevant learning resources for the user's content request.

	The resources include courses, guides, templates, and tutorials about coding, career transitions, AI, backend, frontend, databases, cloud, etc.

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}

	Generate a concise search query to find the most relevant learning resource.
	`;

	const queryResult = await llm
		.withStructuredOutput(z.object({ query: z.string() }))
		.invoke([new SystemMessage(QUERY_PROMPT), ...lastMessages]);

	console.log('Resources search query:', queryResult.query);

	const resourcesPath = path.join(
		process.cwd(),
		'data',
		'resources',
		'learning-resources.json'
	);
	const resourcesData = await fs.readFile(resourcesPath, 'utf-8');
	const allResources = JSON.parse(resourcesData);

	const SEARCH_PROMPT = `
	Given a user query and a list of learning resources, identify the most relevant resource.

	User query: ${queryResult.query}

	Available resources:
	${JSON.stringify(allResources, null, 2)}

	Return the title of the most relevant resource (or empty array if none are relevant).
	Be selective - only return a resource if it directly relates to the query.
	`;

	const result = await llm
		.withStructuredOutput(z.object({ resourceTitles: z.array(z.string()) }))
		.invoke([new SystemMessage(SEARCH_PROMPT)]);

	const relevantResources = allResources
		.filter((resource: any) =>
			result.resourceTitles.includes(resource.title)
		)
		.slice(0, 1);

	console.log('Relevant resources found:', relevantResources.length);

	return { relevantResources };
};

const checkIfBusinessDataNeeded = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const SYSTEM_PROMPT = `
	Determine if the user is asking for business advice, business context, metrics, performance data, or strategy advice.

	Business advice examples:
	- Questions about podcast performance
	- Questions about audience/persona
	- Questions about business strategy
	- Requests for data-driven insights
	- Content optimization based on metrics

	NOT business advice:
	- General content requests about coding/development
	- Writing samples or style questions
	- Template/format questions

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}

	Return true if business data is needed, false otherwise.
	`;

	const result = await llm
		.withStructuredOutput(z.object({ needsBusinessData: z.boolean() }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	return { needsBusinessData: result.needsBusinessData };
};

const shouldGetBusinessData = (state: z.infer<typeof schema>) => {
	return state.needsBusinessData ? 'getBusinessData' : 'getWritingSamples';
};

const checkRequestType = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const SYSTEM_PROMPT = `
	Determine if this is a video research request or content generation request.

	Video research examples:
	- "What videos should I make?"
	- "Should I make a video about X?"
	- "What's performing well on my channel?"
	- "Is this video idea good?"

	Content generation examples:
	- "Write a LinkedIn post about X"
	- "Draft an article about Y"
	- "Create content about Z"

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
	`;

	const result = await llm
		.withStructuredOutput(z.object({ isVideoResearch: z.boolean() }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	return { ...result };
};

const checkVideoResearchNeeds = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const SYSTEM_PROMPT = `
	Determine what type of video research is needed.

	Channel analysis: asking about current channel performance, stats, what's working
	Topic research: asking about a specific video idea or topic to research

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
	`;

	const result = await llm
		.withStructuredOutput(
			z.object({
				needsChannelAnalysis: z.boolean(),
				needsTopicResearch: z.boolean(),
			})
		)
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	return {
		...result,
	};
};

const analyzeYouTubeChannel = async () => {
	const result = await analyzeChannel(BRIAN_CHANNEL_ID, 10);
	return { channelStats: result.stats };
};

const researchVideoTopic = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const QUERY_PROMPT = `
	Extract the video topic to research from the message history.

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
	`;

	const queryResult = await llm
		.withStructuredOutput(z.object({ topic: z.string() }))
		.invoke([new SystemMessage(QUERY_PROMPT), ...lastMessages]);

	const result = await researchTopic(queryResult.topic);
	return { topicResearch: result.suggestions };
};

const generateVideoSuggestions = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const contextParts = [];
	if (state.channelStats) {
		contextParts.push(`CHANNEL STATS:\n${state.channelStats}`);
	}
	if (state.topicResearch) {
		contextParts.push(`TOPIC RESEARCH:\n${state.topicResearch}`);
	}

	const SYSTEM_PROMPT = `
	You are Brian's video strategy assistant. Provide practical video suggestions.

	${contextParts.join('\n\n')}

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
	`;

	const result = await llm
		.withStructuredOutput(z.object({ suggestions: z.string() }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	return { suggestions: result.suggestions };
};

const routeByRequestType = (state: z.infer<typeof schema>) => {
	return state.isVideoResearch
		? 'checkVideoResearchNeeds'
		: 'checkIfBusinessDataNeeded';
};

const routeAfterVideoCheck = (state: z.infer<typeof schema>) => {
	if (state.needsChannelAnalysis && state.needsTopicResearch) {
		return 'analyzeChannel';
	}
	if (state.needsChannelAnalysis) {
		return 'analyzeChannel';
	}
	if (state.needsTopicResearch) {
		return 'researchTopic';
	}
	return 'generateVideoSuggestions';
};

const routeAfterChannelAnalysis = (state: z.infer<typeof schema>) => {
	return state.needsTopicResearch
		? 'researchTopic'
		: 'generateVideoSuggestions';
};

const contentGenerationGraph = new StateGraph(schema)
	.addNode('checkRequestType', checkRequestType)
	.addNode('checkIfBusinessDataNeeded', checkIfBusinessDataNeeded)
	.addNode('getBusinessData', getBusinessData)
	.addNode('getWritingSamples', getWritingSamples)
	.addNode('fetchRelevantResources', fetchRelevantResources)
	.addNode('generateContentOptions', generateContentOptions)
	.addNode('checkVideoResearchNeeds', checkVideoResearchNeeds)
	.addNode('analyzeChannel', analyzeYouTubeChannel)
	.addNode('researchTopic', researchVideoTopic)
	.addNode('generateVideoSuggestions', generateVideoSuggestions)
	.addEdge(START, 'checkRequestType')
	.addConditionalEdges('checkRequestType', routeByRequestType)
	.addConditionalEdges('checkIfBusinessDataNeeded', shouldGetBusinessData)
	.addEdge('getBusinessData', 'getWritingSamples')
	.addEdge('getWritingSamples', 'fetchRelevantResources')
	.addEdge('fetchRelevantResources', 'generateContentOptions')
	.addEdge('generateContentOptions', END)
	.addConditionalEdges('checkVideoResearchNeeds', routeAfterVideoCheck)
	.addConditionalEdges('analyzeChannel', routeAfterChannelAnalysis)
	.addEdge('researchTopic', 'generateVideoSuggestions')
	.addEdge('generateVideoSuggestions', END)
	.compile();

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
