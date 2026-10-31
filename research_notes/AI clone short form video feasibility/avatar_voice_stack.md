# AI Clone / Digital-Twin Short-Form Video Stack (late Oct 2026)

Research scope: avatar/lip-sync, voice cloning/TTS, auto-editing, realism pitfalls, platform policy. Researched 2026-10-31. Most comparison sources are vendor or affiliate SEO blogs. Prices come from official pages wherever I could fetch them; everything else is marked third-party.

## Commercial avatar APIs: which look most real, which have usable APIs, cost per minute

### Takeaway
HeyGen is the most consistently top-ranked tool for cloning a real person, and it has a mature v3 REST API for digital twins. API prices run from $0.60/min (Avatar III twin) to $4.83/min (Avatar IV twin) and $7.20/min (Avatar V twin, its newest and top model). ByteDance OmniHuman 1.5 (~$0.16/s, about $9.60/min, via fal) and Captions/Mirage Avatar X ($0.15/s, about $9/min) are the main photo/video+audio-to-video alternatives. Both cost more per minute than HeyGen.

### Cited Findings
- HeyGen API rate card, per minute (billed by actual seconds generated): Avatar V Digital Twin $7.20 (144 credits); Avatar IV Digital Twin $4.83 (97 credits); Avatar IV Studio Avatar $4.83; Avatar IV Photo Avatar $2.31; Avatar III Studio/Photo $0.99; Avatar III Digital Twin $0.60. Credits cost $0.05 each. Per HeyGen help article "HeyGen API Pricing Explained", updated Oct 19, 2026 — [ugcgen.ai summary](https://ugcgen.ai/heygen-api-pricing)
- The HeyGen web app charges about $2.40 per Avatar V minute (48 credits), so the API costs about 3x more than the web plan — [ugcgen.ai](https://ugcgen.ai/heygen-api-pricing)
- On the $29 Creator web plan, Avatar IV works out to about $1.50/min (31 credits/min). The API is pay-as-you-go from a $5 top-up. API funds expire after 12 months, free API credits ended Feb 2026, and the legacy API Pro/Scale plans are deprecated — [HeyGen pricing roundups via search: Sume](https://www.sume.com/guides/heygen-api-pricing), [Voyager](https://voyager.so/blog/heygen-pricing), [ugcgen.ai](https://ugcgen.ai/heygen-api-pricing)
- Conflict: older third-party pages list the Avatar IV twin at about $4/min ($5 at 4K). The $4.83 figure is newer, tied to the Oct 19, 2026 update — [Spatius](https://www.spatius.ai/blog/heygen-pricing-2026/), [Sume](https://www.sume.com/guides/heygen-api-pricing)
- HeyGen digital-twin creation API (v3): footage of 15–600 s, about 2 min of natural talking recommended. Long edge 640–4096 px, 1080p recommended, mp4/webm, one person facing camera with the face in frame throughout, clear audio with no music. Training "within a few minutes". A voice clone is created automatically from the training footage. Endpoints: `POST /v3/avatars`, `POST /v3/assets`, `GET /v3/avatars/looks/{look_id}`, `POST /v3/avatars/{group_id}/consent`, `POST /v3/videos`. Direct upload up to 200 MB — [HeyGen developer docs](https://developers.heygen.com/docs/avatar-from-video.md)
- HeyGen consent: the subject records a live on-camera statement via a link valid 24 h. Enterprise workspaces can upload a pre-recorded consent clip under 35 s or waive the step. Photo and prompt avatars need no consent — [HeyGen developer docs](https://developers.heygen.com/docs/avatar-from-video.md), [HeyGen avatar consent docs](https://developers.heygen.com/docs/avatar-consent)
- A HeyGen-linked guide says to upload a 3–5 min video. That conflicts with the developer docs' "about 2 min recommended" — [HeyGen blog](https://www.heygen.com/blog/how-to-create-digital-twin-avatar)
- HeyGen also has a Seedance 2.0 integration ("Your digital twin, in cinematic motion"), which puts the twin into generative scenes — [HeyGen Seedance 2 page](https://www.heygen.com/en-gb/integrations/seedance-2)
- One review scores HeyGen Avatar V 9.2/10 for realism vs Synthesia 8.2/10. The scoring methodology is unspecified. Several reviews name HeyGen the best tool for cloning a real person because it holds likeness over time — [search summary of review blogs: Venture Harbour](https://ventureharbour.com/best-ai-avatar-software/), [Techsy](https://techsy.io/en/blog/best-ai-avatar-generators-2026), [HeyGen's own list (biased)](https://www.heygen.com/blog/best-ai-avatar-generators)
- Synthesia is called neck-and-neck with HeyGen for talking-head realism and stronger on full-body presentation. Its positioning is corporate/training rather than creator short-form — [Toolchase](https://toolchase.com/blog/best-ai-avatar-generators-2026/), [Feedough](https://www.feedough.com/best-ai-avatar-generators/)
- Hedra Character-3 is rated a top performer for expressiveness and lip-sync accuracy from a single photo. It has the most usable free tier — [Tandem](https://www.wearetandem.ai/en/blog/tools/best-ai-avatar-generators), [Fluxnote](https://fluxnote.io/best/best-talking-avatar-generators)
- Captions/Mirage official API pricing: Add Captions $0.15/min (rounded up per minute). Mirage Avatar X (video/image + audio → video) $0.15/s, billed in 6-second increments — [Captions API pricing](https://captions.ai/help/docs/api/pricing)
- Mirage models generate the entire frame (face, body, gestures, background). Captions is described as editor-first and avatar-second. Mirage raised $75M in March 2026 — [review summaries](https://aitoolsatlas.ai/tools/captions-mirage/review), [rutab.net](https://rutab.net/b/hardware/2026/03/24/startap-mirage-privlek-75-mln-na-razvitie-ai-modeley-dlya-videoredaktora-captions.html)
- The Captions API supports AI creator videos up to 1 min using community avatars or an AI Twin, at about 1 credit/second (third-party summary) — [API Evangelist / Captions](https://providers.apievangelist.com/providers/captions-ai/)
- OmniHuman 1.5 (ByteDance) on fal: $0.16/s of output. 720p for up to 60 s of audio, 1080p for up to 30 s. Endpoint `fal-ai/bytedance/omnihuman/v1.5` — [fal guide](https://fal.ai/learn/devs/omnihuman-15-user-guide)
- OmniHuman reseller prices range $0.13–$0.25/s, and the billing basis differs: PiAPI $0.13/s on input audio, AIMLAPI $0.156/s, WaveSpeed $0.25/s. ApiPass cites a $0.25/s ByteDance reference price — [PiAPI](https://piapi.ai/blogs/omnihuman-1-5-api-guide), [WaveSpeed](https://wavespeed.ai/docs/docs-api/bytedance/bytedance-avatar-omni-human-1.5), [AIMLAPI](https://aimlapi.com/models/omnihuman), [ApiPass](https://apipass.dev/model/omni-human-1-5/bytedance_omni-human-1-5)
- Tavus is positioned for real-time conversational replicas and developer APIs, so its rendered realism isn't directly comparable — [review summaries](https://ventureharbour.com/best-ai-avatar-software/)
- Commercial lip-sync API landscape: Sync.so is the commercial counterpart to Wav2Lip/LatentSync-style re-syncing — [Sync.so blog](https://sync.so/blog/the-best-free-open-source-lipsync-tools-2), [Crazyrouter May 2026](https://crazyrouter.com/en/blog/ai-lip-sync-tools-comparison-may-2026-apis-avatars-dubbing)

### Inferences
- For a real person with minimal filming, the HeyGen digital twin path covers both look and voice clone from a single ~2-minute clip. It is the lowest-friction high-quality API. A 60 s short costs about $4.83 (IV) or $7.20 (Avatar V) via the API. Generating 30 shorts/month at 45 s each is about 22.5 min, roughly $110 (IV) to $162 (V).
- OmniHuman 1.5 and Mirage Avatar X render the whole frame from a photo or clip plus audio. That gives more natural body motion and varied scenes, at about $9–10/min. OmniHuman's 30 s cap at 1080p means longer shorts must be stitched.
- Re-dubbing real footage with a lip-sync model (Sync.so, LatentSync) instead of fully generating video is often the most realistic option, because the body, gestures and background are real. This assumes the creator has a library of real talking footage to repurpose.

### Gaps
- Could not fetch HeyGen's own pricing page (it redirects to the logged-in app). Rates come from a third-party page citing HeyGen's Oct 19, 2026 help article.
- No verified 2026 API pricing found for Synthesia, Tavus, D-ID, Hedra, Argil, Arcads, or Creatify. Argil returned no API results at all.
- No independent blind benchmark comparing HeyGen Avatar V vs OmniHuman 1.5 vs Mirage. Realism rankings come from affiliate reviews.
- Did not verify Kling/Veo/Sora avatar or lip-sync features or their prices in this pass.
- Did not confirm which HeyGen engines (IV vs V) a v3-trained twin can render on via the API.

## Open-source avatar / lip-sync models: GPU, quality vs commercial, licensing

### Takeaway
LatentSync 1.6 (ByteDance, reportedly Apache-2.0) is the open-source default for re-syncing lips on existing real footage. MuseTalk (MIT code) is the faster real-time alternative. InfiniteTalk (MeiGen, on Wan2.1-I2V-14B) is the strongest open full talking-video generator (lip, head and body motion) but is heavy and slow. Open models generally trail HeyGen/OmniHuman on polish, and their licenses must be checked one by one.

### Cited Findings
- LatentSync 1.6 is "still the local model to beat for short-video dubbing" (May 2026) and optimizes visual fidelity. Its license is reportedly Apache-2.0 — [Instavar, 22 May 2026](https://instavar.com/research/ai-video/open-source-lip-sync-models), [Sync.so](https://sync.so/blog/the-best-free-open-source-lipsync-tools-2), [tomodahinata guide](https://tomodahinata.com/en/blog/ai-lip-sync-talking-head-model-selection-guide-2026)
- LatentSync has a known output-blur issue (GitHub issue #67) — [Instavar](https://instavar.com/research/ai-video/open-source-lip-sync-models)
- MuseTalk runs at 30 FPS on a V100 (real-time) using latent-space inpainting. Its code is reportedly MIT and commercial use is allowed, but weight terms should be checked separately. Reported issues: out-of-sync output, mouth jitter, blurry or black mouth regions — [Instavar](https://instavar.com/research/ai-video/open-source-lip-sync-models), [tomodahinata](https://tomodahinata.com/en/blog/ai-lip-sync-talking-head-model-selection-guide-2026)
- Conflict: Crazyrouter rates MuseTalk highest for quality, while Sync.so favors LatentSync — [Crazyrouter](https://crazyrouter.com/en/blog/ai-lip-sync-tools-comparison-2026), [Sync.so](https://sync.so/blog/the-best-free-open-source-lipsync-tools-2)
- InfiniteTalk handles audio-driven video-to-video and image-to-video with lip, face, head and body motion, at 480p/720p presets, with Gradio and ComfyUI support. It needs Wan2.1-I2V-14B-480P (~27 GB), wav2vec2 (~380 MB) and an InfiniteTalk adapter (~1.2 GB). It supports FP8, multi-GPU FSDP and a Wan2GP low-VRAM mode — [InfiniteTalk docs](https://docsearch.algolia.com/mcp/docs/repo/meigen-ai/infinitetalk), [Colab wrapper](https://github.com/sruckh/InfiniteTalk-Google-Collab)
- InfiniteTalk self-hosting reportedly needs 28 GB+ of VRAM and takes about 16 min to generate 40 s of video (vendor claim). Users report memory pressure at 720p, slow inference, and degradation outside the face — [Atlas Cloud (vendor)](https://www.atlascloud.ai/infinitetalk), [Instavar](https://instavar.com/research/ai-video/open-source-lip-sync-models)
- Conflict: one listing says the InfiniteTalk models are Apache 2.0, while a wrapper says the original framework may have separate terms. Verify in the MeiGen-AI repo — [SourcePulse](https://www.sourcepulse.org/projects/12893512), [Colab wrapper](https://github.com/sruckh/InfiniteTalk-Google-Collab)
- Wav2Lip is outdated (96×96 mouth region) and its public weights are reportedly research/non-commercial — [search summary: talking-avatar.dev](https://talking-avatar.dev/alternatives/10-best-open-source-lip-sync-alternatives-2026), [ToolCenter](https://www.toolcenter.ai/en/articles/wav2lip-review-2026)
- KeySync is the closest A/B challenger to LatentSync, with identity drift and teeth artifacts reported. LTX LipDub (IC-LoRA on LTX 2.3 22B) is on a gated community license with clip-length and teeth-sharpness limits. TalkVerse is a Wan-based model for minute-long audio-driven video and is still on the watchlist. Hallo/Hallo2 and EchoMimic animate a portrait image and are better suited to avatars than to dubbing — [Instavar](https://instavar.com/research/ai-video/open-source-lip-sync-models)
- SadTalker animates a single still photo and is a different category from video re-syncing — [pixazo](https://www.pixazo.ai/blog/best-open-source-ai-lip-sync-models)

### Inferences
- Best open-source path: shoot a real 1080p talking-head base library, then re-sync lips with LatentSync 1.6 on new TTS audio (24 GB-class GPU is likely sufficient; unverified). InfiniteTalk fits generative shots on an A100/H100 at 480–720p, with upscaling needed for 1080x1920.
- Open-source results trail commercial on teeth sharpness, mouth blur and identity drift. Expect more QA and cherry-picking.

### Gaps
- No verified data on Hallo3, Sonic, LivePortrait, EchoMimic v3, OmniAvatar, Wan2.2-S2V or MultiTalk licenses or VRAM in this pass. Hallo-family and some Tencent/Alibaba weights are often non-commercial or custom-licensed (training knowledge, unverified).
- No objective benchmark (e.g. Sync-C/FID on a common set) comparing open vs commercial models from 2026.

## Voice cloning / TTS

### Takeaway
ElevenLabs Professional Voice Clone remains the safest choice for a long-term consistent creator voice. It needs 30 min minimum and 2–3 h recommended, plus verification. Instant clones (ElevenLabs, Cartesia, MiniMax, Fish) need only 5 s–2 min of audio but are less faithful. Fish Audio leads on open/self-hostable identity fidelity. TTS cost is negligible next to avatar video, at about $0.05–0.10 per minute of speech.

### Cited Findings
- ElevenLabs: Instant Voice Cloning needs 1–2 min of audio (from the $6/mo Starter plan). Professional Voice Cloning needs ≥30 min of audio (2–3 h recommended), starts at the Creator plan, and requires voice verification — [invideo TTS pricing, Aug 2026](https://invideo.io/blog/ai-voice-model-pricing/)
- Per 1M characters: Eleven v3 about $100; Flash v2.5 about $50; MiniMax speech-2.8-hd $100 and turbo $60; Seed TTS 2.0 about $31 (promotional). Per narrated hour: Flash about $2.70, v3/MiniMax-hd about $5.40. Gemini TTS bills $1/1M input tokens and $20/1M audio tokens and has no cloning. Cartesia is sold in credit tiers: Pro $5/mo with 100K credits, Startup $49, Scale $299 — [invideo, Aug 2026](https://invideo.io/blog/ai-voice-model-pricing/)
- Cartesia instant clone needs 10 s (Pro plan) and its professional clone starts at the $49 Startup plan. MiniMax Rapid Clone costs $1.50 per voice from about 10 s of audio, with no documented consent check. Seed-ICL 2.0 clones from about 5 s — [invideo](https://invideo.io/blog/ai-voice-model-pricing/)
- A September 2026 replication benchmark, reported secondhand, scored Fish Audio S2-Pro highest on speaker identity (4.03). Cartesia Sonic 3.6 Beta scored 4.36 on naturalness but only 3.63 on identity — [search summary of comparisons](https://fish.audio/blog/text-to-speech-api-comparison-pricing-features/), [futureagi](https://futureagi.com/blog/elevenlabs-vs-cartesia-tts-2026/)
- Fish Audio claims to be 70% cheaper than ElevenLabs (vendor claim). Its open models can be self-hosted, and its minimum sample is 10–15 s (reports conflict) — [Fish Audio blog](https://fish.audio/blog/top-elevenlabs-alternatives-2026-review)
- Cartesia leads on latency (Sonic Turbo 40 ms TTFA, versus about 90 ms elsewhere; reports conflict). Latency matters for real-time avatars, not for pre-rendered shorts — [futureagi](https://futureagi.com/blog/best-tts-providers-voice-agents-2026/)
- ElevenLabs PVC is the better-documented option for keeping a voice stable across months of content — [fast.io](https://fast.io/resources/elevenlabs-alternatives-2026/)
- The HeyGen digital twin auto-creates a cloned voice from the training footage — [HeyGen dev docs](https://developers.heygen.com/docs/avatar-from-video.md)

### Inferences
- Recommended: ElevenLabs PVC trained on 1–3 h of existing podcast/YouTube audio, which a creator with a back catalog already has. Use Eleven v3 for expressive short-form delivery. Pass the audio into the avatar API (HeyGen accepts uploaded audio), not HeyGen's auto-voice.
- Open-source fallback: Fish Audio S2 (self-host) or F5-TTS/XTTS (licenses not verified here; XTTS's Coqui license was non-commercial per training knowledge).

### Gaps
- Did not verify PlayHT's 2026 status, OpenAI TTS custom voices, or F5-TTS/XTTS/Fish licenses directly.
- No official ElevenLabs API per-character price page fetched. Figures are from Artificial Analysis via invideo.

## Auto-editing / compositing (captions, b-roll, cuts, motion graphics)

### Takeaway
For a developer, the buildable pattern is programmatic composition: Remotion (React) or HeyGen HyperFrames (HTML/GSAP, local skills or hosted MCP) over the avatar render, with word-timed captions from a transcript, plus FFmpeg for assembly. Captions/Mirage sells a captions API at $0.15/min. Descript has an agent/API ("Underlord") for cuts and captions.

### Cited Findings
- Captions API "Add Captions" costs $0.15 per input minute, rounded up — [Captions API pricing](https://captions.ai/help/docs/api/pricing)
- HeyGen HyperFrames is a framework for programmable HTML-based video (HTML/GSAP), rendering to MP4/WebM/MOV. Local skills install with `npx skills add heygen-com/hyperframes` and include TTS, transcribe and remove-background helpers. A hosted MCP provides cloud rendering — [HyperFrames GitHub](https://github.com/heygen-com/hyperframes) (described in HeyGen's HyperFrames MCP server documentation in this environment)
- Descript exposes an AI editor agent (Underlord) that can trim, remove filler words, add captions and import stock media via natural language, plus publish/export APIs — (Descript MCP server documentation available in this environment; no public web page fetched)
- Creator guidance: cut-ins every 3–4 s and always add captions, since many viewers watch on mute — [search summary of creator guides: dev.to](https://dev.to/techfind777/how-to-make-ai-generated-videos-that-dont-look-fake-heygen-tutorial-2ag5), [fluxnote](https://fluxnote.io/guides/ai-avatar-video-creation-guide)

### Inferences
- Pipeline: script → ElevenLabs audio → word timestamps (ElevenLabs returns alignment; or Whisper) → avatar render (HeyGen v3) → Remotion/HyperFrames composition (word-highlight captions, b-roll from stock or generated by Veo/Kling/Seedance, zoom punch-ins, overlays) → FFmpeg loudness normalize and export 1080x1920.

### Gaps
- Did not verify Submagic API pricing, Descript public API pricing, or the Remotion 2026 license. Per training knowledge, Remotion needs a paid company license for orgs above a small headcount; verify.
- No data found on which caption styles perform best (retention A/B data).

## Realism pitfalls and how creators hide them; footage needed

### Takeaway
The remaining tells are eyes/micro-expressions, teeth/mouth blur, stiff or repetitive gestures, and drift over long takes. Creators hide them by keeping each avatar shot to a few seconds and cutting to b-roll, screenshots, captions and punch-ins. Training needs only about 2 minutes of clean, front-facing, single-person 1080p footage on HeyGen. Multiple looks (different outfits and framings) add variety.

### Cited Findings
- The avatar looks more real when shown for only 3–4 seconds at a time. The "98% B-roll" playbook (Rowan Cheung style) uses the avatar as an intro and then shifts to b-roll, screenshots, headlines or animations — [Stormy AI](https://stormy.ai/blog/ai-avatar-short-form-video-rowan-cheung-playbook), [fluxnote](https://fluxnote.io/guides/ai-avatar-video-creation-guide)
- Uncanny feelings persist mainly around eye movement and micro-expressions. A casual "office tour" avatar feels uncanny where a real phone video feels genuine — [dev.to genra_ai](https://dev.to/genra_ai/ai-digital-humans-vs-real-presenters-the-complete-guide-to-ai-avatars-in-2026-35oe), [getcoai](https://getcoai.com/?p=65645)
- Open-model failure modes: identity drift, artificial teeth, mouth blur, sync drift after a few seconds (VideoReTalking), degradation outside the face (InfiniteTalk) — [Instavar](https://instavar.com/research/ai-video/open-source-lip-sync-models)
- HeyGen footage spec: 15–600 s, about 2 min recommended, 1080p, face in frame throughout, quiet room — [HeyGen dev docs](https://developers.heygen.com/docs/avatar-from-video.md). The ElevenLabs PVC voice needs 30 min+ of audio — [invideo](https://invideo.io/blog/ai-voice-model-pricing/)

### Inferences
- Filming plan: one session recording 3–4 HeyGen looks (about 2 min each, varied shirt and background, some seated and some standing), plus the consent clip. Use existing long-form audio for the PVC. Total filming is about 30 minutes.
- Pick avatar framing that matches the creator's real-video style (desk or webcam, mid-shot). Hand gestures are weakest, so tighter framing hides them.

### Gaps
- No quantitative data on viewer detection rates or on retention of avatar vs real-filmed shorts.

## Platform policies: labeling and suppression

### Takeaway
All three platforms require disclosure of realistic AI-generated people or voices. A label is not a documented ranking penalty, but undisclosed AI content risks auto-labeling, restriction or removal. Instagram limits the reach of unlabeled AI-person profiles. The EU AI Act transparency duties apply from Aug 2, 2026. These findings come from secondary sources; check platform help pages.

### Cited Findings
- TikTok requires a visible label on realistic AI-generated visuals or audio of people or scenes. It detects synthetic media via C2PA Content Credentials even without self-disclosure. Unlabeled content may be labeled, restricted or removed depending on harm — [Storrito](https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/), [postora](https://www.postora.org/blog/ai-generated-content-labels-social-media-2026)
- Instagram/Meta: as of Aug 31, 2026 the AI creator label was reportedly renamed "AI-generated profile". Instagram will limit the reach of profiles featuring an AI-generated person that don't add the label. Meta also auto-labels flagged uploads — [postora](https://www.postora.org/blog/ai-generated-content-labels-social-media-2026), [socialscalehub](https://www.socialscalehub.com/academy/ai-content-disclosure-rules-2026-tiktok-instagram-youtube)
- YouTube requires a self-disclosure checkbox at upload for realistic altered or synthetic content. Clearly unrealistic content is exempt — [vexub](https://vexub.com/blog/ai-generated-video-monetization-policies), [everything-pr](https://everything-pr.com/ai-generated-content-disclosure-platform-by-platform-rules)
- An honest label is "not a published ranking penalty" on TikTok/YouTube — [susit.ai](https://susit.ai/blog/platform-policies-ai-content-2026)
- EU AI Act transparency rules start applying Aug 2, 2026 — [weventure](https://weventure.de/en/blog/ai-labeling)

### Inferences
- A creator cloning themselves should label avatar shorts (the TikTok AI toggle, YouTube's altered-content checkbox, Meta's AI info). HeyGen and other vendors may embed C2PA, which would trigger auto-labels anyway.
- YouTube's "inauthentic/mass-produced content" monetization rules (from July 2025, per training knowledge) are the bigger risk to templated avatar shorts than the label itself.

### Gaps
- Did not fetch primary platform policy pages. The Instagram Aug 31, 2026 change comes from secondary sources only.
- No reliable data on whether labeled AI-avatar content gets measurably less reach.

## Recommended highest-quality buildable pipeline (synthesis for report writer)

### Takeaway
Hybrid pipeline: ElevenLabs PVC voice → HeyGen v3 digital twin (Avatar V for hero clips, Avatar IV for volume) → Remotion/HyperFrames composition with word-level captions, b-roll and punch-ins → FFmpeg. Sync.so or LatentSync re-dubbing of real footage is the most realistic option when existing footage exists. OmniHuman 1.5 via fal is the alternative for full-body generative shots.

### Cited Findings
- Cost anchors: HeyGen Avatar IV twin $4.83/min, Avatar V $7.20/min — [ugcgen.ai](https://ugcgen.ai/heygen-api-pricing). OmniHuman 1.5 $0.16/s — [fal](https://fal.ai/learn/devs/omnihuman-15-user-guide). Mirage Avatar X $0.15/s and captions $0.15/min — [Captions](https://captions.ai/help/docs/api/pricing). ElevenLabs v3 about $5.40/hour of speech — [invideo](https://invideo.io/blog/ai-voice-model-pricing/)

### Inferences
- About 45 s per short with about 40% avatar on-screen (the rest b-roll with voice-over only) cuts avatar render cost to about $1.50–2.20 per short on Avatar IV/V. Voice costs about $0.05.
- Latency: HeyGen twin training takes minutes, and renders are asynchronous (minutes per clip; exact figure not found). Self-hosted InfiniteTalk takes about 16 min per 40 s (vendor claim).

### Gaps
- No measured HeyGen/OmniHuman render latency per minute found.
