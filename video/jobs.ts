/**
 * A job = one short. Everything lives in out/video/<id>/ so any step can be
 * re-run without re-paying for the steps before it:
 *
 *   job.json        state + script (edit the script here before approving)
 *   script.md       human-readable review copy
 *   narration.mp3   + alignment.json   (voice step)
 *   avatar.mp4      (avatar step — the only expensive one)
 *   screen-N.mp4    your screen recordings, if the script asks for them
 *   final.mp4       + cover.jpg + captions.ass
 */
import fs from "node:fs/promises";
import path from "node:path";
import { type AvatarResult, heygenRender, mockAvatar } from "./avatar/heygen";
import { env, type HeygenEngine, OUT_DIR, PRICING } from "./config";
import {
  ensureDir,
  exists,
  money,
  readJson,
  sha1,
  slug,
  writeJson,
} from "./lib/util";
import { compose, missingAssets } from "./render/compose";
import { type Script, ScriptSchema } from "./schemas";
import { estimateSeconds, wordCount } from "./script/write";
import {
  type CharAlignment,
  charsToWords,
  narrationText,
  segmentTimeline,
} from "./voice/alignment";
import { elevenLabsTTS, mockTTS, type VoiceResult } from "./voice/tts";

export type Job = {
  id: string;
  createdAt: string;
  status: "draft" | "approved" | "rendered";
  approvedAt: string | null;
  script: Script;
  voice: (VoiceResult & { textHash: string }) | null;
  avatar:
    | (AvatarResult & { audioHash: string; pendingVideoId?: string | null })
    | null;
  render: {
    path: string;
    cover: string;
    at: string;
    warnings: string[];
  } | null;
  costUsd: number;
  posts: Array<{ platform: string; url: string; postedAt: string }>;
};

export const jobDir = (id: string) => path.join(OUT_DIR, id);
const jobPath = (id: string) => path.join(jobDir(id), "job.json");

export async function loadJob(id: string): Promise<Job> {
  if (!(await exists(jobPath(id))))
    throw new Error(`No job "${id}" in ${OUT_DIR}`);
  const job = await readJson<Job>(jobPath(id));
  // Re-validate in case the script was hand-edited.
  job.script = ScriptSchema.parse(job.script);
  return job;
}

export async function saveJob(job: Job) {
  await writeJson(jobPath(job.id), job);
  await fs.writeFile(
    path.join(jobDir(job.id), "script.md"),
    scriptMarkdown(job),
  );
}

