#!/usr/bin/env tsx
/**
 * yarn video <command>   — run `yarn video help` for the list.
 */
import fs from "node:fs/promises";
import { z } from "zod";
import { heygenMe, listMyLooks } from "./avatar/heygen";
import { env } from "./config";
import {
  createJob,
  estimateCost,
  estimateRunCost,
  listJobs,
  loadJob,
  type RenderMode,
  saveJob,
  scriptMarkdown,
} from "./jobs";
import { llmParse } from "./lib/llm";
import { money, readJson, readJsonl, run } from "./lib/util";
import { ANALYSES_PATH, loadFormats, mineFormats } from "./library/formats";
import { logResult, report } from "./metrics";
import type { ScoredPost, StoredAnalysis } from "./schemas";
import { writeScript } from "./script/write";
import { jobSummary, startRender } from "./service";
import { runRenderLocal } from "./steps";
import { store } from "./store";
import {
  analyzeOutliers,
  discoverAccounts,
  OUTLIERS_PATH,
  pullAds,
  pullTrends,
} from "./trends/pipeline";

// ---------- tiny arg parser ----------
const argv = process.argv.slice(2);
const cmd = argv[0] ?? "help";
const positional: string[] = [];
const flags: Record<string, string | true> = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) flags[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
    else flags[k] = true;
  } else positional.push(a);
}
const flag = (k: string) =>
  typeof flags[k] === "string" ? (flags[k] as string) : undefined;
const num = (k: string) =>
  flag(k) !== undefined ? Number(flag(k)) : undefined;

const HELP = `
Brian clone — short-form video pipeline

SETUP
  doctor                         Check ffmpeg, API keys, HeyGen account + your avatar looks
  heygen:looks                   List your HeyGen avatar looks (copy one into HEYGEN_AVATAR_ID)

TREND ENGINE  (needs SCRAPECREATORS_API_KEY; OPENAI_API_KEY for analysis)
  trends:discover "<keyword>"    Find accounts with outlier posts for a keyword
  trends:pull [--no-keywords]    Pull tracked accounts + keywords → score → data/video/outliers.json
  trends:analyze [--limit 10]    Transcribe + break down top outliers → data/video/analyses.jsonl
  trends:ads "<query>" [--min-days 21]   Long-running video ads (Meta + TikTok libraries) → data/video/ads.json
  formats:mine                   Fold analyses into the format library (new formats + evidence)
  formats                        List the format library

SCRIPTS
  ideas [--n 10]                 Topic ideas from mined outliers × your content
  script "<topic>" [--audience students|business] [--format id] [--seconds 30] [--from <outlier url>] [--screen] [--notes "..."]
  batch <topics.txt> [--format id]   One topic per line → one draft each
  approve <id...>                Mark drafts ready to render (spends money on render)

RENDER
  render <id> [--mock | --mock-avatar] [--remote] [--music file.mp3] [--label "AI clone"] [--max-cost 5]
      --mock         free dry run: silent voice + placeholder avatar (layout/timing/captions)
      --mock-avatar  real ElevenLabs voice, placeholder avatar (cheap: hear it before HeyGen)
      --remote       queue on Inngest instead of rendering on this machine
  render:approved [--yes] [--max-total 100]   Render every approved, unrendered job
  show <id>                      Script, render status and links
  list                           All jobs with status + cost

LEARN
  log <id|url> --platform tiktok --views 12000 [--watch 0.61] [--shares 40] [--follows 12] [--real] [--format id]
  report                         Clone vs real, by format, keep/kill verdict
`;

