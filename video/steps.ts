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
  type AvatarState,
  type Job,
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
import { dialogueTTS } from "./voice/dialogue";
import { applyLexicon } from "./voice/lexicon";
import { elevenLabsTTS, mockTTS } from "./voice/tts";

export type RenderOptions = { music?: string | null; label?: string };

export async function stepVoice(id: string, mode: RenderMode) {
  const job = await loadJob(id);
  const key = voiceKey(job.script, mode);
  if (job.voice?.key === key) return { cached: true };

  const dir = await ensureDir(workDir(id));
  const put = (name: string, local: string, type: string) =>
    store().putFile(`jobs/${id}/${name}`, local, type);

  let v: {
    provider: "elevenlabs" | "mock";
    audioPath: string;
    alignmentPath: string;
    durationSec: number;
    chars: number;
  };
  let tracks: { brian: string; host: string } | null = null;
  if (job.script.style === "podcast") {
    const d = await dialogueTTS(job.script.segments, dir, mode === "mock");
    v = d;
    tracks = {
      brian: await put("track-brian.mp3", d.tracks.brian, "audio/mpeg"),
      host: await put("track-host.mp3", d.tracks.host, "audio/mpeg"),
    };
  } else {
    // Pronunciation fixes go to TTS only; captions keep the script's spelling.
    const text = applyLexicon(narrationText(job.script.segments));
    v =
      mode === "mock"
        ? await mockTTS(text, dir)
        : await elevenLabsTTS(text, dir);
  }
  job.voice = {
    provider: v.provider,
    audio: await put("narration.mp3", v.audioPath, "audio/mpeg"),
    alignment: await put("alignment.json", v.alignmentPath, "application/json"),
    durationSec: v.durationSec,
    chars: v.chars,
    key,
    tracks,
  };
  if (v.provider === "elevenlabs")
    job.costUsd += (v.chars / 1000) * PRICING.elevenPer1kChars;
  await saveJob(job);
  return { cached: false };
}

type Role = "brian" | "host";
const roleField = (role: Role) =>
  (role === "brian" ? "avatar" : "hostAvatar") as "avatar" | "hostAvatar";
const rolesFor = (job: Job): Role[] =>
  job.script.style === "podcast" ? ["brian", "host"] : ["brian"];

async function startRole(
  job: Job,
  role: Role,
  mode: RenderMode,
): Promise<string | null> {
  if (!job.voice) throw new Error("voice step has not run");
  const field = roleField(role);
  const wantMock = mode !== "final";
  const a = job[field] ?? null;
  const fresh = a?.key === job.voice.key;

  if (fresh && a?.file && (a.provider === "mock") === wantMock) return null;
  if (!wantMock && fresh && a?.provider === "heygen" && a.pending && a.videoId)
    return a.videoId;
  // A real HeyGen avatar for this exact audio is better than a mock: reuse it.
  if (wantMock && fresh && a?.provider === "heygen" && a.file) return null;

  const dir = await ensureDir(workDir(job.id));
  const src =
    role === "brian"
      ? (job.voice.tracks?.brian ?? job.voice.audio)
      : job.voice.tracks?.host;
  if (!src) throw new Error(`no audio track for ${role}`);
  const audioPath = await materialize(
    src,
    path.join(dir, `lipsync-${role}.mp3`),
  );

  let state: AvatarState;
  if (wantMock) {
    const m = await mockAvatar(audioPath, dir, {
      name: `avatar-${role}`,
      color: role === "host" ? "0x3b1e4f" : undefined,
    });
    state = {
      provider: "mock",
      videoId: null,
      engine: null,
      file: await store().putFile(
        `jobs/${job.id}/avatar-${role}.mp4`,
        m.path,
        "video/mp4",
      ),
      durationSec: m.durationSec,
      key: job.voice.key,
      pending: false,
    };
  } else {
    const engine = role === "brian" ? env.heygenEngine : env.hostEngine;
    const videoId = await heygenSubmit(audioPath, {
      title: `${job.script.title} (${role})`,
      avatarId: role === "brian" ? env.heygenAvatarId : env.hostAvatarId,
      engine,
    });
    state = {
      provider: "heygen",
      videoId,
      engine,
      file: null,
      durationSec: 0,
      key: job.voice.key,
      pending: true,
    };
  }
  job[field] = state;
  await saveJob(job);
  return state.pending ? state.videoId : null;
}

/** Start (or resume) every avatar the script needs. Returns HeyGen ids still to poll. */
export async function stepAvatarStart(
  id: string,
  mode: RenderMode,
): Promise<string[]> {
  const pending: string[] = [];
  for (const role of rolesFor(await loadJob(id))) {
    const vid = await startRole(await loadJob(id), role, mode);
    if (vid) pending.push(vid);
  }
  return pending;
}

/** One HeyGen status check; downloads the result when it's ready. */
export async function stepAvatarCheck(
  id: string,
  videoId: string,
): Promise<"pending" | "done"> {
  const r = await heygenCheck(videoId);
  const job = await loadJob(id);
  const role: Role = job.hostAvatar?.videoId === videoId ? "host" : "brian";
  if (r.state === "pending") {
    await setRun(id, { detail: `HeyGen (${role}): ${r.status}` });
    return "pending";
  }
  const dir = await ensureDir(workDir(id));
  const local = await download(
    r.videoUrl,
    path.join(dir, `avatar-${role}.mp4`),
  );
  const durationSec = r.durationSec ?? (await probeDuration(local));
  // HeyGen's URL expires; keep our own copy.
  const file = await store().putFile(
    `jobs/${id}/avatar-${role}.mp4`,
    local,
    "video/mp4",
  );
  await updateJob(id, (j) => {
    const field = roleField(role);
    const a = j[field];
    if (!a || a.videoId !== videoId) return;
    j[field] = { ...a, file, durationSec, pending: false };
    j.costUsd +=
      (durationSec / 60) * PRICING.heygenPerMin[a.engine ?? env.heygenEngine];
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
  const hostAvatarPath =
    job.script.style === "podcast"
      ? job.hostAvatar?.file
        ? await materialize(
            job.hostAvatar.file,
            path.join(dir, "avatar-host.mp4"),
          )
        : (() => {
            throw new Error("host avatar step has not completed");
          })()
      : null;
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
    hostAvatarPath,
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
    let pending = await stepAvatarStart(id, mode);
    if (pending.length) log(`      HeyGen render(s) ${pending.join(", ")}`);
    const started = Date.now();
    while (pending.length) {
      const still: string[] = [];
      for (const vid of pending)
        if ((await stepAvatarCheck(id, vid)) === "pending") still.push(vid);
      pending = still;
      if (!pending.length) break;
      if (Date.now() - started > 45 * 60_000)
        throw new Error(
          `HeyGen render(s) ${pending.join(", ")} still not done after 45 min`,
        );
      await sleep(15_000);
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
