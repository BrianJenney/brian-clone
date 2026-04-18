import { qdrantClient, COLLECTIONS } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';

export interface LinkedInLookupResult {
	id: string | number;
	score: number;
	text: string;
	numImpressions?: number;
	numReactions?: number;
	numComments?: number;
	numShares?: number;
	createdAt?: string;
	sourceUrl?: string;
}

export interface LookupLinkedInWritingArgs {
	query: string;
	minImpressions?: number;
	topK?: number;
	overFetch?: number;
}

/**
 * Semantic lookup over Brian's LinkedIn posts collection.
 *
 * Strategy:
 * 1. Over-fetch `overFetch` candidates by embedding similarity (default 20).
 * 2. Keep posts with `numImpressions >= minImpressions` (default 50).
 * 3. If none pass the filter, fall back to the top 3 semantic matches.
 */
export async function lookupLinkedInWriting(
	args: LookupLinkedInWritingArgs,
): Promise<LinkedInLookupResult[]> {
	const {
		query,
		minImpressions = 50,
		topK = 5,
		overFetch = 20,
	} = args;

	const embedding = await generateEmbedding(query);

	const raw = await qdrantClient.search(COLLECTIONS.POSTS, {
		vector: embedding,
		limit: overFetch,
		with_payload: true,
	});

	const mapped: LinkedInLookupResult[] = raw.map((r) => {
		const p = (r.payload ?? {}) as Record<string, unknown>;
		return {
			id: r.id,
			score: r.score,
			text: String(p.text ?? ''),
			numImpressions:
				typeof p.numImpressions === 'number'
					? p.numImpressions
					: undefined,
			numReactions:
				typeof p.numReactions === 'number'
					? p.numReactions
					: undefined,
			numComments:
				typeof p.numComments === 'number' ? p.numComments : undefined,
			numShares:
				typeof p.numShares === 'number' ? p.numShares : undefined,
			createdAt: typeof p.createdAt === 'string' ? p.createdAt : undefined,
			sourceUrl:
				typeof p.sourceUrl === 'string' ? p.sourceUrl : undefined,
		};
	});

	const highImpact = mapped.filter(
		(r) =>
			r.numImpressions !== undefined && r.numImpressions >= minImpressions,
	);

	if (highImpact.length > 0) {
		return highImpact.slice(0, topK);
	}

	return mapped.slice(0, 3);
}
