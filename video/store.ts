/**
 * Where jobs and media live.
 *
 * - Blob (BLOB_READ_WRITE_TOKEN set): Vercel Blob. Required on Vercel; also
 *   use it locally if you want CLI and MCP to see the same jobs.
 * - Local (no token): out/video/<id>/ on disk, for CLI-only use.
 *
 * Media is referenced by a "ref": a Blob URL or an absolute local path.
 * Steps materialize refs into a scratch dir before running FFmpeg.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { OUT_DIR, SERVERLESS } from "./config";
import { download, ensureDir, exists, readJson, writeJson } from "./lib/util";

export type Store = {
  kind: "local" | "blob";
  readJson<T>(key: string): Promise<T | null>;
  writeJson(key: string, data: unknown): Promise<void>;
  /** Keys directly under a prefix's subfolders, e.g. listKeys("jobs/", "job.json"). */
  listKeys(prefix: string, fileName: string): Promise<string[]>;
  /** Persist a local file; returns its ref. */
  putFile(key: string, localPath: string, contentType: string): Promise<string>;
  deletePrefix(prefix: string): Promise<void>;
};

const BLOB_ROOT = "video/";
const ACCESS = (process.env.VIDEO_BLOB_ACCESS ?? "public") as
  | "public"
  | "private";

const blobStore: Store = {
  kind: "blob",
  async readJson<T>(key: string) {
    // useCache:false — job state changes every step; never read a stale CDN copy.
    const res = await get(BLOB_ROOT + key, { access: ACCESS, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return JSON.parse(await new Response(res.stream).text()) as T;
  },
  async writeJson(key, data) {
    await put(BLOB_ROOT + key, JSON.stringify(data, null, 2), {
      access: ACCESS,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
  },
  async listKeys(prefix, fileName) {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: BLOB_ROOT + prefix,
        cursor,
        limit: 1000,
      });
      for (const b of page.blobs)
        if (b.pathname.endsWith(`/${fileName}`))
          keys.push(b.pathname.slice(BLOB_ROOT.length));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return keys;
  },
  async putFile(key, localPath, contentType) {
    const blob = await put(BLOB_ROOT + key, await fs.readFile(localPath), {
      access: ACCESS,
      contentType,
      // Random suffix = a fresh URL per render, so the CDN never serves an old cut.
      addRandomSuffix: true,
    });
    return blob.url;
  },
  async deletePrefix(prefix) {
    const page = await list({ prefix: BLOB_ROOT + prefix, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
  },
};

const localStore: Store = {
  kind: "local",
  async readJson<T>(key: string) {
    const p = path.join(OUT_DIR, key);
    return (await exists(p)) ? readJson<T>(p) : null;
  },
  async writeJson(key, data) {
    await writeJson(path.join(OUT_DIR, key), data);
  },
  async listKeys(prefix, fileName) {
    const dir = path.join(OUT_DIR, prefix);
    if (!(await exists(dir))) return [];
    const subs = await fs.readdir(dir);
    const keys: string[] = [];
    for (const s of subs)
      if (await exists(path.join(dir, s, fileName)))
        keys.push(`${prefix}${s}/${fileName}`);
    return keys;
  },
  async putFile(key, localPath) {
    const dest = path.join(OUT_DIR, key);
    if (path.resolve(dest) !== path.resolve(localPath)) {
      await ensureDir(path.dirname(dest));
      await fs.copyFile(localPath, dest);
    }
    return dest;
  },
  async deletePrefix(prefix) {
    await fs.rm(path.join(OUT_DIR, prefix), { recursive: true, force: true });
  },
};

let cached: Store | null = null;
export function store(): Store {
  if (cached) return cached;
  if (process.env.BLOB_READ_WRITE_TOKEN) cached = blobStore;
  else if (SERVERLESS)
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Create a Vercel Blob store and connect it to this project.",
    );
  else cached = localStore;
  return cached;
}

/** Make a ref available as a local file at `dest` (download URLs, copy paths). */
export async function materialize(ref: string, dest: string): Promise<string> {
  if (/^https?:\/\//.test(ref)) {
    if (ACCESS === "private" && ref.includes(".blob.vercel-storage.com")) {
      const res = await get(ref, { access: "private" });
      if (!res?.stream) throw new Error(`Blob not found: ${ref}`);
      await ensureDir(path.dirname(dest));
      await fs.writeFile(
        dest,
        Buffer.from(await new Response(res.stream).arrayBuffer()),
      );
      return dest;
    }
    return download(ref, dest);
  }
  if (path.resolve(ref) === path.resolve(dest)) return dest;
  if (!(await exists(ref))) throw new Error(`File not found: ${ref}`);
  await ensureDir(path.dirname(dest));
  await fs.copyFile(ref, dest);
  return dest;
}
