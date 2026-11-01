import { z } from "zod";
import { env } from "../config";
import { llmParse } from "../lib/llm";
import {
  type Audience,
  audienceBrief,
  getAudience,
} from "../library/audiences";
import { getFormat, loadFormats } from "../library/formats";
import {
  type Format,
  type Script,
  ScriptSchema,
  type StoredAnalysis,
} from "../schemas";

/** ElevenLabs narration runs ~2.6 words/sec at speed 1.0. */
export const WORDS_PER_SEC = 2.6;

export function wordCount(script: Script) {
  return script.segments.reduce(
    (n, s) => n + s.text.split(/\s+/).filter(Boolean).length,
    0,
  );
}

export function estimateSeconds(script: Script) {
  return wordCount(script) / WORDS_PER_SEC;
}

const VOICE_RULES = `Voice rules (Brian Jenney: senior dev, bootcamp owner, blunt and practical):
- Talk like a person on camera, not a blog. Short sentences. Contractions.
- Specific > general: name tools, numbers, timeframes. No vague "leverage", "unlock", "game-changer", "dive in", "in today's fast-paced world", "let's break it down", "here's the thing".
- No em dashes. No rhetorical question stacks. No "Not X, but Y" constructions more than once.
- One idea per video. Cut anything that doesn't serve the hook's promise.
- Opinions are allowed and encouraged. Don't hedge.
- Never invent personal anecdotes, numbers, tools Brian used, or credentials that aren't in the provided source material.
- Write for the ear: this is read aloud by TTS. No URLs, slashes, parentheses, "1)" lists, arrows, emoji or abbreviations that read badly. Say "first, second, third". Links go in the caption, never in speech.
- Every segment must add something new. Never restate the previous line ("Myth. Nope, total myth.").`;

async function retrieveContext(
  topic: string,
): Promise<{ text: string; sources: string[] }> {
  try {
    const { lookupWriting } = await import("@/libs/mcp/lookupWriting");
    const res = await lookupWriting({ query: topic, topK: 6 });
    const hits = res.hits.slice(0, 6);
    return {
      text: hits
        .map(
          (h, i) =>
            `[${i + 1}] (${h.source}${h.title ? `: ${h.title}` : ""})\n${h.text.slice(0, 1500)}`,
        )
        .join("\n\n"),
      sources: hits.map((h) => h.sourceUrl ?? h.title ?? `${h.source}:${h.id}`),
    };
  } catch (e) {
    console.warn(`  (no RAG context: ${(e as Error).message.split("\n")[0]})`);
    return { text: "", sources: [] };
  }
}

async function pickFormat(
  topic: string,
  formats: Format[],
  audience: Audience | null,
): Promise<Format> {
  const clone = formats.filter((f) => f.cloneSuitable);
  const hinted = audience
    ? clone.filter((f) => audience.formatHints.includes(f.id))
    : [];
  const usable = hinted.length ? hinted : clone;
  const { id } = await llmParse(
    z.object({ id: z.enum(usable.map((f) => f.id) as [string, ...string[]]) }),
    "format_choice",
    `Pick the short-form format that best fits this topic: "${topic}"\n\n${usable
      .map((f) => `${f.id}: ${f.whenToUse}`)
      .join("\n")}`,
    { model: env.llmFastModel },
  );
  return usable.find((f) => f.id === id) ?? usable[0];
}

export type WriteOptions = {
  topic: string;
  formatId?: string;
  targetSec?: number;
  inspiration?: StoredAnalysis;
  hasScreenRecording?: boolean;
  /** "students" | "business" (data/video/audiences.json). Drives pains, claims and CTA. */
  audience?: string;
  /** Extra facts/context to use (e.g. pasted from lookup_writing or a call transcript). */
  notes?: string;
};

