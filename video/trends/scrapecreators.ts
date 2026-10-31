/**
 * ScrapeCreators client (https://docs.scrapecreators.com). One credit per call.
 * The official TikTok/Instagram APIs can't do niche-wide discovery, so we use a
 * vendor that serves public, logged-out data.
 */
import { env, requireEnv } from "../config";
import { fetchJson } from "../lib/util";
import type { Platform, Post } from "../schemas";

const BASE = "https://api.scrapecreators.com";

async function sc<T>(
  pathname: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  const key = requireEnv(env.scrapeKey, "SCRAPECREATORS_API_KEY");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined) qs.set(k, v);
  return fetchJson<T>(`${BASE}${pathname}?${qs}`, {
    headers: { "x-api-key": key },
  });
}

// ---------- TikTok ----------

type Aweme = {
  aweme_id: string;
  desc?: string;
  create_time?: number;
  url?: string;
  statistics?: {
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
  };
  video?: { duration?: number };
  author?: { unique_id?: string; follower_count?: number };
};

function fromAweme(a: Aweme, handleHint?: string): Post {
  const handle = a.author?.unique_id ?? handleHint ?? "unknown";
  const durMs = a.video?.duration;
  return {
    platform: "tiktok",
    id: a.aweme_id,
    url: a.url ?? `https://www.tiktok.com/@${handle}/video/${a.aweme_id}`,
    handle,
    caption: a.desc ?? "",
    views: a.statistics?.play_count ?? 0,
    likes: a.statistics?.digg_count ?? null,
    comments: a.statistics?.comment_count ?? null,
    shares: a.statistics?.share_count ?? null,
    followers: a.author?.follower_count ?? null,
    // TikTok reports ms in v3 responses; guard against seconds.
    durationSec: durMs ? (durMs > 1000 ? durMs / 1000 : durMs) : null,
    postedAt: new Date((a.create_time ?? 0) * 1000).toISOString(),
  };
}

export async function tiktokProfileVideos(handle: string): Promise<Post[]> {
  const res = await sc<{ aweme_list?: Aweme[] }>("/v3/tiktok/profile/videos", {
    handle,
    sort_by: "latest",
    trim: "true",
  });
  return (res.aweme_list ?? []).map((a) => fromAweme(a, handle));
}

export async function tiktokKeywordSearch(
  query: string,
  datePosted: "this-week" | "this-month" | "last-3-months" = "this-month",
): Promise<Post[]> {
  const res = await sc<{
    search_item_list?: Array<Aweme | { aweme_info: Aweme }>;
  }>("/v1/tiktok/search/keyword", {
    query,
    date_posted: datePosted,
    sort_by: "relevance",
    trim: "true",
  });
  return (res.search_item_list ?? []).map((it) =>
    fromAweme("aweme_info" in it ? it.aweme_info : it),
  );
}

// ---------- Instagram ----------

type Reel = {
  id: string;
  code: string;
  taken_at?: number;
  caption?: { text?: string } | null;
  play_count?: number;
  ig_play_count?: number;
  like_count?: number;
  comment_count?: number;
  video_duration?: number | null;
  user?: { username?: string };
  url?: string;
};

export async function instagramReels(
  handle: string,
  followers?: number,
): Promise<Post[]> {
  const res = await sc<{ items?: Array<Reel | { media: Reel }> }>(
    "/v1/instagram/user/reels",
    {
      handle,
      trim: "true",
    },
  );
  return (res.items ?? []).map((raw) => {
    const r = "media" in raw ? raw.media : raw;
    return {
      platform: "instagram" as const,
      id: r.id,
      url: r.url ?? `https://www.instagram.com/reel/${r.code}/`,
      handle: r.user?.username ?? handle,
      caption: r.caption?.text ?? "",
      views: r.ig_play_count ?? r.play_count ?? 0,
      likes: r.like_count ?? null,
      comments: r.comment_count ?? null,
      shares: null,
      followers: followers ?? null,
      durationSec: r.video_duration ?? null,
      postedAt: new Date((r.taken_at ?? 0) * 1000).toISOString(),
    };
  });
}

// ---------- YouTube Shorts ----------

type Short = {
  id: string;
  url: string;
  title?: string;
  viewCountInt?: number;
  likeCountInt?: number;
  commentCountInt?: number;
  publishDate?: string;
  durationMs?: number;
};

export async function youtubeShorts(handle: string): Promise<Post[]> {
  const res = await sc<{ shorts?: Short[] }>("/v1/youtube/channel/shorts", {
    handle,
    sort: "newest",
  });
  return (res.shorts ?? []).map((s) => ({
    platform: "youtube" as const,
    id: s.id,
    url: s.url,
    handle,
    caption: s.title ?? "",
    views: s.viewCountInt ?? 0,
    likes: s.likeCountInt ?? null,
    comments: s.commentCountInt ?? null,
    shares: null,
    followers: null,
    durationSec: s.durationMs ? s.durationMs / 1000 : null,
    // Shorts tab often omits dates; treat unknown as old enough to score.
    postedAt: s.publishDate ?? new Date(0).toISOString(),
  }));
}

