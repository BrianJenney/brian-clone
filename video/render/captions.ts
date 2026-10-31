/**
 * Builds an ASS subtitle file (rendered by libass inside FFmpeg) for:
 *  - word-by-word "karaoke" captions, the active word highlighted
 *  - the hook overlay in the first ~2s
 *  - headline text for card segments
 * Coordinates are in a 1080x1920 canvas.
 */
import type { Script } from "../schemas";
import type { SegmentTiming, Word } from "../voice/alignment";

export type CaptionStyle = {
  font: string;
  size: number;
  highlight: string; // RRGGBB
  uppercase: boolean;
  maxWords: number;
  maxChars: number;
};

export const DEFAULT_STYLE: CaptionStyle = {
  font: "Inter ExtraBold",
  size: 82,
  highlight: "FFD60A",
  uppercase: false,
  maxWords: 3,
  maxChars: 18,
};

/** ASS colours are &HAABBGGRR. */
function assColor(rrggbb: string, alpha = "00") {
  const [r, g, b] = [
    rrggbb.slice(0, 2),
    rrggbb.slice(2, 4),
    rrggbb.slice(4, 6),
  ];
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

export function assTime(sec: number) {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function esc(text: string) {
  return text.replace(/\\/g, "").replace(/[{}]/g, "").replace(/\n/g, " ");
}

/** Group words into on-screen chunks: ≤ maxWords, ≤ maxChars, break after punctuation. */
export function chunkWords(
  words: Word[],
  style: Pick<CaptionStyle, "maxWords" | "maxChars">,
): Word[][] {
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  const len = (ws: Word[]) => ws.map((w) => w.text).join(" ").length;
  for (const w of words) {
    if (
      cur.length &&
      (cur.length >= style.maxWords || len([...cur, w]) > style.maxChars)
    ) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?,;:]$/.test(w.text)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export function buildAss(
  script: Script,
  timeline: SegmentTiming[],
  totalDuration: number,
  style: CaptionStyle = DEFAULT_STYLE,
  { label }: { label?: string } = {},
): string {
  const white = assColor("FFFFFF");
  const black = assColor("000000");
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${style.font},${style.size},${white},${white},${black},${assColor("000000", "80")},0,0,0,0,100,100,0,0,1,7,2,5,60,60,0,1
Style: Hook,${style.font},96,${assColor("111111")},${white},${assColor("FFFFFF")},${assColor("FFFFFF")},0,0,0,0,100,100,0,0,3,22,0,8,80,80,0,1
Style: Card,${style.font},112,${white},${white},${black},${black},0,0,0,0,100,100,0,0,1,0,0,5,90,90,0,1
Style: CardSub,Inter,58,${assColor("CBD5E1")},${white},${black},${black},-1,0,0,0,100,100,0,0,1,0,0,5,110,110,0,1
Style: Label,Inter,32,${assColor("FFFFFF", "40")},${white},${black},${black},-1,0,0,0,100,100,0,0,1,2,0,7,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];
  const ev = (
    layer: number,
    start: number,
    end: number,
    styleName: string,
    text: string,
  ) =>
    events.push(
      `Dialogue: ${layer},${assTime(start)},${assTime(end)},${styleName},,0,0,0,,${text}`,
    );

  // Hook overlay: first segment, max 2.4s.
  const hookEnd = Math.min(timeline[0]?.end ?? 2.4, 2.4);
  if (script.hookOverlay.trim())
    ev(
      3,
      0,
      hookEnd,
      "Hook",
      `{\\an8\\pos(540,230)\\fad(80,150)}${esc(script.hookOverlay)}`,
    );

  const hi = assColor(style.highlight);
  timeline.forEach((seg) => {
    const s = script.segments[seg.index];
    const isCard = s.visual.kind === "card";
    const isSplit = s.layout === "split";
    if (isCard && s.visual.kind === "card") {
      ev(
        2,
        seg.start,
        seg.end,
        "Card",
        `{\\an5\\pos(540,780)\\fad(100,100)}${esc(s.visual.headline)}`,
      );
      if (s.visual.sub)
        ev(
          2,
          seg.start,
          seg.end,
          "CardSub",
          `{\\an5\\pos(540,1010)\\fad(100,100)}${esc(s.visual.sub)}`,
        );
    }
    // Captions: on the seam for split layouts, lower-middle otherwise (clear of platform UI).
    const y = isSplit ? 960 : isCard ? 1360 : 1290;
    const chunks = chunkWords(seg.words, style);
    chunks.forEach((chunk, ci) => {
      const chunkEnd = chunks[ci + 1]?.[0]?.start ?? seg.end;
      chunk.forEach((w, wi) => {
        const start = wi === 0 ? chunk[0].start : w.start;
        const end = chunk[wi + 1]?.start ?? chunkEnd;
        if (end <= start) return;
        const line = chunk
          .map((x, xi) => {
            const t = esc(style.uppercase ? x.text.toUpperCase() : x.text);
            return xi === wi
              ? `{\\c${hi}\\fscx108\\fscy108}${t}{\\c${white}\\fscx100\\fscy100}`
              : t;
          })
          .join(" ");
        ev(1, start, end, "Caption", `{\\an5\\pos(540,${y})}${line}`);
      });
    });
  });

  if (label)
    ev(4, 0, totalDuration, "Label", `{\\an7\\pos(40,70)}${esc(label)}`);
  return `${header + events.join("\n")}\n`;
}
