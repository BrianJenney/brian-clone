import path from "node:path";
import { z } from "zod";
import { DATA_DIR } from "../config";
import { readJson } from "../lib/util";

/**
 * Who a video is for. Each audience carries its real objections (pains), the
 * claims Brian can credibly make to them, hard "never say" rules, and the CTA,
 * so every script is written to convert someone, not just to get views.
 */
export const AudienceSchema = z.object({
  id: z.string(),
  name: z.string(),
  who: z.string(),
  pains: z.array(z.string()),
  claims: z.array(z.string()),
  never: z.array(z.string()),
  cta: z.string(),
  formatHints: z.array(z.string()),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const AUDIENCES_PATH = path.join(DATA_DIR, "audiences.json");

export async function loadAudiences(): Promise<Audience[]> {
  const raw = await readJson<unknown[]>(AUDIENCES_PATH, []);
  return raw.map((a) => AudienceSchema.parse(a));
}

export async function getAudience(id: string): Promise<Audience> {
  const all = await loadAudiences();
  const a = all.find((x) => x.id === id);
  if (!a)
    throw new Error(
      `Unknown audience "${id}". Known: ${all.map((x) => x.id).join(", ")}`,
    );
  return a;
}

export function audienceBrief(a: Audience) {
  return `AUDIENCE: ${a.name}
Who: ${a.who}
What they're thinking (speak to one of these, in their words): ${a.pains.map((p) => `"${p}"`).join("; ")}
What Brian can credibly claim (use only these for credentials/offer): ${a.claims.join("; ")}
Never: ${a.never.join("; ")}
CTA (last segment, keep the keyword exactly): ${a.cta}`;
}
