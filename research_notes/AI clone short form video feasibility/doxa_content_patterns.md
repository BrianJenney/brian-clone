# Doxa content patterns: what actually works in their AI-clone videos

Research date: 2026-11-01. This builds on `doxa.md` in this folder and does not repeat the company background.

**How I got the evidence.** I downloaded the 7 case videos Doxa hosts on its own sites (doxaviral.com and lp.doxascale.com). Doxa's files are named "SnapInsta…", which means they were saved from Instagram. I also pulled the public profile data for @corealquimias from Instagram, which gave me exact view and like counts, and downloaded two of that account's recent clone reels to compare against its viral hit.

For each video I:
- transcribed the audio locally with Whisper,
- read the burned-in captions off frame grabs where the file had no audio,
- counted cuts with ffmpeg scene detection,
- checked contact sheets by eye.

I also read the UI text inside Doxa's client app bundle, which contains their script structure and delivery coaching.

**What I could not get:**
- Instagram rate-limited further profile lookups, and third-party viewers returned 403. So @uninovamotos, the lawyer and the Miami realtor have no verified account-level data beyond Doxa's own claimed numbers.
- Doxa has no findable Instagram, TikTok or YouTube account of its own. The handles @doxaviral and @doxascale don't exist or are unreachable, and its sites link to no social accounts. The only YouTube presence is the unlisted VSL on the "Tech Spreed" channel.
- The Meta Ad Library shows 2 ads from a "Spreed.AI" page (started 2025-09-12) and none under Doxa. The library API returned no ad copy and the snapshot pages return 403, so **I could not see the ad angles**.

That leaves 7 analysed videos, not 10. I fabricated nothing. Every view count below is labelled with its source.

---

## Executive summary: 8 patterns Brian can copy

### 1. The "Did you know X can Y? I'll teach you. Do this:" template
**Evidence:** All three @corealquimias clone reels open with the same formula:
- *"Você sabia que a fumaça do incenso pode responder as suas perguntas? Vou te ensinar como interpretar. Faz assim."* ("Did you know incense smoke can answer your questions? I'll teach you how to read it. Do this.") This is the **4.02M-view** reel.
- *"Você sabia que um simples punhado de sal pode ajudar a limpar a energia da sua casa…? Vou te ensinar um ritual simple… Faz assim."* (10.1k views)
- *"Você sabia que existe uma magia capaz de transformar o seu desejo em um símbolo de poder…? Vou te ensinar…"* (3.6k views)

The structure is: surprising claim as a question, then a promise to teach, then the imperative "do this", then 5–7 concrete steps, then a "test it today" close.

**Caveat:** the same template produced 4M views once and 3.6k–10k views otherwise. The template doesn't make a video go viral. It's a reliable chassis, and the topic decides the result. The winning topic was odd and visual, cost nothing to try today, and made sense to people who will never buy incense.

**Brian, Replace Your Software:** *"Did you know the five apps you pay for every month can be one app you own? I'll show you how to work it out. Do this: list every subscription…"*
**Brian, AI Engineering course:** *"Did you know a working RAG chatbot is about 40 lines of Python? I'll show you. Do this:"* followed by steps on screen.

### 2. A numbered rules listicle with the rule number spoken and captioned
**Evidence:** The lawyer case (Doxa claims 1.5M views) opens with *"Se você recebeu um Pix por engano e alguém te chamou no WhatsApp para devolver rápido, esse é o golpe do Pix errado."* ("If you got a Pix transfer by mistake and someone messaged you on WhatsApp to return it fast, that's the wrong-Pix scam.") He then names the mechanism ("it exploits one thing: urgency") and walks through **"Regra número um … dois … três … 4 … 5"**, each rule a hard caption beat.

The topic is protective and fear-based: avoid losing money. It is relevant to everyone with a bank account, not only people who need a lawyer.

**Brian, Replace Your Software:** *"If your booking app just raised its price again, that's the SaaS tax. Rule number one: never pay per seat for software your staff only reads. Rule number two…"*
**Brian, AI Engineering course:** *"If you've applied to 50 AI engineer jobs and heard nothing, here are 5 rules. Rule number one: no more chatbot-wrapper portfolio projects…"*

