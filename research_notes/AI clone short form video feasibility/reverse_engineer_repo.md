# "Reverse Engineer Anything" (REA) repo: what it is, does it work, and can it reverse-engineer a SaaS like Doxa

Research date: 2026-10-31. Repo inspected directly via a shallow clone of `main` (HEAD 6e9ee97, committed 2026-11-01 05:38 +0800, "fix!: preserve feature traces when owner lookup is unavailable (#8368)"; package.json version 6.8.0).

## 1. Locating the repo: URL, author, stars, last commit, license, README claims

### Takeaway
The repo is **morluto/rea** ("REA: Reverse Engineer Anything"). It is MIT-licensed, has about 415k stars, and was pushed hours before this research. It is an MCP server plus CLI (npm `rea-agents`) for AI coding agents, not a SaaS-cloning bot. The maintainer goes only by the GitHub handle "morluto"; I found no real-name identity. Dozens of similarly named repos exist. Most are derivative guides or plugins, and some are fake "free download" copies.

### Cited Findings
- `gh` search for "reverse engineer anything" ranks **morluto/rea** first: 415,328 stars, MIT, pushed 2026-10-31T22:14Z, description "Reverse engineer anything with agents, from app behavior down to native binaries." — [GitHub search API / repo](https://github.com/morluto/rea)
- The GitHub page shows 415.3k stars, 103.9k forks, 1.6k watchers, 6,292 commits on main, 787 open issues and 666 open PRs. The owner profile shows no name or bio. — [GitHub repo page](https://github.com/morluto/rea)
- The project was created in April 2026 and took off from about October 4, 2026. Next.ink reported it passing 120,000 stars at the time. — [Next.ink](https://next.ink/261039/rea-comment-un-projet-open-source-se-propose-de-tout-decompiler/)
- Growth figures from different dates disagree: 234,477 stars and 58,512 forks on Oct 14 ([Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/23845/rea-reverse-engineer-anything-github-true-false), via search snippet; the page returned a 502 on fetch); "over 145,000" on Oct 13 ([wikidocs](https://wikidocs.net/451131)); "52K stars in a day" ([besthub.dev](https://www.besthub.dev/articles/rea-ai-agent-reverse-engineering-tool-gains-52k-stars-in-a-day-clones-software-without-source-code-d7dd726ce865)). These are snapshots at different times and not necessarily contradictory. The README itself celebrates "400,000 GitHub stars." — [README](https://github.com/morluto/rea/blob/main/README.md)
- README tagline: "One MCP for reverse engineering across binaries, applications, and runtime behavior. See a feature you like. Understand how it works, down to the binary level." The README pitch: "See a feature in an app that you want in your own product? Ask your agent to investigate it with REA. It can inspect the app without its source code, explain how the feature works, show the evidence, and build a version for your project." — [README](https://github.com/morluto/rea/blob/main/README.md)
- Official channels are morluto/rea, rea.tools and npm `rea-agents`. The README warns: "A similar repository name or copied README does not establish that a download is official." — [README](https://github.com/morluto/rea/blob/main/README.md)
- Fake "REA zip download" repos exist, and one fact-check flags a trojan copy. — [codewithmukesh](https://codewithmukesh.com/blog/reverse-engineer-anything-rea/); [Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/23845/rea-reverse-engineer-anything-github-true-false); [awesome-reverse-engineer-anything](https://github.com/AIshihzong/awesome-reverse-engineer-anything)
- Other candidates from the same search, all derivative or unrelated:
  - NabilRFG12/Reverse-Engineer-anything: 1,135 stars, same description as REA. Likely a mirror; treat as untrusted.
  - aicodeking/leanrea: 3,789 stars. "One 8 KB skill that replaces REA... plain CLI tools, no MCP. Benchmarked: 38% faster, 35% cheaper."
  - JoasASantos/REA-Prompts: 3,341 stars. A prompt collection.
  - Speedrunlab/reverse-engineer-anything-self-learning-loop: 121 stars. A skill to "examine a product you're authorised to rebuild, build your own, then test against the original and fix gaps until every must-have on a written checklist passes."
  - AIshihzong/awesome-reverse-engineer-anything: 333 stars. A curated list.
  - leileqiTHU/reverse-cli-anything: 6 stars. Wraps closed desktop apps such as CapCut as CLIs.
  - Docker, DeepSeek and LM Studio wrappers.
  - — [GitHub search results](https://github.com/search?q=reverse+engineer+anything&type=repositories)

### Inferences
- For "Reverse Engineer Anything," morluto/rea is the repo almost certainly meant. Install it only via `npx rea-agents setup`, never from look-alike repos.
- The roughly 4:1 star-to-fork ratio and the hype-driven growth suggest viral attention. Star count says little about whether it is useful for any particular job.

### Gaps
- The maintainer's real identity, company and motives: the profile is blank and no source names a person.
- The exact creation date: GitHub API repo metadata was blocked in this session. "April 2026" comes from Next.ink only.

## 2. How it works technically: inputs and outputs

### Takeaway
REA is a local **MCP server and CLI** that gives an existing agent (Claude Code, Codex, Cursor, Gemini CLI and others) a large catalogue of reverse-engineering tools, about 170 to 207 tools depending on version. It wraps established engines (Ghidra, Hopper, IDA, JADX, Apktool, Binwalk, TShark, WABT) and adds built-in static parsers for JavaScript/Electron, .NET and many file formats. It also has a skill ("reverse-engineer-anything") telling the agent how to investigate. Every tool returns structured "Evidence" with explicit limitations. REA is not itself a decompiler or an agent; the LLM does the reasoning and rebuilding.

### Cited Findings
- "REA connects your agent to tools for inspecting native binaries, JavaScript and Electron apps, .NET assemblies, and websites... Analysis runs locally, and results include the evidence and limitations behind each conclusion." Setup: `npx rea-agents setup`, which registers the MCP server and installs workflow instructions. Supported agents: Claude Code, Codex, Cursor, Gemini CLI, Grok Build and others. — [README](https://github.com/morluto/rea/blob/main/README.md)
- Next.ink: "REA is not in itself a decompiler or even an agent." It is a layer that chains existing tools (Hopper/Ghidra/IDA, JADX/Apktool, Binwalk/Unblob, WABT) with normalized outputs. — [Next.ink](https://next.ink/261039/rea-comment-un-projet-open-source-se-propose-de-tout-decompiler/)
- Target table, from the README:
  - Native binaries → pseudocode, assembly, strings, symbols, xrefs (needs Hopper, Ghidra, IDA or Kuna).
  - JavaScript/Electron → "modules, imports, source maps, routes, IPC and native add-on relationships."
  - **Websites** → "page structure, scripts, network observations and requested screenshots" (needs a Chrome-family browser).
  - **Saved network captures** → "requests, responses, exposed payloads and source locations" from HAR, Fiddler SAZ or mitmproxy.
  - Also Android APKs (JADX), .NET, firmware, pcaps, WASM, SQLite, Unity IL2CPP, Go/Rust binaries and more.
  - — [README](https://github.com/morluto/rea/blob/main/README.md)
- Web tools (docs/browser-observation.md):
  - REA attaches to "a user-owned Chrome-family browser through the Chrome DevTools Protocol (CDP)... This is a passive reverse-engineering capability, not a general browser automation or remote-control surface."
  - `inspect_web_page` captures DOM, accessibility tree, scripts, resources, network/console metadata, WebSocket frame sizes, workers and storage key names.
  - **`analyze_web_bundle`** "parses selected script artifacts without execution and derives chunk edges, route and endpoint candidates, **vendor fingerprints**, static WebMCP declarations, and optionally source-map/original-source evidence."
  - `observe_web_session` records navigation during a user action.
  - `compare_web_captures` diffs captures.
  - — [docs/browser-observation.md](https://github.com/morluto/rea/blob/main/docs/browser-observation.md)
- The bundled skill also lists `capture_browser_scenario` with "declared actions" (click, type, navigate) for cases where the agent must act itself, and `export_environment_bundle` to turn a live web app or HAR into an "AgentEnv" bundle. — [.agents/skills/reverse-engineer-anything/SKILL.md](https://github.com/morluto/rea/tree/main/.agents/skills/reverse-engineer-anything)
- `inspect_web_network_capture` is offline: "recorded URLs are never fetched." It supports HAR 1.2, SAZ and mitmproxy. — [docs/web-network-captures.md](https://github.com/morluto/rea/blob/main/docs/web-network-captures.md)
- The official browser guide workflow:
  1. Launch Chrome with `--remote-debugging-port=9222` and a separate profile.
  2. The user performs the action (for example, clicking Export).
  3. REA reports the endpoint, method, status, initiating script and JSON response shape (`--include-json-body-shapes`).
  4. "Server-side behavior isn't covered; [it] only observes what the browser sends and receives." Only traffic inside the observation window is captured.
  - — [rea.tools browser guide](https://rea.tools/guides/browser/)
- RL environments: "Record a web app session, turn its API into tools, and export an environment an AI agent can use" (`rea environment-build ./session.har ./my-env`). — [README](https://github.com/morluto/rea/blob/main/README.md)

### Inferences
- For a web SaaS, the useful inputs are (a) a live Chrome session you drive, logged into your own trial account, and (b) HAR exports. The useful outputs are an endpoint inventory, request initiators, JSON response shapes, route lists from JS bundles, and vendor/SDK fingerprints from bundled code.

### Gaps
- I did not run REA against a live site in this session, so I could not verify the vendor-fingerprint quality myself.

## 3. Evidence that it works: demos, tests, community feedback

### Takeaway
There is real but mixed evidence. Official showcases cover narrow, single-function or single-feature reconstructions. An independent hands-on test found the static Electron/JS analysis fast and honest about its limits, but it had blind spots and a very large context cost. The most rigorous independent study, 482 preregistered runs, found **no significant improvement** in solve rate with REA, at about twice the time and cost. Hype articles ("clone any software in minutes," PS5 security) overstate what it does.

### Cited Findings
- Official showcases:
  - DX-Ball sound-pan function rebuilt in C, passing 3,205 original-x86 test cases and reproducing all 63 compiled bytes.
  - Notion's Electron clipboard bridge traced through preload and IPC.
  - A TH04 PC-98 bullet-ring calculation recovered.
  - — [README Showcases](https://github.com/morluto/rea/blob/main/README.md); [rea.tools/showcase](https://rea.tools/showcase/)
- "The official project does not claim to recover original source code or clone a whole application. DX-Ball's 3,205 / 63 figures apply to one function." — [awesome-reverse-engineer-anything](https://github.com/AIshihzong/awesome-reverse-engineer-anything)
- Independent HackerNoon test, REA 6.4.0, static JS only, on a 100 MB Electron app:
  - The full scan took about 52 s, parsed 421 JS files with zero failures, and produced 59.2 MB of JSON.
  - Window, contextBridge and IPC counts matched grep, and the tracer worked through minified code.
  - It found **zero preload entrypoints** on the real app and dropped graph edges for 365 files because of result budgets. A trace for a string present in the source returned no match.
  - The tool list was about 170 tools and about 1.95 MB, roughly 500k tokens by the author's estimate. The compact profile cut that by only 9%.
  - Verdict: useful but "blind in places"; websites and native analysis were not tested.
  - — [HackerNoon](https://hackernoon.com/i-tested-rea-githubs-viral-reverse-engineering-tool-on-a-real-electron-app)
- pablodiazjorge/rea-lab: five preregistered studies, 482 Claude Code runs on Windows with Ghidra.
  - Study 1: 28 of 30 crackmes solved both with and without REA, with REA at about 2x time and cost.
  - Study 2: harder binaries were solved 11/24 without REA vs 4/24 with it (not significant, p = 0.092).
  - Study 5: the official skill made no measurable difference.
  - Advice: "Use REA for targeted questions on a known surface, not open-ended exploration."
  - — [awesome-reverse-engineer-anything summary of rea-lab](https://github.com/AIshihzong/awesome-reverse-engineer-anything); [rea-lab](https://github.com/pablodiazjorge/rea-lab)
- Next.ink reader comments:
  - Effective on simple wrapper binaries, but the model "often hallucinated" on complex or SIMD/GPU code, and runs were token-heavy.
  - Another reader reached in hours a point on TI C28 DSP firmware that would have taken weeks in Ghidra alone.
  - Another admitted cracking an old commercial program and writing a keygen in about 2 h, which is misuse.
  - — [Next.ink](https://next.ink/261039/rea-comment-un-projet-open-source-se-propose-de-tout-decompiler/)
- Hacker News: an aggregator reports a main thread at 805 points and 337 comments, plus a smaller "Reverse engineer anything with agents" thread at 98 points and 38 comments. I could not open these threads directly. — via search summary of [hackernoon "is software really dead"](https://hackernoon.com/is-software-really-dead-the-rise-of-ai-powered-reverse-engineering) and related aggregator coverage
- Web/SaaS-adjacent community cases:
  - michaelshimeles/terminal-rs: chart behaviour "studied from public TradingView pages."
  - az9713/wispr-flow-rea-teardown: each claim marked proven, inferred or hidden, plus a 64-line local rebuild.
  - devtechedge/feature-heist: clean-room TypeScript rebuilds of single features.
  - — [awesome-reverse-engineer-anything](https://github.com/AIshihzong/awesome-reverse-engineer-anything)
- Defensive counter-tools now exist: MockirDev/antirea and qybaihe/bla, which plant decoys or push artifacts past REA's resource budgets. — [awesome-reverse-engineer-anything](https://github.com/AIshihzong/awesome-reverse-engineer-anything)
- Hype framing appears in coverage: "How To Use REA To Clone Any Software In Minutes" (YouTube) and "Someone used AI to reverse engineer PS5 security in weeks" (Towards AI, paywalled). — [YouTube](https://www.youtube.com/watch?v=FnB9tHKBJXQ); [Towards AI](https://pub.towardsai.net/someone-used-ai-to-reverse-engineer-ps5-security-in-weeks-what-is-rea-11aed6dd106e)

### Inferences
- REA works best as an evidence-gathering harness for targeted questions on a known surface. It is not an autonomous "clone this product" machine, and frontier agents with plain DevTools/CLI tools may do just as well (compare leanrea's "38% faster, 35% cheaper" claim and the rea-lab results).

### Gaps
- No independent benchmark of REA's **website/browser** tools exists; every independent test I found covered binaries or Electron.
- The Pillitteri fact-check page returned a 502, so its detailed true/false verdicts were not read.

## 4. Applying it to a SaaS web app (e.g. Doxa, an AI avatar short-form video platform)

### Takeaway
REA is partly useful here. Its browser/HAR tools can catalogue a web app's front-end routes, the API calls the browser makes, response shapes, and third-party SDKs bundled in the JS. That covers features, UX flows and the client-visible vendor stack. It **cannot** see server-side architecture. An AI-avatar video product does its core work (avatar rendering, TTS and lip-sync calls to vendors like HeyGen or ElevenLabs) on the backend, so those vendors usually won't appear in browser traffic unless the front-end calls them directly or loads their SDK or player.

### Cited Findings
- Browser observation covers only "what the browser sends and receives"; server-side behavior is not covered. — [rea.tools browser guide](https://rea.tools/guides/browser/)
- `analyze_web_bundle` derives "route and endpoint candidates, vendor fingerprints" and optional source-map evidence from scripts. "Static candidates never establish complete application coverage or reachability." — [docs/browser-observation.md](https://github.com/morluto/rea/blob/main/docs/browser-observation.md)
- The CDP capability is described as "passive... not a general browser automation or remote-control surface," although `capture_browser_scenario` supports declared click, type and navigate actions. — [docs/browser-observation.md](https://github.com/morluto/rea/blob/main/docs/browser-observation.md); [SKILL.md](https://github.com/morluto/rea/tree/main/.agents/skills/reverse-engineer-anything)
- The HAR → AgentEnv feature turns recorded API calls into a mock environment. The environment "supports changes only when the recording confirms their effects." — [README](https://github.com/morluto/rea/blob/main/README.md)
- If Doxa ships desktop or mobile apps, REA's Electron and APK paths apply. Whether it does is not established here. — [README target table](https://github.com/morluto/rea/blob/main/README.md)

### Inferences
- A realistic REA workflow for Doxa:
  1. Sign up for a trial using your own account, in a separate Chrome profile.
  2. Run `observe_web_session` or `inspect_web_page` while walking each flow: onboarding, avatar creation, script entry, voice pick, render, export or publish.
  3. Export HARs and run `inspect_web_network_capture`.
  4. Run `analyze_web_bundle` on the JS for routes, feature flags and SDKs. Expect signals such as Stripe, Segment, PostHog, Intercom, Sentry, Mux or Cloudflare Stream players, Firebase or Supabase, Clerk or Auth0 hosts.
  5. Have the agent write a feature/flow spec.
- Render-pipeline vendors can sometimes show up in media URLs (for example CDN hostnames of generated videos) or job-status response fields. Often they are hidden behind the company's own API.
- Plain Chrome DevTools plus Claude Code can do most of this without REA. Given rea-lab's cost findings, REA's main added value here is structured evidence and bundle parsing, not unique capability.

### Gaps
- I did not verify whether Doxa's front end exposes vendor names. That requires actually signing up, which was not done here.

## 5. Complementary techniques for reverse-engineering a SaaS product from public surfaces

### Takeaway
The highest-yield, lowest-risk methods do not need REA:
- Tech-detection services (Wappalyzer, BuiltWith).
- DNS, TXT and subdomain records.
- Privacy policy and **subprocessor lists**, which often legally have to name AI vendors.
- Job postings, founder posts or podcasts, and help docs and changelogs.
- Trial signup with screen recording and a written UX teardown.

### Cited Findings
- Wappalyzer identifies "CMS, ecommerce platforms, and analytics tools" by scanning a site's code and scripts. It can monitor stack changes and offers API bulk lookup. A third-party review lists Business at $450/mo; this was not verified on wappalyzer.com. — [syncgtm review](https://syncgtm.com/blog/wappalyzer-review-2026); [cybersectools](https://cybersectools.com/tools/wappalyzer)
- REA's own `analyze_web_bundle` vendor-fingerprint output overlaps with Wappalyzer for client-side SDKs. — [docs/browser-observation.md](https://github.com/morluto/rea/blob/main/docs/browser-observation.md)

### Inferences (practitioner knowledge, not separately sourced)
- **Subprocessor list / DPA / privacy policy**: GDPR Art. 28 obliges processors to disclose sub-processors to controllers. SaaS products selling to EU or B2B customers often publish lists naming LLM, TTS and avatar vendors (OpenAI, ElevenLabs, HeyGen, D-ID, AWS, GCP). This is usually the single best source for the backend vendor stack.
- **DNS/TXT/MX/CNAME and subdomains** (crt.sh certificate transparency): reveal email, auth, docs, status page and CDN providers, and sometimes `api.` or `render.` hosts.
- **Job postings**: list frameworks, cloud provider, and in-house vs vendor ML (e.g. "experience with diffusion lip-sync models" vs "integrate third-party APIs").
- **Watermarks and output forensics**: artifacts, voice timbre and default avatar faces can match vendor stock libraries. HeyGen and ElevenLabs have recognizable stock voices and avatars.
- **Trial walkthrough**: record every screen, step, limit, price gate, credit cost and render time. This is the core of a clean-room functional spec.

### Gaps
- No primary sources gathered here for subprocessor-list practice or crt.sh; adjacent researchers may have them.

## 6. Legal and ethical boundaries

### Takeaway
Observing a SaaS from the outside (public pages, your own trial account, your own browser's traffic) and writing an independent functional spec is generally low-risk. Copyright protects code and assets, not functionality. The main risks are:
- **Contract (ToS)**: most SaaS terms ban reverse engineering, scraping and building competing products, and US courts have enforced such clauses.
- **Copying expression**: UI copy, design assets, avatars, voices and code.
- **Bypassing technical access controls**: DMCA §1201 and CFAA exposure for gated or password-protected areas.

REA's own disclaimer forbids copying proprietary software and bypassing access controls.

### Cited Findings
- REA DISCLAIMER: the project will not help with "copying proprietary software or reproducing its protected code and assets," "bypassing authentication, bot protection or access controls on systems you are not authorized to test," or "circumventing DRM." Users must comply "with applicable laws, license agreements and terms of service." "Authorization to inspect an artifact does not necessarily authorize execution, interception... or interaction with another party's system." — [DISCLAIMER.md](https://github.com/morluto/rea/blob/main/DISCLAIMER.md)
- Critics note that "one agent doing both analysis and rebuilding does not meet the personnel separation of traditional clean-room development." — [awesome-reverse-engineer-anything](https://github.com/AIshihzong/awesome-reverse-engineer-anything)
- Anthropic's and OpenAI's own terms prohibit reverse-engineering their services. — [awesome-reverse-engineer-anything](https://github.com/AIshihzong/awesome-reverse-engineer-anything)
- **EU (SAS v World Programming, CJEU C-406/10, 2012)**: functionality and programming languages are not protected by copyright. A licensee may "observe, study or test its functioning so as to determine the ideas and principles which underlie that program." — [Wikipedia](https://en.wikipedia.org/wiki/SAS_Institute_Inc_v_World_Programming_Ltd); [Computerworld](https://www.computerworld.com/article/1535945/programming-languages-can-t-have-copyright-protection-eu-court-rules.html)
- **US (Bowers v. Baystate, Fed. Cir. 2002/2003)**: a shrink-wrap "no reverse engineering" clause was held enforceable even where the use might be fair use, and was not preempted by copyright (following ProCD). — [Wikipedia](https://en.wikipedia.org/wiki/Bowers_v._Baystate_Technologies,_Inc.); [WilmerHale](https://www.wilmerhale.com/insights/publications/shrink-wrap-licenses-and-reverse-engineering-april-16-2003)
- **CFAA**:
  - *Van Buren* (2021) held that ToS violations alone do not "exceed authorized access."
  - hiQ v. LinkedIn (9th Cir.): accessing public data in breach of ToS is "unlikely to constitute a violation of the CFAA," but LinkedIn later won on **breach of contract**.
  - Data behind a login, or circumventing technical barriers, carries higher risk.
  - — [Nixon Peabody](https://nixonpeabody.com/insights/articles/2021/06/28/web-scraping-battle-to-provide-further-clarification-to-computer-fraud-and-abuse-act-cfaa); [Fenwick](https://www.fenwick.com/insights/publications/hiq-labs-scrapes-by-again-the-ninth-circuit-reaffirms-that-data-scraping-does-not-violate-the-cfaa-1); [Privacy World](https://www.privacyworld.blog/2022/11/federal-court-rules-in-favor-of-linkedins-breach-of-contract-claim-after-six-years-of-cfaa-data-scraping-litigation/)
- REA's README requires legally licensed IDA, Hopper and JEB, with no cracked copies, and says trials remain subject to vendor terms. — [README](https://github.com/morluto/rea/blob/main/README.md)

### Inferences
- **Safe zone**: public marketing pages and docs, pricing, help center, changelog, subprocessor list, job ads, Wappalyzer/BuiltWith, DNS. Using the product as a normal user and documenting features and flows in your own words. Building your own implementation on vendors you contract with directly (HeyGen, ElevenLabs and others).
- **Grey zone**: inspecting your own browser's network traffic and JS bundles while logged into a trial whose ToS bans reverse engineering. Detection and litigation are unlikely for a small rebuild, but this is technically a contract breach. Running REA over a SaaS's bundles falls here.
- **High risk**: copying UI text, layouts, avatars, voices or code. Automated scraping of logged-in areas. Replaying or abusing their private APIs. Bypassing rate limits or paywalls. Reselling access. Claiming "clean room" when the same agent saw the internals.
- For Brian's purpose (judging the feasibility of building his own AI-clone short-video tool), the cleanest path is a functional spec built from a normal trial plus public-surface vendor fingerprinting, followed by building directly on the vendors' APIs. REA is optional.

### Gaps
- No legal analysis gathered specific to DMCA §1201 and web apps (it mainly matters for encrypted or DRM'd content), or for Doxa's actual ToS. Doxa's ToS text was not reviewed.
- Jurisdiction-specific advice (US vs EU, where Art. 6 of the Software Directive limits decompilation to interoperability) needs counsel.