export async function writeScript(opts: WriteOptions): Promise<Script> {
  const formats = await loadFormats();
  const audience = opts.audience ? await getAudience(opts.audience) : null;
  const format = opts.formatId
    ? await getFormat(opts.formatId)
    : await pickFormat(opts.topic, formats, audience);
  const targetSec =
    opts.targetSec ??
    Math.round((format.lengthSec.min + format.lengthSec.max) / 2);
  const targetWords = Math.round(targetSec * WORDS_PER_SEC);
  const ctx = await retrieveContext(opts.topic);

  const script = await llmParse(
    ScriptSchema,
    "short_form_script",
    `Write a ${targetSec}-second vertical short (TikTok / Reels / Shorts) for Brian's AI clone to deliver.

TOPIC: ${opts.topic}

FORMAT: ${format.name} (id: ${format.id})
Hook patterns: ${format.hookPatterns.join(" | ")}
Beats: ${format.beats.join(" → ")}
Visual plan: ${format.visualPlan}
Proven hooks in this format: ${format.exampleHooks.join(" | ") || "n/a"}
${
  opts.inspiration
    ? `\nSTRUCTURAL INSPIRATION (an outlier that worked — copy the structure and pacing, NEVER the wording or claims):
Hook type: ${opts.inspiration.hookType}. Beats: ${opts.inspiration.beats.join(" → ")}. Template: ${opts.inspiration.transferableTemplate}. Why it worked: ${opts.inspiration.whyItWorked}\n`
    : ""
}
${audience ? `${audienceBrief(audience)}\n\nThe goal is not views for their own sake: the right viewer should finish this thinking "this guy can fix my problem" and act on the CTA.\n` : ""}
BRIAN'S OWN MATERIAL (facts, opinions and stories must come from here or be general knowledge):
${ctx.text || "(none retrieved — stick to general, verifiable claims)"}
${opts.notes ? `\nEXTRA NOTES FROM BRIAN (treat as true):\n${opts.notes}\n` : ""}
${VOICE_RULES}

HARD CONSTRAINTS:
- Total spoken words across all segments: ${targetWords - 10} to ${targetWords + 10}.
- 5 to 9 segments. Each segment is one beat of 2 to 6 seconds of speech. A new visual every segment.
- Segment 1 is the hook: visual.kind "avatar", framing "wide", and it must land the promise in under 3 seconds of speech.
- Payoff (the useful part) must start before second 15.
- Never use the same visual kind on more than 2 consecutive segments. Alternate avatar framing wide/tight.
- Use "card" for numbers, rules, and lists (headline ≤ 5 words, sub ≤ 8 words or null).
- Only state a credential (years, students, hires) if it appears in Brian's material above; otherwise skip the credential beat rather than being vague. Use "broll" with a concrete, filmable stock query. ${
      opts.hasScreenRecording
        ? 'Use "screen" (layout "split") for demo beats and describe exactly what to record in note.'
        : 'Only use "screen" if a demo is essential; describe exactly what to record in note.'
    }
- layout "split" only for broll/screen. avatar and card are always "full".
- Last segment: ${audience ? `the audience CTA above, in Brian's voice, keeping the comment keyword exact` : "a short CTA in Brian's voice (comment a keyword, follow for more, or save this)"}. Avatar wide.
- hookOverlay: ≤ 7 words, punchier than the spoken hook.
- caption: 1-2 sentences, no hashtags. hashtags: 3-5, lowercase, no #.
- formatId must be "${format.id}". audience must be ${audience ? `"${audience.id}"` : "null"}. topic must be the topic above. sources: list the [n] items you drew from as their titles/urls: ${JSON.stringify(ctx.sources)}`,
    { model: env.llmModel },
  );

  return {
    ...normalizeScript(script, format.id),
    audience: audience?.id ?? null,
  };
}

/** Enforce rules the LLM sometimes bends, so render never breaks on them. */
export function normalizeScript(script: Script, formatId: string): Script {
  const segments = script.segments
    .filter((s) => s.text.trim())
    .map((s) => ({
      ...s,
      text: s.text.replace(/\s*—\s*/g, ", ").trim(),
      layout:
        s.visual.kind === "broll" || s.visual.kind === "screen"
          ? s.layout
          : ("full" as const),
    }));
  if (segments[0] && segments[0].visual.kind !== "avatar") {
    segments[0] = {
      ...segments[0],
      visual: { kind: "avatar", framing: "wide" },
      layout: "full",
    };
  }
  return {
    ...script,
    formatId,
    segments,
    // Platforms break hashtags at hyphens/punctuation.
    hashtags: script.hashtags
      .map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(Boolean),
  };
}