### 3. Talk about the audience's world, not the product
**Evidence:** None of the 7 videos pitches the product:
- The motorcycle shop (@uninovamotos, Doxa claims 2.5M+) is a romantic identity monologue: *"Quem vive de moto sabe, tem coisa que o carro nunca vai te dar"* ("Anyone who lives on a motorcycle knows: there are things a car will never give you"). It ends *"pra quem entende é terapia de duas rodas"* ("for those who get it, it's therapy on two wheels").
- The incense shop teaches divination.
- The lawyer teaches scam defence.
- The realtor explains a financing trick: *"Brasileiro tá comprando casa em Miami sem tirar dinheiro do Brasil. Funciona assim…"* ("Brazilians are buying houses in Miami without moving money out of Brazil. Here's how it works…")

This matches Doxa's own onboarding rule that what most separates high-view clients is a pain "already felt by people who have never heard of your solution".

**Brian, Replace Your Software:** an identity hook: *"Anyone who runs a small business knows: there's a feeling no SaaS dashboard will ever give you: owning the thing your business runs on."*
**Brian, AI Engineering course:** *"Anyone who's shipped real software knows: there's something a no-code AI tool will never give you."*

### 4. Frame the clone as a seated podcast guest
**Evidence:** Every human clone in the set (lawyer, realtor, incense presenter, moto shop owner) is:
- **seated in a podcast studio** with acoustic foam or curtains and coloured accent light,
- shot at a **~45° angle**,
- behind a **large podcast mic** in the lower third of the frame.

Doxa's onboarding enforces this. The client uploads a 45° photo that "becomes your clone", must be seated "like in a podcast conversation", and is placed "in the DOXA studio you pick".

This framing hides the AI in three ways:
- It explains why the body barely moves and the hands stay low.
- The mic covers the chin and mouth edge, where lip-sync artifacts show most.
- Viewers read it as a "podcast clip", a format they already trust.

The one obviously synthetic presenter is the Magalu SKU video: a standing, fully generated avatar in a living room. It is labelled "SKU/Product video", not "viral video".

**Brian:** generate his HeyGen look seated at a desk with a visible podcast mic, angled 30–45°. Don't use a straight-to-camera standing shot.

### 5. Keep the clone on screen 25–50% of the time and cut to literal b-roll every ~3 seconds
**Evidence:**
- Average shot length on the hits was 2.6s (lawyer), 2.7s (moto), 2.8s (realtor) and 3.2s (incense).
- From contact sheets, the clone face is on screen roughly 25–50% of the runtime.
- B-roll illustrates **the exact noun being spoken**: smoke on "fumaça", a phone banking app on "Pix", Nubank's "Contestar transação" screen on "contest it in the app", Miami condos on "Miami", a woman fanning dollar bills on "receive rent in dollars", wheelies on "the wind in your face".
- The lawyer video is mostly **phone screen recordings** of the actual banking and WhatsApp flows.

The two low-performing @corealquimias reels were slower and longer: 5.3s average shot over 58s, and 4.2s over 46s. With only 7 videos this is a correlation, not proof, but it points the same way.

**Brian, Replace Your Software:** screen recordings of the custom app he built (his demo-factory output) cut in on every noun: "invoice", "calendar", "text reminder". **Brian, AI Engineering course:** code-editor and terminal recordings, with the clone returning only for the claim and the close.

### 6. Show b-roll or a split screen in the first second
**Evidence:**
- **Realtor and Magalu:** open with a **split screen**, clone on top and b-roll (a Miami house, a fruit stand) on the bottom, for the first ~3 seconds.
- **Incense hit:** shows the face for ~0.5s, then smoke b-roll while the hook is still being spoken.
- **Lawyer:** cuts to a phone screen by ~2.5s.

So the hook is never carried by the AI face alone.

**Brian:** use a split screen for the hook, clone on top and the app or code on the bottom, then go full screen to b-roll.

### 7. Use one caption template everywhere: 1–3 word chunks, bold uppercase yellow, centred mid-frame
**Evidence:** Every client video uses the identical caption style:
- bold uppercase sans serif in gold/yellow with a dark outline or shadow,
- 1–3 words at a time,
- placed at **~50% of frame height**, not the bottom third.

