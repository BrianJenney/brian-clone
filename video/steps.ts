/**
 * The render pipeline as small idempotent steps. Each step loads the job,
 * does one thing, saves the job. That lets the same code run:
 *   - inside Inngest (each step is its own short function invocation, with
 *     sleeps between HeyGen status checks), or
 *   - sequentially in the CLI (runRenderLocal).
 * Re-running a step after a crash is safe: work already done is skipped, and a
 * HeyGen render that was already submitted is resumed, never paid for twice.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { heygenCheck, heygenSubmit, mockAvatar } from "./avatar/heygen";
import { env, PRICING } from "./config";
import {
  loadJob,
  type RenderMode,
  saveJob,
  setRun,
  updateJob,
  voiceKey,
  workDir,
} from "./jobs";
import {
  download,
  ensureDir,
  probeDuration,
  readJson,
  sleep,
} from "./lib/util";
import { compose } from "./render/compose";
import type { Script } from "./schemas";
import { materialize, store } from "./store";
import {
  type CharAlignment,
  charsToWords,
  narrationText,
  segmentTimeline,
} from "./voice/alignment";
import { applyLexicon } from "./voice/lexicon";
import { elevenLabsTTS, mockTTS } from "./voice/tts";

export type RenderOptions = { music?: string | null; label?: string };

export async function stepVoice(id: string, mode: RenderMode) {
  const job = await loadJob(id);
  const key = voiceKey(job.script, mode);
  if (job.voice?.key === key) return { cached: true };

  const dir = await ensureDir(workDir(id));
  // Pronunciation fixes go to TTS only; captions keep the script's spelling.
  const text = applyLexicon(narrationText(job.script.segments));
  const v =
    mode === "mock" ? await mockTTS(text, dir) : await elevenLabsTTS(text, dir);
  const audio = await store().putFile(
    `jobs/${id}/narration.mp3`,
    v.audioPath,
    "audio/mpeg",
  );
  const alignment = await store().putFile(
    `jobs/${id}/alignment.json`,
    v.alignmentPath,
    "application/json",
  );
  job.voice = {
    provider: v.provider,
    audio,
    alignment,
    durationSec: v.durationSec,
    chars: v.chars,
    key,
  };
  if (v.provider === "elevenlabs")
    job.costUsd += (v.chars / 1000) * PRICING.elevenPer1kChars;
  await saveJob(job);
  return { cached: false };
}

/** Returns a HeyGen video id to poll, or null when the avatar is already ready. */
export async function stepAvatarStart(
  id: string,
  mode: RenderMode,
): Promise<string | null> {
  const job = await loadJob(id);
  if (!job.voice) throw new Error("voice step has not run");
  const wantMock = mode !== "final";
  const a = job.avatar;
  const fresh = a?.key === job.voice.key;

  if (fresh && a?.file && (a.provider === "mock") === wantMock) return null;
  if (!wantMock && fresh && a?.provider === "heygen" && a.pending && a.videoId)
    return a.videoId;
  // A real HeyGen avatar for this exact audio is better than a mock: reuse it.
  if (wantMock && fresh && a?.provider === "heygen" && a.file) return null;

  const dir = await ensureDir(workDir(id));
  const audioPath = await materialize(
    job.voice.audio,
    path.join(dir, "narration.mp3"),
  );

  if (wantMock) {
    const m = await mockAvatar(audioPath, dir);
    const file = await store().putFile(
      `jobs/${id}/avatar.mp4`,
      m.path,
      "video/mp4",
    );
    job.avatar = {
      provider: "mock",
      videoId: null,
      engine: null,
      file,
      durationSec: m.durationSec,
      key: job.voice.key,
      pending: false,
    };
    await saveJob(job);
    return null;
  }

  const videoId = await heygenSubmit(audioPath, { title: job.script.title });
  job.avatar = {
    provider: "heygen",
    videoId,
    engine: env.heygenEngine,
    file: null,
    durationSec: 0,
    key: job.voice.key,
    pending: true,
  };
  await saveJob(job);
  return videoId;
}

/** One HeyGen status check; downloads the result when it's ready. */
export async function stepAvatarCheck(
  id: string,
  videoId: string,
): Promise<"pending" | "done"> {
  const r = await heygenCheck(videoId);
  if (r.state === "pending") {
    await setRun(id, { detail: `HeyGen: ${r.status}` });
    return "pending";
  }
  const dir = await ensureDir(workDir(id));
  const local = await download(r.videoUrl, path.join(dir, "avatar.mp4"));
  const durationSec = r.durationSec ?? (await probeDuration(local));
  // HeyGen's URL expires; keep our own copy.
  const file = await store().putFile(
    `jobs/${id}/avatar.mp4`,
    local,
    "video/mp4",
  );
  await updateJob(id, (job) => {
    if (!job.avatar || job.avatar.videoId !== videoId) return;
    job.avatar = { ...job.avatar, file, durationSec, pending: false };
    job.costUsd +=
      (durationSec / 60) *
      PRICING.heygenPerMin[job.avatar.engine ?? env.heygenEngine];
  });
  return "done";
}

