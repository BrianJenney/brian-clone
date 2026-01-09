import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { qdrantClient, COLLECTIONS } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import assert from 'assert';

type AuthoredUpPost = {
	urn?: string;
	text?: string;
	content_type?: string;
	hashtags?: string[] | null;
	reaction_count?: number | null;
	comment_count?: number | null;
	share_count?: number | null;
	impression_count?: number | null;
	engagement_rate?: number;
	post_published_at?: string;
	actor_profile_id?: string;
};

type LinkedInPostPayload = {
	text: string;
	contentType: 'post';
	urn?: string;
	type?: string;
	numImpressions?: number;
	numReactions?: number;
	numComments?: number;
	numShares?: number;
	numEngagementRate?: number;
	hashtags?: string;
	createdAt?: string;
	sourceUrl?: string;
	uploadedAt: string;
};

async function fetchPostsFromAuthoredUp(
	fromDate: string,
	toDate: string
): Promise<AuthoredUpPost[]> {
	const apiKey = process.env.AUTHOREDUP_API_KEY;

	assert(apiKey, new Error('AUTHOREDUP_API_KEY is not configured'));

	const url = new URL('https://api.authoredup.com/external/api/v1/posts');
	url.searchParams.set('from-date', fromDate);
	url.searchParams.set('to-date', toDate);

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`AuthoredUp API error: ${response.status} - ${errorText}`
		);
	}

	const data = await response.json();

	if (data.items && Array.isArray(data.items)) {
		console.log(`Found ${data.items.length} posts`);
		return data.items;
	}

	return [];
}

async function checkExistingUrns(urns: string[]): Promise<Set<string>> {
	if (urns.length === 0) return new Set();

	// Fetch all posts and check URNs in memory
	// This is simpler and works without requiring field indexing
	const result = await qdrantClient.scroll(COLLECTIONS.POSTS, {
		limit: 1000,
		with_payload: true,
	});

	const existingUrns = new Set<string>();
	for (const point of result.points) {
		const payload = point.payload as Record<string, unknown>;
		if (payload?.urn && urns.includes(payload.urn as string)) {
			existingUrns.add(payload.urn as string);
		}
	}

	return existingUrns;
}

async function storePost(post: AuthoredUpPost): Promise<string | null> {
	if (!post.text || post.text.length < 10) {
		return null;
	}

	const id = uuidv4();
	const embedding = await generateEmbedding(post.text);

	// Build LinkedIn post URL from URN
	const postId = post.urn?.split(':').pop();
	const sourceUrl = postId
		? `https://www.linkedin.com/feed/update/${post.urn}`
		: undefined;

	const payload: LinkedInPostPayload = {
		text: post.text,
		contentType: 'post',
		urn: post.urn,
		type: post.content_type,
		numImpressions: post.impression_count ?? undefined,
		numReactions: post.reaction_count ?? undefined,
		numComments: post.comment_count ?? undefined,
		numShares: post.share_count ?? undefined,
		numEngagementRate: post.engagement_rate,
		hashtags: Array.isArray(post.hashtags)
			? post.hashtags.join(', ')
			: undefined,
		createdAt: post.post_published_at,
		sourceUrl,
		uploadedAt: new Date().toISOString(),
	};

	// Remove undefined values
	const cleanPayload = Object.fromEntries(
		Object.entries(payload).filter(([_, v]) => v !== undefined)
	);

	await qdrantClient.upsert(COLLECTIONS.POSTS, {
		wait: true,
		points: [
			{
				id,
				vector: embedding,
				payload: cleanPayload,
			},
		],
	});

	return id;
}

/**
 * GET /api/linkedin-posts
 * Fetch LinkedIn posts from AuthoredUp API and store in Qdrant
 * Query params:
 *   - from-date: ISO 8601 date string (defaults to 8 days ago)
 *   - to-date: ISO 8601 date string (defaults to now)
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;

		// Default to last 8 days if not specified
		const now = new Date();
		const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

		// Format dates as ISO 8601 without milliseconds
		const formatDate = (d: Date) => d.toISOString().split('.')[0] + 'Z';

		const fromDate =
			searchParams.get('from-date') || formatDate(eightDaysAgo);
		const toDate = searchParams.get('to-date') || formatDate(now);

		const posts = await fetchPostsFromAuthoredUp(fromDate, toDate);

		if (posts.length === 0) {
			return NextResponse.json({
				success: true,
				message: 'No posts found in the specified date range',
				stored: 0,
				total: 0,
			});
		}

		// Check for existing URNs to avoid duplicates
		const urns = posts
			.map((p) => p.urn)
			.filter((urn): urn is string => !!urn);
		let existingUrns = new Set<string>();
		try {
			existingUrns = await checkExistingUrns(urns);
		} catch (e) {
			console.log('Duplicate check failed, proceeding without:', e);
		}

		let storedCount = 0;
		let skippedCount = 0;
		let duplicateCount = 0;
		const storedIds: string[] = [];

		for (const post of posts) {
			// Skip if already exists
			if (post.urn && existingUrns.has(post.urn)) {
				duplicateCount++;
				continue;
			}

			const id = await storePost(post);
			if (id) {
				storedCount++;
				storedIds.push(id);
			} else {
				skippedCount++;
			}
		}

		return NextResponse.json({
			success: true,
			message: `Fetched and stored ${storedCount} posts from LinkedIn`,
			stored: storedCount,
			skipped: skippedCount,
			duplicates: duplicateCount,
			total: posts.length,
			storedIds,
			dateRange: { fromDate, toDate },
		});
	} catch (error) {
		console.error('Error syncing LinkedIn posts:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to sync LinkedIn posts',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
