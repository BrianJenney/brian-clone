/**
 * Pronunciation fixes applied to the text sent to TTS (never to captions).
 * data/video/pronunciations.json maps a word to a one-token spoken form, e.g.
 * "AIVARA" -> "Eye-vara". Keeping it one token keeps the word count identical,
 * so captions can show the original spelling at the spoken word's timing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../config";

export type Lexicon = Record<string, string>;

let cached: Lexicon | null = null;
export function loadLexicon(): Lexicon {
  if (cached) return cached;
  try {
    const raw = JSON.parse(
      readFileSync(path.join(DATA_DIR, "pronunciations.json"), "utf8"),
    ) as Record<string, string>;
    cached = Object.fromEntries(
      Object.entries(raw)
        .filter(([k, v]) => !k.startsWith("_") && !/\s/.test(v))
        .map(([k, v]) => [k.toLowerCase(), v]),
    );
  } catch {
    cached = {};
  }
  return cached;
}

/** Replace whole words, keeping surrounding punctuation ("AIVARA," -> "Eye-vara,"). */
export function applyLexicon(text: string, lexicon: Lexicon = loadLexicon()) {
  return text
    .split(/(\s+)/)
    .map((tok) => {
      const m = tok.match(
        /^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’-]*?)([^\p{L}\p{N}]*)$/u,
      );
      if (!m) return tok;
      const spoken = lexicon[m[2].toLowerCase()];
      return spoken ? `${m[1]}${spoken}${m[3]}` : tok;
    })
    .join("");
}
