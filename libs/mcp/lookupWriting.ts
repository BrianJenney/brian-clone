import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { qdrantClient, COLLECTIONS } from '@/libs/qdrant';
import { openai, generateEmbedding } from '@/libs/openai';

export type WritingSource = 'article' | 'post' | 'transcript';

export type WritingHit = {
	source: WritingSource;
	id: string | number;
	score: number;
	text: string;
	title?: string;
	author?: string;
	date?: string;
	createdAt?: string;
	sourceUrl?: string;
	tags?: string[];
	numImpressions?: number;
	numReactions?: number;
	numComments?: number;
	numShares?: number;
};

export type LookupWritingArgs = {
	query: string;
	sources?: WritingSource[];
	minImpressions?: number;
	topK?: number;
	overFetch?: number;
};

export type LookupWritingResponse = {
	chosenSources: WritingSource[];
	routerReasoning?: string;
	hits: WritingHit[];
};

const COLLECTION_BY_SOURCE: Record<WritingSource, string> = {
	article: COLLECTIONS.ARTICLES,
	post: COLLECTIONS.POSTS,
	transcript: COLLECTIONS.TRANSCRIPTS,
};

const RouteSchema = z.object({
	sources: z
		.array(z.enum(['article', 'post', 'transcript']))
		.describe(
			'Which of Brian\'s content collections to search: "article" for long-form Medium/blog posts, "post" for LinkedIn posts, "transcript" for YouTube/podcast transcripts.',
		),
	reasoning: z
		.string()
		.describe(
			'One short sentence explaining why those sources were chosen.',
		),
});

const ROUTER_SYSTEM_PROMPT = `You route a user query to the right subset of Brian's writing collections.

Collections:
- "article": long-form essays / Medium posts (deep explanations, tutorials, opinion pieces).
- "post": short-form LinkedIn posts (hot takes, career advice, announcements, engagement-driven).
- "transcript": YouTube & podcast transcripts (spoken-word, interviews, off-the-cuff stories).

Rules:
- Return the minimal set that covers the user's intent.
- If the query clearly asks about LinkedIn / short posts / "posts", return ["post"].
- If it asks for articles / blogs / essays / long-form, return ["article"].
- If it asks for videos / podcasts / interviews / "what have I said about", return ["transcript"].
- If it is ambiguous or broad (e.g. "find my writing about RAG"), return all three.
- Never return an empty array.`;

async function routeQuery(
	query: string,
): Promise<{ sources: WritingSource[]; reasoning: string }> {
	try {
		const result = await openai.responses.parse({
			model: 'gpt-4o-mini',
			temperature: 0,
			input: [
				{ role: 'system', content: ROUTER_SYSTEM_PROMPT },
				{ role: 'user', content: query },
			],
			text: {
				format: zodTextFormat(RouteSchema, 'writing_route'),
			},
		});
		const parsed = result.output_parsed;
		if (parsed && parsed.sources.length > 0) {
			return { sources: parsed.sources, reasoning: parsed.reasoning };
		}
	} catch (err) {
		console.warn('routeQuery failed, falling back to all sources:', err);
	}
	return {
		sources: ['article', 'post', 'transcript'],
		reasoning: 'Router unavailable; searching all collections.',
	};
}

function mapPayload(
	source: WritingSource,
	id: string | number,
	score: number,
	payload: Record<string, unknown>,
): WritingHit {
	const base: WritingHit = {
		source,
		id,
		score,
		text: String(payload.text ?? ''),
	};

	if (source === 'post') {
		return {
			...base,
			numImpressions:
				typeof payload.numImpressions === 'number'
					? payload.numImpressions
					: undefined,
			numReactions:
				typeof payload.numReactions === 'number'
					? payload.numReactions
					: undefined,
			numComments:
				typeof payload.numComments === 'number'
					? payload.numComments
					: undefined,
			numShares:
				typeof payload.numShares === 'number'
					? payload.numShares
					: undefined,
			createdAt:
				typeof payload.createdAt === 'string'
					? payload.createdAt
					: undefined,
			sourceUrl:
				typeof payload.sourceUrl === 'string'
					? payload.sourceUrl
					: undefined,
		};
	}

	return {
		...base,
		title: typeof payload.title === 'string' ? payload.title : undefined,
		author: typeof payload.author === 'string' ? payload.author : undefined,
		date: typeof payload.date === 'string' ? payload.date : undefined,
		sourceUrl:
			typeof payload.sourceUrl === 'string'
				? payload.sourceUrl
				: undefined,
		tags: Array.isArray(payload.tags)
			? (payload.tags as unknown[]).map(String)
			: undefined,
	};
}

async function fetchSource(
	source: WritingSource,
	embedding: number[],
	limit: number,
): Promise<WritingHit[]> {
	try {
		const raw = await qdrantClient.search(COLLECTION_BY_SOURCE[source], {
			vector: embedding,
			limit,
			with_payload: true,
		});
		return raw.map((r) =>
			mapPayload(
				source,
				r.id,
				r.score,
				(r.payload ?? {}) as Record<string, unknown>,
			),
		);
	} catch (err) {
		console.warn(`fetchSource(${source}) failed:`, err);
		return [];
	}
}

/**
 * Unified lookup across Brian's writing. An LLM router decides which
 * collections to search. LinkedIn posts are over-fetched and filtered
 * by `numImpressions >= minImpressions`, falling back to the top 3
 * semantic matches if none pass. Articles and transcripts take the
 * top `topK` semantic matches.
 */
export async function lookupWriting(
	args: LookupWritingArgs,
): Promise<LookupWritingResponse> {
	const {
		query,
		sources: requestedSources,
		minImpressions = 50,
		topK = 5,
		overFetch = 20,
	} = args;

	let chosenSources: WritingSource[];
	let routerReasoning: string | undefined;

	if (requestedSources && requestedSources.length > 0) {
		chosenSources = Array.from(new Set(requestedSources));
	} else {
		const routed = await routeQuery(query);
		chosenSources = routed.sources;
		routerReasoning = routed.reasoning;
	}

	const embedding = await generateEmbedding(query);

	const perSource = await Promise.all(
		chosenSources.map((source) => {
			const limit = source === 'post' ? overFetch : topK;
			return fetchSource(source, embedding, limit);
		}),
	);

	const hits: WritingHit[] = [];
	for (let i = 0; i < chosenSources.length; i++) {
		const source = chosenSources[i];
		const sourceHits = perSource[i];

		if (source === 'post') {
			const highImpact = sourceHits.filter(
				(h) =>
					h.numImpressions !== undefined &&
					h.numImpressions >= minImpressions,
			);
			if (highImpact.length > 0) {
				hits.push(...highImpact.slice(0, topK));
			} else {
				hits.push(...sourceHits.slice(0, 3));
			}
		} else {
			hits.push(...sourceHits.slice(0, topK));
		}
	}

	hits.sort((a, b) => b.score - a.score);

	return { chosenSources, routerReasoning, hits };
}