That makes it a Doxa house template. Rule numbers ("REGRA NÚMERO UM") and key nouns get their own caption beat. The app's delivery coaching also mentions a "highlighted word" to be spoken "louder, raise your pitch and stretch it a little."

**Brian:** set up one fixed caption preset in Descript or CapCut and never change it. Short chunks placed at mid-frame keep the eye near the face and b-roll, and away from the platform UI.

### 8. Let Brian's own recorded voice drive the clone, with a short script in a fixed shape
**Evidence:**
- **Voice:** Doxa's current app has the client **"Read the script out loud — your recording will be the voice of the video."** The AI face lip-syncs to real human audio. TTS from the ElevenLabs clone is the fallback path, behind a warning screen that the cloned voice "may present small variations…".
- **Script shape:** every script is **Hook / Body / Close**, with this coaching:
  - Hook: "Say it in one go, no pause, like someone who already knows the answer."
  - Body: "Speak a little faster than usual and vary your tone. Conviction, not a lecture."
  - Close: "Smile and give weight to the highlighted word."
- **Script control:** editing an AI script voids the view guarantee, which shows how much they trust the formula over client edits.
- **Closes:** there are no hard CTAs on screen. The close is either comment bait (*"Testa isso hoje e depois volta aqui para me contar o que você viu"*, "Test it today and come back and tell me what you saw") or a one-line identity or payoff statement. The selling happens in the caption ("save the post", "link in bio").
- **Length:** 21–51s for the hits.

**Brian:** record the voice himself on a phone (about 60 seconds per script) and use HeyGen only for the face. This gets past the biggest weakness of AI clones, flat TTS delivery. Close with *"Try it on your own stack and comment what you'd replace"* or *"Comment RAG and I'll send the repo"*, and put the offer link in the caption.

### Reality check on hit rate and cadence
@corealquimias has 247.6k followers and 861 posts.
- **The hit:** the pinned clone reel (posted 2026-08-29) has **4,020,226 views, 425,398 likes and 918 comments**, verified from Instagram's public profile data on 2026-11-01. That's up from the "3.4M" Doxa shows on its site.
- **The next two clone reels** (2026-10-16 and 2026-10-23) have **3,572 and 10,123 views**.
- **Cadence:** in October 2026 the account posted every 2–5 days, mostly image carousels, with only 2 clone reels.

Doxa's 1M-views guarantee is therefore realistically met by **one outlier inside 36–60 posts**, not by consistent per-video performance. Brian should plan for volume and treat each topic as a lottery ticket. The format, captions and b-roll are the fixed part; the topic is the variable.

---

## Per-video table

