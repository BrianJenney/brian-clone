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
});

const getTemplates = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);
	const writingSamples = state.writingSamples;

	const templateOption = contentTemplates.map((template) => template.type);

	const SYSTEM_PROMPT = `
	Given a short message history and writing samples, pick the most relevant template from the options provided.

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
	Writing samples:
	${writingSamples.join('\n')}
	Template options:
	${templateOption.join('\n')}
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

	const SYSTEM_PROMPT = `
	Youu are writing content for Brian. You have access to his previous writing samples and a content template for structure ONLY.

	Template (to be used for structure ONLY):
	${template}
	Writing samples to get Brian's writing style:
	${writingSamples.join('\n')}
	Generate 3 options for the content to be generated.
	${needsBusinessData ? "Brian's business data:" : ''} Brian's business data:
	${needsBusinessData ? JSON.stringify(businessData, null, 2) : ''}
	Use the template for formatting ONLY. Do not use the template for the content.
	Do not use the writing samples for the content. Do not use the business data for the content.
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
	Given a short message history, construct a query to search for writing samples that are relevant 
	to the message history to be usedin a vector database.

	Message history:
	${lastMessages.map((message) => message.content).join('\n')}
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

const shouldGetBusinessData = (state: z.infer<typeof schema>) => {
	return state.needsBusinessData ? 'getBusinessData' : 'getWritingSamples';
};

export const graph = new StateGraph(schema)
	.addNode('agent', async ({ messages }) => {
		const SYSTEM_PROMPT = `
		Determine if the user needs business data to generate content.
		For example, if the query is in relation to Parsity, the podcast or the persona of our ideal customer, Marcus, then we need to get the business data.
		Otherwise, we do not need to get the business data.
		Do not ask the user for the business data. Just determine if it is needed.

		Message history:
		${messages.map((message) => message.content).join('\n')}
		};`;

		const result = await llm
			.withStructuredOutput(z.object({ needsBusinessData: z.boolean() }))
			.invoke([new SystemMessage(SYSTEM_PROMPT), ...messages]);
		return { needsBusinessData: result.needsBusinessData };
	})
	.addEdge(START, 'agent')
	.addNode('getWritingSamples', getWritingSamples)
	.addNode('getTemplates', getTemplates)
	.addNode('generateContentOptions', generateContentOptions)
	.addNode('getBusinessData', getBusinessData)
	.addConditionalEdges('agent', shouldGetBusinessData)
	.addEdge('getWritingSamples', 'getTemplates')
	.addEdge('getBusinessData', 'getWritingSamples')
	.addEdge('getTemplates', 'generateContentOptions')
	.addEdge('generateContentOptions', END)
	.compile();

export type GraphType = typeof graph;
