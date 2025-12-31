import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { ChatOpenAI } from '@langchain/openai';
import { getCollectionName } from '@/libs/utils';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import z from 'zod/v4';
import { exec } from 'child_process';

const llm = new ChatOpenAI({ model: 'gpt-5' });

const querySchema = z.object({
	query: z.string().describe('The search query to use for the web search'),
	url: z.string().describe('The URL of the page to crawl'),
});

type querySchemaType = z.infer<typeof querySchema>[];

const generateSearchQueries = async (
	query: string
): Promise<querySchemaType> => {
	const systemPrompt = `
    You generate search queries for a given topic for a web search. 
    This web search is for finding relevant articles to write an article about the given topic.
    US based articles are preferred and must be written in English. Ideally, written in the last 6 months.`;

	const result = await llm
		.withStructuredOutput(
			z.object({ queries: z.array(querySchema).min(1).max(5) })
		)
		.invoke([
			new SystemMessage(systemPrompt),
			new HumanMessage(
				`Topic: ${query}\n\nGenerate 1-5 search queries for a web search. Make sure to include the URL of the page to crawl.`
			),
		]);

	return result.queries;
};

const crawlWeb = async ({ url, query }: { url: string; query: string }) => {
	const command = exec(`crawl ${url} -q ${query}`);
	const result = (await command.stdout?.toString()) ?? '';
	console.log('Crawled web:', JSON.stringify(result, null, 2));
	return result;
};

const searchQdrant = async (query: string) => {
	const results = await qdrantClient.search(getCollectionName('article'), {
		vector: await generateEmbedding(query),
		limit: 5,
		with_payload: true,
	});
	return results;
};

export const articleWriter = async (query: string) => {
	const queries = await generateSearchQueries(query);

	const results = await Promise.all(
		queries.map(async (query) => {
			return crawlWeb({ url: query.url, query: query.query });
		})
	);

	console.log('Results:', results);

	const writingSamples = await searchQdrant(query);

	const systemPrompt = `
    You write an article about the given topic.
    You use the following writing samples to write the article:
    ${writingSamples.map((sample) => sample.payload?.text).join('\n')}

    Use these resouces to understand the topic and write the article.
    The resources are:
    ${results.join('\n')}

    The article can be written in the following format, but is not limited to these formats:
    - Opening: First sentence tells the reader you're going to explain How To do something
    - Why: Explain why they should learn this - what benefits, outcomes, or rewards they can expect
    - The Problem: Start with "Unfortunately..." and explain why so many people don't do this
    - Primary Reason Subhead: The main reason why
    - Additional Reasons: List 4-5 other reasons people struggle:
    - Reason #1
    - Reason #2
    - Reason #3
    - Reason #4
    - Hope: Tell the reader you'll explain how they can overcome all these problems
    - Steps: For each step:
    - Step Title: Tell them exactly what to do (be specific!)
    - First sentence explains why it's important
    - Provide examples or stories of someone putting this into action
    - For Step 2: Point out where people go wrong, why it's a mistake, and how to avoid it
    - For Step 3: Motivate with "light at the end of the tunnel" - what everything ladders up to
    `;

	const result = await llm.invoke([
		new SystemMessage(systemPrompt),
		new HumanMessage(query),
	]);

	return result.content;
};