| # | Client / niche | URL (source of file) | Views (source) | Length | Hook (first line, English) | Format | Editing | Clone visible / obvious? | CTA / close |
|---|---|---|---|---|---|---|---|---|---|
| 1 | @corealquimias, esoteric/incense shop | https://www.instagram.com/reel/Dco0EzOiqBk/ (also https://www.doxaviral.com/media/core-video.mp4 and the "Loja de incenso" case on lp.doxascale.com) | **4,020,226** views, 425k likes, 918 comments (Instagram public data, 2026-11-01). Doxa site says 3.4M/170k; lp says "3M" | 51s | "Did you know incense smoke can answer your questions? I'll teach you how to read it. Do this." | Podcast-studio clone (seated, mic) + heavy literal b-roll (smoke shots); how-to list of 7 smoke meanings | 15 cuts, ~3.2s avg shot; clone on screen ~35%; 1–3 word yellow uppercase captions mid-frame; first b-roll at 0.5s | Visible, seated behind mic; looks like a real podcast guest at 720p | "Test it today and come back and tell me what you saw" (comment bait). Caption: "save the post… link in bio" |
| 2 | @uninovamotos, motorcycle shop | https://www.doxaviral.com/media/uninova-video.mp4 (same clip as "Loja de motos" on lp.doxascale.com) | Doxa claims "+2.5M" views / "+111k" likes (doxaviral) and "2.4M" (lp). **Not independently verified** (Instagram rate-limited) | 21s | "Anyone who lives on a motorcycle knows: there are things a car will never give you." | Identity/emotional monologue; clone opens and closes, middle is all stock moto b-roll (wheelies, cornering, city night) | 7 cuts, ~2.7s avg shot; clone ~25%; same caption style | Visible only at start and end; seated in a podcast set with curtains | No CTA. Ends on a quotable line: "for those who get it, it's therapy on two wheels" |
| 3 | Lawyer (handle not shown by Doxa) | https://lp.doxascale.com/assets/videos/cases/SnapInsta.to_AQNQErsrugH1Sc0asMy0xXFl2BM3yq1QiaZPGPz5s_q394DgycVgWlC6f5bYguW-mGxuTAphyp0sCv1BQOF-uf79.mp4 | Doxa claims 1.5M. **Not verified** | 41s | "If you got a Pix transfer by mistake and someone messaged you on WhatsApp to return it fast, that's the wrong-Pix scam." | Numbered rules listicle (Rule 1–5); clone + phone screen recordings (bank app, WhatsApp, Nubank dispute screen) | 15 cuts, ~2.6s avg shot; clone ~40%; "REGRA NÚMERO X" as caption beats | Visible, suit and tie, seated behind a Shure mic, purple-lit studio | No sales CTA. Ends on rule 5 ("2FA on in the bank app, never share a code"). File is muted on Doxa's site; hook read from burned-in captions |
| 4 | Miami real-estate broker | https://lp.doxascale.com/assets/videos/cases/SnapInsta.to_AQOzYCgBXkCvkIr9amahsdPD73ToStT3rnk3_nK5ye8NcSRs3JSggMXF03KjlOgZwMnQq1P-bVZuSgtK7BD2tnjx7h3UDQZCVRlOxLI.mp4 | Doxa claims 500K. **Not verified** | 28s | "Brazilians are buying houses in Miami without taking money out of Brazil. Here's how it works." | Explainer/"secret method"; **split-screen opener** (clone top, Miami house bottom), then luxury condo b-roll and a stock "money" clip | 9 cuts + punch-in zooms on the clone, ~2.8s avg shot; clone ~50% | Visible, close-up with podcast mic in foreground | Implicit: "whoever used their property as collateral is already earning in dollars." No explicit CTA. Muted on site; hook read from captions |
| 5 | Magalu (major retailer), SKU/product video | https://www.doxaviral.com/media/magalu-video.mp4 | No views given ("stats: null" in Doxa's site code) | 12s (preview excerpt) | "A smoothie at a pretty café costs over 30 reais. It comes in a clear cup with a paper straw that goes soggy in two minutes…" | Fully synthetic standing avatar (not a clone of a real person) + split-screen b-roll; price-anchoring setup before a product reveal | 8 cuts in 12s (~1.3s avg shot) | Obviously AI-styled presenter | Excerpt ends at "But…" (product pivot cut off) |
| 6 | @corealquimias, salt ritual | https://www.instagram.com/reel/De2iqBXiC78/ | **10,123** views, 813 likes (Instagram, 2026-11-01) | 58s | "Did you know a simple handful of salt can help clean your home's energy and open your paths?" | Same template as #1; opens on b-roll (salt in a glass) | 10 cuts, **~5.3s** avg shot (slower); same captions | Same clone, same set | No explicit CTA; ends with an explanation. Caption repeats the ritual words |
| 7 | @corealquimias, sigil magic | https://www.instagram.com/reel/DekhE7QCi1-/ | **3,572** views, 235 likes (Instagram, 2026-11-01) | 46s | "Did you know there's a magic that can turn your desire into a symbol of absolute power?" | Same template; AI-generated fantasy b-roll (glowing orb) | 10 cuts, **~4.2s** avg shot; same captions | Same clone in a different outfit | No CTA in video; caption is a long how-to list |

Durations and cut counts come from ffprobe and ffmpeg scene detection (threshold 0.3), so punch-in zooms are not counted as cuts. Videos 2, 5 and the identical copy of #1 come from doxaviral.com. Videos 3 and 4 come from lp.doxascale.com, where they are muted, so their hooks were read from the burned-in captions. Doxa hosts four case files on lp.doxascale.com; the incense and moto files there are the same clips as #1 and #2.