async function main() {
  switch (cmd) {
    case "help":
    case "--help":
      console.log(HELP);
      return;

    case "doctor": {
      const ok = (b: unknown) => (b ? "✓" : "✗");
      const ff = await run("ffmpeg", ["-hide_banner", "-filters"]).catch(
        () => "",
      );
      console.log(
        `${ok(ff)} ffmpeg${ff && !/\bass\b/.test(ff) ? " (⚠ built without libass: captions will fail)" : ""}`,
      );
      console.log(`${ok(env.heygenKey)} HEYGEN_API_KEY`);
      console.log(
        `${ok(env.heygenAvatarId)} HEYGEN_AVATAR_ID   engine=${env.heygenEngine}`,
      );
      console.log(`${ok(env.elevenKey)} ELEVENLABS_API_KEY`);
      console.log(
        `${ok(env.elevenVoiceId)} ELEVENLABS_VOICE_ID  model=${env.elevenModel}`,
      );
      console.log(
        `${ok(process.env.OPENAI_API_KEY)} OPENAI_API_KEY      model=${env.llmModel}`,
      );
      console.log(
        `${ok(process.env.QDRANT_URL)} QDRANT_URL (your writing, for scripts)`,
      );
      console.log(`${ok(env.scrapeKey)} SCRAPECREATORS_API_KEY (trend engine)`);
      console.log(
        `${ok(env.pexelsKey)} PEXELS_API_KEY (stock b-roll; optional)`,
      );
      console.log(
        `${ok(process.env.BLOB_READ_WRITE_TOKEN)} BLOB_READ_WRITE_TOKEN (shared job store for MCP; without it jobs stay in out/video/jobs)`,
      );
      console.log(
        `${ok(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV)} INNGEST_EVENT_KEY or INNGEST_DEV=1 (async renders from MCP / --remote)`,
      );
      if (env.heygenKey) {
        try {
          await heygenMe();
          const looks = await listMyLooks();
          console.log(`✓ HeyGen auth OK — ${looks.length} private look(s)`);
          const chosen = looks.find((l) => l.id === env.heygenAvatarId);
          if (env.heygenAvatarId && !chosen)
            console.log("✗ HEYGEN_AVATAR_ID is not one of your looks");
          if (chosen)
            console.log(
              `  using "${chosen.name}" (${chosen.avatar_type}) engines: ${chosen.supported_api_engines.join(", ")}`,
            );
          if (
            chosen &&
            !chosen.supported_api_engines.includes(env.heygenEngine)
          )
            console.log(
              `✗ this look does not support ${env.heygenEngine}; set HEYGEN_ENGINE`,
            );
        } catch (e) {
          console.log(`✗ HeyGen: ${(e as Error).message}`);
        }
      }
      return;
    }

    case "heygen:looks": {
      const looks = await listMyLooks();
      for (const l of looks)
        console.log(
          `${l.id}  ${l.name}  [${l.avatar_type}]  engines: ${l.supported_api_engines.join(",")}`,
        );
      if (!looks.length)
        console.log(
          "No private looks yet. Create your digital twin in HeyGen first (see video/README.md).",
        );
      return;
    }

    case "trends:discover": {
      const kw = positional[0];
      if (!kw) throw new Error('Usage: trends:discover "<keyword>"');
      const rows = await discoverAccounts(kw);
      for (const r of rows.slice(0, 25))
        console.log(
          `${r.best.toFixed(1).padStart(6)}x followers  @${r.handle}  (${r.followers?.toLocaleString() ?? "?"} followers)`,
        );
      console.log("\nAdd the good ones to data/video/accounts.json.");
      return;
    }

    case "trends:pull": {
      const res = await pullTrends({ keywords: !flags["no-keywords"] });
      console.log(
        `\n${res.posts} posts scored, ${res.outliers.length} outliers → ${OUTLIERS_PATH}`,
      );
      for (const o of res.outliers.slice(0, 15))
        console.log(
          `  ${(o.multiple ?? o.viewsPerFollower ?? 0).toFixed(1).padStart(5)}x  ${o.views.toLocaleString().padStart(10)}  @${o.handle}  ${o.caption.slice(0, 60).replace(/\n/g, " ")}`,
        );
      for (const e of res.errors) console.log(`  ✗ ${e}`);
      return;
    }

    case "trends:analyze": {
      const rows = await analyzeOutliers({ limit: num("limit") ?? 10 });
      console.log(
        `\n${rows.length} analyzed → ${ANALYSES_PATH}. Next: yarn video formats:mine`,
      );
      return;
    }

    case "trends:ads": {
      const q = positional[0];
      if (!q) throw new Error('Usage: trends:ads "<query>"');
      const res = await pullAds(q, { minDays: num("min-days") ?? 21 });
      console.log(
        `${res.found} ads found, ${res.winners.length} long-running video ads:`,
      );
      for (const a of res.winners.slice(0, 20))
        console.log(
          `  ${String(a.daysRunning).padStart(4)}d  ${a.source.padEnd(6)} ${a.advertiser.slice(0, 30).padEnd(30)}  ${(a.transcript ?? a.body).slice(0, 70).replace(/\n/g, " ")}`,
        );
      for (const e of res.errors) console.log(`  ✗ ${e}`);
      return;
    }

    case "formats:mine": {
      console.log(await mineFormats());
      return;
    }

    case "formats": {
      for (const f of await loadFormats())
        console.log(
          `${f.cloneSuitable ? " " : "🎥"} ${f.id.padEnd(22)} ${f.name.padEnd(34)} ${f.lengthSec.min}-${f.lengthSec.max}s  evidence: ${f.evidence.length}`,
        );
      console.log("\n🎥 = film these yourself (personal/story formats)");
      return;
    }

    case "ideas": {
      const analyses = (await readJsonl<StoredAnalysis>(ANALYSES_PATH)).filter(
        (a) => a.relevanceToBrian >= 6,
      );
      const formats = (await loadFormats()).filter((f) => f.cloneSuitable);
      const { ideas } = await llmParse(
        z.object({
          ideas: z.array(
            z.object({
              topic: z.string(),
              formatId: z.string(),
              why: z.string(),
            }),
          ),
        }),
        "ideas",
        `Generate ${num("n") ?? 10} short-form video topics for Brian Jenney (senior dev, runs the Parsity coding bootcamp and an AI engineering program; audience: career changers and junior devs learning practical AI like RAG and agents).
Each topic must be one specific idea, phrased as the promise of the video. Match each to a format id.
Formats: ${formats.map((f) => `${f.id} (${f.whenToUse})`).join("; ")}
Structures that are currently outperforming in adjacent niches:
${
  analyses
    .slice(-30)
    .map((a) => `- [${a.hookType}] ${a.transferableTemplate}`)
    .join("\n") || "(none mined yet — use evergreen pain points)"
}`,
        { model: env.llmModel },
      );
      // stdout is batch-ready ("[format] topic  # why"); hints go to stderr.
      for (const i of ideas)
        console.log(`[${i.formatId}] ${i.topic}  # ${i.why}`);
      console.error(
        "\nKeep the lines you like and run: yarn video batch <file>",
      );
      return;
    }

    case "script": {
      const topic = positional[0];
      if (!topic)
        throw new Error(
          'Usage: script "<topic>" [--format id] [--seconds 30] [--from <outlier url>]',
        );
      let inspiration: StoredAnalysis | undefined;
      if (flag("from")) {
        inspiration = (await readJsonl<StoredAnalysis>(ANALYSES_PATH)).find(
          (a) => a.url === flag("from"),
        );
        if (!inspiration)
          throw new Error(
            `No analysis for ${flag("from")} — run trends:analyze first`,
          );
      }
      const script = await writeScript({
        topic,
        formatId: flag("format") ?? inspiration?.formatId ?? undefined,
        targetSec: num("seconds"),
        inspiration,
        hasScreenRecording: !!flags.screen,
        audience: flag("audience"),
        notes: flag("notes"),
      });
      const job = await createJob(script);
      console.log(scriptMarkdown(job));
      return;
    }

    case "batch": {
      const file = positional[0];
      if (!file) throw new Error("Usage: batch <topics.txt>");
      // Lines: "topic" or "[format-id] topic  # optional comment"
      const topics = (await fs.readFile(file, "utf8"))
        .split("\n")
        .map((l) => l.replace(/\s+#.*$/, "").trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const m = l.match(/^\[([^\]]+)\]\s*(.+)$/);
          return m
            ? { formatId: m[1], topic: m[2] }
            : { formatId: flag("format"), topic: l };
        });
      for (const { topic, formatId } of topics) {
        try {
          const script = await writeScript({
            topic,
            formatId,
            audience: flag("audience"),
          });
          const job = await createJob(script);
          const est = estimateCost(script);
          console.log(
            `✓ ${job.id}  ~${Math.round(est.secs)}s  ${money(est.total)}  ${script.title}`,
          );
        } catch (e) {
          console.log(`✗ ${topic}: ${(e as Error).message}`);
        }
      }
      console.log("\nReview with `yarn video show <id>`, then approve <id...>");
      return;
    }

    case "approve": {
      for (const id of positional) {
        const job = await loadJob(id);
        job.status = job.status === "rendered" ? "rendered" : "approved";
        job.approvedAt = new Date().toISOString();
        await saveJob(job);
        console.log(
          `✓ approved ${id} (est. ${money(estimateCost(job.script).total)})`,
        );
      }
      return;
    }

    case "render": {
      const id = positional[0];
      if (!id)
        throw new Error("Usage: render <id> [--mock|--mock-avatar] [--remote]");
      const mode: RenderMode = flags.mock
        ? "mock"
        : flags["mock-avatar"]
          ? "voice"
          : "final";
      const job = await loadJob(id);
      const cost = estimateRunCost(job, mode);
      if (mode === "final" && job.status === "draft")
        throw new Error(
          `Job ${id} is a draft. Review it (yarn video show ${id}), then: yarn video approve ${id}`,
        );
      const cap = num("max-cost");
      if (cap !== undefined && cost > cap)
        throw new Error(
          `Estimated ${money(cost)} exceeds --max-cost ${money(cap)}`,
        );
      if (flags.remote) {
        await startRender(id, mode, { maxCostUsd: cost, label: flag("label") });
        console.log(
          `Queued ${mode} render on Inngest (est. ${money(cost)}). Check: yarn video show ${id}`,
        );
        return;
      }
      const r = await runRenderLocal(id, mode, {
        music: flag("music") ?? null,
        label: flag("label"),
      });
      for (const w of r.warnings) console.log(`  ⚠ ${w}`);
      const after = await loadJob(id);
      console.log(
        `\n✓ ${r.video}\n  cover: ${r.cover}\n  spent so far on this job: ${money(after.costUsd)}`,
      );
      return;
    }

    case "render:approved": {
      const todo = (await listJobs()).filter((j) => j.status === "approved");
      const total = todo.reduce((n, j) => n + estimateRunCost(j, "final"), 0);
      console.log(`${todo.length} approved job(s), est. ${money(total)}`);
      const cap = num("max-total") ?? 100;
      if (total > cap)
        throw new Error(
          `Estimated ${money(total)} > --max-total ${money(cap)}`,
        );
      if (!flags.yes) {
        console.log("Re-run with --yes to render.");
        return;
      }
      for (const j of todo) {
        console.log(`\n▶ ${j.id}`);
        try {
          if (flags.remote)
            await startRender(j.id, "final", {
              maxCostUsd: total,
              label: flag("label"),
            });
          else
            await runRenderLocal(j.id, "final", {
              music: flag("music") ?? null,
              label: flag("label"),
            });
        } catch (e) {
          console.log(`  ✗ ${(e as Error).message}`);
        }
      }
      return;
    }

    case "show": {
      const id = positional[0];
      if (!id) throw new Error("Usage: show <id>");
      console.log(jobSummary(await loadJob(id)));
      return;
    }

    case "list": {
      const jobs = await listJobs();
      let spent = 0;
      for (const j of jobs) {
        spent += j.costUsd;
        const run = j.run ? `${j.run.mode}:${j.run.stage}` : "";
        console.log(
          `${j.status.padEnd(9)} ${run.padEnd(18)} ${j.id.padEnd(58)} ${money(j.costUsd).padStart(7)}  ${j.script.formatId}`,
        );
      }
      console.log(
        `\n${jobs.length} jobs, ${money(spent)} spent (store: ${store().kind})`,
      );
      return;
    }

    case "log": {
      const target = positional[0];
      const platform = flag("platform");
      const views = num("views");
      if (!target || !platform || views === undefined)
        throw new Error(
          "Usage: log <id|url> --platform tiktok --views 12000 [--watch 0.6]",
        );
      const isUrl = /^https?:\/\//.test(target);
      const job = isUrl ? null : await loadJob(target);
      const url = isUrl ? target : (flag("url") ?? `${platform}:${target}`);
      if (job && flag("url")) {
        job.posts.push({
          platform,
          url: flag("url") as string,
          postedAt: new Date().toISOString(),
        });
        await saveJob(job);
      }
      await logResult({
        jobId: job?.id ?? null,
        url,
        platform,
        kind: flags.real ? "real" : "clone",
        formatId: job?.script.formatId ?? flag("format") ?? null,
        views,
        avgWatch: num("watch") ?? null,
        shares: num("shares") ?? null,
        follows: num("follows") ?? null,
      });
      console.log("✓ logged");
      return;
    }

    case "report": {
      const r = await report();
      const fmt = (s: {
        n: number;
        medianViews: number | null;
        medianWatch: number | null;
        sharesPer1k: number | null;
      }) =>
        `n=${s.n}  median views ${s.medianViews?.toLocaleString() ?? "—"}  median watch ${s.medianWatch !== null ? `${(s.medianWatch * 100).toFixed(0)}%` : "—"}  shares/1k ${s.sharesPer1k?.toFixed(1) ?? "—"}`;
      console.log(
        `clone  ${fmt(r.clone)}\nreal   ${fmt(r.real)}\n\nBy format (clone):`,
      );
      for (const f of r.byFormat)
        console.log(`  ${f.formatId.padEnd(22)} ${fmt(f)}`);
      console.log(`\n${r.verdict}`);
      return;
    }

    case "outliers": {
      const o = await readJson<ScoredPost[]>(OUTLIERS_PATH, []);
      for (const x of o.slice(0, num("n") ?? 20))
        console.log(
          `${(x.multiple ?? x.viewsPerFollower ?? 0).toFixed(1)}x  ${x.url}`,
        );
      return;
    }

    default:
      console.log(`Unknown command "${cmd}".\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exit(1);
});
