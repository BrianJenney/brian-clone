/**
 * The experiment loop: log how each posted short did, then compare clone vs
 * real-face and format vs format. The kill criterion from the feasibility
 * report lives here: if clone retention < 80% of real after ~20 posts, stop
 * using the clone and keep the trend/script engine.
 */
import { median } from "./lib/util";
import { store } from "./store";

const RESULTS_KEY = "results.json";

export type Result = {
  jobId: string | null;
  url: string;
  platform: string;
  kind: "clone" | "real";
  formatId: string | null;
  views: number;
  /** Average % watched (0-1) from platform analytics. The number that matters most. */
  avgWatch: number | null;
  shares: number | null;
  follows: number | null;
  loggedAt: string;
};

export async function logResult(r: Omit<Result, "loggedAt">) {
  const all = (await store().readJson<Result[]>(RESULTS_KEY)) ?? [];
  all.push({ ...r, loggedAt: new Date().toISOString() });
  await store().writeJson(RESULTS_KEY, all);
}

/** Latest entry per URL wins, so you can re-log as numbers grow. */
export async function latestResults(): Promise<Result[]> {
  const all = (await store().readJson<Result[]>(RESULTS_KEY)) ?? [];
  return [...new Map(all.map((r) => [r.url, r])).values()];
}

type Summary = {
  n: number;
  medianViews: number | null;
  medianWatch: number | null;
  sharesPer1k: number | null;
};

function summarize(rs: Result[]): Summary {
  const watch = rs
    .map((r) => r.avgWatch)
    .filter((x): x is number => x !== null);
  const withShares = rs.filter((r) => r.shares !== null);
  const v = withShares.reduce((n, r) => n + r.views, 0);
  return {
    n: rs.length,
    medianViews: median(rs.map((r) => r.views)),
    medianWatch: median(watch),
    sharesPer1k: v
      ? (withShares.reduce((n, r) => n + (r.shares ?? 0), 0) / v) * 1000
      : null,
  };
}

export async function report() {
  const rs = await latestResults();
  const clone = summarize(rs.filter((r) => r.kind === "clone"));
  const real = summarize(rs.filter((r) => r.kind === "real"));
  const byFormat = new Map<string, Result[]>();
  for (const r of rs.filter((x) => x.kind === "clone")) {
    const k = r.formatId ?? "unknown";
    byFormat.set(k, [...(byFormat.get(k) ?? []), r]);
  }
  const ratio =
    clone.medianWatch && real.medianWatch
      ? clone.medianWatch / real.medianWatch
      : null;
  let verdict = "Need avg-watch numbers for both clone and real posts.";
  if (ratio !== null) {
    if (clone.n < 20)
      verdict = `Clone holds ${(ratio * 100).toFixed(0)}% of real-face watch time (n=${clone.n}; decide at 20).`;
    else if (ratio < 0.8)
      verdict = `KILL: clone holds ${(ratio * 100).toFixed(0)}% of real-face watch time after ${clone.n} posts. Keep the engine, film yourself.`;
    else
      verdict = `KEEP: clone holds ${(ratio * 100).toFixed(0)}% of real-face watch time after ${clone.n} posts.`;
  }
  return {
    clone,
    real,
    byFormat: [...byFormat.entries()]
      .map(([formatId, xs]) => ({ formatId, ...summarize(xs) }))
      .sort((a, b) => (b.medianViews ?? 0) - (a.medianViews ?? 0)),
    verdict,
  };
}
