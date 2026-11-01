import { z } from "zod";

/*
 * Every schema the LLM fills uses required + nullable fields (no .optional()
 * or .default()) so it works with OpenAI strict structured outputs.
 */

// ---------- Script ----------

export const VisualSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("avatar"),
    /** tight = punch-in crop; alternating framing hides jump cuts and avatar tells. */
    framing: z.enum(["wide", "tight"]),
  }),
  z.object({
    kind: z.literal("broll"),
    /** Stock search query (Pexels) — concrete and visual, e.g. "developer typing at night". */
    query: z.string(),
    /** Local file override, filled in by you before render. */
    file: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("screen"),
    /** What you need to screen-record for this beat. */
    note: z.string(),
    /** Path to the recording (relative to the job folder or absolute). Null until recorded. */
    file: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("card"),
    headline: z.string(),
    sub: z.string().nullable(),
  }),
]);
export type Visual = z.infer<typeof VisualSchema>;

export const SegmentSchema = z.object({
  /** Exactly what the clone says during this beat. */
  text: z.string(),
  visual: VisualSchema,
  /** split = visual on top, avatar on the bottom half (only for broll/screen). */
  layout: z.enum(["full", "split"]),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const ScriptSchema = z.object({
  title: z.string(),
  formatId: z.string(),
  /** Audience id from data/video/audiences.json (students | business), or null. */
  audience: z.string().nullable(),
  topic: z.string(),
  /** Big text shown over the first ~2s; usually a punchier rewrite of the spoken hook. */
  hookOverlay: z.string(),
  segments: z.array(SegmentSchema),
  /** Post caption without hashtags. */
  caption: z.string(),
  hashtags: z.array(z.string()),
  /** Which of Brian's own pieces the facts/opinions came from. */
  sources: z.array(z.string()),
});
export type Script = z.infer<typeof ScriptSchema>;

// ---------- Format library ----------

export const FormatSchema = z.object({
  id: z.string(),
  name: z.string(),
  whenToUse: z.string(),
  hookPatterns: z.array(z.string()),
  beats: z.array(z.string()),
  lengthSec: z.object({ min: z.number(), max: z.number() }),
  visualPlan: z.string(),
  /** False for formats that need real-face credibility (confessions, stories). */
  cloneSuitable: z.boolean(),
  exampleHooks: z.array(z.string()),
  evidence: z.array(
    z.object({
      url: z.string(),
      platform: z.string(),
      views: z.number(),
      multiple: z.number().nullable(),
    }),
  ),
  source: z.enum(["seed", "mined"]),
  tags: z.array(z.string()),
});
export type Format = z.infer<typeof FormatSchema>;

// ---------- Trend posts ----------

export type Platform = "tiktok" | "instagram" | "youtube";

export type Post = {
  platform: Platform;
  id: string;
  url: string;
  handle: string;
  caption: string;
  views: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  followers: number | null;
  durationSec: number | null;
  postedAt: string;
};

export type ScoredPost = Post & {
  ageHours: number;
  baselineViews: number | null;
  multiple: number | null;
  viewsPerFollower: number | null;
  sharesPerView: number | null;
  viewsPerHour: number;
  isOutlier: boolean;
};

export const HookTypeSchema = z.enum([
  "contrarian",
  "curiosity-gap",
  "numbered-list",
  "story",
  "authority-pov",
  "question",
  "shock-stat",
  "how-to",
  "mistake",
  "news",
  "other",
]);

export const AnalysisSchema = z.object({
  hook: z.string().describe("The literal opening line(s), first ~3 seconds"),
  hookType: HookTypeSchema,
  formatId: z
    .string()
    .nullable()
    .describe("id of the closest existing format, or null if none fits"),
  proposedFormatName: z.string().nullable(),
  beats: z
    .array(z.string())
    .describe("Structure as abstract beats, not content"),
  payoffSecond: z.number().nullable(),
  visualStyle: z.string(),
  whyItWorked: z.string(),
  transferableTemplate: z
    .string()
    .describe(
      'Fill-in-the-blank template Brian could reuse, e.g. "Stop [common habit]. Do [better habit] instead. Here is why: ..."',
    ),
  relevanceToBrian: z
    .number()
    .describe("0-10: fit for a dev-education / AI-engineering audience"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export type StoredAnalysis = Analysis & {
  url: string;
  platform: string;
  handle: string;
  views: number;
  multiple: number | null;
  transcript: string;
  analyzedAt: string;
};
