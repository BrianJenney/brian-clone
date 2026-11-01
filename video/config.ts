import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * True inside a deployed function (read-only filesystem except /tmp). Not just
 * `VERCEL=1`: `vercel env pull` copies that into local .env files too.
 */
export const SERVERLESS =
  process.env.VIDEO_SERVERLESS === "1" ||
  (!!process.env.VERCEL && process.cwd().startsWith("/var/task"));

/**
 * Repo root. The CLI runs from the repo root (yarn), and Next.js functions run
 * with cwd = project root, so cwd works for both (import.meta paths don't
 * survive bundling).
 */
export const ROOT = process.env.VIDEO_ROOT ?? process.cwd();
/** Committed, curated data: format library, tracked accounts, mined analyses. */
export const DATA_DIR = path.join(ROOT, "data", "video");
/**
 * Local job folders (CLI without Blob) and scratch space for rendering.
 * Gitignored via /out/. On Vercel this has to live in /tmp.
 */
export const OUT_DIR = SERVERLESS
  ? path.join(os.tmpdir(), "brian-video")
  : path.join(ROOT, "out", "video");
export const CACHE_DIR = path.join(OUT_DIR, "_cache");
export const FONTS_DIR = path.join(ROOT, "video", "assets", "fonts");

/**
 * FFmpeg binary: $FFMPEG_PATH, else the bundled static build (has libass, and is
 * what runs on Vercel), else whatever `ffmpeg` is on PATH.
 */
export function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const bundled = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");
  if (SERVERLESS && existsSync(bundled)) return bundled;
  return "ffmpeg";
}

/**
 * Env for FFmpeg. Vercel's runtime has no /etc/fonts, so the static build's
 * fontconfig would find nothing; point it at a generated config that only
 * knows our bundled fonts.
 */
export function ffmpegEnv(): NodeJS.ProcessEnv {
  if (process.env.FONTCONFIG_FILE || existsSync("/etc/fonts/fonts.conf"))
    return process.env;
  const dir = path.join(os.tmpdir(), "brian-video-fontconfig");
  const file = path.join(dir, "fonts.conf");
  if (!existsSync(file)) {
    mkdirSync(path.join(dir, "cache"), { recursive: true });
    writeFileSync(
      file,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><dir>${FONTS_DIR}</dir><cachedir>${path.join(dir, "cache")}</cachedir></fontconfig>\n`,
    );
  }
  return { ...process.env, FONTCONFIG_FILE: file };
}

/** x264 preset for the final encode. Serverless CPUs are slow; trade size for time. */
export const X264_PRESET =
  process.env.VIDEO_X264_PRESET ?? (SERVERLESS ? "veryfast" : "medium");

export type HeygenEngine = "avatar_iii" | "avatar_iv" | "avatar_v";

export const env = {
  heygenKey: process.env.HEYGEN_API_KEY,
  /** A look id (GET /v3/avatars/looks?ownership=private) — passed as avatar_id. */
  heygenAvatarId: process.env.HEYGEN_AVATAR_ID,
  heygenEngine: (process.env.HEYGEN_ENGINE ?? "avatar_iv") as HeygenEngine,
  elevenKey: process.env.ELEVENLABS_API_KEY,
  // Brian's Professional Voice Clone. Not a secret: useless without the API key.
  elevenVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "FQdOEGfTV7PMYQrRB5zz",
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
