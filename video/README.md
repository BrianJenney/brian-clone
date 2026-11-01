# Brian clone: short-form video pipeline

This pipeline turns a topic into a captioned, edited 9:16 short of your AI clone, using formats that are currently outperforming. It does the same job as Doxa: Doxa's Terms say it runs on HeyGen + ElevenLabs. We call those directly, and then add the parts Doxa sells: a format library mined from outlier videos and ads, scripts grounded in your own writing, and a feedback loop.

```
trends:pull ─► outliers ─► trends:analyze ─► formats:mine ─► data/video/formats.json   (the "library")
                                                                  │
topic ─► script (format + your writing via Qdrant RAG) ─► review/approve
                                                                  │
          ElevenLabs voice (word timestamps) ─► HeyGen twin lip-sync ─► FFmpeg edit ─► final.mp4
                                                                  │
                                           log results ─► report (clone vs real, by format)
```

## Using it from Claude (MCP)

The video tools are on the existing Brian-Clone MCP server, so you never open another app. In any Claude chat:

> "Write a contrarian short about not needing a vector DB for your first RAG app."
> → `video_write_script` returns the script table and a job id. Ask for edits (`video_update_script`).
> "Render a free preview." → `video_render` mode `mock`, then "is it done?" → `video_get_job` gives the video link.
> "Looks good, do the final, up to $3." → `video_render` mode `final`, `maxCostUsd: 3`.
> "What videos did I make last week?" → `video_list_jobs`.

