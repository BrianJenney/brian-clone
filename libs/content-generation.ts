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

	INSTRUCTIONS:
	1. Generate 3 content options focused on coding, software development, career transitions into tech, or learning to code
	2. Use the template ONLY for formatting/structure (e.g., if it's a list, use list format; if it's how-to, use how-to structure)
	3. IGNORE the actual topic/content of the template completely - it's for marketers, but Brian's audience is developers/coders
	4. Match Brian's writing style from the samples
	5. Address the Marcus persona: career changers, people learning to code, developers building skills
	6. Topics should relate to: coding tutorials, career advice for developers, learning paths, building projects, tech skills, etc.

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

const shouldGetBusinessData = (state: z.infer<typeof schema>) => {
	return state.needsBusinessData ? 'getBusinessData' : 'getWritingSamples';
};

export const graph = new StateGraph(schema)
	.addNode('agent', async ({ messages }) => {
		const SYSTEM_PROMPT = `
		Determine if the user needs business data to understand the business and the target audience OR just writing samples for style to create
		a linkedin post.

		Brian's content is ALWAYS targeted at the Marcus persona: coders and people learning to code (career changers, developers, tech learners).
		Brian's content is NEVER about marketing, ecommerce, or B2B topics.

		Business data should be retrieved if the query relates to:
		- Parsity (Brian's coding education business)
		- The podcast about coding/tech education
		- The Marcus persona (target audience: career changers learning to code)
		- Specific business metrics, performance, or context

		Otherwise, we do not need business data - just writing samples for style.

		Message history:
		${messages.map((message) => message.content).join('\n')}
		`;

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
	.addEdge('getBusinessData', END)
	.addEdge('getTemplates', 'generateContentOptions')
	.addEdge('generateContentOptions', END)
	.compile();

export type GraphType = typeof graph;
