import "dotenv/config";
import path from "node:path";

/** Repo root, resolved from this file so the CLI works from any cwd. */
export const ROOT = path.resolve(import.meta.dirname, "..");
/** Committed, curated data: format library, tracked accounts, mined analyses. */
export const DATA_DIR = path.join(ROOT, "data", "video");
/** Generated media (gitignored via /out/). One folder per video job. */
export const OUT_DIR = path.join(ROOT, "out", "video");
export const CACHE_DIR = path.join(OUT_DIR, "_cache");
export const FONTS_DIR = path.join(ROOT, "video", "assets", "fonts");

export type HeygenEngine = "avatar_iii" | "avatar_iv" | "avatar_v";

export const env = {
  heygenKey: process.env.HEYGEN_API_KEY,
  /** A look id (GET /v3/avatars/looks?ownership=private) — passed as avatar_id. */
  heygenAvatarId: process.env.HEYGEN_AVATAR_ID,
  heygenEngine: (process.env.HEYGEN_ENGINE ?? "avatar_iv") as HeygenEngine,
  elevenKey: process.env.ELEVENLABS_API_KEY,
  elevenVoiceId: process.env.ELEVENLABS_VOICE_ID,
  elevenModel: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
  scrapeKey: process.env.SCRAPECREATORS_API_KEY,
  pexelsKey: process.env.PEXELS_API_KEY,
  llmModel: process.env.VIDEO_LLM_MODEL ?? "gpt-5",
  llmFastModel: process.env.VIDEO_LLM_FAST_MODEL ?? "gpt-5-mini",
};

/**
 * Approximate list prices (USD) used for pre-render cost estimates only.
 * HeyGen API rates per minute of output as of Oct 2026 — check your dashboard
 * at platform.heygen.com/pricing and adjust if they differ.
 */
export const PRICING = {
  heygenPerMin: { avatar_iii: 0.6, avatar_iv: 4.83, avatar_v: 7.2 } as Record<
    HeygenEngine,
    number
  >,
  elevenPer1kChars: 0.1,
};

export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env (see video/README.md).`,
    );
  }
  return value;
}
