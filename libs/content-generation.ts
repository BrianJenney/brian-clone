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

const llm = new ChatOpenAI({ model: 'gpt-4o' });

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

	return { options: result.options };
};

const getBusinessData = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const businessContextOptions = [
		'persona',
		'business_overview',
		'podcast_performance',
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

	const businessData = await fs.readFile(
		path.join(process.cwd(), 'data', 'context', `${result.context}.json`),
		'utf-8'
	);
	return { businessData: JSON.parse(businessData) };
};

const getWritingSamples = async (state: z.infer<typeof schema>) => {
	const lastMessages = state.messages.slice(-5);

	const SYSTEM_PROMPT = `
	Given a short message history, construct a query to search for writing samples that are relevant to the message history to be used
	in a vector database.

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
			(sample) => sample.payload?.source as string
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