export async function fetchAccount(
  platform: Platform,
  handle: string,
): Promise<Post[]> {
  if (platform === "tiktok") return tiktokProfileVideos(handle);
  if (platform === "instagram") return instagramReels(handle);
  return youtubeShorts(handle);
}

// ---------- Transcripts ----------

/** Strip WEBVTT cues down to plain text. */
export function vttToText(vtt: string): string {
  return vtt
    .split("\n")
    .filter(
      (l) =>
        l.trim() &&
        !/^WEBVTT/.test(l) &&
        !/-->/.test(l) &&
        !/^\d+$/.test(l.trim()),
    )
    .join(" ")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function transcript(
  platform: Platform,
  url: string,
): Promise<string> {
  if (platform === "tiktok") {
    const r = await sc<{ transcript?: string | null }>(
      "/v1/tiktok/video/transcript",
      {
        url,
        use_ai_as_fallback: "true",
      },
    );
    return vttToText(r.transcript ?? "");
  }
  if (platform === "instagram") {
    const r = await sc<{
      transcripts?: Array<{ text?: string }>;
      transcript?: string;
    }>("/v2/instagram/media/transcript", { url });
    return (
      r.transcript ??
      r.transcripts?.map((t) => t.text ?? "").join(" ") ??
      ""
    ).trim();
  }
  const r = await sc<{ transcript_only_text?: string }>(
    "/v1/youtube/video/transcript",
    { url },
  );
  return (r.transcript_only_text ?? "").trim();
}

// ---------- Ad libraries ----------

export type AdRecord = {
  source: "meta" | "tiktok";
  id: string;
  url: string;
  advertiser: string;
  body: string;
  startedAt: string | null;
  daysRunning: number | null;
  isActive: boolean | null;
  hasVideo: boolean;
};

type MetaAd = {
  ad_archive_id: string;
  url?: string;
  page_name?: string;
  is_active?: boolean;
  start_date?: number;
  end_date?: number;
  snapshot?: {
    body?: { text?: string };
    videos?: unknown[];
    cards?: Array<{
      body?: string;
      video_hd_url?: string;
      video_sd_url?: string;
    }>;
    display_format?: string;
  };
};

/**
 * Meta Ad Library keyword search. Ads that have been running for a long time are
 * the closest public proxy for "this ad is profitable" — advertisers kill losers fast.
 */
export async function metaAdSearch(
  query: string,
  country = "US",
): Promise<AdRecord[]> {
  const res = await sc<{ searchResults?: MetaAd[] }>(
    "/v1/facebook/adLibrary/search/ads",
    {
      query,
      country,
      status: "ACTIVE",
      media_type: "VIDEO",
      trim: "true",
    },
  );
  const now = Date.now() / 1000;
  return (res.searchResults ?? []).map((a) => {
    const start = a.start_date ?? null;
    const end = a.is_active ? now : (a.end_date ?? now);
    const snap = a.snapshot ?? {};
    return {
      source: "meta" as const,
      id: a.ad_archive_id,
      url:
        a.url ?? `https://www.facebook.com/ads/library/?id=${a.ad_archive_id}`,
      advertiser: a.page_name ?? "",
      body: snap.body?.text ?? snap.cards?.[0]?.body ?? "",
      startedAt: start ? new Date(start * 1000).toISOString() : null,
      daysRunning: start ? Math.round((end - start) / 86400) : null,
      isActive: a.is_active ?? null,
      hasVideo:
        (snap.videos?.length ?? 0) > 0 || snap.display_format === "VIDEO",
    };
  });
}

type TikTokAd = {
  id: string;
  url?: string;
  name?: string;
  first_shown_date?: number;
  last_shown_date?: number;
  videos?: unknown[];
};

export async function tiktokAdSearch(query: string): Promise<AdRecord[]> {
  const res = await sc<{ ads?: TikTokAd[] }>("/v1/tiktok/ad-library/search", {
    query,
  });
  return (res.ads ?? []).map((a) => {
    const first = a.first_shown_date ?? null; // ms
    const last = a.last_shown_date ?? Date.now();
    return {
      source: "tiktok" as const,
      id: a.id,
      url: a.url ?? `https://library.tiktok.com/ads/detail/?ad_id=${a.id}`,
      advertiser: a.name ?? "",
      body: "",
      startedAt: first ? new Date(first).toISOString() : null,
      daysRunning: first ? Math.round((last - first) / 86_400_000) : null,
      isActive: null,
      hasVideo: (a.videos?.length ?? 0) > 0,
    };
  });
}

export async function metaAdTranscript(id: string): Promise<string> {
  const r = await sc<{ transcript?: string; transcript_only_text?: string }>(
    "/v1/facebook/adLibrary/ad/transcript",
    { id },
  );
  return vttToText(r.transcript_only_text ?? r.transcript ?? "");
}