Hooks and scripts in Portuguese (verbatim where transcribed, used above):
- #1: "Você sabia que a fumaça do incenso pode responder as suas perguntas? Vou te ensinar como interpretar. Faz assim. Acende o incenso em um ambiente sem vento…"
- #2: "Quem vive de moto sabe, tem coisa que o carro nunca vai te dar. O vento na cara não é só sensação, é dopamina pura…"
- #3: "Se você recebeu um Pix por engano e alguém te chamou no WhatsApp para devolver rápido, esse é o golpe do Pix errado. E ele explora uma coisa: urgência em mensagem. Regra número um: nunca devolva fazendo um novo Pix para a chave que te mandarem…"
- #4: "Brasileiro tá comprando casa em Miami sem tirar dinheiro do Brasil. Funciona assim: você dá seu imóvel quitado no Brasil como garantia, financia em real e usa esse dinheiro pra comprar em dólar na Flórida…"

## What Doxa's app says about scripts (from its client JS bundle)
- Script sections are labelled **Hook / Body / Close + highlighted word**, with the delivery tips quoted in pattern 8.
- Recording screen: "Read the script out loud. Your recording will be the voice of the video. Read at your own pace, without long pauses, up to the last line."
- Loading states: "Searching hooks", "Sharpening the hook", "Writing the 3 most important first seconds of your week."
- "Our AI already optimized all scripts based on more than 150 viral patterns." "Drop a loose idea. The AI finds the viral angle, checks the facts and writes the three most important first seconds of your week."
- Example hooks shown in the app's UI: "Stop posting without a strategy", "Nobody tells you this about sales", "3 mistakes killing your reach", "This is how I doubled my revenue".
- Podcast path: "5 carefully selected clips with high viral potential for every 1 hour of podcast."
- Onboarding asks: "Do you usually use strong hooks in the first second?"
- Editing a script "voids the contractual performance guarantee for this content."

## Doxa's own channels and ads
- **Organic:** I found no Doxa-branded Instagram, TikTok or YouTube account. The Instagram handles doxaviral, doxascale and doxa.ai return nothing relevant. Doxa's sites link to no social accounts, and search engines index none. The only video is the unlisted VSL "My Movie 1" on the YouTube channel @TechSpreed (ID V8Y6mQ3jGoU). Doxa appears to sell through its case reels, press coverage, a paid "diagnosis" booking and agency licensees, not through its own content.
- **Meta Ad Library:** the "Spreed.AI" page (ID 611499575388684) has 2 ads, created 2025-09-12 (IDs 1323588939330886 and 1331802008730907). No Doxa-named page with relevant ads was found; "DOXA" page 540243569350788 bills in MXN and is probably unrelated. Ad copy and creative were not retrievable: the API returned no body text and snapshot pages return 403. **Ad angles are unverified.** The angles on Doxa's sites are: "1M organic views or your money back", "one photo and one audio become 60 pieces of content in 90 days", "daily viral content without needing to record", and agency licensing ("You don't build the agency. You plug ours into yours").

## Sources
- Doxa main site and case bundle (case list with handles and stats): https://www.doxaviral.com/ (assets/index-DlMGIFZF.js; media/core-video.mp4, uninova-video.mp4, magalu-video.mp4)
- Doxa landing page case grid (Advogado 1.5M, Loja de motos 2.4M, Loja de incenso 3M, Corretora em Miami 500K): https://lp.doxascale.com/home (assets/CompanyExperience-CtTwaj9o.js and /assets/videos/cases/*.mp4)
- Doxa client app bundle (script structure, read-aloud voice, hooks, guarantee rules): https://app.doxascale.com/login
- @corealquimias public profile data (followers, per-post views and likes, captions): https://www.instagram.com/corealquimias/ ; reels https://www.instagram.com/reel/Dco0EzOiqBk/ , https://www.instagram.com/reel/De2iqBXiC78/ , https://www.instagram.com/reel/DekhE7QCi1-/
- YouTube VSL oEmbed (channel "Tech Spreed"): https://www.youtube.com/watch?v=V8Y6mQ3jGoU
- Meta Ad Library, Spreed.AI ads: https://www.facebook.com/ads/library/?id=1323588939330886 , https://www.facebook.com/ads/library/?id=1331802008730907
- Prior company research: `doxa.md` in this folder.
