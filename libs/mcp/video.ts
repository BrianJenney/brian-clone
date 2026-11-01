import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJob, estimateCost, listJobs, loadJob } from "@/video/jobs";
import { loadFormats } from "@/video/library/formats";
import { logResult, report } from "@/video/metrics";
import { SegmentSchema } from "@/video/schemas";
import { writeScript } from "@/video/script/write";
import {
  attachMedia,
  isRunning,
  jobSummary,
  startRender,
  updateScript,
} from "@/video/service";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export const VIDEO_INSTRUCTIONS =
  ' Short-form video (AI clone): every video should target an audience: "students" (devs who want AI engineering skills) or "business" (owners replacing software). `video_write_script` drafts a script from a topic + proven format + audience, grounded in Brian\'s writing; pass relevant `lookup_writing` results as `notes`. Show Brian the script and revise with `video_update_script` before rendering. `video_render` is asynchronous: it queues the job and returns at once. Start with mode "mock" (free) or "voice" (~$0.05), then "final" (~$2–3, needs maxCostUsd). Poll with `video_get_job`; `video_list_jobs` finds any earlier video. Renders take ~1 min (mock) to ~10 min (final).';

export function registerVideoTools(server: McpServer) {
  server.registerTool(
    "video_list_formats",
    {
      title: "List short-form video formats",
      description:
        "The format library: proven short-form structures (hook patterns, beats, length, visual plan). Formats marked cloneSuitable=false (personal stories) should be filmed by Brian himself, not the AI clone.",
      inputSchema: {},
    },
    async () => {
      const formats = await loadFormats();
      return text(
        formats
          .map(
            (f) =>
              `- **${f.id}** — ${f.name}${f.cloneSuitable ? "" : " (film yourself)"} · ${f.lengthSec.min}-${f.lengthSec.max}s · evidence: ${f.evidence.length}\n  When: ${f.whenToUse}\n  Hooks: ${f.hookPatterns.join(" | ")}`,
          )
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "video_write_script",
    {
      title: "Draft a short-form video script",
      description:
        "Writes a 20-50s vertical video script for Brian's AI clone: hook, beats with a visual per beat (avatar / card / b-roll / screen recording), caption and hashtags. Grounded in Brian's own writing. Creates a draft job and returns its id. Takes ~30-60s. Nothing is rendered or charged.",
      inputSchema: {
        topic: z
          .string()
          .min(3)
          .describe("One specific idea, phrased as the promise of the video."),
        formatId: z
          .string()
          .optional()
          .describe("Format id from video_list_formats. Omit to auto-pick."),
        seconds: z
          .number()
          .int()
          .min(15)
          .max(60)
          .optional()
          .describe("Target length. Defaults to the format midpoint."),
        hasScreenRecording: z
          .boolean()
          .optional()
          .describe(
            "True if Brian will provide a screen recording for demo beats.",
          ),
        audience: z
          .enum(["students", "business"])
          .optional()
          .describe(
            'Who the video should convert. "students" = developers who want AI engineering skills (AI Engineering course; CTA: free AI engineer roadmap). "business" = Replace Your Software: owners overpaying for rented per-seat software who could own a fixed-price custom version (CTA: comment REPLACE). Strongly recommended.',
          ),
        style: z
          .enum(["solo", "podcast"])
          .optional()
          .describe(
            '"podcast" = a clip from a fake podcast: a co-host asks, Brian answers, both faces on screen (about 2x avatar cost). Default "solo".',
          ),
        notes: z
          .string()
          .optional()
          .describe(
            "Extra facts to use, e.g. relevant lookup_writing results, a client story, or numbers Brian confirmed. Treated as true.",
          ),
      },
    },
    async ({
      topic,
      formatId,
      seconds,
      hasScreenRecording,
      audience,
      notes,
      style,
    }) => {
      const script = await writeScript({
        topic,
        formatId,
        targetSec: seconds,
        hasScreenRecording,
        audience,
        notes,
        style,
      });
      const job = await createJob(script);
      return text(
        `${jobSummary(job)}\n\nNext: revise with video_update_script, or video_render { jobId: "${job.id}", mode: "mock" } for a free preview.`,
      );
    },
  );

  server.registerTool(
    "video_update_script",
    {
      title: "Edit a video script",
      description:
        'Replace parts of a draft script. Pass only the fields to change. `segments` replaces the whole segment list (each: text, visual, layout). Each segment needs speaker ("brian", or "host" in podcast scripts). Visual kinds: {kind:"avatar",framing:"wide"|"tight"}, {kind:"card",headline,sub|null}, {kind:"broll",query,file:null}, {kind:"screen",note,file:null}. layout "split" only for broll/screen.',
      inputSchema: {
        jobId: z.string(),
        title: z.string().optional(),
        hookOverlay: z.string().optional(),
        segments: z.array(SegmentSchema).optional(),
        caption: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
      },
    },
    async ({ jobId, ...patch }) => {
      const job = await updateScript(jobId, patch);
      return text(jobSummary(job));
    },
  );

  server.registerTool(
    "video_attach_media",
    {
      title: "Attach a screen recording or clip to a segment",
      description:
        "Use a public https link to an mp4/mov/webm/png/jpg (a direct file URL, not a Loom/Drive viewer page) as the visual for one segment, e.g. a screen recording for a demo beat. Shown on top with the avatar below.",
      inputSchema: {
        jobId: z.string(),
        segment: z
          .number()
          .int()
          .min(1)
          .describe("1-based segment number from the script table."),
        url: z.string().url(),
      },
    },
    async ({ jobId, segment, url }) => {
      const job = await attachMedia(jobId, segment, url);
      return text(`Attached to segment ${segment}.\n\n${jobSummary(job)}`);
    },
  );

  server.registerTool(
    "video_render",
    {
      title: "Render a video (async)",
      description:
        'Queues a render and returns immediately; poll video_get_job for status and the video link. Modes: "mock" = free preview with placeholder voice and avatar (checks timing, captions, layout; ~1 min). "voice" = real cloned voice, placeholder avatar (~$0.05). "final" = cloned voice + HeyGen digital twin (~$2-3, 3-10 min). Paid modes require maxCostUsd at or above the estimate as explicit confirmation. Unchanged voice/avatar from earlier renders are reused, not re-billed.',
      inputSchema: {
        jobId: z.string(),
        mode: z.enum(["mock", "voice", "final"]),
        maxCostUsd: z
          .number()
          .nonnegative()
          .optional()
          .describe(
            "Spending cap for this render. Required for voice/final. Confirm with Brian first.",
          ),
        label: z
          .string()
          .optional()
          .describe('Optional small burned-in label, e.g. "AI clone".'),
      },
    },
    async ({ jobId, mode, maxCostUsd, label }) => {
      const { cost } = await startRender(jobId, mode, {
        maxCostUsd,
        label,
      });
      return text(
        `Queued ${mode} render for ${jobId} (est. charge $${cost.toFixed(2)}). Check progress with video_get_job { jobId: "${jobId}" }. Typical time: ${mode === "final" ? "3-10 minutes" : "about a minute"}.`,
      );
    },
  );

  server.registerTool(
    "video_get_job",
    {
      title: "Get a video job",
      description:
        "Script, render status (queued → voice → avatar → compositing → done/failed), video and cover links, cost so far.",
      inputSchema: { jobId: z.string() },
    },
    async ({ jobId }) => text(jobSummary(await loadJob(jobId))),
  );

  server.registerTool(
    "video_list_jobs",
    {
      title: "List video jobs",
      description:
        "All short-form video jobs, newest first, with status and latest video link. Use this to find a video from an earlier conversation.",
      inputSchema: {
        status: z
          .enum(["draft", "approved", "rendered", "rendering"])
          .optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async ({ status, limit }) => {
      let jobs = await listJobs();
      if (status === "rendering") jobs = jobs.filter(isRunning);
      else if (status) jobs = jobs.filter((j) => j.status === status);
      jobs = jobs.slice(0, limit ?? 20);
      if (!jobs.length) return text("No video jobs yet.");
      return text(
        jobs
          .map(
            (j) =>
              `- \`${j.id}\` · ${j.status}${j.run ? ` · ${j.run.mode}:${j.run.stage}` : ""} · ${j.script.formatId} · "${j.script.title}" · est $${estimateCost(j.script).total.toFixed(2)}${j.render ? ` · ${j.render.video}` : ""}`,
          )
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "video_log_result",
    {
      title: "Log how a posted video performed",
      description:
        "Record platform stats for a posted short, so video_report can compare clone vs real-face and formats. Re-log the same url later to update numbers.",
      inputSchema: {
        url: z.string().describe("The post URL."),
        platform: z.enum(["tiktok", "instagram", "youtube", "linkedin"]),
        views: z.number().int().nonnegative(),
        avgWatch: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Average % watched as 0-1 (e.g. 0.62)."),
        shares: z.number().int().nonnegative().optional(),
        follows: z.number().int().nonnegative().optional(),
        jobId: z
          .string()
          .optional()
          .describe("The video job, if this was a clone video."),
        real: z
          .boolean()
          .optional()
          .describe("True for a video Brian filmed himself (the baseline)."),
        formatId: z.string().optional(),
      },
    },
    async (a) => {
      const job = a.jobId ? await loadJob(a.jobId) : null;
      await logResult({
        jobId: job?.id ?? null,
        url: a.url,
        platform: a.platform,
        kind: a.real ? "real" : "clone",
        formatId: job?.script.formatId ?? a.formatId ?? null,
        views: a.views,
        avgWatch: a.avgWatch ?? null,
        shares: a.shares ?? null,
        follows: a.follows ?? null,
      });
      return text("Logged.");
    },
  );

  server.registerTool(
    "video_report",
    {
      title: "Clone vs real performance report",
      description:
        "Median views, average watch and share rate for clone vs real-face videos and by format, plus the keep/kill verdict (kill the clone if it holds <80% of real-face watch time after 20 posts).",
      inputSchema: {},
    },
    async () => {
      const r = await report();
      const fmt = (s: {
        n: number;
        medianViews: number | null;
        medianWatch: number | null;
        sharesPer1k: number | null;
      }) =>
        `n=${s.n}, median views ${s.medianViews ?? "—"}, median watch ${s.medianWatch !== null ? `${Math.round(s.medianWatch * 100)}%` : "—"}, shares/1k ${s.sharesPer1k?.toFixed(1) ?? "—"}`;
      return text(
        [
          `Clone: ${fmt(r.clone)}`,
          `Real: ${fmt(r.real)}`,
          "",
          "By format (clone):",
          ...r.byFormat.map((f) => `- ${f.formatId}: ${fmt(f)}`),
          "",
          r.verdict,
        ].join("\n"),
      );
    },
  );
}
