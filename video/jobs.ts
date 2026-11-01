/**
 * A job = one short. State lives in the store (Vercel Blob or out/video/jobs/<id>/)
 * so the same job can be created from Claude via MCP, rendered by Inngest, and
 * inspected from the CLI, or any mix of those.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env, type HeygenEngine, OUT_DIR, PRICING } from "./config";
import { money, sha1, slug } from "./lib/util";
import { type Script, ScriptSchema } from "./schemas";
import { estimateSeconds, wordCount } from "./script/write";
import { store } from "./store";
import { narrationText } from "./voice/alignment";
import { applyLexicon } from "./voice/lexicon";

/**
 * mock  = $0: silent voice + placeholder avatar (layout, timing, captions)
 * voice = ~$0.05: real ElevenLabs voice + placeholder avatar
 * final = real voice + HeyGen digital twin (~$2–3)
 */
export type RenderMode = "mock" | "voice" | "final";
export type Stage =
  | "queued"
  | "voice"
  | "avatar"
  | "compositing"
  | "done"
  | "failed";

export type Job = {
  id: string;
  createdAt: string;
  status: "draft" | "approved" | "rendered";
  approvedAt: string | null;
  script: Script;
  /** Per-segment media overrides (1-based segment number → ref), e.g. a screen recording URL. */
  media: Record<string, string>;
  voice: {
    provider: "elevenlabs" | "mock";
    audio: string;
    alignment: string;
    durationSec: number;
    chars: number;
    /** Hash of text + voice settings: the cache key for everything downstream. */
    key: string;
  } | null;
  avatar: {
    provider: "heygen" | "mock";
    videoId: string | null;
    engine: HeygenEngine | null;
    file: string | null;
    durationSec: number;
    /** voice.key this avatar was rendered against. */
    key: string;
    /** Submitted to HeyGen but not downloaded yet — resume instead of paying twice. */
    pending: boolean;
  } | null;
  render: {
    mode: RenderMode;
    video: string;
    cover: string;
    at: string;
    warnings: string[];
  } | null;
  run: {
    mode: RenderMode;
    stage: Stage;
    startedAt: string;
    updatedAt: string;
    error: string | null;
    detail: string | null;
  } | null;
  costUsd: number;
  posts: Array<{ platform: string; url: string; postedAt: string }>;
};

const jobKey = (id: string) => `jobs/${id}/job.json`;

/** Local scratch dir for a job. In local-store mode this IS the job folder. */
export function workDir(id: string) {
  return store().kind === "local"
    ? path.join(OUT_DIR, "jobs", id)
    : path.join(OUT_DIR, "work", id);
}

function normalizeJob(raw: Job): Job {
  return {
    ...raw,
    media: raw.media ?? {},
    run: raw.run ?? null,
    // Re-validate in case the script was hand-edited. Older jobs predate `audience`.
    script: ScriptSchema.parse({
      ...raw.script,
      audience: (raw.script as { audience?: string | null }).audience ?? null,
      hookOptions: (raw.script as { hookOptions?: string[] }).hookOptions ?? [],
    }),
  };
}

export async function loadJob(id: string): Promise<Job> {
  const raw = await store().readJson<Job>(jobKey(id));
  if (!raw)
    throw new Error(
      `No video job "${id}". Use video_list_jobs / \`yarn video list\` to find it.`,
    );
  return normalizeJob(raw);
}

export async function saveJob(job: Job) {
  await store().writeJson(jobKey(job.id), job);
  if (store().kind === "local") {
    await fs.writeFile(
      path.join(workDir(job.id), "script.md"),
      scriptMarkdown(job),
    );
  }
}

/** Read-modify-write helper used by every step. */
export async function updateJob(
  id: string,
  fn: (job: Job) => void | Promise<void>,
) {
  const job = await loadJob(id);
  await fn(job);
  await saveJob(job);
  return job;
}

export async function setRun(
  id: string,
  patch: Partial<NonNullable<Job["run"]>>,
) {
  return updateJob(id, (job) => {
    const now = new Date().toISOString();
    job.run = {
      mode: patch.mode ?? job.run?.mode ?? "mock",
      stage: patch.stage ?? job.run?.stage ?? "queued",
      startedAt: patch.startedAt ?? job.run?.startedAt ?? now,
      updatedAt: now,
      error: patch.error !== undefined ? patch.error : (job.run?.error ?? null),
      detail:
        patch.detail !== undefined ? patch.detail : (job.run?.detail ?? null),
    };
  });
}

