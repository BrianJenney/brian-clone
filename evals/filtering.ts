import "dotenv/config";
import {
  type LookupWritingArgs,
  lookupWriting,
  type WritingHit,
} from "../libs/mcp/lookupWriting";

/**
 * Evals for lookup_writing's native Qdrant metadata filtering.
 *
 * These hit the real Qdrant collections. Each case runs a query with
 * filters and asserts the returned hits satisfy the constraints. The
 * negative-control cases (impossible windows) prove the filter is actually
 * applied server-side rather than silently ignored.
 *
 * Run: yarn eval:filtering
 */

function monthsAgoISO(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

type Check = { label: string; ok: boolean; detail: string };

type EvalCase = {
  name: string;
  description: string;
  args: LookupWritingArgs;
  check: (hits: WritingHit[], args: LookupWritingArgs) => Check[];
};

const ok = (label: string, ok: boolean, detail = ""): Check => ({
  label,
  ok,
  detail,
});

/** Every hit satisfies a per-hit predicate; reports the first offender. */
function all(
  hits: WritingHit[],
  label: string,
  pred: (h: WritingHit) => boolean,
  describe: (h: WritingHit) => string,
): Check {
  const bad = hits.find((h) => !pred(h));
  return ok(
    label,
    !bad,
    bad ? `offender → ${describe(bad)}` : `${hits.length} ok`,
  );
}

const SIX_MONTHS = monthsAgoISO(6);

const CASES: EvalCase[] = [
  {
    name: "popular-ai-posts-6mo",
    description: "Popular LinkedIn posts about AI in the past 6 months",
    args: {
      query: "artificial intelligence and AI agents",
      sources: ["post"],
      dateFrom: SIX_MONTHS,
      minReactions: 50,
      topK: 5,
    },
    check: (hits, args) => [
      ok("returned at least 1 hit", hits.length > 0, `${hits.length} hits`),
      all(
        hits,
        "all hits are posts",
        (h) => h.source === "post",
        (h) => h.source,
      ),
      all(
        hits,
        `all within last 6 months (>= ${args.dateFrom})`,
        (h) =>
          !!h.createdAt &&
          Date.parse(h.createdAt) >= Date.parse(args.dateFrom!),
        (h) => `createdAt=${h.createdAt}`,
      ),
      all(
        hits,
        `all reactions >= ${args.minReactions}`,
        (h) => (h.numReactions ?? -1) >= args.minReactions!,
        (h) => `reactions=${h.numReactions}`,
      ),
    ],
  },
  {
    name: "recency-60d",
    description: "Date lower-bound is enforced (last 60 days only)",
    args: {
      query: "career advice for developers",
      sources: ["post"],
      dateFrom: daysAgoISO(60),
      topK: 5,
    },
    check: (hits, args) => [
      all(
        hits,
        `all within last 60 days (>= ${args.dateFrom})`,
        (h) =>
          !!h.createdAt &&
          Date.parse(h.createdAt) >= Date.parse(args.dateFrom!),
        (h) => `createdAt=${h.createdAt}`,
      ),
    ],
  },
  {
    name: "impossible-window-negative-control",
    description:
      "Impossible date window must return 0 posts (proves date filter is applied)",
    args: {
      query: "artificial intelligence",
      sources: ["post"],
      dateTo: "2010-01-01T00:00:00.000Z",
      topK: 5,
    },
    check: (hits) => [
      ok(
        "0 hits for pre-2010 window",
        hits.length === 0,
        hits.length === 0
          ? "empty as expected"
          : `LEAK: got ${hits.length} (e.g. ${hits[0].createdAt}) — filter ignored`,
      ),
    ],
  },
  {
    name: "high-reactions-negative-control",
    description:
      "Absurd reaction floor must return 0 posts (proves reactions filter is applied)",
    args: {
      query: "artificial intelligence",
      sources: ["post"],
      minReactions: 1_000_000,
      topK: 5,
    },
    check: (hits) => [
      ok(
        "0 hits for reactions >= 1,000,000",
        hits.length === 0,
        hits.length === 0
          ? "empty as expected"
          : `LEAK: got ${hits.length} (e.g. reactions=${hits[0].numReactions}) — filter ignored`,
      ),
    ],
  },
];

async function run() {
  let failed = 0;

  for (const c of CASES) {
    console.log(`\n▶ ${c.name} — ${c.description}`);
    let hits: WritingHit[] = [];
    try {
      const res = await lookupWriting(c.args);
      hits = res.hits;
      console.log(
        `  chosen=${res.chosenSources.join(",")} hits=${hits.length}` +
          hits
            .map(
              (h) =>
                `\n    · [${h.source}] reactions=${h.numReactions ?? "-"} createdAt=${h.createdAt ?? "-"}`,
            )
            .join(""),
      );
    } catch (err) {
      console.log(`  ✗ threw: ${err instanceof Error ? err.message : err}`);
      failed++;
      continue;
    }

    for (const chk of c.check(hits, c.args)) {
      console.log(`  ${chk.ok ? "✓" : "✗"} ${chk.label} — ${chk.detail}`);
      if (!chk.ok) failed++;
    }
  }

  console.log(
    `\n${failed === 0 ? "✅ all checks passed" : `❌ ${failed} check(s) failed`}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

run();
