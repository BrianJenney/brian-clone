import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ffmpegEnv, ffmpegPath } from "../config";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(p: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export async function writeJson(p: string, data: unknown) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJsonl<T>(p: string): Promise<T[]> {
  if (!(await exists(p))) return [];
  const raw = await fs.readFile(p, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

export async function appendJsonl(p: string, rows: unknown[]) {
  if (!rows.length) return;
  await ensureDir(path.dirname(p));
  await fs.appendFile(p, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
}

export function sha1(input: string | Buffer) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function slug(s: string, max = 40) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** fetch + JSON with retries on 429/5xx. Throws with the response body on failure. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  { retries = 3 }: { retries?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      lastErr = err; // network error: retry
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    const body = await res.text();
    lastErr = new Error(
      `${init.method ?? "GET"} ${url} → ${res.status}: ${body.slice(0, 500)}`,
    );
    if (res.status !== 429 && res.status < 500) throw lastErr;
    await sleep(1000 * 2 ** attempt);
  }
  throw lastErr;
}

export async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Run a binary, resolve stdout, reject with stderr tail. */
export function run(
  cmd: string,
  args: string[],
  { quiet = true } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isFfmpeg = cmd === "ffmpeg";
    const p = spawn(isFfmpeg ? ffmpegPath() : cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: isFfmpeg ? ffmpegEnv() : process.env,
    });
    let out = "";
    let errOut = "";
    p.stdout.on("data", (d) => {
      out += d;
    });
    p.stderr.on("data", (d) => {
      errOut += d;
      if (!quiet) process.stderr.write(d);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}:\n${errOut.slice(-2000)}`));
    });
  });
}

/** Media duration in seconds. Parses `ffmpeg -i` so we don't need ffprobe on Vercel. */
export function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), ["-hide_banner", "-i", file], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d;
    });
    p.on("error", reject);
    p.on("close", () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return reject(new Error(`Could not read duration of ${file}`));
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
  });
}

export function money(n: number) {
  return `$${n.toFixed(2)}`;
}
