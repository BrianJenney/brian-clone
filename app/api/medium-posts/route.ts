import * as cheerio from "cheerio";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateEmbedding } from "@/libs/openai";
import { COLLECTIONS, qdrantClient } from "@/libs/qdrant";
import { chunkTextWithOverlap } from "@/libs/utils/chunking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIUM_HANDLE = process.env.MEDIUM_HANDLE || "@brianjenney";
const FEED_URL = `https://medium.com/feed/${MEDIUM_HANDLE}`;

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
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** Extract readable text from a Medium content:encoded HTML blob. */
function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  let content = "";
  $("p, h1, h2, h3, h4, li").each((_, el) => {
    const text = $(el).text().trim();
    if (text) content += text + "\n\n";
  });
  return content.trim();
}

async function fetchFeed(): Promise<MediumItem[]> {
  const response = await fetch(FEED_URL, {
    headers: { "User-Agent": "brian-clone-ingest/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Medium RSS error: ${response.status}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: MediumItem[] = [];

  $("item").each((_, el) => {
    const item = $(el);
    const guid = item.find("guid").first().text().trim();
    const title = item.find("title").first().text().trim();
    const link = item.find("link").first().text().trim();
    const pubDate = item.find("pubDate").first().text().trim();
    const encoded = item.find("content\\:encoded").first().text();
    const tags = item
      .find("category")
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
      with_payload: ["guid"],
      offset: offset ?? undefined,
    });
    for (const point of result.points) {
      const guid = (point.payload as Record<string, unknown>)?.guid;
      if (typeof guid === "string") existing.add(guid);
    }
    offset = result.next_page_offset as string | number | null;
  } while (offset !== null && offset !== undefined);

  return existing;
}

async function storeArticle(item: MediumItem): Promise<number> {
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
            contentType: "article",
            baseId,
            chunkIndex: chunk.index,
            totalChunks: chunk.totalChunks,
            source: "medium-rss",
            guid: item.guid,
            title: item.title,
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
 * Pull recent articles from Brian's Medium RSS feed, dedupe by guid,
 * chunk + embed new ones into the articles collection. Runs on a cron.
 */
export async function GET(_request: NextRequest) {
  try {
    const items = await fetchFeed();

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No articles in feed",
        stored: 0,
        total: 0,
      });
    }

    let existingGuids = new Set<string>();
    try {
      existingGuids = await fetchExistingGuids();
    } catch (e) {
      console.log("Dedup check failed, proceeding without:", e);
    }

    let storedCount = 0;
    let duplicateCount = 0;
    let totalChunks = 0;
    const storedTitles: string[] = [];

    for (const item of items) {
      if (existingGuids.has(item.guid)) {
        duplicateCount++;
        continue;
      }
      totalChunks += await storeArticle(item);
      storedCount++;
      storedTitles.push(item.title);
    }

    return NextResponse.json({
      success: true,
      message: `Fetched ${items.length} articles, stored ${storedCount} new`,
      stored: storedCount,
      duplicates: duplicateCount,
      chunks: totalChunks,
      total: items.length,
      storedTitles,
      feed: FEED_URL,
    });
  } catch (error) {
    console.error("Error syncing Medium posts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync Medium posts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
