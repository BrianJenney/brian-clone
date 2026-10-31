import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateCost, estimateRunCost, type Job, voiceKey } from "./jobs";
import type { Script } from "./schemas";
import { isRunning } from "./service";

const script: Script = {
  title: "t",
  formatId: "contrarian-take",
  topic: "t",
  hookOverlay: "h",
  segments: [
    {
      text: "One two three four five six seven eight nine ten.",
      visual: { kind: "avatar", framing: "wide" },
      layout: "full",
    },
  ],
  caption: "c",
  hashtags: [],
  sources: [],
};

function job(over: Partial<Job> = {}): Job {
  return {
    id: "j",
    createdAt: "2026-10-31T00:00:00Z",
    status: "draft",
    approvedAt: null,
    script,
    media: {},
    voice: null,
    avatar: null,
    render: null,
    run: null,
    costUsd: 0,
    posts: [],
    ...over,
  };
}

test("mock renders are free; final charges voice + avatar", () => {
  const est = estimateCost(script);
  assert.equal(estimateRunCost(job(), "mock"), 0);
  assert.equal(estimateRunCost(job(), "voice"), est.voice);
  assert.equal(estimateRunCost(job(), "final"), est.voice + est.avatar);
});

test("cached voice and a pending HeyGen render are not charged again", () => {
  const key = voiceKey(script, "final");
  const j = job({
    voice: {
      provider: "elevenlabs",
      audio: "a",
      alignment: "b",
      durationSec: 4,
      chars: 50,
      key,
    },
    avatar: {
      provider: "heygen",
      videoId: "v",
      engine: "avatar_iv",
      file: null,
      durationSec: 0,
      key,
      pending: true,
    },
  });
  assert.equal(estimateRunCost(j, "final"), 0);
});

test("editing the words invalidates the cached voice", () => {
  const key = voiceKey(script, "final");
  const edited = {
    ...script,
    segments: [{ ...script.segments[0], text: "Different words now." }],
  };
  assert.notEqual(voiceKey(edited, "final"), key);
  assert.notEqual(voiceKey(script, "mock"), key);
});

test("isRunning ignores finished and stale runs", () => {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 2 * 3600_000).toISOString();
  const run = (stage: NonNullable<Job["run"]>["stage"], updatedAt: string) =>
    job({
      run: {
        mode: "final",
        stage,
        startedAt: updatedAt,
        updatedAt,
        error: null,
        detail: null,
      },
    });
  assert.equal(isRunning(run("avatar", now)), true);
  assert.equal(isRunning(run("done", now)), false);
  assert.equal(isRunning(run("failed", now)), false);
  assert.equal(isRunning(run("avatar", old)), false);
});
