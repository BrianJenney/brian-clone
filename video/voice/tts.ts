import fs from "node:fs/promises";
import path from "node:path";
import { env, requireEnv } from "../config";
import { fetchJson, probeDuration, run, writeJson } from "../lib/util";
import { type CharAlignment, syntheticAlignment } from "./alignment";

export type VoiceResult = {
  provider: "elevenlabs" | "mock";
  audioPath: string;
  alignmentPath: string;
  durationSec: number;
  chars: number;
};

/**
 * ElevenLabs TTS with character timestamps. The timestamps drive word-level
 * captions and the cut points between visuals, so we never need a separate
 * transcription pass.
 */
export async function elevenLabsTTS(
  text: string,
  outDir: string,
): Promise<VoiceResult> {
  const key = requireEnv(env.elevenKey, "ELEVENLABS_API_KEY");
  const voiceId = requireEnv(env.elevenVoiceId, "ELEVENLABS_VOICE_ID");
  const res = await fetchJson<{
    audio_base64: string;
    alignment: CharAlignment;
  }>(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: env.elevenModel,
        voice_settings: {
          stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.45),
          similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY ?? 0.85),
          style: Number(process.env.ELEVENLABS_STYLE ?? 0.2),
          use_speaker_boost: true,
          speed: Number(process.env.ELEVENLABS_SPEED ?? 1.05),
        },
      }),
    },
  );
  const audioPath = path.join(outDir, "narration.mp3");
  const alignmentPath = path.join(outDir, "alignment.json");
  await fs.writeFile(audioPath, Buffer.from(res.audio_base64, "base64"));
  await writeJson(alignmentPath, res.alignment);
  return {
    provider: "elevenlabs",
    audioPath,
    alignmentPath,
    durationSec: await probeDuration(audioPath),
    chars: text.length,
  };
}

/** Silent narration with synthetic timings — exercises the whole pipeline for $0. */
export async function mockTTS(
  text: string,
  outDir: string,
): Promise<VoiceResult> {
  const alignment = syntheticAlignment(text);
  const duration = (alignment.character_end_times_seconds.at(-1) ?? 1) + 0.4;
  const audioPath = path.join(outDir, "narration.mp3");
  const alignmentPath = path.join(outDir, "alignment.json");
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=180:sample_rate=44100:duration=${duration.toFixed(2)}`,
    "-af",
    "volume=0.03",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    audioPath,
  ]);
  await writeJson(alignmentPath, alignment);
  return {
    provider: "mock",
    audioPath,
    alignmentPath,
    durationSec: duration,
    chars: text.length,
  };
}