/** Attached media (by segment) → local files the compositor can use. */
async function withAttachedMedia(
  script: Script,
  media: Record<string, string>,
  dir: string,
): Promise<Script> {
  const segments = [...script.segments];
  for (const [n, ref] of Object.entries(media)) {
    const i = Number(n) - 1;
    const seg = segments[i];
    if (!seg) continue;
    const ext = (
      ref.split("?")[0].match(/\.(mp4|mov|webm|png|jpe?g)$/i)?.[0] ?? ".mp4"
    ).toLowerCase();
    const name = `media-${n}${ext}`;
    await materialize(ref, path.join(dir, name));
    segments[i] =
      seg.visual.kind === "broll"
        ? { ...seg, visual: { ...seg.visual, file: name } }
        : seg.visual.kind === "screen"
          ? { ...seg, visual: { ...seg.visual, file: name } }
          : {
              ...seg,
              visual: { kind: "screen", note: "attached media", file: name },
              layout: "split",
            };
  }
  return { ...script, segments };
}

export async function stepCompose(
  id: string,
  mode: RenderMode,
  opts: RenderOptions = {},
) {
  const job = await loadJob(id);
  if (!job.voice || !job.avatar?.file)
    throw new Error("voice/avatar steps have not completed");
  const dir = await ensureDir(workDir(id));

  const audioPath = await materialize(
    job.voice.audio,
    path.join(dir, "narration.mp3"),
  );
  const alignPath = await materialize(
    job.voice.alignment,
    path.join(dir, "alignment.json"),
  );
  const avatarPath = await materialize(
    job.avatar.file,
    path.join(dir, "avatar.mp4"),
  );
  const script = await withAttachedMedia(job.script, job.media, dir);

  const spokenWords = charsToWords(await readJson<CharAlignment>(alignPath));
  // Show the script's spelling ("AIVARA") at the spoken word's timing ("Eye-vara").
  const written = narrationText(script.segments).split(/\s+/).filter(Boolean);
  const words =
    written.length === spokenWords.length
      ? spokenWords.map((w, i) => ({ ...w, text: written[i] }))
      : spokenWords;
  const timeline = segmentTimeline(
    script.segments,
    words,
    job.voice.durationSec,
  );
  const r = await compose({
    jobDir: dir,
    script,
    timeline,
    avatarPath,
    audioPath,
    durationSec: job.voice.durationSec,
    musicPath: opts.music ?? null,
    label: opts.label,
  });
  const video = await store().putFile(
    `jobs/${id}/final-${mode}.mp4`,
    r.path,
    "video/mp4",
  );
  const cover = await store().putFile(
    `jobs/${id}/cover-${mode}.jpg`,
    r.cover,
    "image/jpeg",
  );

  await updateJob(id, (j) => {
    j.render = {
      mode,
      video,
      cover,
      at: new Date().toISOString(),
      warnings: r.warnings,
    };
    if (mode === "final") j.status = "rendered";
  });
  if (store().kind === "blob")
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  return { video, cover, warnings: r.warnings };
}

/** Run the whole pipeline in-process (CLI). */
export async function runRenderLocal(
  id: string,
  mode: RenderMode,
  opts: RenderOptions & { log?: (s: string) => void } = {},
) {
  const log = opts.log ?? ((s: string) => console.log(s));
  await setRun(id, {
    mode,
    stage: "voice",
    startedAt: new Date().toISOString(),
    error: null,
    detail: null,
  });
  try {
    log(`  🎙  voice (${mode === "mock" ? "mock" : "ElevenLabs"})…`);
    const v = await stepVoice(id, mode);
    if (v.cached) log("      cached");

    await setRun(id, { stage: "avatar" });
    log(
      `  🧍 avatar (${mode === "final" ? `HeyGen ${env.heygenEngine}` : "mock"})…`,
    );
    const videoId = await stepAvatarStart(id, mode);
    if (videoId) {
      log(`      HeyGen render ${videoId}`);
      const started = Date.now();
      while ((await stepAvatarCheck(id, videoId)) === "pending") {
        if (Date.now() - started > 45 * 60_000)
          throw new Error(
            `HeyGen render ${videoId} still not done after 45 min`,
          );
        await sleep(15_000);
      }
    }

    await setRun(id, { stage: "compositing", detail: null });
    log("  🎬 compositing…");
    const r = await stepCompose(id, mode, opts);
    await setRun(id, { stage: "done" });
    return r;
  } catch (e) {
    await setRun(id, { stage: "failed", error: (e as Error).message });
    throw e;
  }
}
