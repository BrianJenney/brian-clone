import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { StateGraph, MessagesZodMeta, START, END } from '@langchain/langgraph';
import { registry } from '@langchain/langgraph/zod';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod/v4';
import { qdrantClient } from './qdrant';
import { generateEmbedding } from './openai';
import contentTemplates from '@/data/templates/content-templates.json';
import * as fs from 'fs/promises';
import * as path from 'path';

const llm = new ChatOpenAI({ model: 'gpt-5' });

const schema = z.object({
	messages: z.custom<BaseMessage[]>().register(registry, MessagesZodMeta),
	businessData: z.string(),
	template: z.string(),
	needsBusinessData: z.boolean(),
	writingSamples: z.array(z.string()),
	sources: z.array(z.string()),
	options: z.array(z.string()),
	relevantResources: z.array(z.object({
		title: z.string(),
		url: z.string(),
		category: z.string(),
		description: z.string(),
	})),
});

const getTemplates = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);
	const writingSamples = state.writingSamples;

	const templateOption = contentTemplates.map((template) => template.type);

	const SYSTEM_PROMPT = `
	Given a short message history and writing samples, pick the most relevant content STRUCTURE/FORMAT template.

	IMPORTANT: These templates are ONLY for format (how-to, list, observation, advice, thought-leadership, etc.).
	The templates contain marketing content, but Brian's audience is CODERS/PEOPLE LEARNING TO CODE, not marketers.
	You are picking the FORMAT type (list, how-to, etc.), NOT the topic.

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}

	Writing samples:
	${writingSamples.join('\n')}

	Template format options:
	${templateOption.join('\n')}

	Pick the format that best matches the structure needed for the user's request.
	`;

	const result = await llm
		.withStructuredOutput(z.object({ template: z.string() }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	const templateExample = contentTemplates.find(
		(option) => option.type === result.template
	);

	return { template: templateExample?.content };
};

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
	Brian's content is NEVER about marketing, ecommerce, B2B sales, or business marketing topics.

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
			? `Relevant learning resource (use sparingly as context, include link if highly relevant):\n${JSON.stringify(relevantResources[0], null, 2)}`
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
	const writingSamples = state.writingSamples;

	// Load learning resources
	const resourcesPath = path.join(
		process.cwd(),
		'data',
		'resources',
		'learning-resources.json'
	);
	const resourcesData = await fs.readFile(resourcesPath, 'utf-8');
	const allResources = JSON.parse(resourcesData);

	const SYSTEM_PROMPT = `
	Based on the user's request and writing samples, determine if ANY of these learning resources would be valuable context.

	IMPORTANT: Be VERY selective. Only choose a resource if it directly relates to the content being generated.
	Maximum of 1 resource should be selected (or 0 if none are truly relevant).

	User's message history:
	${lastMessages.map((message) => message.content).join('\n')}

	Writing samples context:
	${writingSamples.slice(0, 2).join('\n')}

	Available resources:
	${JSON.stringify(allResources, null, 2)}

	Return an array of resource titles that are relevant (max 1, or empty array if none fit).
	`;

	const result = await llm
		.withStructuredOutput(z.object({ resourceTitles: z.array(z.string()) }))
		.invoke([new SystemMessage(SYSTEM_PROMPT), ...lastMessages]);

	// Get the full resource objects for the selected titles
	const relevantResources = allResources.filter((resource: any) =>
		result.resourceTitles.includes(resource.title)
	).slice(0, 1); // Ensure max 1 resource

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

export const graph = new StateGraph(schema)
	.addNode('checkIfBusinessDataNeeded', checkIfBusinessDataNeeded)
	.addNode('getBusinessData', getBusinessData)
	.addNode('getWritingSamples', getWritingSamples)
	.addNode('fetchRelevantResources', fetchRelevantResources)
	.addNode('getTemplates', getTemplates)
	.addNode('generateContentOptions', generateContentOptions)
	.addEdge(START, 'checkIfBusinessDataNeeded')
	.addConditionalEdges('checkIfBusinessDataNeeded', shouldGetBusinessData)
	.addEdge('getBusinessData', 'getWritingSamples')
	.addEdge('getWritingSamples', 'fetchRelevantResources')
	.addEdge('fetchRelevantResources', 'getTemplates')
	.addEdge('getTemplates', 'generateContentOptions')
	.addEdge('generateContentOptions', END)
	.compile();

export const contentGenerationGraph = graph;
