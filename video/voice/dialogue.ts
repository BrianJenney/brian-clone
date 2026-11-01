/**
 * Two-voice narration for podcast-style scripts.
 *
 * Each line is synthesized on its own with the speaker's voice (passing the
 * neighbouring lines so intonation stays natural), then laid out on one
 * timeline with short turn-taking gaps. Outputs:
 *   narration.mp3     both speakers (what the viewer hears)
 *   track-brian.mp3   only Brian's lines, silence elsewhere  -> Brian's lip-sync
 *   track-host.mp3    only the host's lines, silence elsewhere -> host's lip-sync
 *   alignment.json    combined character timings (lines joined by a space,
 *                     so it matches narrationText() for captions)
 */
import path from "node:path";
import { env } from "../config";
import { probeDuration, readJson, run, writeJson } from "../lib/util";
import type { Segment } from "../schemas";
import type { CharAlignment } from "./alignment";
import { applyLexicon } from "./lexicon";
import { elevenLabsTTS, mockTTS } from "./tts";

/** Pause before a line: longer when the speaker changes, like a real conversation. */
export const GAP_SAME = 0.12;
export const GAP_TURN = 0.28;

export type DialogueResult = {
  provider: "elevenlabs" | "mock";
  audioPath: string;
  alignmentPath: string;
  tracks: { brian: string; host: string };
  durationSec: number;
  chars: number;
};

type Line = {
  speaker: Segment["speaker"];
  file: string;
  align: CharAlignment;
  start: number;
  dur: number;
};

/** Combine per-line alignments into one, offset by each line's start, joined by spaces. */
export function joinAlignments(
  lines: Array<{ align: CharAlignment; start: number; dur: number }>,
): CharAlignment {
  const out: CharAlignment = {
    characters: [],
    character_start_times_seconds: [],
    character_end_times_seconds: [],
  };
  lines.forEach((l, i) => {
    if (i > 0) {
      const t = lines[i - 1].start + lines[i - 1].dur;
      out.characters.push(" ");
      out.character_start_times_seconds.push(t);
      out.character_end_times_seconds.push(t);
    }
    l.align.characters.forEach((c, k) => {
      out.characters.push(c);
      out.character_start_times_seconds.push(
        l.align.character_start_times_seconds[k] + l.start,
      );
      out.character_end_times_seconds.push(
        l.align.character_end_times_seconds[k] + l.start,
      );
    });
  });
  return out;
}

/** Mix a set of lines at their offsets into one track of exact total length. */
async function mixTrack(lines: Line[], total: number, out: string) {
  if (!lines.length) {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=44100:cl=mono`,
      "-t",
      total.toFixed(3),
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      out,
    ]);
    return out;
  }
  const inputs = lines.flatMap((l) => ["-i", l.file]);
  const chains = lines.map(
    (l, i) =>
      `[${i}:a]aresample=44100,aformat=channel_layouts=mono,adelay=${Math.round(l.start * 1000)}:all=1[a${i}]`,
  );
  const mix = `${lines.map((_, i) => `[a${i}]`).join("")}amix=inputs=${lines.length}:normalize=0:duration=longest,apad=whole_dur=${total.toFixed(3)},atrim=0:${total.toFixed(3)}[out]`;
  await run("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    [...chains, mix].join(";"),
    "-map",
    "[out]",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    out,
  ]);
  return out;
}

export async function dialogueTTS(
  segments: Segment[],
  dir: string,
  mock: boolean,
): Promise<DialogueResult> {
  const lines: Line[] = [];
  let t = 0.1;
  let chars = 0;
  for (const [i, seg] of segments.entries()) {
    const text = applyLexicon(seg.text);
    chars += text.length;
    const name = `line-${String(i).padStart(2, "0")}`;
    const v = mock
      ? await mockTTS(text, dir, {
          name,
          frequency: seg.speaker === "host" ? 260 : 160,
        })
      : await elevenLabsTTS(text, dir, {
          name,
          voiceId: seg.speaker === "host" ? env.hostVoiceId : env.elevenVoiceId,
          previousText:
            segments[i - 1]?.speaker === seg.speaker
              ? segments[i - 1].text
              : undefined,
          nextText:
            segments[i + 1]?.speaker === seg.speaker
              ? segments[i + 1].text
              : undefined,
        });
    const dur = await probeDuration(v.audioPath);
    if (i > 0)
      t += seg.speaker === segments[i - 1].speaker ? GAP_SAME : GAP_TURN;
    lines.push({
      speaker: seg.speaker,
      file: v.audioPath,
      align: await readJson<CharAlignment>(v.alignmentPath),
      start: t,
      dur,
    });
    t += dur;
  }
  const total = t + 0.4;

  const alignmentPath = path.join(dir, "alignment.json");
  await writeJson(alignmentPath, joinAlignments(lines));
  const audioPath = await mixTrack(
    lines,
    total,
    path.join(dir, "narration.mp3"),
  );
  const brian = await mixTrack(
    lines.filter((l) => l.speaker === "brian"),
    total,
    path.join(dir, "track-brian.mp3"),
  );
  const host = await mixTrack(
    lines.filter((l) => l.speaker === "host"),
    total,
    path.join(dir, "track-host.mp3"),
  );
  return {
    provider: mock ? "mock" : "elevenlabs",
    audioPath,
    alignmentPath,
    tracks: { brian, host },
    durationSec: total,
    chars,
  };
}
