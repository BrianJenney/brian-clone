import path from "node:path";
import { z } from "zod";
import { DATA_DIR, env } from "../config";
import { llmParse } from "../lib/llm";
import { readJson, readJsonl, writeJson } from "../lib/util";
import { type Format, FormatSchema, type StoredAnalysis } from "../schemas";

export const FORMATS_PATH = path.join(DATA_DIR, "formats.json");
export const ANALYSES_PATH = path.join(DATA_DIR, "analyses.jsonl");

export async function loadFormats(): Promise<Format[]> {
  const raw = await readJson<unknown[]>(FORMATS_PATH, []);
  return raw.map((f) => FormatSchema.parse(f));
}

export async function saveFormats(formats: Format[]) {
  await writeJson(FORMATS_PATH, formats);
}

export async function getFormat(id: string): Promise<Format> {
  const formats = await loadFormats();
  const f = formats.find((x) => x.id === id);
  if (!f)
    throw new Error(
      `Unknown format "${id}". Known: ${formats.map((x) => x.id).join(", ")}`,
    );
  return f;
}

/**
 * Fold mined analyses into the library:
 * 1. Attach evidence (outlier URLs) to the format each analysis matched.
 * 2. Cluster the unmatched, relevant ones into new formats via the LLM.
 * The library is the moat Doxa sells; this is how ours grows.
 */
export async function mineFormats({ minRelevance = 6, minCluster = 2 } = {}) {
  const formats = await loadFormats();
  const analyses = await readJsonl<StoredAnalysis>(ANALYSES_PATH);
  const relevant = analyses.filter((a) => a.relevanceToBrian >= minRelevance);

  let attached = 0;
  for (const a of relevant) {
    const f = a.formatId ? formats.find((x) => x.id === a.formatId) : undefined;
    if (!f || f.evidence.some((e) => e.url === a.url)) continue;
    f.evidence.push({
      url: a.url,
      platform: a.platform,
      views: a.views,
      multiple: a.multiple,
    });
    if (f.exampleHooks.length < 8 && !f.exampleHooks.includes(a.hook))
      f.exampleHooks.push(a.hook);
    attached++;
  }

  const unmatched = relevant.filter(
    (a) => !a.formatId || !formats.some((x) => x.id === a.formatId),
  );
  let created: Format[] = [];
  if (unmatched.length >= minCluster) {
    const NewFormats = z.object({ formats: z.array(FormatSchema) });
    const out = await llmParse(
      NewFormats,
      "new_formats",
      `Existing format ids (do not duplicate): ${formats.map((f) => f.id).join(", ")}

Below are analyses of viral short-form videos that did not fit an existing format.
Group the ones that share a STRUCTURE (not topic) into new reusable formats.
Only create a format if at least ${minCluster} analyses share it. Use kebab-case ids,
source "mined", and put the source URLs in evidence. Set cloneSuitable=false for
formats that depend on personal stories or emotional vulnerability.

${JSON.stringify(
  unmatched.map(({ transcript: _t, ...a }) => a),
  null,
  1,
)}`,
      { model: env.llmModel },
    );
    created = out.formats.filter((f) => !formats.some((x) => x.id === f.id));
    formats.push(...created);
  }

  await saveFormats(formats);
  return { attached, created: created.map((f) => f.id), total: formats.length };
}
