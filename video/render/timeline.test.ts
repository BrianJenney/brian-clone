import assert from "node:assert/strict";
import { test } from "node:test";
import type { Script } from "../schemas";
import { normalizeScript } from "../script/write";
import {
  charsToWords,
  narrationText,
  segmentTimeline,
  syntheticAlignment,
} from "../voice/alignment";
import { assTime, buildAss, chunkWords } from "./captions";

const script: Script = {
  title: "Test",
  formatId: "contrarian-take",
  topic: "t",
  hookOverlay: "Stop doing LeetCode",
  segments: [
    {
      text: "Stop grinding LeetCode for your first job.",
      visual: { kind: "avatar", framing: "wide" },
      layout: "full",
    },
    {
      text: "I have hired developers for years.",
      visual: { kind: "card", headline: "3 things instead", sub: null },
      layout: "full",
    },
    {
      text: "Build one real project, and ship it.",
      visual: { kind: "broll", query: "developer typing", file: null },
      layout: "split",
    },
  ],
  caption: "c",
  hashtags: ["code"],
  sources: [],
};

test("charsToWords groups non-whitespace runs with timings", () => {
  const words = charsToWords(syntheticAlignment("Hello big world."));
  assert.deepEqual(
    words.map((w) => w.text),
    ["Hello", "big", "world."],
  );
  assert.ok(words[0].end <= words[1].start);
});

test("segmentTimeline is contiguous and covers the whole narration", () => {
  const text = narrationText(script.segments);
  const words = charsToWords(syntheticAlignment(text));
  const total = (words.at(-1)?.end ?? 0) + 0.4;
  const tl = segmentTimeline(script.segments, words, total);
  assert.equal(tl.length, 3);
  assert.equal(tl[0].start, 0);
  assert.equal(tl[2].end, total);
  for (let i = 1; i < tl.length; i++) assert.equal(tl[i].start, tl[i - 1].end);
  assert.deepEqual(
    tl.map((t) => t.words.length),
    [7, 6, 7],
  );
});

test("chunkWords respects max words and punctuation", () => {
  const words = charsToWords(
    syntheticAlignment("One two three four. Five, six"),
  );
  const chunks = chunkWords(words, { maxWords: 3, maxChars: 30 }).map((c) =>
    c.map((w) => w.text).join(" "),
  );
  assert.deepEqual(chunks, ["One two three", "four.", "Five,", "six"]);
});

test("assTime formats centiseconds", () => {
  assert.equal(assTime(65.237), "0:01:05.23");
});

test("buildAss emits hook, card and highlighted caption events", () => {
  const text = narrationText(script.segments);
  const words = charsToWords(syntheticAlignment(text));
  const tl = segmentTimeline(script.segments, words, 10);
  const ass = buildAss(script, tl, 10);
  assert.match(ass, /,Hook,.*Stop doing LeetCode/);
  assert.match(ass, /,Card,.*3 things instead/);
  assert.match(ass, /\\pos\(540,960\)/); // split layout caption on the seam
  assert.equal((ass.match(/,Caption,/g) ?? []).length, 20); // one event per word
});

test("normalizeScript forces an avatar hook and full layout for cards", () => {
  const bad: Script = {
    ...script,
    segments: [
      {
        text: "Hook — here",
        visual: { kind: "card", headline: "x", sub: null },
        layout: "split",
      },
      ...script.segments.slice(1),
    ],
    hashtags: ["#AI"],
  };
  const n = normalizeScript(bad, "contrarian-take");
  assert.equal(n.segments[0].visual.kind, "avatar");
  assert.equal(n.segments[0].text, "Hook, here");
  assert.equal(n.segments[1].layout, "full");
  assert.deepEqual(n.hashtags, ["ai"]);
});
