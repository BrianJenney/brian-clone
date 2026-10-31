/**
 * Free stock b-roll from Pexels (https://www.pexels.com/api/). Commercial use is
 * allowed without attribution. Results are cached per query so re-renders are free.
 */
import path from "node:path";
import { CACHE_DIR, env } from "../config";
import { download, exists, fetchJson, slug } from "../lib/util";

type PexelsVideo = {
  id: number;
  duration: number;
  video_files: Array<{
    link: string;
    width: number;
    height: number;
    quality: string | null;
  }>;
};

/** Returns a local path, or null if no key / no result (caller falls back to a card). */
export async function fetchBroll(
  query: string,
  minDurationSec: number,
): Promise<string | null> {
  if (!env.pexelsKey) return null;
  const dest = path.join(CACHE_DIR, "broll", `${slug(query, 60)}.mp4`);
  if (await exists(dest)) return dest;

  const qs = new URLSearchParams({
    query,
    orientation: "portrait",
    size: "medium",
    per_page: "10",
  });
  const res = await fetchJson<{ videos: PexelsVideo[] }>(
    `https://api.pexels.com/videos/search?${qs}`,
    {
      headers: { Authorization: env.pexelsKey },
    },
  );
  const pick = res.videos
    .filter((v) => v.duration >= Math.min(minDurationSec, 8))
    .map((v) => ({
      v,
      file: v.video_files
        .filter((f) => f.height >= f.width && f.height >= 1280)
        .sort(
          (a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920),
        )[0],
    }))
    .find((x) => x.file);
  if (!pick) return null;
  await download(pick.file.link, dest);
  return dest;
}
