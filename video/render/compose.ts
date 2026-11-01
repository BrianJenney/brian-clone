/**
 * FFmpeg compositor. One avatar render covers the whole narration; we cut
 * between it and other visuals on segment boundaries, then burn captions and
 * lay the narration back on top.
 *
 * Why cut away at all: avatar tells (eyes, teeth, drift) show up on long
 * continuous shots. A new visual every 2–6s hides them and is also simply how
 * high-retention shorts are edited.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fetchBroll } from "../broll/pexels";
import { env, FONTS_DIR, X264_PRESET } from "../config";
import { ensureDir, exists, run } from "../lib/util";
import type { Script, Segment } from "../schemas";
import type { SegmentTiming } from "../voice/alignment";
import { buildAss } from "./captions";

const W = 1080;
const H = 1920;
const FPS = 30;
const BG = "0x0b1220";

/** Where the face sits in a 9:16 HeyGen frame. Tune via env if your framing differs. */
const FACE_CROP_Y = Number(process.env.VIDEO_FACE_CROP_Y ?? 260); // top of 1080x960 split crop
const TIGHT_ZOOM = Number(process.env.VIDEO_TIGHT_ZOOM ?? 1.22);

const COVER = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
/**
 * Brian's twin was trained on selfie-mirrored footage (shirt logos read
 * backwards), so un-mirror avatar shots. Set VIDEO_FLIP_AVATAR=0 for a twin
 * trained on unmirrored footage.
 */
const AVATAR_PRE = process.env.VIDEO_FLIP_AVATAR === "0" ? "" : "hflip,";
const enc = [
  "-r",
  String(FPS),
  "-pix_fmt",
  "yuv420p",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "18",
  "-an",
];

export type ComposeInput = {
  jobDir: string;
  script: Script;
  timeline: SegmentTiming[];
  avatarPath: string;
  /** Podcast style: the co-host's lip-synced video. Avatar beats become a two-up. */
  hostAvatarPath?: string | null;
  audioPath: string;
  durationSec: number;
  musicPath?: string | null;
  label?: string;
};

export type ComposeResult = { path: string; cover: string; warnings: string[] };

function resolveFile(jobDir: string, file: string) {
  return path.isAbsolute(file) ? file : path.join(jobDir, file);
}

function escFilterPath(p: string) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

/** Files the script needs from you (screen recordings) that aren't there yet. */
export async function missingAssets(jobDir: string, script: Script) {
  const missing: Array<{ index: number; note: string; expected: string }> = [];
  for (const [i, s] of script.segments.entries()) {
    if (s.visual.kind !== "screen") continue;
    const expected = s.visual.file ?? `screen-${i + 1}.mp4`;
    if (!(await exists(resolveFile(jobDir, expected))))
      missing.push({ index: i, note: s.visual.note, expected });
  }
  return missing;
}

function avatarFilter(framing: "wide" | "tight") {
  if (framing === "wide") return AVATAR_PRE + COVER;
  const zw = Math.round((W * TIGHT_ZOOM) / 2) * 2;
  const zh = Math.round((H * TIGHT_ZOOM) / 2) * 2;
  // Punch in toward the face (upper third), not the center.
  return `${AVATAR_PRE}${COVER},scale=${zw}:${zh},crop=${W}:${H}:${(zw - W) / 2}:${Math.round((zh - H) * 0.25)}`;
}

/** Where the host's face sits in her 9:16 render (top of the 1080x960 crop). */
const HOST_CROP_Y = Number(process.env.VIDEO_HOST_CROP_Y ?? 140);
/** Brian's twin sits small in frame; punch in for the two-up so both faces read the same size. */
const TWOUP_ZOOM = Number(process.env.VIDEO_TWOUP_ZOOM ?? 1.15);
const TWOUP_BRIAN_Y = Number(process.env.VIDEO_TWOUP_BRIAN_Y ?? 380);
const ACCENT = "0xFFD60A";

