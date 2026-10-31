/**
 * HeyGen v3 "audio to video": lip-sync our ElevenLabs narration onto Brian's
 * digital twin. Docs: https://developers.heygen.com/audio-to-video.md
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env, type HeygenEngine, requireEnv } from "../config";
import { download, fetchJson, probeDuration, run, sleep } from "../lib/util";

const BASE = "https://api.heygen.com";

function headers(json = true): Record<string, string> {
  const key = requireEnv(env.heygenKey, "HEYGEN_API_KEY");
  return json
    ? { "x-api-key": key, "Content-Type": "application/json" }
    : { "x-api-key": key };
}

export type AvatarResult = {
  provider: "heygen" | "mock";
  videoId: string | null;
  engine: HeygenEngine | null;
  path: string;
  durationSec: number;
};

export async function heygenMe() {
  return fetchJson<{ data: unknown }>(`${BASE}/v3/users/me`, {
    headers: headers(false),
  });
}

export type Look = {
  id: string;
  name: string;
  avatar_type: string;
  group_id: string | null;
  supported_api_engines: HeygenEngine[];
  preview_image_url?: string;
};

export async function listMyLooks(): Promise<Look[]> {
  const res = await fetchJson<{ data: Look[] }>(
    `${BASE}/v3/avatars/looks?ownership=private&limit=100`,
    {
      headers: headers(false),
    },
  );
  return res.data;
}

async function uploadAudio(file: string): Promise<string> {
  const form = new FormData();
  const buf = await fs.readFile(file);
  form.append(
    "file",
    new Blob([buf], { type: "audio/mpeg" }),
    path.basename(file),
  );
  const res = await fetchJson<{ data: { asset_id?: string; id?: string } }>(
    `${BASE}/v3/assets`,
    {
      method: "POST",
      headers: headers(false),
      body: form,
    },
  );
  const id = res.data.asset_id ?? res.data.id;
  if (!id)
    throw new Error(
      `HeyGen asset upload returned no id: ${JSON.stringify(res)}`,
    );
  return id;
}

type VideoStatus = {
  status:
    | "waiting"
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | string;
  video_url?: string;
  duration?: number;
  failure_code?: string;
  failure_message?: string;
};

export async function heygenStatus(videoId: string) {
  return (
    await fetchJson<{ data: VideoStatus }>(`${BASE}/v3/videos/${videoId}`, {
      headers: headers(false),
    })
  ).data;
}

/**
 * Submit (or resume) a render. Pass `existingVideoId` to resume polling a render
 * that was already paid for, e.g. after the CLI was interrupted.
 */
export async function heygenRender(
  audioPath: string,
  outDir: string,
  {
    avatarId = env.heygenAvatarId,
    engine = env.heygenEngine,
    existingVideoId,
    onSubmitted,
    title,
  }: {
    avatarId?: string;
    engine?: HeygenEngine;
    existingVideoId?: string | null;
    onSubmitted?: (videoId: string) => Promise<void>;
    title?: string;
  } = {},
): Promise<AvatarResult> {
  const look = requireEnv(avatarId, "HEYGEN_AVATAR_ID");
  let videoId = existingVideoId ?? null;

  if (!videoId) {
    const assetId = await uploadAudio(audioPath);
    const body: Record<string, unknown> = {
      type: "avatar",
      avatar_id: look,
      audio_asset_id: assetId,
      aspect_ratio: "9:16",
      resolution: "1080p",
      fit: "cover",
      title: title ?? path.basename(outDir),
    };
    // Omitting engine = Avatar IV. Only send it when asking for something else.
    if (engine && engine !== "avatar_iv") body.engine = { type: engine };
    const res = await fetchJson<{ data: { video_id: string } }>(
      `${BASE}/v3/videos`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      },
    );
    videoId = res.data.video_id;
    await onSubmitted?.(videoId);
    console.log(`  HeyGen render submitted: ${videoId}`);
  }

  const started = Date.now();
  for (;;) {
    const s = await heygenStatus(videoId);
    if (s.status === "completed" && s.video_url) {
      const dest = path.join(outDir, "avatar.mp4");
      await download(s.video_url, dest);
      return {
        provider: "heygen",
        videoId,
        engine,
        path: dest,
        durationSec: await probeDuration(dest),
      };
    }
    if (s.status === "failed") {
      throw new Error(
        `HeyGen render failed: ${s.failure_code ?? ""} ${s.failure_message ?? ""}`,
      );
    }
    if (Date.now() - started > 30 * 60_000)
      throw new Error(`HeyGen render ${videoId} timed out (still ${s.status})`);
    process.stdout.write(
      `  HeyGen ${s.status}… ${Math.round((Date.now() - started) / 1000)}s\r`,
    );
    await sleep(10_000);
  }
}

/**
 * Stand-in "avatar": a gradient with a pulsing circle where the face would be.
 * Lets you iterate on scripts, timing, captions and layout without paying HeyGen.
 */
export async function mockAvatar(
  audioPath: string,
  outDir: string,
): Promise<AvatarResult> {
  const duration = await probeDuration(audioPath);
  const dest = path.join(outDir, "avatar.mp4");
  // A "head" box that drifts slightly so punch-ins and splits are visible in previews.
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x1e293b:s=1080x1920:r=30:d=${duration.toFixed(2)}`,
    "-i",
    audioPath,
    "-vf",
    "drawbox=x='340+20*sin(t)':y=420:w=400:h=520:color=0x94a3b8@0.5:t=fill,drawbox=x=240:y=980:w=600:h=940:color=0x64748b@0.4:t=fill,format=yuv420p",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    dest,
  ]);
  return {
    provider: "mock",
    videoId: null,
    engine: null,
    path: dest,
    durationSec: duration,
  };
}