export async function listJobs(): Promise<Job[]> {
  if (!(await exists(OUT_DIR))) return [];
  const ids = (await fs.readdir(OUT_DIR)).filter((d) => !d.startsWith("_"));
  const jobs = await Promise.all(
    ids.map((id) => readJson<Job | null>(jobPath(id), null)),
  );
  return jobs
    .filter((j): j is Job => !!j)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createJob(script: Script): Promise<Job> {
  const date = new Date().toISOString().slice(0, 10);
  const id = `${date}-${slug(script.title, 36)}-${sha1(JSON.stringify(script) + Date.now()).slice(0, 4)}`;
  await ensureDir(jobDir(id));
  const job: Job = {
    id,
    createdAt: new Date().toISOString(),
    status: "draft",
    approvedAt: null,
    script,
    voice: null,
    avatar: null,
    render: null,
    costUsd: 0,
    posts: [],
  };
  await saveJob(job);
  return job;
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

export function scriptMarkdown(job: Job) {
  const s = job.script;
  const est = estimateCost(s);
  const rows = s.segments
    .map((seg, i) => {
      const v = seg.visual;
      const vis =
        v.kind === "avatar"
          ? `avatar (${v.framing})`
          : v.kind === "card"
            ? `card: **${v.headline}**${v.sub ? ` / ${v.sub}` : ""}`
            : v.kind === "broll"
              ? `b-roll: "${v.query}"${v.file ? ` [${v.file}]` : ""}`
              : `🎥 SCREEN (you record → screen-${i + 1}.mp4): ${v.note}`;
      return `| ${i + 1} | ${seg.text.replace(/\|/g, "/")} | ${vis}${seg.layout === "split" ? " · split" : ""} |`;
    })
    .join("\n");
  return `# ${s.title}

- **Job:** \`${job.id}\` · **Status:** ${job.status} · **Format:** ${s.formatId}
- **Length:** ~${Math.round(est.secs)}s (${wordCount(s)} words) · **Est. cost:** ${money(est.total)} (voice ${money(est.voice)}, avatar ${money(est.avatar)})
- **Hook overlay:** ${s.hookOverlay}

| # | Says | Visual |
|---|------|--------|
${rows}

**Caption:** ${s.caption}

**Hashtags:** ${s.hashtags.map((h) => `#${h}`).join(" ")}

**Drawn from:** ${s.sources.join("; ") || "—"}

---
Edit \`job.json\` → \`script\` to change anything, then \`yarn video approve ${job.id}\`.
`;
}

export type RenderOptions = {
  mock?: boolean;
  mockAvatarOnly?: boolean;
  music?: string | null;
  label?: string;
  maxCost?: number;
};

/** voice → avatar → compose, each step cached against its inputs. */
export async function renderJob(
  id: string,
  opts: RenderOptions = {},
): Promise<Job> {
  const job = await loadJob(id);
  const dir = jobDir(id);
  const mockVoice = !!opts.mock;
  const mockAv = !!opts.mock || !!opts.mockAvatarOnly;

  if (job.status === "draft" && !mockAv) {
    throw new Error(
      `Job ${id} is not approved. Review ${path.join(dir, "script.md")} then run: yarn video approve ${id}`,
    );
  }

  const missing = await missingAssets(dir, job.script);
  if (missing.length) {
    console.log(
      "  ⚠ Screen recordings this script wants (placeholders will be used):",
    );
    for (const m of missing)
      console.log(`    - ${path.join(dir, m.expected)}: ${m.note}`);
  }

  const est = estimateCost(job.script);
  if (!mockAv && opts.maxCost !== undefined && est.total > opts.maxCost) {
    throw new Error(
      `Estimated ${money(est.total)} exceeds --max-cost ${money(opts.maxCost)}`,
    );
  }

  // 1. Voice
  const text = narrationText(job.script.segments);
  const textHash = sha1(
    `${text}|${mockVoice ? "mock" : env.elevenVoiceId}|${env.elevenModel}`,
  );
  if (
    !job.voice ||
    job.voice.textHash !== textHash ||
    !(await exists(job.voice.audioPath))
  ) {
    console.log(`  🎙  voice (${mockVoice ? "mock" : "ElevenLabs"})…`);
    const v = mockVoice
      ? await mockTTS(text, dir)
      : await elevenLabsTTS(text, dir);
    if (!mockVoice) job.costUsd += (v.chars / 1000) * PRICING.elevenPer1kChars;
    job.voice = { ...v, textHash };
    job.avatar = null; // new audio invalidates the lip-sync
    await saveJob(job);
  } else console.log("  🎙  voice cached");

  // 2. Avatar
  const audioHash = sha1(await fs.readFile(job.voice.audioPath));
  const avatarStale =
    !job.avatar ||
    job.avatar.audioHash !== audioHash ||
    (job.avatar.provider === "mock") !== mockAv ||
    !(await exists(job.avatar.path));
  if (avatarStale) {
    if (mockAv) {
      console.log("  🧍 avatar (mock)…");
      job.avatar = {
        ...(await mockAvatar(job.voice.audioPath, dir)),
        audioHash,
      };
    } else {
      console.log(
        `  🧍 avatar (HeyGen ${env.heygenEngine}, ~${money(est.avatar)})…`,
      );
      const resumeId =
        job.avatar?.audioHash === audioHash ? job.avatar.pendingVideoId : null;
      const a = await heygenRender(job.voice.audioPath, dir, {
        existingVideoId: resumeId,
        title: job.script.title,
        onSubmitted: async (videoId) => {
          job.avatar = {
            provider: "heygen",
            videoId,
            engine: env.heygenEngine,
            path: "",
            durationSec: 0,
            audioHash,
            pendingVideoId: videoId,
          };
          await saveJob(job);
        },
      });
      job.costUsd +=
        (a.durationSec / 60) * PRICING.heygenPerMin[env.heygenEngine];
      job.avatar = { ...a, audioHash, pendingVideoId: null };
    }
    await saveJob(job);
  } else console.log("  🧍 avatar cached");

  // 3. Compose
  if (!job.avatar) throw new Error("avatar step produced no video");
  console.log("  🎬 compositing…");
  const alignment = await readJson<CharAlignment>(job.voice.alignmentPath);
  const words = charsToWords(alignment);
  const timeline = segmentTimeline(
    job.script.segments,
    words,
    job.voice.durationSec,
  );
  const r = await compose({
    jobDir: dir,
    script: job.script,
    timeline,
    avatarPath: job.avatar.path,
    audioPath: job.voice.audioPath,
    durationSec: job.voice.durationSec,
    musicPath: opts.music,
    label: opts.label,
  });
  job.render = { ...r, at: new Date().toISOString() };
  if (!mockAv) job.status = "rendered";
  await saveJob(job);
  return job;
}
