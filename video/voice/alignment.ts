export type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export type Word = { text: string; start: number; end: number };
export type SegmentTiming = {
  index: number;
  start: number;
  end: number;
  words: Word[];
};

/** The exact text sent to TTS. Segment boundaries are recoverable from char offsets. */
export function narrationText(segments: { text: string }[]) {
  return segments.map((s) => s.text.trim()).join(" ");
}

/** Collapse character timings into word timings (runs of non-whitespace). */
export function charsToWords(a: CharAlignment): Word[] {
  const words: Word[] = [];
  let cur: Word | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    const s = a.character_start_times_seconds[i];
    const e = a.character_end_times_seconds[i];
    if (!cur) cur = { text: ch, start: s, end: e };
    else {
      cur.text += ch;
      cur.end = e;
    }
  });
  if (cur) words.push(cur);
  return words;
}

/**
 * Map each script segment to its time range in the narration. Segment i runs from
 * its first word's start to segment i+1's first word start (so cuts land on the
 * breath before the next beat); the last one runs to the end of the audio.
 */
export function segmentTimeline(
  segments: { text: string }[],
  words: Word[],
  totalDuration: number,
): SegmentTiming[] {
  const counts = segments.map(
    (s) => s.text.trim().split(/\s+/).filter(Boolean).length,
  );
  const out: SegmentTiming[] = [];
  let w = 0;
  counts.forEach((n, index) => {
    const segWords = words.slice(w, w + n);
    w += n;
    out.push({
      index,
      start: segWords[0]?.start ?? 0,
      end: 0,
      words: segWords,
    });
  });
  out.forEach((seg, i) => {
    seg.start = i === 0 ? 0 : seg.start;
    seg.end =
      i < out.length - 1
        ? (out[i + 1].words[0]?.start ?? totalDuration)
        : totalDuration;
    if (seg.end <= seg.start) seg.end = seg.start + 0.5;
  });
  return out;
}

/** Synthetic alignment at a fixed speaking rate — for mock voice / dry runs. */
export function syntheticAlignment(
  text: string,
  wordsPerSec = 2.6,
): CharAlignment {
  const characters: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const wordDur = 1 / wordsPerSec;
  let t = 0.15;
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      for (const ch of token) {
        characters.push(ch);
        starts.push(t);
        ends.push(t);
      }
      continue;
    }
    const per = (wordDur * 0.9) / token.length;
    for (const ch of token) {
      characters.push(ch);
      starts.push(t);
      t += per;
      ends.push(t);
    }
    t +=
      wordDur * 0.1 +
      (/[.!?]$/.test(token) ? 0.25 : /[,;:]$/.test(token) ? 0.1 : 0);
  }
  return {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  };
}