Renders run in the background on **Inngest** (a final takes ~3–10 min, mostly HeyGen). The tool call returns right away. Jobs and media live in **Vercel Blob**, so a video is always findable later with `video_list_jobs`, from any chat or from the CLI. Setup (Blob store + Inngest integration on Vercel) is in [MCP.md](../MCP.md#video-rendering-inngest--vercel-blob).

For screen-recording beats, upload the clip somewhere with a direct link (Vercel Blob, S3, a Dropbox `?dl=1` link) and say "attach this to segment 4": `video_attach_media`.

The trend engine (`trends:*`, `formats:mine`) stays CLI-only on purpose: it writes the format library into this repo (`data/video/`), so changes to the library get reviewed and committed like code.

## One-time setup

### 1. Film your digital twin in HeyGen (about 30 min, once)

In the HeyGen app: **Avatars → Create → Digital Twin**.
- Shoot 2–3 min per look, 1080p or better, phone vertical (9:16), eye-level, quiet room, soft front light.
- Talk naturally the whole time, with small head movement and normal hand gestures kept low in frame. Don't read stiffly; the twin copies your energy.
- Record 3–4 looks (different shirt or background). Varied looks make a feed of AI shorts look less templated.
- Record the consent clip when it asks.
- Then run `yarn video heygen:looks` and copy the look id into `HEYGEN_AVATAR_ID`.

> **Billing:** an API key bills against HeyGen's *API* balance (pay-as-you-go at platform.heygen.com), not your web plan's credits. Add $25–50 to start.
> Avatar IV costs about $4.83/min (≈ $2.50 per 30s short). Avatar V costs about $7.20/min. Use V for the hero posts once you've seen IV.

### 2. Clone your voice in ElevenLabs

**Voices → Add voice → Professional Voice Clone.** Upload 30+ min of clean audio (more is better, up to ~3 h). Your YouTube and podcast audio works if there's no music or second speaker. Verify, wait for training (a few hours), and copy the voice id.

Why ElevenLabs PVC: it's the best at sounding like *you* on long-ish reads, and its timestamps drive the captions and cuts. Cartesia is faster but scored lower on matching the speaker's identity, and speed doesn't matter here. HeyGen also auto-clones a voice from your twin footage, but it's weaker than a PVC trained on hours of audio.

### 3. Keys in `.env`

```bash
# required to render
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=          # a look id from `yarn video heygen:looks`
HEYGEN_ENGINE=avatar_iv    # avatar_iv | avatar_v | avatar_iii
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=       # defaults to FQdOEGfTV7PMYQrRB5zz (Brian's clone); override to try another voice
# ELEVENLABS_MODEL_ID=eleven_multilingual_v2
# ELEVENLABS_SPEED=1.05  ELEVENLABS_STABILITY=0.45  ELEVENLABS_STYLE=0.2

# already used by this repo — scripts are grounded in your writing
OPENAI_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
# VIDEO_LLM_MODEL=gpt-5

# shared job store + async renders (needed for MCP; optional for CLI-only)
BLOB_READ_WRITE_TOKEN=     # `vercel env pull` brings this down once the Blob store is connected
INNGEST_DEV=1              # local only; on Vercel the Inngest integration sets INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY

# trend engine (≈ $47 for 25k calls at scrapecreators.com)
SCRAPECREATORS_API_KEY=
# optional free stock b-roll (pexels.com/api); without it, b-roll beats become avatar punch-ins
PEXELS_API_KEY=

# framing tweaks if your twin sits higher or lower in frame
# VIDEO_FACE_CROP_Y=260  VIDEO_TIGHT_ZOOM=1.22
```

Needs `ffmpeg` built with libass (`brew install ffmpeg` on macOS includes it). Run `yarn video doctor` to check everything.

## The first 25 videos (≈ $70)

```bash
yarn video doctor

# 1. Build the library: who's winning in your lane, and why
yarn video trends:discover "ai engineer"        # add good handles to data/video/accounts.json
yarn video trends:pull                           # score posts against each account's median
yarn video trends:analyze --limit 20             # transcript → hook / beats / template
yarn video trends:ads "coding bootcamp"          # long-running video ads = proven offers
yarn video formats:mine                          # fold it into data/video/formats.json

# 2. Scripts
yarn video ideas --n 25 > ideas.txt              # edit down to topics you'd actually say
yarn video batch topics.txt                      # drafts in out/video/<id>/script.md
yarn video script "RAG explained for career changers" --format explainer-30s

# 3. Preview for free, then pay
yarn video render <id> --mock                    # $0: timing, captions, layout
yarn video render <id> --mock-avatar             # ~$0.05: hear the real voice first
yarn video approve <id> [<id>...]
yarn video render:approved --yes --max-total 100

# 4. Learn
yarn video log <id> --platform tiktok --url https://... --views 8200 --watch 0.58 --shares 31
yarn video log https://tiktok.com/@you/video/... --platform tiktok --views 15000 --watch 0.66 --real
yarn video report
```

`yarn video show <id>` prints the script, render status and links. Without `BLOB_READ_WRITE_TOKEN`, jobs live in `out/video/jobs/<id>/` (`job.json` is editable). With it, the CLI and MCP share the same jobs, and `render --remote` queues on Inngest instead of rendering on your machine. Every step is cached: editing a card or b-roll only re-runs FFmpeg, and editing words re-runs voice + avatar. If a render gets interrupted, re-running resumes polling the same paid HeyGen job instead of paying again.

**Screen recordings:** if a script has a 🎥 SCREEN beat, record it and drop it in the job folder as `screen-N.mp4` (local store), or attach a URL with `video_attach_media`, using the segment number shown in the script table. Missing recordings fall back to an avatar punch-in, so you can still render.

## How the edit hides avatar tells

- One HeyGen render covers the whole narration, so you pay once and lip-sync stays continuous. We then cut away from it every 2–6 s: cards, b-roll, screen recordings, and split layouts with the visual on top and the avatar on the bottom.
- Avatar beats alternate wide and tight framing, which reads as jump cuts.
- Word-by-word captions with an active-word highlight, a hook overlay for the first 2.4 s, and loudness normalized to −14 LUFS.

## Rules this enforces (from the research)

- 20–40 s, hook in under 3 s, payoff before 15 s, a new visual every beat.
- Scripts copy **structure** from outliers, never wording, and facts and credentials must come from your own writing.
- `mistake-confession` and other story formats are marked 🎥: film those yourself.
- **Label it.** Turn on the platform AI-content toggle (TikTok "AI-generated", YouTube "altered or synthetic", Instagram AI label). TikTok detects it anyway, and viewers punish late discovery far more than upfront disclosure. `--label "AI clone"` also burns a small tag into the video.
- **Kill criterion:** `yarn video report` compares clone vs real-face average watch. After 20 clone posts, if the clone holds < 80% of your real-face watch time, stop using the clone and keep the trend + script engine.

## Swapping vendors

Avatar and voice are isolated in `video/avatar/heygen.ts` and `video/voice/tts.ts`, and both take an audio file or text and return a file. To try open source, add a provider that takes `narration.mp3` and writes `avatar.mp4`:
- **LatentSync 1.6** re-syncs lips on *real* footage of you, which looks the most real but needs b-roll of you talking.
- **InfiniteTalk** generates the whole talking video but needs a 28 GB+ GPU and ~16 min per 40 s.

At $1–4 a video, HeyGen is cheaper than the GPU time and your hours. Revisit this only if volume gets large.

## Tests

```bash
yarn test:video
```
