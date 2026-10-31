import path from "node:path";
import { DATA_DIR, env, OUT_DIR } from "../config";
import { llmParse } from "../lib/llm";
import { appendJsonl, readJson, readJsonl, writeJson } from "../lib/util";
import { ANALYSES_PATH, loadFormats } from "../library/formats";
import {
  AnalysisSchema,
  type Platform,
  type Post,
  type ScoredPost,
  type StoredAnalysis,
} from "../schemas";
import { rankOutliers, scorePosts } from "./outliers";
import {
  type AdRecord,
  fetchAccount,
  metaAdSearch,
  metaAdTranscript,
  tiktokAdSearch,
  tiktokKeywordSearch,
  transcript,
} from "./scrapecreators";

type AccountsFile = {
  keywords: string[];
  accounts: Array<{ platform: Platform; handle: string }>;
};

export const ACCOUNTS_PATH = path.join(DATA_DIR, "accounts.json");
const SNAPSHOT_PATH = path.join(OUT_DIR, "_trends", "latest-posts.json");
export const OUTLIERS_PATH = path.join(DATA_DIR, "outliers.json");
export const ADS_PATH = path.join(DATA_DIR, "ads.json");

/** Pull recent posts for every tracked account + keyword, score them, save outliers. */
export async function pullTrends({ keywords = true } = {}) {
  const cfg = await readJson<AccountsFile>(ACCOUNTS_PATH);
  const posts: Post[] = [];
  const errors: string[] = [];

  for (const a of cfg.accounts) {
    try {
      const got = await fetchAccount(a.platform, a.handle);
      posts.push(...got);
      console.log(`  ${a.platform}/${a.handle}: ${got.length} posts`);
    } catch (e) {
      errors.push(`${a.platform}/${a.handle}: ${(e as Error).message}`);
    }
  }
  if (keywords) {
    for (const k of cfg.keywords) {
      try {
        const got = await tiktokKeywordSearch(k);
        posts.push(...got);
        console.log(`  tiktok search "${k}": ${got.length} posts`);
      } catch (e) {
        errors.push(`search "${k}": ${(e as Error).message}`);
      }
    }
  }

  const unique = [
    ...new Map(posts.map((p) => [`${p.platform}:${p.id}`, p])).values(),
  ];
  await writeJson(SNAPSHOT_PATH, unique);
  const outliers = rankOutliers(scorePosts(unique));
  await writeJson(OUTLIERS_PATH, outliers);
  return { posts: unique.length, outliers, errors };
}

/** Find new accounts worth tracking from a keyword: authors of outlier posts. */
export async function discoverAccounts(keyword: string) {
  const posts = await tiktokKeywordSearch(keyword, "last-3-months");
  const scored = scorePosts(posts).filter((p) => p.viewsPerFollower !== null);
  const byHandle = new Map<
    string,
    { handle: string; followers: number | null; best: number }
  >();
  for (const p of scored) {
    const cur = byHandle.get(p.handle);
    const v = p.viewsPerFollower ?? 0;
    if (!cur || v > cur.best)
      byHandle.set(p.handle, {
        handle: p.handle,
        followers: p.followers,
        best: v,
      });
  }
  return [...byHandle.values()].sort((a, b) => b.best - a.best);
}

/** Transcribe + structurally analyze the top N outliers that haven't been analyzed yet. */
export async function analyzeOutliers({ limit = 10 } = {}) {
  const outliers = await readJson<ScoredPost[]>(OUTLIERS_PATH, []);
  const done = new Set(
    (await readJsonl<StoredAnalysis>(ANALYSES_PATH)).map((a) => a.url),
  );
  const formats = await loadFormats();
  const formatList = formats
    .map((f) => `- ${f.id}: ${f.name} — beats: ${f.beats.join(" → ")}`)
    .join("\n");

  const todo = outliers.filter((o) => !done.has(o.url)).slice(0, limit);
  const results: StoredAnalysis[] = [];
  for (const o of todo) {
    try {
      const text = await transcript(o.platform, o.url);
      if (text.length < 40) {
        console.log(`  skip (no speech): ${o.url}`);
        continue;
      }
      const analysis = await llmParse(
        AnalysisSchema,
        "analysis",
        `Analyze why this short-form video outperformed its account's baseline.
Platform: ${o.platform} | Views: ${o.views} | ${o.multiple ? `${o.multiple}x account median` : `${o.viewsPerFollower}x followers`} | Duration: ${o.durationSec ?? "?"}s
Caption: ${o.caption}

Transcript:
${text.slice(0, 6000)}

Known formats (match one by id if the STRUCTURE fits; ignore topic):
${formatList}

The person reusing this is a senior developer who runs a coding bootcamp and teaches practical AI engineering (RAG, agents) to career changers.`,
        { model: env.llmFastModel },
      );
      const row: StoredAnalysis = {
        ...analysis,
        url: o.url,
        platform: o.platform,
        handle: o.handle,
        views: o.views,
        multiple: o.multiple,
        transcript: text,
        analyzedAt: new Date().toISOString(),
      };
      results.push(row);
      await appendJsonl(ANALYSES_PATH, [row]);
      console.log(
        `  ✓ ${analysis.hookType} | ${analysis.formatId ?? "NEW"} | "${analysis.hook.slice(0, 70)}"`,
      );
    } catch (e) {
      console.log(`  ✗ ${o.url}: ${(e as Error).message}`);
    }
  }
  return results;
}

/**
 * Ad library mining: the closest public proxy for "this ad makes money" is how
 * long it's been running. Pull long-running video ads for a query, transcribe the
 * top ones (Meta only — TikTok's library doesn't expose transcripts), save them.
 */
export async function pullAds(
  query: string,
  { minDays = 21, transcribe = 5 } = {},
) {
  const [meta, tiktok] = await Promise.allSettled([
    metaAdSearch(query),
    tiktokAdSearch(query),
  ]);
  const ads: AdRecord[] = [
    ...(meta.status === "fulfilled" ? meta.value : []),
    ...(tiktok.status === "fulfilled" ? tiktok.value : []),
  ];
  const winners = ads
    .filter((a) => a.hasVideo && (a.daysRunning ?? 0) >= minDays)
    .sort((a, b) => (b.daysRunning ?? 0) - (a.daysRunning ?? 0));

  const withTranscripts: Array<
    AdRecord & { transcript: string | null; query: string }
  > = [];
  for (const [i, ad] of winners.entries()) {
    let t: string | null = null;
    if (i < transcribe && ad.source === "meta") {
      try {
        t = await metaAdTranscript(ad.id);
      } catch {
        t = null;
      }
    }
    withTranscripts.push({ ...ad, transcript: t, query });
  }

  const existing = await readJson<typeof withTranscripts>(ADS_PATH, []);
  const merged = [
    ...new Map(
      [...existing, ...withTranscripts].map((a) => [`${a.source}:${a.id}`, a]),
    ).values(),
  ];
  await writeJson(ADS_PATH, merged);
  return {
    found: ads.length,
    winners: withTranscripts,
    errors: [meta, tiktok]
      .filter((r) => r.status === "rejected")
      .map((r) => String((r as PromiseRejectedResult).reason)),
  };
}
