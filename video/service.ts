/**
 * High-level operations shared by the MCP tools and the CLI, so both
 * front-ends enforce the same rules (cost guard, one render at a time).
 */
import { requestRender } from "./inngest";
import {
  estimateCost,
  estimateRunCost,
  type Job,
  loadJob,
  type RenderMode,
  saveJob,
  scriptMarkdown,
  setRun,
} from "./jobs";
import { money } from "./lib/util";
import { type Script, ScriptSchema } from "./schemas";
import { normalizeScript } from "./script/write";

const STALE_RUN_MS = 60 * 60_000;

export function isRunning(job: Job) {
  if (!job.run || job.run.stage === "done" || job.run.stage === "failed")
    return false;
  return Date.now() - new Date(job.run.updatedAt).getTime() < STALE_RUN_MS;
}

export type ScriptPatch = Partial<
  Pick<Script, "title" | "hookOverlay" | "segments" | "caption" | "hashtags">
>;

export async function updateScript(id: string, patch: ScriptPatch) {
  const job = await loadJob(id);
  if (isRunning(job))
    throw new Error(
      `Job ${id} is rendering (${job.run?.stage}); wait for it to finish.`,
    );
  const merged = ScriptSchema.parse({ ...job.script, ...patch });
  job.script = normalizeScript(merged, job.script.formatId);
  // Media attached by segment number may no longer line up.
  if (
    patch.segments &&
    patch.segments.length !== Object.keys(job.media).length
  ) {
    for (const k of Object.keys(job.media))
      if (Number(k) > job.script.segments.length) delete job.media[k];
  }
  if (job.status === "rendered") job.status = "approved";
  await saveJob(job);
  return job;
}

export async function attachMedia(id: string, segment: number, url: string) {
  if (!/^https:\/\//.test(url))
    throw new Error(
      "url must be a public https URL to an mp4/mov/webm/png/jpg file",
    );
  const job = await loadJob(id);
  if (segment < 1 || segment > job.script.segments.length)
    throw new Error(`segment must be 1–${job.script.segments.length}`);
  const head = await fetch(url, { method: "HEAD" }).catch(() => null);
  const type = head?.headers.get("content-type") ?? "";
  if (head && !head.ok)
    throw new Error(`Could not fetch ${url} (${head.status})`);
  if (type && !/^(video|image)\//.test(type) && !/octet-stream/.test(type))
    throw new Error(
      `${url} is ${type}, not a video or image. Use a direct file link (not a Loom/Drive page).`,
    );
  job.media[String(segment)] = url;
  await saveJob(job);
  return job;
}

/** Queue a render on Inngest. Returns immediately. */
export async function startRender(
  id: string,
  mode: RenderMode,
  { maxCostUsd, label }: { maxCostUsd?: number; label?: string } = {},
) {
  const job = await loadJob(id);
  if (isRunning(job))
    throw new Error(
      `Job ${id} is already rendering (${job.run?.mode} → ${job.run?.stage}).`,
    );
  const cost = estimateRunCost(job, mode);
  if (cost > 0 && (maxCostUsd === undefined || maxCostUsd < cost)) {
    throw new Error(
      `This ${mode} render will cost about ${money(cost)}. Re-run with maxCostUsd ≥ ${cost.toFixed(2)} to confirm.`,
    );
  }
  if (mode === "final") {
    job.status = "approved";
    job.approvedAt = new Date().toISOString();
    await saveJob(job);
  }
  await setRun(id, {
    mode,
    stage: "queued",
    startedAt: new Date().toISOString(),
    error: null,
    detail: null,
  });
  await requestRender({ jobId: id, mode, label });
  return { cost };
}

export function jobSummary(job: Job) {
  const lines = [scriptMarkdown(job)];
  if (job.run) {
    const r = job.run;
    lines.push(
      `**Render status:** ${r.mode} → **${r.stage}**${r.detail ? ` (${r.detail})` : ""} · updated ${r.updatedAt}${r.error ? `\n**Error:** ${r.error}` : ""}`,
    );
  }
  if (job.render) {
    lines.push(
      `**Video (${job.render.mode}):** ${job.render.video}\n**Cover:** ${job.render.cover}`,
    );
    for (const w of job.render.warnings) lines.push(`⚠ ${w}`);
  }
  const media = Object.entries(job.media);
  if (media.length)
    lines.push(
      `**Attached media:** ${media.map(([n, u]) => `#${n} ${u}`).join(", ")}`,
    );
  lines.push(
    `**Spent on this job:** ${money(job.costUsd)} · **est. final:** ${money(estimateCost(job.script).total)}`,
  );
  return lines.join("\n\n");
}