export async function listJobs(): Promise<Job[]> {
  const keys = await store().listKeys("jobs/", "job.json");
  const jobs = await Promise.all(
    keys.map((k) =>
      store()
        .readJson<Job>(k)
        .catch(() => null),
    ),
  );
  return jobs
    .filter((j): j is Job => !!j)
    .map((j) => ({ ...j, media: j.media ?? {}, run: j.run ?? null }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createJob(script: Script): Promise<Job> {
  const date = new Date().toISOString().slice(0, 10);
  const id = `${date}-${slug(script.title, 36)}-${sha1(JSON.stringify(script) + Date.now()).slice(0, 4)}`;
  const job: Job = {
    id,
    createdAt: new Date().toISOString(),
    status: "draft",
    approvedAt: null,
    script,
    media: {},
    voice: null,
    avatar: null,
    render: null,
    run: null,
    costUsd: 0,
    posts: [],
  };
  if (store().kind === "local")
    await fs.mkdir(workDir(id), { recursive: true });
  await saveJob(job);
  return job;
}

export function voiceKey(script: Script, mode: RenderMode) {
  return sha1(
    `${applyLexicon(narrationText(script.segments))}|${mode === "mock" ? "mock" : `${env.elevenVoiceId}|${env.elevenModel}`}`,
  );
}

export function estimateCost(
  script: Script,
  engine: HeygenEngine = env.heygenEngine,
) {
  const secs = estimateSeconds(script);
  const voice =
    (narrationText(script.segments).length / 1000) * PRICING.elevenPer1kChars;
  const avatar = (secs / 60) * PRICING.heygenPerMin[engine];
  return { secs, voice, avatar, total: voice + avatar };
}

/** What a render in this mode will actually charge, given what's already cached. */
export function estimateRunCost(job: Job, mode: RenderMode) {
  if (mode === "mock") return 0;
  const est = estimateCost(job.script);
  const key = voiceKey(job.script, mode);
  const voiceCached =
    job.voice?.key === key && job.voice.provider === "elevenlabs";
  const avatarCached =
    job.avatar?.key === key &&
    job.avatar.provider === "heygen" &&
    (!!job.avatar.file || job.avatar.pending);
  return (
    (voiceCached ? 0 : est.voice) +
    (mode === "final" && !avatarCached ? est.avatar : 0)
  );
}

export function scriptMarkdown(job: Job) {
  const s = job.script;
  const est = estimateCost(s);
  const rows = s.segments
    .map((seg, i) => {
      const v = seg.visual;
      const attached = job.media[String(i + 1)];
      const vis = attached
        ? `📎 attached media${seg.layout === "split" ? "" : ""}`
        : v.kind === "avatar"
          ? `avatar (${v.framing})`
          : v.kind === "card"
            ? `card: **${v.headline}**${v.sub ? ` / ${v.sub}` : ""}`
            : v.kind === "broll"
              ? `b-roll: "${v.query}"${v.file ? ` [${v.file}]` : ""}`
              : `🎥 SCREEN (needs recording): ${v.note}`;
      const spoken = applyLexicon(seg.text);
      const said =
        spoken === seg.text ? seg.text : `${seg.text} _(says: ${spoken})_`;
      return `| ${i + 1} | ${said.replace(/\|/g, "/")} | ${vis}${seg.layout === "split" ? " · split" : ""} |`;
    })
    .join("\n");
  return `# ${s.title}

- **Job:** \`${job.id}\` · **Audience:** ${s.audience ?? "general"} · **Status:** ${job.status}${job.run ? ` · **Render:** ${job.run.mode} → ${job.run.stage}` : ""} · **Format:** ${s.formatId}
- **Length:** ~${Math.round(est.secs)}s (${wordCount(s)} words) · **Est. final cost:** ${money(est.total)} (voice ${money(est.voice)}, avatar ${money(est.avatar)})
- **Hook overlay:** ${s.hookOverlay}
${s.hookOptions.length ? `- **Hook options:** ${s.hookOptions.map((h, i) => `(${i + 1}) ${h}`).join("  ")}` : ""}

| # | Says | Visual |
|---|------|--------|
${rows}

**Caption:** ${s.caption}

**Hashtags:** ${s.hashtags.map((h) => `#${h}`).join(" ")}

**Drawn from:** ${s.sources.join("; ") || "—"}
${job.render ? `\n**Latest render (${job.render.mode}):** ${job.render.video}\n` : ""}`;
}
