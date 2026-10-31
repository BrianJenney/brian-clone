import assert from "node:assert/strict";
import { test } from "node:test";
import type { Post } from "../schemas";
import { rankOutliers, scorePosts } from "./outliers";
import { vttToText } from "./scrapecreators";

const now = new Date("2026-10-31T00:00:00Z");
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 86_400_000).toISOString();

function post(
  id: string,
  views: number,
  age: number,
  extra: Partial<Post> = {},
): Post {
  return {
    platform: "tiktok",
    id,
    url: `https://x/${id}`,
    handle: "acct",
    caption: "",
    views,
    likes: null,
    comments: null,
    shares: null,
    followers: null,
    durationSec: 30,
    postedAt: daysAgo(age),
    ...extra,
  };
}

test("flags a post that beats 3x the account median", () => {
  const posts = [
    post("a", 1000, 10),
    post("b", 1200, 9),
    post("c", 900, 8),
    post("d", 1100, 7),
    post("e", 1000, 6),
    post("hit", 12000, 5),
  ];
  const scored = scorePosts(posts, { now });
  const hit = scored.find((s) => s.id === "hit");
  assert.ok(hit?.isOutlier);
  assert.equal(hit?.multiple, 12);
  assert.equal(scored.filter((s) => s.isOutlier).length, 1);
});

test("does not judge posts younger than minAgeHours", () => {
  const posts = [1, 2, 3, 4, 5].map((i) => post(`p${i}`, 1000, 10 + i));
  posts.push(post("fresh", 50000, 1));
  const fresh = scorePosts(posts, { now }).find((s) => s.id === "fresh");
  assert.equal(fresh?.isOutlier, false);
  assert.equal(fresh?.multiple, 50);
});

test("falls back to views/follower when there is no account history", () => {
  const [s] = scorePosts([post("solo", 30000, 5, { followers: 10000 })], {
    now,
  });
  assert.equal(s.baselineViews, null);
  assert.equal(s.viewsPerFollower, 3);
  assert.ok(s.isOutlier);
});

test("rankOutliers boosts high share rate", () => {
  const base = [1, 2, 3, 4, 5].map((i) => post(`p${i}`, 1000, 10 + i));
  const a = post("a", 5000, 5, { shares: 0 });
  const b = post("b", 5000, 5, { shares: 250 });
  const ranked = rankOutliers(scorePosts([...base, a, b], { now }));
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["b", "a"],
  );
});

test("vttToText strips cue timing", () => {
  const vtt =
    "WEBVTT\n\n\n00:00:00.120 --> 00:00:01.840\nAlright, pizza review time.\n\n00:00:01.841 --> 00:00:03.761\nSecond line.\\n";
  assert.equal(vttToText(vtt), "Alright, pizza review time. Second line.");
});