function nameTag(text: string) {
  if (!text) return "";
  const font = escFilterPath(path.join(FONTS_DIR, "Inter-Bold.otf"));
  const t = text.replace(/[':\\]/g, "");
  return `,drawtext=fontfile='${font}':text='${t}':x=36:y=h-th-44:fontsize=34:fontcolor=white:box=1:boxcolor=0x000000@0.55:boxborderw=14`;
}

/**
 * Podcast two-up: host on top, Brian below, both always visible (the silent one
 * is "listening"). The speaker gets an accent frame; the listener is dimmed.
 */
async function renderTwoUp(
  seg: Segment,
  start: number,
  d: string,
  input: ComposeInput,
  out: string,
) {
  const half = H / 2;
  const hostTalking = seg.speaker === "host";
  const on = `,drawbox=x=0:y=0:w=iw:h=ih:color=${ACCENT}@0.95:t=8`;
  const off = ",eq=brightness=-0.07:saturation=0.8";
  await run("ffmpeg", [
    "-y",
    "-ss",
    start.toFixed(3),
    "-t",
    d,
    "-i",
    input.hostAvatarPath as string,
    "-ss",
    start.toFixed(3),
    "-t",
    d,
    "-i",
    input.avatarPath,
    "-filter_complex",
    `[0:v]${COVER},crop=${W}:${half}:0:${HOST_CROP_Y},setsar=1${hostTalking ? on : off}${nameTag(env.hostName)}[t];` +
      `[1:v]${AVATAR_PRE}${COVER},scale=${Math.round((W * TWOUP_ZOOM) / 2) * 2}:${Math.round((H * TWOUP_ZOOM) / 2) * 2},crop=${W}:${half}:${Math.round((Math.round((W * TWOUP_ZOOM) / 2) * 2 - W) / 2)}:${TWOUP_BRIAN_Y},setsar=1${hostTalking ? off : on}${nameTag("Brian Jenney")}[b];` +
      `[t][b]vstack=inputs=2,fps=${FPS}[v]`,
    "-map",
    "[v]",
    "-t",
    d,
    ...enc,
    out,
  ]);
}

async function renderSegment(
  i: number,
  seg: Segment,
  start: number,
  dur: number,
  input: ComposeInput,
  tmp: string,
  warnings: string[],
): Promise<{ file: string; fellBack: boolean }> {
  const out = path.join(tmp, `seg-${String(i).padStart(2, "0")}.mp4`);
  const d = dur.toFixed(3);
  // In a split layout the bottom half shows whoever is speaking.
  const speakerIsHost = seg.speaker === "host" && !!input.hostAvatarPath;
  const speakerPath = speakerIsHost
    ? (input.hostAvatarPath as string)
    : input.avatarPath;
  const avatarIn = ["-ss", start.toFixed(3), "-t", d, "-i", speakerPath];
  const podcast = !!input.hostAvatarPath;
  if (podcast && seg.visual.kind === "avatar") {
    await renderTwoUp(seg, start, d, input, out);
    return { file: out, fellBack: false };
  }

  // Resolve the non-avatar visual (if any) to a file on disk.
  let visualFile: string | null = null;
  let fit: "cover" | "contain" = "cover";
  const v = seg.visual;
  if (v.kind === "broll") {
    const given = v.file ? resolveFile(input.jobDir, v.file) : null;
    if (given && !(await exists(given)))
      warnings.push(`seg ${i + 1}: b-roll file ${v.file} not found`);
    visualFile =
      given && (await exists(given))
        ? given
        : await fetchBroll(v.query, dur).catch(() => null);
    if (!visualFile)
      warnings.push(
        `seg ${i + 1}: no b-roll for "${v.query}" (set PEXELS_API_KEY or visual.file) — used avatar`,
      );
  } else if (v.kind === "screen") {
    const f = resolveFile(input.jobDir, v.file ?? `screen-${i + 1}.mp4`);
    if (await exists(f)) {
      visualFile = f;
      fit = "contain";
    } else
      warnings.push(
        `seg ${i + 1}: missing screen recording (${v.note}) — used avatar`,
      );
  }

  if (v.kind === "card") {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${d}`,
      "-vf",
      // Subtle vignette so cards don't look like a flat slide.
      "vignette=PI/5,format=yuv420p",
      "-t",
      d,
      ...enc,
      out,
    ]);
    return { file: out, fellBack: false };
  }

  if (!visualFile && podcast) {
    await renderTwoUp(seg, start, d, input, out);
    return { file: out, fellBack: true };
  }
  if (!visualFile) {
    // Fallback: alternate framing so the cut is still visible.
    await run("ffmpeg", [
      "-y",
      ...avatarIn,
      "-vf",
      avatarFilter(v.kind === "avatar" ? v.framing : "tight"),
      "-t",
      d,
      ...enc,
      out,
    ]);
    return { file: out, fellBack: v.kind !== "avatar" };
  }

  const isImage = /\.(png|jpe?g)$/i.test(visualFile);
  const visualIn = isImage
    ? ["-loop", "1", "-t", d, "-i", visualFile]
    : ["-stream_loop", "-1", "-t", d, "-i", visualFile];

  if (seg.layout === "split") {
    const half = H / 2;
    const top =
      fit === "cover"
        ? `scale=${W}:${half}:force_original_aspect_ratio=increase,crop=${W}:${half}`
        : `scale=${W}:${half}:force_original_aspect_ratio=decrease,pad=${W}:${half}:(ow-iw)/2:(oh-ih)/2:color=${BG}`;
    await run("ffmpeg", [
      "-y",
      ...visualIn,
      ...avatarIn,
      "-filter_complex",
      `[0:v]${top},setsar=1[t];[1:v]${speakerIsHost ? "" : AVATAR_PRE}${COVER},crop=${W}:${half}:0:${speakerIsHost ? HOST_CROP_Y : FACE_CROP_Y},setsar=1[b];[t][b]vstack=inputs=2,fps=${FPS}[v]`,
      "-map",
      "[v]",
      "-t",
      d,
      ...enc,
      out,
    ]);
    return { file: out, fellBack: false };
  }

  const full =
    fit === "cover"
      ? COVER
      : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`;
  await run("ffmpeg", [
    "-y",
    ...visualIn,
    "-vf",
    `${full},setsar=1,fps=${FPS}`,
    "-t",
    d,
    ...enc,
    out,
  ]);
  return { file: out, fellBack: false };
}

export async function compose(input: ComposeInput): Promise<ComposeResult> {
  const tmp = await ensureDir(path.join(input.jobDir, "_render"));
  const warnings: string[] = [];

  // Snap boundaries to frames so the concatenated video never drifts from the audio.
  const frame = (t: number) => Math.round(t * FPS);
  const totalFrames = frame(input.durationSec);
  const parts: string[] = [];
  // What actually rendered: a missing b-roll/screen becomes a full-frame avatar shot,
  // and captions must follow that, not the original plan.
  const rendered: Script = {
    ...input.script,
    // Podcast: the host's opening line already is the hook, and an overlay would cover her face.
    hookOverlay: input.hostAvatarPath ? "" : input.script.hookOverlay,
    segments: [...input.script.segments],
  };
  for (const [i, t] of input.timeline.entries()) {
    const f0 = frame(t.start);
    const f1 = i === input.timeline.length - 1 ? totalFrames : frame(t.end);
    if (f1 <= f0) continue;
    const seg = input.script.segments[t.index];
    const r = await renderSegment(
      i,
      seg,
      f0 / FPS,
      (f1 - f0) / FPS,
      input,
      tmp,
      warnings,
    );
    parts.push(r.file);
    const twoUp =
      !!input.hostAvatarPath && (seg.visual.kind === "avatar" || r.fellBack);
    if (twoUp)
      // Captions sit on the seam between the two faces.
      rendered.segments[t.index] = {
        ...seg,
        visual: { kind: "avatar", framing: "wide" },
        layout: "split",
      };
    else if (r.fellBack)
      rendered.segments[t.index] = {
        ...seg,
        visual: { kind: "avatar", framing: "tight" },
        layout: "full",
      };
  }

  const list = path.join(tmp, "concat.txt");
  await fs.writeFile(
    list,
    parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
  );
  const joined = path.join(tmp, "joined.mp4");
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-c",
    "copy",
    joined,
  ]);

  const assPath = path.join(input.jobDir, "captions.ass");
  await fs.writeFile(
    assPath,
    buildAss(rendered, input.timeline, input.durationSec, undefined, {
      label: input.label,
    }),
  );

  const final = path.join(input.jobDir, "final.mp4");
  const music =
    input.musicPath && (await exists(input.musicPath)) ? input.musicPath : null;
  const audioGraph = music
    ? "[1:a]aresample=48000[n];[2:a]aresample=48000,volume=0.12[m];[n][m]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    : "[1:a]aresample=48000,loudnorm=I=-14:TP=-1.5:LRA=11[a]";
  await run("ffmpeg", [
    "-y",
    "-i",
    joined,
    "-i",
    input.audioPath,
    ...(music ? ["-stream_loop", "-1", "-i", music] : []),
    "-filter_complex",
    `[0:v]ass=filename='${escFilterPath(assPath)}':fontsdir='${escFilterPath(FONTS_DIR)}'[v];${audioGraph}`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    X264_PRESET,
    "-crf",
    "18",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-t",
    input.durationSec.toFixed(3),
    final,
  ]);

  const cover = path.join(input.jobDir, "cover.jpg");
  await run("ffmpeg", [
    "-y",
    "-ss",
    "0.6",
    "-i",
    final,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    cover,
  ]);
  return { path: final, cover, warnings };
}
