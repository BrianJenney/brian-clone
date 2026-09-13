import * as cheerio from 'cheerio';
import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbedding } from '@/libs/openai';
import { COLLECTIONS, qdrantClient } from '@/libs/qdrant';
import { chunkTextWithOverlap } from '@/libs/utils/chunking';
import { TRACKED_MEDIUM_AUTHORS } from '@/libs/trackedAuthors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MEDIUM_HANDLE = process.env.MEDIUM_HANDLE || '@brianjenney';

// Brian's own feed plus every tracked author's feed - each stored article is
// tagged with `author` so lookupWriting can keep Brian's voice search scoped
// to just his writing (see the must_not exclusion in libs/mcp/lookupWriting.ts).
const FEEDS: Array<{ author: string; handle: string }> = [
	{ author: 'brianjenney', handle: MEDIUM_HANDLE },
	...Object.entries(TRACKED_MEDIUM_AUTHORS).map(([author, info]) => ({
		author,
		handle: info.handle,
	})),
];

type MediumItem = {
	guid: string;
	title: string;
	sourceUrl: string;
	date?: string;
	tags: string[];
	text: string;
};

/** Strip the tracking query string Medium appends to RSS links. */
function normalizeUrl(url: string): string {
	try {
		const u = new URL(url);
		u.search = '';
		return u.toString();
	} catch {
		return url;
	}
}

/** Extract readable text from a Medium content:encoded HTML blob. */
function htmlToText(html: string): string {
	const $ = cheerio.load(html);
	let content = '';
	$('p, h1, h2, h3, h4, li').each((_, el) => {
		const text = $(el).text().trim();
		if (text) content += text + '\n\n';
	});
	return content.trim();
}

async function fetchFeed(handle: string): Promise<MediumItem[]> {
	const feedUrl = `https://medium.com/feed/${handle}`;
	const response = await fetch(feedUrl, {
		headers: { 'User-Agent': 'brian-clone-ingest/1.0' },
	});

	if (!response.ok) {
		throw new Error(`Medium RSS error for ${handle}: ${response.status}`);
	}

	const xml = await response.text();
	const $ = cheerio.load(xml, { xmlMode: true });
	const items: MediumItem[] = [];

	$('item').each((_, el) => {
		const item = $(el);
		const guid = item.find('guid').first().text().trim();
		const title = item.find('title').first().text().trim();
		const link = item.find('link').first().text().trim();
		const pubDate = item.find('pubDate').first().text().trim();
		const encoded = item.find('content\\:encoded').first().text();
		const tags = item
			.find('category')
			.map((_i, c) => $(c).text().trim())
			.get()
			.filter(Boolean);

		const body = htmlToText(encoded);
		if (!guid || !body) return;

		items.push({
			guid,
			title,
			sourceUrl: normalizeUrl(link),
			date: pubDate ? new Date(pubDate).toISOString() : undefined,
			tags,
			text: `${title}\n\n${body}`.trim(),
		});
	});

	return items;
}

/** Collect guids already ingested so we only embed new articles. */
async function fetchExistingGuids(): Promise<Set<string>> {
	const existing = new Set<string>();
	let offset: string | number | undefined | null;

	do {
		const result = await qdrantClient.scroll(COLLECTIONS.ARTICLES, {
			limit: 500,
			with_payload: ['guid'],
			offset: offset ?? undefined,
		});
		for (const point of result.points) {
			const guid = (point.payload as Record<string, unknown>)?.guid;
			if (typeof guid === 'string') existing.add(guid);
		}
		offset = result.next_page_offset as string | number | null;
	} while (offset !== null && offset !== undefined);

	return existing;
}

async function storeArticle(item: MediumItem, author: string): Promise<number> {
	const chunks = chunkTextWithOverlap(item.text, 1500);
	const baseId = uuidv4();

	for (const chunk of chunks) {
		const embedding = await generateEmbedding(chunk.text);
		await qdrantClient.upsert(COLLECTIONS.ARTICLES, {
			wait: true,
			points: [
				{
					id: uuidv4(),
					vector: embedding,
					payload: {
						text: chunk.text,
						contentType: 'article',
						baseId,
						chunkIndex: chunk.index,
						totalChunks: chunk.totalChunks,
						source: 'medium-rss',
						guid: item.guid,
						title: item.title,
						author,
						sourceUrl: item.sourceUrl,
						...(item.date && { date: item.date }),
						...(item.tags.length > 0 && { tags: item.tags }),
						uploadedAt: new Date().toISOString(),
					},
				},
			],
		});
	}

	return chunks.length;
}

/**
 * GET /api/medium-posts
 * Pull recent articles from Brian's Medium RSS feed plus every tracked
 * author's feed, dedupe by guid, chunk + embed new ones into the articles
 * collection (tagged with `author`). Runs on a cron.
 */
export async function GET(_request: NextRequest) {
	try {
		let existingGuids = new Set<string>();
		try {
			existingGuids = await fetchExistingGuids();
		} catch (e) {
			console.log('Dedup check failed, proceeding without:', e);
		}

		let totalItems = 0;
		let storedCount = 0;
		let duplicateCount = 0;
		let totalChunks = 0;
		const storedTitles: string[] = [];
		const errors: Array<{ handle: string; error: string }> = [];

		for (const { author, handle } of FEEDS) {
			let items: MediumItem[];
			try {
				items = await fetchFeed(handle);
			} catch (e) {
				errors.push({
					handle,
					error: e instanceof Error ? e.message : 'Unknown error',
				});
				continue;
			}

			totalItems += items.length;

			for (const item of items) {
				if (existingGuids.has(item.guid)) {
					duplicateCount++;
					continue;
				}
				totalChunks += await storeArticle(item, author);
				existingGuids.add(item.guid);
				storedCount++;
				storedTitles.push(item.title);
			}
		}

		return NextResponse.json({
			success: true,
			message: `Fetched ${totalItems} articles across ${FEEDS.length} feeds, stored ${storedCount} new`,
			stored: storedCount,
			duplicates: duplicateCount,
			chunks: totalChunks,
			total: totalItems,
			storedTitles,
			feeds: FEEDS.map((f) => f.handle),
			...(errors.length > 0 && { errors }),
		});
	} catch (error) {
		console.error('Error syncing Medium posts:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to sync Medium posts',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
