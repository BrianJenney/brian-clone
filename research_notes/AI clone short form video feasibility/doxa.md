# Doxa: the AI-clone short-form video company (Brazil/US)

Research date: 2026-10-31. Primary evidence comes from Doxa's own public web properties: lp.doxascale.com, www.doxaviral.com, and the client web app at app.doxascale.com, whose shipped JavaScript bundles hold the UI copy and Terms of Service. I downloaded and read those bundles directly. Press coverage is mostly Brazilian. Revenue, views and client-count figures are company claims repeated by the press, not independently verified.

## Which Doxa is it? (disambiguation, website, founders, funding, launch)

### Takeaway
The Doxa in question is a Brazilian-founded startup, legally styled "Doxa Inc." in its Terms, with a Palo Alto mailing address. Its sites are **doxaviral.com** (current main site) and **doxascale.com** (landing page plus the client app at app.doxascale.com). Founder **Diogo Guilhon** previously ran the same product under the name **Spreed.Ai** (legal entity "Spreed Software e Produções Ltda"). Doxa looks like a rebrand or successor of Spreed rather than a new company. It is not doxa.ai, doxa.so (documentation tool), DOXA AI (Brazilian healthtech) or doxaai.com (AI competitions platform).

### Cited Findings
- lp.doxascale.com page title: "Doxa — Conteúdo viral diário, sem precisar gravar" ("daily viral content without needing to record"). Meta description: "Nossa IA cria vídeos com seu clone digital ou avatar" ("Our AI creates videos with your digital clone or avatar"). — [Doxa landing page](https://lp.doxascale.com/)
- doxascale.com 301-redirects to lp.doxascale.com, and app.doxascale.com redirects to a /login page. The app is a Next.js client platform titled "Doxa". — [doxascale.com](https://doxascale.com/), [Doxa app](https://app.doxascale.com/login) (checked directly with HTTP requests)
- Current main site title: "Doxa — Um milhão de views. Ou seu dinheiro de volta." ("One million views. Or your money back.") Description: "Uma foto e um áudio viram sessenta conteúdos em noventa dias" ("One photo and one audio become sixty pieces of content in ninety days"). HTML comments note that doxavira.com (no L) is a different, unrelated domain. — [doxaviral.com](https://www.doxaviral.com/)
- The Terms of Service in the app name the owner as "Doxa Inc.", governed by California law. Contact: financeiro@doxascale.com, 3101 Park Blvd, 1st Floor, Palo Alto, CA 94306. The Terms are dated "Last Updated: 01/18/2025". — [Doxa app](https://app.doxascale.com/login) (ToS strings in the client JS bundle)
- Press (Aug 25, 2026) names Diogo Guilhon as founder and Gabriel Basques as co-founder, both leading US expansion and US licensing. Partners Rafael Fernandes and Victor Pimenta (Insper Computer Engineering/Science students) lead enterprise/large accounts. The article claims R$30M revenue in 2025, 25 staff, ~900 videos/day, 1,500+ clients, 10B+ organic views for clients, 70+ agencies in its network, and a Miami office opened August 2026. — [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/); also syndicated by [BrazilCham](https://brazilcham.com/news/posts/startup-de-ia-ligada-ao-insper-fatura-rdollar-30-milhoes-e-abre-operacao-em-miami) and [Money Report](https://www.moneyreport.com.br/negocios/startup-de-ia-ligada-ao-insper-fatura-r-30-milhoes-e-abre-operacao-em-miami/)
- Predecessor: in May 2024, press profiled Diogo Guilhon, then 21, from Juiz de Fora (MG) and now based in São Paulo, as creator of **Spreed.Ai**. Spreed was an AI platform that turned long videos (30+ min podcasts/interviews) into short viral clips with scripts and subtitles. The article claims ~R$700k/month revenue and ~80 active users including in the US and Dubai, and cites a case study of consultant Evandro Rodrigues growing from 750 to 235k followers in 6 months. — [Diário do Comércio](https://diariodocomercio.com.br/tecnologia/mineiro-plataforma-ia-viralizar-videos-fatura-700-mil/)
- spreed.ai and beta.spreed.ai/faceai still resolve, with the title "Spreed - AI Content Platform". A search snippet for the "Spreed Face AI" page carried the same offer: post 60 videos, and if you don't reach 1M organic views you get a full refund. — [Spreed Face AI](https://beta.spreed.ai/faceai)
- The YouTube VSL embedded on Doxa's "Bookar Diagnóstico" page (video ID V8Y6mQ3jGoU) is uploaded by the channel "Tech Spreed". — [YouTube oEmbed for VSL](https://www.youtube.com/watch?v=V8Y6mQ3jGoU)
- A PitchBook listing (search snippet only; the page returned 403) ties "DOXA" to lp.doxascale.com, with founding in 2022, 33 employees, and a $2.86M early-stage VC deal in January 2023. — [PitchBook](https://pitchbook.com/profiles/company/596728-63)

### Inferences
- Doxa is almost certainly Spreed.Ai rebranded and repositioned. The evidence: same founder, same 1M-views/60-videos guarantee, the VSL hosted on a "Tech Spreed" channel, and the app still containing a "podcast → viral clips" flow, which was Spreed's original product. The rebrand probably happened around 2025: the ToS is dated Jan 2025 and the press in 2026 uses the Doxa name. Nobody has published a rebrand date, so treat it as approximate.
- The Delaware/California "Doxa Inc." entity with a Palo Alto virtual address (3101 Park Blvd is a known coworking/virtual-office address) fits a Brazilian operating company with a US holding entity for the US expansion and licensing push. That is my inference and is not confirmed.
- The PitchBook entry may belong to a different "DOXA" mislinked to this domain. Founding in 2022 with a $2.86M round in 2023 is not corroborated by any press, which mentions no investors. Treat it as unverified.

### Gaps
- No Crunchbase, LinkedIn company page, Product Hunt launch or confirmed investor list found. Press mentions no outside funding.
- No exact rebrand date from Spreed to Doxa, and no public statement linking the two.
- No CNPJ found for a "Doxa" Brazilian entity. Spreed's legal name, "Spreed Software e Produções Ltda", comes from its Reclame Aqui URL slug.

## What the product is: features, workflow, clone creation, output, and what "licensing" means

### Takeaway
Doxa is a **managed "done-with-you" AI content platform**. The client submits **3 photos (frontal, profile, 45°) plus ~5 minutes of voice audio**, or records a podcast at a partner studio. Doxa builds a HeyGen avatar plus an ElevenLabs voice clone, writes niche-tuned scripts, and delivers ready-to-post vertical clips on a credit/plan quota. The headline is a contractual "1M organic views in 90 days or refund of the implementation fee". "Licensing" means a **white-label/agency license**: agency owners resell Doxa's offer (the 1M-views guarantee) to their own clients, and Doxa's platform and account managers do the delivery. It does **not** mean licensing creators' likenesses.

### Cited Findings
**Two customer funnels (profile selector on lp.doxascale.com):**
- "Tenho uma empresa" ("I have a business") → "Quero Viralizar" ("I want to go viral"): "1M de views orgânicos para sua marca — garantido em contrato ou devolução total" ("1M organic views for your brand, guaranteed by contract or a full refund"). CTA "Bookar Diagnóstico" (book a diagnosis call). — [Doxa landing page](https://lp.doxascale.com/) (ProfileSelect JS chunk)
- "Sou dono de agência" ("I own an agency") → "Agency Experience · 50 vagas · São Paulo": a live São Paulo event for 50 agency owners, CTA "Aplicar para Vaga" (apply for a seat). — [Doxa landing page](https://lp.doxascale.com/)

**The agency license ("Licença DOXA"):**
- Pitch: "Você não monta a agência. Você liga a nossa na sua" ("You don't build the agency. You plug ours into yours"). Doxa says "Não é curso, não é mentoria… É a máquina que já roda na nossa própria operação, entregue pronta — a oferta, a entrega e o material de vendas. Você pluga e vende" ("It's not a course or mentoring… it's the machine already running in our own operation, delivered ready: the offer, the delivery and the sales material. You plug in and sell"). — [Doxa landing page, /agency-experience](https://lp.doxascale.com/agency-experience)
- The three pillars:
  - The offer: "1 milhão de visualizações orgânicas em 90 dias, garantido — ou o cliente não paga" ("1M organic views in 90 days, guaranteed, or the client doesn't pay").
  - The delivery: "A IA da DOXA entrega — são cinco anos de desenvolvimento… Um gestor de contas dá conta de até 100 clientes" ("DOXA's AI delivers, five years of development… one account manager handles up to 100 clients").
  - The sales arsenal: funnels, scripts, recordings of calls that closed, and proof/cases.
  — [Doxa /agency-experience](https://lp.doxascale.com/agency-experience)
- Stats on the license page: "60+ licenciados operando" (60+ licensees operating), "R$ 24 mil ticket médio" (R$24k average ticket), and "1 : 100 gestor por clientes" (one account manager per 100 clients). Disclaimer: "Os resultados citados são de licenciados reais… Não há garantia de resultado" ("results cited are from real licensees… no result is guaranteed"). The application page is titled "Licença DOXA — Candidatura", and the funnel says small cohorts are accepted ("Lotes pequenos, nem todo mundo entra"). — [Doxa /agency-experience](https://lp.doxascale.com/agency-experience)
- Press: Doxa targets 2,000 partner agencies in Brazil and 1,000 in the US by end of 2027. Pimenta: agencies "conhecem profundamente seus clientes, enquanto nós concentramos os investimentos em produto e IA" ("know their clients deeply while we concentrate investment in product and AI"). — [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/)
- The doxaviral.com lead-qualification quiz includes the options "Quero ser uma agência licenciada" ("I want to be a licensed agency") and "Agência licenciada" ("licensed agency"). — [doxaviral.com](https://www.doxaviral.com/) (JS bundle)
- The ToS prohibits clients from reselling "Doxa outputs as a competing service" and grants "a limited, non-transferable license for internal business use only". Reselling is therefore only allowed through the formal agency license. — [Doxa app ToS](https://app.doxascale.com/login)

**Client workflow (from the app's UI strings):**
- Onboarding questionnaire about the business, niche, pain points and social presence. The app scores it, and "From 75 points onward your onboarding already supports strong themes and scripts". Weak answers block progress because "They are the basis for every theme and script the AI will generate." The process takes about 5–10 minutes. — [Doxa app](https://app.doxascale.com/login)
- **Avatar path:**
  - Photos: "Upload the 3 photos: frontal, profile and 45°. We place you in the DOXA studio you pick… The 45° one becomes your clone; the other two help the AI keep the likeness." The subject must be seated "like in a podcast conversation". An "Improve Clone" AI fix can re-seat a standing person. Hands and arms must be visible ("the AI can't invent them"). HEIC is rejected. A step reads "Building your clone in the studio… this takes 2 to 4 minutes." — [Doxa app](https://app.doxascale.com/login)
  - Voice: "Record about 5 minutes talking about your business." Voice ownership is checked by a captcha-style read-aloud, or by manual ID-document verification. The app offers a "professional voice clone" (PVC) that "is being trained by ElevenLabs; this can take a few hours." — [Doxa app](https://app.doxascale.com/login)
  - Approval: "After the recording, our AI transforms your voice and face into an avatar. In up to 48 hours, it will appear…" Internal staff score each avatar 0–10: "Avatars with ratings below 6 are not automatically approved", and clips require at least 5/10. Clients must acknowledge that "my avatar's score (0 - 10) will influence the reach of my generated videos." — [Doxa app](https://app.doxascale.com/login)
- **Podcast/Persona Scan path:** clients schedule a "Persona Scan" recording at a partner studio, booked through Doxa's Google Calendar. The formats offered are a solo podcast, a podcast with a guest of the client's choice, or a "Fluid conversation about viral topics". The client can also register a YouTube podcast link. The AI then "detected {{count}} clips with viral potential in this podcast, with the highest scoring {{score}} points." Users get "Clips ready to go viral". — [Doxa app](https://app.doxascale.com/login)
- **Scripts and clips:**
  - Theme suggestions come from the AI ("Choose one of the suggestions below or write your own theme"). Each script allows one adjustment request. Editing a script triggers the warning "you will replace AI-optimized sections and lose the contractual performance guarantee for this content."
  - Funnel-stage targeting: awareness, consideration and conversion, plus a "Converter" type. Converter is locked until 20 published clips and doesn't count toward the guarantee.
  - Pipeline statuses: "Generating face" → "Generating speech" (lipsync) → "Editing" → "Ready". Caption text is provided for social posts. — [Doxa app](https://app.doxascale.com/login)
- **Feedback loop:** "Enter the link of the last posted video — this is how our AI understands the real performance of your content and adjusts the next videos." To request new clips, the client must mark the previous clip as published. — [Doxa app](https://app.doxascale.com/login)
- **Quota:** "You have 42 videos available in the first 3 months. To activate the guarantee of 1 million organic views, post a minimum of 36 (one video every two days)." This conflicts with the ToS, which requires "at least 60 videos within 90 days", and with press, which reports 60 pieces over 90 days at one per 24h. — [Doxa app](https://app.doxascale.com/login); [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/)
- **Credits:** "when requesting clips using avatars we debit credits. Each clip will use 2 credits, while rejections use one credit." Limits are enforced per plan: clips, scripts, recordings, avatar count, and at most 3 concurrent podcasts. — [Doxa app](https://app.doxascale.com/login)
- **Output examples:**
  - Magalu "SKU/Product video".
  - @corealquimias "Vídeo viral": 3.4M views, 170k likes.
  - @uninovamotos: 2.5M+ views, 111k+ likes.
  - Other cases listed: Advogado (lawyer) 1.5M views, motorcycle shop 2.4M, incense shop 3M, and a Miami real-estate broker 500K.
  — [doxaviral.com](https://www.doxaviral.com/); [Doxa landing page](https://lp.doxascale.com/home)
- The ToS describes the service as an "AI-powered platform designed to analyze viral content patterns, generate structured video scripts, and produce short-form videos optimized for organic reach". It "Does not sell views… Does not run ads". The agreement is B2B only. — [Doxa app ToS](https://app.doxascale.com/login)

### Inferences
- The product is a hybrid. It runs as SaaS with a self-serve app, quotas and credits, but has heavy human-in-the-loop operations: customer success, human avatar QA scoring, manual fallbacks for HeyGen and ElevenLabs, studio scheduling, and account managers at 1:100. It is closer to "productized service plus platform" than pure self-serve SaaS.
- Clone setup is roughly "minutes of user effort, up to 48 hours to approval": 2–4 minutes of AI studio compositing, a few hours of PVC training, and then human approval.
- The photo-based "place you in a DOXA studio" approach suggests a photo-to-avatar pipeline: an image-composition step first, then a HeyGen photo avatar (Avatar IV-style). That would explain "3 photos" instead of a filmed training video, but this is my inference.

### Gaps
- No independent review of output quality beyond complaints (see the evidence section). No public demo of raw clip quality was found besides Doxa's own case reels.
- The exact clip count per plan is unclear because 42, 36 and 60 conflict across sources.

## Pricing, plans and target customers

### Takeaway
Doxa publishes no prices. Everything is sold through a diagnosis/sales call ("Bookar Diagnóstico"), sometimes behind a paid "Auditoria Estratégica" checkout. The pricing structure is an **upfront implementation fee, which is refundable under the guarantee, plus non-refundable monthly fees**. The lead quiz turns away prospects with a monthly budget under R$1,000. The license page cites a R$24k average ticket for licensees' sales, and a competitor with the same offer cites an average of R$15k. Targets are Brazilian SMBs and brands (lawyers, retail shops, real estate, e-commerce, enterprise like Magalu and G4) plus agency owners as licensees.

### Cited Findings
- Guarantee economics: "a 100% refund of the initial implementation fee will be issued. Monthly recurring fees are non-refundable." Refund requests go to financeiro@doxascale.com and are audited on posting volume, dates, organic compliance and analytics. — [Doxa app ToS](https://app.doxascale.com/login)
- ToS §10: "voice or facial clone quality, realism, or subjective dissatisfaction shall not be used as grounds for refunds, disputes, or chargebacks". Disputes must use internal review, "not chargebacks". — [Doxa app ToS](https://app.doxascale.com/login)
- The diagnosis booking uses a paid checkout on "The Bank" (Brazilian payment processor), titled "AUDITORIA ESTRATÉGICA DOXA - Complete o pagamento para agendar uma reunião com o time DOXA" ("complete the payment to schedule a meeting with the DOXA team"). The amount was not visible in the static HTML. — [The Bank checkout](https://checkout.thebank.com.br/pt-BR/7472746024528564224?cc=BR)
- The doxaviral.com qualification quiz asks for:
  - Revenue band: "Até R$ 50 mil" up to "Mais de R$ 5 milhões".
  - Objective: sell more, generate leads, become an authority, brand awareness, launch.
  - Blockers: "Não sei o que falar", "Não gosto de aparecer", "Já paguei agência e não deu certo", "Não tenho equipe".
  - Monthly budget: "Abaixo de R$ 1.000" through "Mais de R$ 5.000".
  The under-R$1,000 answer returns: "A Doxa não se encaixa no seu momento — o nosso trabalho começa numa faixa acima dessa" ("Doxa doesn't fit your moment; our work starts in a band above that"). Lead scoring weights are fit 18, pain 22, budget 24, scale 14, presence 10, authority 12. — [doxaviral.com](https://www.doxaviral.com/) (JS bundle)
- License page: "R$ 24 mil ticket médio" (average ticket). It also pitches licensees to escape "R$15 mil" months that restart from zero because of churn. — [Doxa /agency-experience](https://lp.doxascale.com/agency-experience)
- Named clients: Magalu, G4, Nathalia Beauty, plus SMBs. — [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/)
- License fit criteria: "Você já fechou contrato de verdade. Sabe vender" ("you've closed real contracts, you know how to sell"). "Not for you if" you "Nunca fechou uma venda" (never closed a sale) or want a course or mentoring. — [Doxa /agency-experience](https://lp.doxascale.com/agency-experience)
- The app UI is localized in Portuguese, Spanish and English, and the ToS references Instagram, TikTok and YouTube Shorts as the primary platforms. — [Doxa app](https://app.doxascale.com/login)

### Inferences
- The "R$24k average ticket" is most likely the per-client contract value licensees sell, roughly US$4–5k for a 90-day package. That squares with the competitor's "R$15k average investment" for the same 1M-views promise. Neither is confirmed as Doxa's own list price.
- The model is high-ticket and sales-led, typical of Brazilian "infoproduct/high-ticket" marketing: VSL, paid audit call, scarcity cohorts. That contrasts with the self-serve $20–$100/month US SaaS tools.

### Gaps
- No published plan names, monthly fee, implementation fee or licensing fee. The plan and credit system exists in the app, but its values are server-side.
- The cost of the license itself, whether upfront fee or revenue share, is not disclosed.

## Evidence of results, reviews and criticisms

### Takeaway
All positive evidence is self-reported: case reels with 0.5–3.4M views, "10B+ organic views", and R$30M revenue. Independent sentiment is thin. Reclame Aqui complaints against the predecessor Spreed allege low clone quality ("shameful, unusable"), misleading marketing, and refused refunds or cancellations. The ToS clauses barring quality-based refunds and chargebacks match those complaints. I found no Reddit, X, Trustpilot or YouTube reviews of Doxa.

### Cited Findings
- Case reels on Doxa's sites:
  - Advogado: 1.5M views.
  - Motorcycle shop: 2.4M.
  - Incense shop: 3M.
  - Miami real-estate broker: 500K.
  - @corealquimias: 3.4M views, 170k likes, 3k comments, 1,300 reposts.
  - @uninovamotos: 2.5M+ views.
  The case video assets are files saved via "SnapInsta" (an Instagram downloader). — [Doxa landing page](https://lp.doxascale.com/home); [doxaviral.com](https://www.doxaviral.com/)
- Press claims: 10B+ organic views, ~900 videos/day, 1,500+ clients. The article does not independently verify these numbers. — [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/)
- Reclame Aqui complaints against "Spreed Software e Produções Ltda" (seen via search snippets; the pages returned 403 to direct fetch):
  - "Marketing por IA com propaganda enganosa e recusa de cancelamento e estorno" (misleading advertising, refusal to cancel or refund). — [Reclame Aqui 1](https://www.reclameaqui.com.br/spreed-software-e-producoes-ltda/marketing-por-ia-com-propaganda-enganosa-e-recusa-de-cancelamento-e-estorno_B73wkY8BQBrr8ESI/)
  - "qualidade inferior ao prometido e não conformidade com o contratado" (quality below what was promised). Per the snippet, the customer called the video shameful and unusable on social media and said no contract was presented. Spreed replied that its technology is among the most advanced and that it keeps improving clone likeness. — [Reclame Aqui 2](https://www.reclameaqui.com.br/spreed-software-e-producoes-ltda/reclamacao-sobre-servico-de-video-com-ia-da-spreed-qualidade-inferior-ao-prometido-e-nao-conformidade-com-o-contratado_jOTKyFwh9X-u7S6D/)
  - "Promessas não cumpridas e baixa qualidade do conteúdo da Spreed AI" (unmet promises, low content quality; Oct 2025 per snippet). — [Reclame Aqui 3](https://www.reclameaqui.com.br/spreed-software-e-producoes-ltda/promessas-nao-cumpridas-e-baixa-qualidade-do-conteudo-da-spreed-ai_ZrRXIG9O8Ua0W9N6/)
- The guarantee has broad voiding conditions:
  - No paid ads or boosting on the profile during the 90 days.
  - No traffic from WhatsApp, Telegram or email blasts.
  - No deleting or archiving videos, frequent caption edits, niche or handle changes, or "excessive use of trending sounds unrelated to the niche".
  - No edited scripts.
  - Views must be organic and on the primary platform, with cross-posting counted at Doxa's discretion. — [Doxa app ToS](https://app.doxascale.com/login)

### Inferences
- The guarantee is a sales device with many exits. Views are summed across ~36–60 videos, so 1M total means ~17–28k per video on average. That is achievable for many niches on Instagram Reels, which makes the promise less bold than it sounds.
- The quality complaints relate to the Spreed era. Doxa's later additions (human 0–10 avatar QA, PVC voices, photo-compositing studio) look like responses to them, but there is no direct evidence of that.

### Gaps
- Reclame Aqui reputation score and complaint count for Spreed/Doxa could not be retrieved (403). There is no Reclame Aqui page under the "Doxa" name.
- No Reddit, X, Trustpilot or YouTube third-party reviews of Doxa found. English-language discussion appears to be nonexistent.

## Tech stack signals (avatar, voice and other vendors)

### Takeaway
This is confirmed rather than inferred: **HeyGen is the avatar/lip-sync engine and ElevenLabs is the voice engine.** Both are named explicitly in the client app (HeyGen Avatar IDs, ElevenLabs Voice IDs and PVC training) and in the ToS ("Doxa relies on ElevenLabs and HeyGen as infrastructure providers"). The marketing site also shows ChatGPT/OpenAI, Claude, Meta, HeyGen and ElevenLabs logos. Doxa is essentially a HeyGen + ElevenLabs + LLM orchestration layer with proprietary scripting, viral-scoring and ops tooling on top.

### Cited Findings
- ToS §10 footer: "By purchasing and using Doxa, you confirm that you understand Doxa relies on ElevenLabs and HeyGen as infrastructure providers, that AI cloning has known limitations". — [Doxa app ToS](https://app.doxascale.com/login)
- Admin/ops UI strings from the app:
  - "Pending Clones… The HeyGen avatar is created automatically"
  - "Avatar created in HeyGen" / "Failed to create the avatar in HeyGen. Create it manually and fill in the ID below"
  - "Fill in the HeyGen Avatar ID and ElevenLabs Voice ID"
  - "Automated voice creation failed. Download the samples, create the voice manually on ElevenLabs and fill the ID below"
  - "The customer requested manual verification; waiting for ElevenLabs to approve the voice"
  - Voice "similarity" slider: "Determines how closely the AI should adhere to the original voice"
  — [Doxa app](https://app.doxascale.com/login) (client JS bundles)
- The app bundle also contains the strings "replicate" (3 occurrences), "lipsync" and "veO". Their context was not resolved, so they may be generic words. — [Doxa app](https://app.doxascale.com/login)
- The doxaviral.com "powered by" logo strip lists HeyGen, ChatGPT (OpenAI), Claude, Meta and ElevenLabs, with platforms Instagram, TikTok and YouTube Shorts. — [doxaviral.com](https://www.doxaviral.com/)
- Web stack:
  - Landing page: React/Vite SPA with GA4, and preconnects to vturb/ConverteAI (Brazilian VSL video player) and YouTube.
  - App: Next.js (Turbopack chunks, Vercel-style `dpl_` deployment IDs).
  - Main site: React with GA4. Its HTML comments reference a CLAUDE.md file in its repo.
  - Payments: The Bank (Brazil).
  - Scheduling: Google Calendar integration for studio bookings.
  — [Doxa landing page](https://lp.doxascale.com/), [Doxa app](https://app.doxascale.com/login), [doxaviral.com](https://www.doxaviral.com/)
- Press says the AI "analyzes more than 100,000 videos per niche" for hooks, script structures, recurring themes and high-retention formats. — [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/)

### Inferences
- The "Generating face → Generating speech (lipsync) → Editing" pipeline maps to an image-composition model (possibly via Replicate), then ElevenLabs TTS, then HeyGen avatar video, then automated captioning and editing. Script and theme generation probably runs on OpenAI and/or Anthropic models given the logos. Which LLM handles which step is unconfirmed.
- The credit cost per clip (2 credits, rejections 1) reflects HeyGen API minute costs being passed through.
- The "viral trend" engine is most likely a corpus of scraped niche Reels/TikToks (Spreed-era clipping heritage) used to prompt LLM script generation, plus a performance-feedback loop from the client's posted video links. Doxa publishes no technical details.

### Gaps
- No job postings, API docs or formal subprocessor list found. Hosting provider (likely Vercel) and database are unconfirmed.
- No evidence of Captions, Tavus, Arcads, Creatify, Hedra or Argil usage. "Captions" appears once in the main-site bundle but its context was not resolved.

## How Doxa claims to find trends and viral formats

### Takeaway
Doxa claims proprietary AI that mines large volumes of niche short-form videos (100k+ per niche) for hooks, script structures, themes and retention patterns. It combines this with a scored business-onboarding questionnaire and a per-client performance feedback loop. It also discourages chasing generic trends.

### Cited Findings
- AI "analisa grandes volumes de vídeos e formatos" (analyzes large volumes of videos and formats), covering hooks, script structures, recurring themes and high-retention formats. It analyzes 100k+ videos per niche to generate segment-specific scripts. — [The University Journal](https://theuniversityjournal.com/1-milhao-de-visualizacoes-organicas-ou-seu-dinheiro-de-volta-startup-de-ia-co-fundada-por-estudantes-do-insper-fatura-r30-milhoes-e-abre-escritorio-em-miami/)
- App: "DOXA is an innovative tool that uses a sophisticated learning algorithm to create viral videos." For podcasts: "Each segment we select has the highest potential to go viral." Clips are given viral-potential scores. Script direction labels include "Direction (viral way to respond to questioning)". The onboarding includes a measure of "whether the pain you described is already felt by people who have never heard of your solution. This is what most separates high-view clients from the rest." — [Doxa app](https://app.doxascale.com/login)
- Feedback loop: the posted-video link is used so "our AI understands the real performance of your content and adjusts the next videos… If the link is wrong, your AI will be trained with incorrect data." — [Doxa app](https://app.doxascale.com/login)
- The ToS lists "Excessive use of trending sounds unrelated to the niche" as guarantee-voiding. — [Doxa app ToS](https://app.doxascale.com/login)
- Spreed era: the methodology relied on "análise de dados, métricas de conteúdo, algoritmos e tendências" (data analysis, content metrics, algorithms and trends). — [Diário do Comércio](https://diariodocomercio.com.br/tecnologia/mineiro-plataforma-ia-viralizar-videos-fatura-700-mil/)

### Inferences
- The emphasis is on broad-appeal "pain felt by non-buyers" topics, which is a top-of-funnel reach strategy, not trend-jacking. That fits a guarantee measured in raw organic views.

### Gaps
- No technical detail on data sources (scraping, third-party trend APIs) or model architecture.

## Close competitors and how Doxa differs

### Takeaway
Doxa's distinctive features are its contractual view guarantee, its agency licensing/white-label channel, its human-managed ops, and its high-ticket Brazilian sales model. It builds on HeyGen and ElevenLabs rather than competing with them at the model layer. US AI-UGC/avatar tools (HeyGen, Captions, Argil, Arcads, Creatify, Hedra) are mostly self-serve SaaS without outcome guarantees. In Brazil, at least one direct copycat (CIPTA) sells the same "1M organic Reels views with an AI clone" promise.

### Cited Findings
- CIPTA (Brazil) offers an AI clone with a contractual promise of 1M organic Reels views. The guarantee covers organic views, not sales or reach, and the company cites a stated "investimento médio de R$ 15 mil" (average investment R$15k) that varies by plan. This comes from a search-result summary; the underlying article was not fetched, and the source is likely [Band Vale do Paraíba](https://www.band.com.br/nacional/sp/vale-do-paraiba/do-zero-a-1-milhao-de-visualizacoes-organicas-no-instagram) or [Startupi](https://startupi.com.br/ia-capaz-de-viralizar-videos-organicamente/). Verify before relying on it.
- Doxa itself names HeyGen as an "infrastructure provider", meaning HeyGen is a supplier, not a competitor at the model layer. — [Doxa app ToS](https://app.doxascale.com/login)
- Doxa's site positions it against alternatives the buyer might consider: "Um editor de vídeo" (a video editor), "Uma agência" (an agency) and "Um calendário editorial" (an editorial calendar), along with buyer objections such as "Já paguei agência e não deu certo" (I already paid an agency and it didn't work). — [doxaviral.com](https://www.doxaviral.com/) (JS bundle)

### Inferences
- How Doxa differs from the self-serve tools:
  1. Outcome-based packaging (a views guarantee) instead of minutes or credits.
  2. A done-with-you service with account managers and human QA.
  3. B2B agency licensing as a distribution channel ("plug our delivery into your agency").
  4. Scripting and strategy included and locked; editing a script voids the guarantee.
  5. Portuguese-first and high-ticket, sold by sales call.
- The closest US analogs are AI-clone content agencies and "done-for-you" HeyGen/ElevenLabs operators, rather than Argil or Captions directly.
- For anyone replicating this: the moat is distribution, sales and ops plus scripting know-how, not the avatar tech, which is off-the-shelf HeyGen + ElevenLabs. The guarantee works financially because only the implementation fee is refundable and the voiding conditions are extensive.

### Gaps
- Competitor pricing and features (Arcads, Creatify, Argil, Captions, Hedra, HeyGen) were not researched in detail here and should come from the competitor-focused notes.
- No head-to-head quality comparison of Doxa output against competitors found.
