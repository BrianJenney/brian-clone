---
name: build-carousel
description: Build a TikTok / Instagram carousel (deck of slides, native 1080x1350) plus a matching caption, and optionally a matching lead magnet doc when the piece has one attached. Use when the user says "/build-carousel", "build carousel", "tiktok carousel", "ig carousel", "instagram carousel", or "make me a carousel".
argument-hint: ''
allowed-tools: Bash, Read, Write, Edit, WebFetch
license: MIT
user-invocable: true
---

# /build-carousel

Build a single TikTok / Instagram carousel deck from your subject (or an example reference), plus a matching caption, and optionally a matching lead magnet doc. Each run produces a **draft for review first**, then on your approval the materials are locked in. The skill never builds the lead magnet before you approve the deck and caption (see Step 10 to Step 11 approval gate).

---

## What This Produces (Per Run)

| #   | Deliverable                         | Where It Lives                                                                                                                    |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Slide deck (PNGs + source HTML)** | `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slide-N.png` (one per slide) + `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slides.html`     |
| 2   | **Caption**                         | `<output-dir>/[YYYY-MM-DD]-[kebab-title]-caption.txt`                                                                             |
| 3   | **Lead magnet doc** _(optional)_    | `<output-dir>/[YYYY-MM-DD]-[kebab-title]-lead-magnet.md`. Only created when you said "yes" to the lead magnet question at intake. |

`<output-dir>` is the path the user set in `config.md` during the setup helper prompt (default: `~/carousel-output/`).

The user handles:

- Posting the deck on TikTok / Instagram (uploading the PNGs + pasting the caption)
- The DM workflow that sends the lead magnet URL to commenters
- The lead magnet hosting page (Skool, Notion, Beehiiv, your own site, etc., they pick the platform)

This skill does NOT auto-post, DM, or host the lead magnet.

---

## Cache-First Reference Rule (MANDATORY)

**Never re-derive a reference example that already has a `notes.md`.** Every reference carousel in `reference-examples/` is analyzed once and saved as `reference-examples/[carousel-name-kebab]/notes.md`. On every run, **read the existing notes file** — do not re-analyze the source PNGs or webpages.

| Reference                        | Source (do NOT re-process)                     | Use this (the cache)                        |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Example carousels                | the PNGs / URL in `reference-examples/[name]/` | `reference-examples/[name]/notes.md`        |
| Slide structure / design rules   | (this skill's spec)                            | the **Carousel Blueprint** section below    |
| Caption format                   | (this skill's spec)                            | the **Caption Blueprint** section below     |
| Lead magnet 10-section structure | (this skill's spec)                            | the **Lead Magnet Blueprint** section below |

**The ONLY trigger for re-derivation:** the user adds a new example to `reference-examples/`. A new folder appearing under `reference-examples/` with no `notes.md` inside means: analyze that one new carousel and save its breakdown.

**Forbidden:**

- "Just to be safe, let me re-look at the source slides." NO. Read the notes file.
- "Let me double-check the format by reading the original example." NO. The notes file IS the format.
- Re-deriving word counts from a reference that already has a `notes.md`, wasteful and risks drift if the result differs from the cached version.

**Why this matters:** every re-derivation burns tokens we already spent. The cached notes are the single source of truth.

---

## Output Style Rules (apply to PRODUCED ARTIFACTS only)

**Scope clarification:** these rules govern the files the skill produces for the user (the deck text, the caption, the lead magnet doc, the resource post copy, and the draft variants of each). They do NOT govern the skill's internal documentation (`SKILL.md`, blueprints, template instruction text), those may use em/en dashes freely in descriptive prose. The QA gate at Step 9 runs on the produced artifacts, not on the framework files.

- **NEVER use em dashes (`—`) in any produced artifact.** This applies to the slide text, the caption, the lead magnet doc, and the source `slides.html`. Em dashes are a common AI-writing tell and survive into rendered PNG output.
- **Default replacement:** swap `—` for `, ` (comma + space) in flowing prose. For title-style separators where a comma reads awkwardly, use a colon. Periods are fine when the clause stands as its own sentence.
- **Hyphens (`-`) are fine.** This rule is specifically about the em dash character `—` (U+2014) and its en-dash cousin `–` (U+2013).
- **High-school reading level applies to the deck, caption, AND lead magnet.** Plain words. Short sentences. Every technical term gets a 1-line plain-English translation on first mention or gets cut. No insider acronyms (SaaS, GTM, MRR, CAC, LTV, ICP, CRM, API).
- **QA gate:** before delivery, every artifact must be searched for `—` and `–`. Zero matches required.

```bash
grep -E "[—–]" <output-file>
# Should return zero matches
```

(Note: use `grep -E`, not `grep -P` — BSD grep on stock macOS doesn't support `-P` and will silently return empty matches even when em dashes exist.)

---

## Naming Convention (MANDATORY)

Every carousel has ONE brand identity, the **Topic Name**, that anchors the deck and (when attached) the lead magnet.

| Where                                            | What                                               | Example                                        |
| ------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------- |
| **Lead magnet doc filename** (the kebab portion) | Topic Name in kebab-case                           | `the-non-developers-code-stack-lead-magnet.md` |
| **Lead magnet doc internal H1**                  | Topic Name (verbatim, no prefix)                   | `The Non-Developer's Code Stack`               |
| **Slide deck implicit branding**                 | Topic Name lives in slide 1 hook + final CTA slide | n/a, varies per design                         |

### Topic Name naming heuristic (use when proposing)

The Topic Name follows this pattern: `[Definite article (optional)] [Niche or audience] [Outcome or asset] [Format suffix (optional)]`

Examples:

- `The Non-Developer's Code Stack` (definite article + audience + asset + format suffix)
- `Weekend SaaS Stack` (no article + outcome + format suffix)
- `The Solo Coach Intake Stack` (definite article + audience + outcome + format suffix)
- `Korean BBQ Voice Agent Starter Kit` (no article + niche + asset + format suffix)
- `Cross-Platform Publishing Skill` (no article + outcome + format suffix)

Format suffixes that work: `Stack`, `Kit`, `Skill`, `System`, `OS`, `Playbook`, `Framework`, `Engine`. Pick the one that honestly describes what's packaged (Stack = multi-tool wiring; Kit = ready-to-use bundle; Skill = single command; Playbook = step-by-step). When in doubt, default to `Stack` for multi-tool walkthroughs.

**Forbidden:**

- The phrase **"lead magnet"** appearing anywhere on the lead magnet doc — not in the filename, not in the body. The lead-facing artifact never uses the words.
- `Lead Magnet —` prefixes on the lead magnet filename.
- Comment keyword (e.g. `BUILD`, `STACK`) in the lead magnet filename. The keyword is a routing word, not part of the brand.
- Different Topic Name in the lead magnet H1 vs. what slide 1 of the carousel implicitly carries.

**Allowed:**

- The Topic Name CAN include words like `Skill`, `OS`, `Kit`, `Stack` if that's how the topic is naturally branded (e.g. `Solo Content OS`).

**Why this rule exists:** when a lead clicks through TikTok or Instagram and into the lead magnet doc, they see the same brand name at every step. Variation breaks the trail of recognition.

---

## Step 0: Intake (MANDATORY: ask all three questions and wait)

On every invocation of `/build-carousel`:

1. **List the reference examples available.** Read `reference-examples/` and list every subfolder that has a `notes.md` inside.
2. **Ask all three intake questions in the same message, then wait for the user's answers before doing anything else:**

    > Before I start, three questions:
    >
    > **1. Which reference example should this carousel be based on?** Here's what's in your library:
    >
    > - [List subfolder names from `reference-examples/`]
    >
    > **2. What's the subject for this carousel?** Options:
    >
    > - Paste the subject text directly (problem, framework, asset you want to teach)
    > - Point me at a local file (`path/to/your/notes.md`)
    > - Paste a URL I can fetch
    > - Describe the subject in chat (I'll work from your description)
    >
    > **3. Is a lead magnet part of this piece?** (yes / no)
    >
    > - **Yes** = I'll also draft the lead magnet doc on this run, gated behind the deck approval
    > - **No** = I'll build only the deck and caption

3. **Do not proceed to Step 1 until all three answers are received.**

If `reference-examples/` is empty, tell the user they need to add a reference example first and point them at `reference-examples/README.md` for the format. Do NOT proceed without a reference.

---

## Step 1: Gather Materials

Pull the materials based on the Step 0 answers:

| #   | Material                        | Source                                                                                                                                                                                                    |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Reference example breakdown** | `reference-examples/[picked-name]/notes.md` (already cached from setup or first-run analysis)                                                                                                             |
| 2   | **Subject material**            | Whatever the user provided in Step 0: pasted text, local file, fetched URL, or chat description                                                                                                           |
| 3   | **Brand config**                | `config.md` in the skill folder (niche, target viewer, voice, primary color, accent color, display/ui/mono fonts, watermark text, social handle, lead magnet destination URL, next step link, output dir) |

If `config.md` is missing, tell the user to run the setup helper prompt before continuing. Do not proceed.

---

## Step 2: Confirm the Reference Example Breakdown

Read `reference-examples/[picked-name]/notes.md` and present a 5-line summary to the user:

```
**Reference:** [name]
**Slide count + arc:** [e.g., "8 slides: Hook -> Promise -> Asset -> Diagnosis -> Mechanism -> Proof -> Stakes -> CTA"]
**Asset slide:** [which slide carries the deliverable, e.g., "Slide 3 (kicker + code block + footer)"]
**Italic rhythm:** [e.g., "one italic word per slide forming a chain" / "no italic words"]
**Color pattern:** [e.g., "cream/coral alternation: 1,3,4,6,8 cream; 2,5,7 coral"]
```

Ask: "Confirm this is the carousel pattern you want to follow, or pick a different reference example."

Wait for confirmation. If the user says "yes" / "confirmed" / "go", proceed to Step 3. If they pick a different reference, repeat Step 2 with that one.

---

## Step 3: Review Subject + Pick the Topic Name

### 3a. Read the subject material

Read whatever the user provided in Step 0. If it's a URL, fetch it. If it's a file, read it. If it's pasted text, work from that.

### 3b. Check for keyword collisions

Ensure `<output-dir>` exists, then list its contents:

```bash
mkdir -p "<output-dir>"
ls "<output-dir>/"
```

Scan existing filenames for the kebab-title portion. Note which titles and keywords have been used so the new one doesn't collide.

If `<output-dir>/` is empty or freshly created (first run), skip the collision check.

### 3c. Lock the asset content

The asset slide (the slide that carries the actual deliverable — the prompt, framework, checklist, or steps) is the highest-value moment in the deck. From the subject material, derive:

- The single most useful concrete asset the carousel can hand the viewer
- Same word count as the reference's asset slide, or shorter
- 10x sharper / more useful than what the reference put there
- Plain English, no jargon
- Self-contained (works without context from other slides)

The asset is **not gated**. The lead magnet (when attached) is the same content delivered as plain text. The value of the lead magnet is copy-paste convenience, not new content.

### 3d. Recommend the Topic Name + comment keyword

Present to the user:

> Based on the reference example and your subject, here's what I recommend:
>
> **Topic Name:** [the canonical brand name, follows the heuristic above]
> **Comment keyword:** [1 word, all caps, 4 to 10 chars, behavior word that names what the asset DOES, not the persona it adopts, unused]
> **Asset content (slide for asset):** [one-paragraph preview of what slide [N] will carry]
> **Story angle:** [one-sentence pitch — the deck's argument]
> **Has real results?** [Yes — validated / No — explanation only]

Wait for user confirmation. If they push back on any element (Topic Name, keyword, asset), iterate until they confirm.

---

## Step 4: Draft the Slide Copy

Once the user confirms, draft the copy for every slide following the **Carousel Blueprint** section below.

For each slide of the deck, declare:

- **Role** (Hook / Promise / Asset / Diagnosis / Mechanism / Proof / Stakes / CTA, or whatever the reference uses)
- **Background color** (primary or accent, matching the reference's pattern)
- **Elements** present (headline, kicker, subhead, code block, footer, italic accent word, etc.)
- **Word count per element** (within +/-1 of the reference's analogous slide)
- **Italic accent word** when applicable

Show the user the slide-by-slide copy plan before generating HTML. Wait for "looks good" or revisions. Iterate until approved.

---

## Step 5: Build the HTML Deck

Use the **Template: Slide (HTML)** section below as the starting frame. The template reads CSS custom properties from its `:root` block, so when you copy the template into the build output you only edit the variable values, not every CSS rule.

When generating the build output from the template:

1. **Swap the palette.** Read `primary color` and `accent color` from `config.md` and overwrite `--primary` and `--accent` in the template's `:root` block.
2. **Swap the fonts.** Read `display font`, `ui font`, `mono font` from `config.md`. Overwrite `--font-display`, `--font-ui`, `--font-mono` in `:root`. ALSO rewrite the Google Fonts `<link>` import tag (marked with the `<!-- BUILD: GOOGLE_FONTS_IMPORT -->` comments) so the chosen fonts actually load. The link URL format is `https://fonts.googleapis.com/css2?family={Font+Name}:wght@...&family=...&display=swap` — substitute each font's name with `+` replacing spaces.
3. **Apply the watermark** (top-left) on every slide when `config.md` has watermark text; remove the `.wm-top` div entirely from every slide when watermark text is blank.

Then for each slide:

1. Set the slide background class (`primary` or `accent`) per the reference's color pattern
2. Insert the slide's elements (headline, kicker, subhead, etc.) per Step 4's plan
3. Apply italic styling to the accent word when applicable
4. Use `→` arrows for navigation paths (NEVER em dashes)
5. Keep the `?only=N` inline script (already in the template) so each slide can be rendered standalone

Save to `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slides.html`.

`[kebab-title]` is the Topic Name kebab-cased (lowercase, hyphens between words, apostrophes stripped). Example: `The Non-Developer's Code Stack` → `the-non-developers-code-stack`.

---

## Step 6: Render the Slides

Start a tiny Python static server pointing at the output directory, then use Chrome headless to render each slide.

**Before running**, edit the four marked values below (`<output-dir>`, `DATE`, `TITLE`, `SLIDE_COUNT`) to match this build. The block is a template, not a copy-paste-runnable script:

```bash
# === EDIT THESE 4 VALUES BEFORE RUNNING ===
OUTPUT_DIR="<output-dir>"           # absolute path from config.md, e.g. /Users/you/carousel-output
DATE="2026-01-15"                   # today's date in YYYY-MM-DD, matches the filenames you wrote in Step 5
TITLE="kebab-title-here"            # the Topic Name kebab-cased
SLIDE_COUNT=8                       # the reference example's slide count
# ===========================================

# Pick the Chrome binary path for your OS:
#   macOS:   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
#   Linux:   "google-chrome" or "chromium"
#   Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Start the server (background, serves OUTPUT_DIR on port 8765)
cd "$OUTPUT_DIR"
python3 -m http.server 8765 &
SERVER_PID=$!

# Render each slide as PNG
for i in $(seq 1 $SLIDE_COUNT); do
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=1080,1350 \
    --screenshot="${OUTPUT_DIR}/${DATE}-${TITLE}-slide-${i}.png" \
    --virtual-time-budget=3000 \
    "http://localhost:8765/${DATE}-${TITLE}-slides.html?only=${i}"
done

# Stop the server
kill $SERVER_PID
```

Chrome runs headless (no window appears), this is expected. The PNGs land in `$OUTPUT_DIR` as the loop progresses.

---

## Step 7: Audit each PNG

Read each rendered slide. Check for:

- **Black bar at bottom** (means body bg isn't matching slide bg in single-render mode, fix the inline script in the HTML)
- **Headlines wrapping to one extra line** (drop font size 10 to 20%)
- **Asset code block overflow** (the asset slide commonly carries 3 to 5 lines of stack/checklist content; if the default 36px overflows, drop to 28 to 32px and re-render. Short 1 to 2 line prompts can stay at 36px.)
- **Text overlaps** between headline and subhead (move headline up or shrink font)
- **Orphan articles** ("a", "the") at end of lines (rebreak)
- **Italic word color contrast** (italic on primary should use accent color; italic on accent should use lighter primary)
- **Watermark placement** (top-left, doesn't overlap content)

Fix and re-render any failing slide.

See the **Carousel Blueprint** section below Section 13 (Layout watch-outs) for the full list of known render failures.

---

## Step 8: Write the Caption

Draft the caption following the **Caption Blueprint** section below and the **Caption Template** section below.

Target metrics:

- **Length:** 90 to 110 words
- **Comment CTA placement:** line 2, immediately after the hook (so it sits in TikTok / IG's truncation zone)
- **Reading level:** high school (same bar as the slides)
- **Em dashes:** zero
- **Voice:** matches the deck verbatim where possible

Save to `<output-dir>/[YYYY-MM-DD]-[kebab-title]-caption.txt`.

---

## Step 9: Draft the Lead Magnet Doc (CONDITIONAL — only if user said "yes" at intake)

**Skip this step entirely if the user said "no" at Step 0 question 3.**

If yes, draft the full lead magnet content following the **Lead Magnet Blueprint** section below and the **Lead Magnet Template** section below. Required sections:

1. **Title** — the Topic Name, verbatim, no suffix
2. **What This Is** (2 to 3 sentences)
3. **What You'll Need** (tools, accounts, rough time commitment; flag every paid tool with price)
4. **The Story (short recap)** (3 to 5 sentences anchoring the template to the carousel's narrative)
5. **The Template Itself** — the actual reusable asset (same content as the carousel's asset slide, expanded with usage notes that wouldn't fit on the slide):
    - Prompt → full prompt text in a code block
    - Workflow → numbered steps with what to click / type / paste
    - Config → the config file with inline comments
    - Checklist → the full checklist with 1-line why for each item
6. **How to Use It** — step-by-step walk-through. Numbered. Each step <=2 sentences.
7. **Common Mistakes** — 3 to 5 failure modes with the fix for each (plain language)
8. **What "Done" Looks Like** — describe the end state concretely
9. **Next Step** — soft offer linking to the user's `[next step link]` from `config.md`. Keep it gentle, 1 to 2 sentences max. Always hyperlinked.
10. **Credits / Source** — link to the original case study / source (if external). Do not include the carousel, this skill, or internal references.

### Reading Level

Write the entire lead magnet at a **high-school reading level**:

- Short sentences. Plain words.
- No jargon without a 1-line plain-English translation right after.
- Prefer "the tool that sends the message" over "the webhook dispatcher".
- Use concrete examples over abstractions.
- A motivated high-schooler should be able to follow this and actually build the thing.

---

## Step 10: QA

Run QA against all built deliverables. Use the checklists in the **Carousel Blueprint** section below (Carousel QA section), the **Caption Blueprint** section below (Caption QA section), and the **Lead Magnet Blueprint** section below (Lead Magnet QA section, if LM was built).

**Critical checks (must all pass before Step 11):**

| #   | Check                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Slide count matches the chosen reference                                                                                                                           |
| 2   | Asset slide carries the actual deliverable in the right format (code block / steps / checklist)                                                                    |
| 3   | Word counts per element are within +/-1 of the reference's analogous slide                                                                                         |
| 4   | Italic accent words form a chain that advances the argument (when reference uses italics)                                                                          |
| 5   | Background color pattern matches the reference                                                                                                                     |
| 6   | Watermark renders top-left only when `config.md` has watermark text                                                                                                |
| 7   | Comment keyword: 1 word, all caps, 4 to 10 chars, unused in any prior carousel                                                                                     |
| 8   | Topic Name appears in slide 1 hook (or final CTA slide) AND lead magnet H1 (if LM was built)                                                                       |
| 9   | Caption is 90 to 110 words with comment CTA on line 2                                                                                                              |
| 10  | Lead magnet has all 10 required sections (if LM was built)                                                                                                         |
| 11  | Lead magnet reads at high-school level (no unexplained jargon)                                                                                                     |
| 12  | Zero em dashes (`—`) or en dashes (`–`) anywhere in the deck text, caption, or lead magnet                                                                         |
| 13  | Next Step link in lead magnet is hyperlinked and matches `[next step link]` from `config.md` (if LM was built)                                                     |
| 14  | If `lead magnet destination URL` in `config.md` is `TBD`, the lead magnet's hosting reference uses the literal placeholder `<TO BE FILLED>` so it's findable later |

Present QA results to the user. Fix any failures before proceeding to hand-off.

---

## Step 11: Hand off for approval (MANDATORY GATE)

Tell the user:

> ### Carousel Draft Ready for Review — [Topic Name]
>
> **Slides HTML:** `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slides.html`
> **Rendered PNGs:** `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slide-{1..N}.png`
> **Caption:** `<output-dir>/[YYYY-MM-DD]-[kebab-title]-caption.txt`
> **Lead magnet doc:** [`<output-dir>/[YYYY-MM-DD]-[kebab-title]-lead-magnet.md` if LM was built, otherwise omit this line]
> **Topic Name:** [Topic Name]
> **Comment keyword:** `[KEYWORD]`
>
> Review the deck and the supporting materials. Reply **"approved"** to lock in the files, or send revision notes.

Stop. Do not proceed under any circumstance until the user replies.

- **Approval signal:** "approved" / "looks good — proceed" / "ship it"
- **Revision signal:** notes / edits / "make these changes". Edit the affected files (use `Edit` tool, never overwrite the whole file). Re-render any slide whose source HTML changed. Re-request approval. Repeat until approved.
- **Abandonment signal:** "scrap this". Leave the files in place (or move to trash if asked).

---

## Step 12: Final summary

On approval, write a final summary:

> ### Carousel — [Date] — Materials Locked
>
> **Slides HTML:** `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slides.html`
> **Rendered PNGs:** `<output-dir>/[YYYY-MM-DD]-[kebab-title]-slide-{1..N}.png`
> **Caption:** `<output-dir>/[YYYY-MM-DD]-[kebab-title]-caption.txt`
> **Lead magnet doc:** [include this line only when LM was built]
> **Comment keyword:** `[KEYWORD]`
>
> **Next steps (you own these):**
>
> - Post the carousel to TikTok and Instagram (upload the PNGs in order, paste the caption)
> - [If LM] Publish the lead magnet doc to your hosting page and update the `lead magnet destination URL` in `config.md` if needed
> - [If LM] When viewers comment the keyword, DM them the lead magnet hosting URL

---

## What This Skill Does NOT Do

- **Auto-post to TikTok or Instagram.** You post manually.
- **Run the DM automation that sends the lead magnet URL.** That's a separate tool (Tally, ManyChat, your own bot, etc.).
- **Host the lead magnet.** You publish `lead-magnet.md` to your platform of choice (Skool, Notion, Beehiiv, Substack, etc.).
- **Build the resource / Skool post copy.** Not in scope for this skill. Compose the social post yourself when you publish.
- **Generate the email sequence or follow-up flow.** You own the downstream funnel.

---

## Failure Modes to Watch For

| Failure                                           | Cause                                                                          | Fix                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference example cache miss after rename         | The folder name in `reference-examples/` was changed after the cache was built | Either re-derive the cache at the new path, or rename the folder back                                                                                                         |
| Comment keyword collides with a previous carousel | Step 3b spot-check missed it                                                   | Pick a different keyword. Collisions break DM routing                                                                                                                         |
| Em dash sneaks into a rendered slide              | Source HTML had a `—` character or pasted-in text had one                      | Run the em-dash search on the source HTML before render: `grep -E "[—–]" <slides.html>` should return zero matches. Use `-E` not `-P` (BSD grep on macOS lacks `-P`)          |
| Topic Name drift between deck and lead magnet     | Skill named the LM H1 one thing, slide 1 implied another                       | QA gate #8: both must match the canonical Topic Name                                                                                                                          |
| Asset slide repeats content from a prior carousel | Cache check missed it                                                          | Pick a different asset. Recycled value = viewer drop-off                                                                                                                      |
| Headline wraps awkwardly across slides            | Font size or word count off                                                    | Drop font size 10 to 20% or rebreak the line. See the **Carousel Blueprint** section below Section 13.                                                                        |
| Black bar at slide bottom (rendering)             | Body bg doesn't match slide bg in single-render mode                           | Fix the inline `?only=N` script in the slide HTML. The script must set `document.body.style.background` AND `document.documentElement.style.background` to the slide's color. |
| Watermark renders on top of important content     | Slide content reaches the top-left corner                                      | Push content down ~80px to clear the watermark zone, OR set watermark text to blank in `config.md` to disable                                                                 |
| `config.md` missing or incomplete                 | User skipped or partially completed the setup helper prompt                    | Stop and ask the user to run the setup helper prompt before continuing. Do not improvise defaults                                                                             |
| `reference-examples/` is empty                    | First run, no examples added yet                                               | Stop and tell the user to add a reference example following `reference-examples/README.md`. Do not invent a slide pattern from scratch                                        |
| Chrome headless not found                         | Chrome isn't installed or isn't at the standard path                           | Ask the user to install Chrome and / or point the skill at the correct binary path                                                                                            |

---

## Prerequisites

| Tool         | Purpose                                  | Install                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome**   | Headless rendering of HTML slides to PNG | macOS: download from google.com/chrome (standard path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`) · Linux: `apt install google-chrome-stable` or `apt install chromium` · Windows: download from google.com/chrome |
| **Python 3** | Tiny static HTTP server during render    | macOS: pre-installed (verify with `python3 --version`) · Linux: `apt install python3` · Windows: download from python.org                                                                                                               |

### Prerequisite Check

```bash
which python3
python3 --version
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null || which google-chrome || which chromium || echo "chrome not found"
```

If anything is missing, ask the user to install before proceeding.

---

## Config File Reference

The skill reads `config.md` in the skill folder. The setup helper prompt creates this file. If it's missing, the skill stops and tells the user to run the setup helper prompt.

Expected format:

```markdown
# Brand Config

- niche: [user's content niche]
- target viewer: [one-sentence description]
- brand voice: [voice descriptor]
- primary color: [hex value, default #F5F0E8]
- accent color: [hex value, default #D97757]
- display font: [Google Font name, default "Playfair Display"]
- ui font: [Google Font name, default "Inter"]
- mono font: [Google Font name, default "JetBrains Mono"]
- watermark text: [text or blank]
- social handle: [@handle or blank]
- lead magnet destination URL: [URL or "TBD"]
- next step link: [URL — Calendly, signup page, etc.]
- output directory: [absolute path, default ~/carousel-output/]
```

---

## Blueprint Files

QA references in `blueprints/`:

```
blueprints/
├── carousel-blueprint.md       <-- slide structure, palette, typography, layout watch-outs, QA
├── caption-blueprint.md        <-- 90 to 110 word caption format + comment-CTA placement + QA
└── lead-magnet-blueprint.md    <-- 10-section lead magnet structure + lead magnet QA
```

Read these end-to-end on first install. After that, the cached `notes.md` files in `reference-examples/[name]/` are the only references you need to re-read per run.

---

# Setup Helper Prompt

I've just downloaded the `build-carousel` Claude Code skill folder and I want you to help me set it up end-to-end. Walk me through every step. Ask one question at a time when you need an answer from me.

Here's what I want you to do, in order:

## Step 1 — Verify the folder location

Read the `README.md` and `SKILL.md` files inside the `build-carousel` folder so you understand what this skill does and what files belong to it. Then confirm to me:

- Where is the folder currently located on my machine?
- Is that location one of these three places?
    1. `~/.claude/skills/build-carousel/` (user-level skill, available across all projects)
    2. `.claude/skills/build-carousel/` inside my project root (project-level skill)
    3. Anywhere else (in which case it's not yet installed, tell me which of the two locations above I should move it to)

If the folder is not yet in an installable location, ask me which install mode I want and move it there for me.

## Step 2 — Check prerequisites

Run these commands and tell me which ones pass / fail:

```bash
which python3
python3 --version
(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null && echo "Chrome OK") || (command -v google-chrome >/dev/null && echo "Chrome OK ($(command -v google-chrome))") || (command -v chromium >/dev/null && echo "Chrome OK ($(command -v chromium))") || echo "Chrome NOT found at standard locations"
```

A successful Chrome check prints `Chrome OK`. If you see `Chrome NOT found`, install Chrome before proceeding.

For any missing tool, give me the exact install instructions for my platform (macOS / Linux / Windows + WSL) and **wait for me to run it before proceeding**. Do not assume I want you to install anything via Bash without my explicit yes.

Chrome is required for headless slide rendering. Python 3 is required for the tiny static HTTP server used during render.

## Step 3 — Configure my brand

Create a `config.md` file inside the skill folder with my answers. Walk me through the questions in two batches.

### Batch 1 — Content + voice + handles

Ask me **all 7 in one message**, then wait for my answers:

1. **What is my content niche?** (e.g., AI coding tools, real estate investing, fitness coaching, voice agents for local businesses)
2. **Who is my target viewer?** (1 sentence — who am I making these carousels for)
3. **What is my brand voice?** Pick one or describe your own: confident-and-warm, direct-and-punchy, calm-expert, playful-and-irreverent, no-fluff-tactical
4. **Watermark text** for the top-left of every slide. (Optional. Leave blank for no watermark. Example: `YOUR HANDLE` in caps)
5. **Social handle for caption sign-off** (e.g., `@yourname`. Optional. Leave blank to skip the sign-off line)
6. **What is the URL where my lead magnet lives?** (where I'll DM people who comment the keyword. If I don't have one yet, leave blank and we'll fill in `TBD`)
7. **What is my "Next Step" link?** (the soft call-to-action at the bottom of every lead magnet, e.g., a Calendly link, an email signup, a Discord invite, a product page)
8. **Where should the skill save my carousels?** (default: `~/carousel-output/` — I can override)

### Batch 2 — Style: fonts and colors

Ask me ONE question with three options. I pick one:

> **Style preference for fonts and colors? Pick one:**
>
> - **(a) Use the skill's defaults** — warm cream background `#F5F0E8` + coral accent `#D97757`, Playfair Display for headings, Inter for kickers, JetBrains Mono for code.
> - **(b) Provide an example** — paste an image (logo, brand board, a screenshot of a deck or page whose look I like). You'll analyze it and propose 2 hex values + 3 Google Fonts (display, ui, mono) that match.
> - **(c) Describe in plain language** — I'll tell you the vibe (e.g., "navy + gold with modern sans-serif", "pastel pink and mint with a handwritten heading"). You'll propose 2 hex values + 3 Google Fonts to match.

Then:

- **If (a):** use the defaults verbatim. No further questions.
- **If (b):** I paste the image. You analyze it, then show me back: `primary color: #...`, `accent color: #...`, `display font: [Google Font name]`, `ui font: [Google Font name]`, `mono font: [Google Font name]`. Wait for my confirmation, iterate if I push back.
- **If (c):** I describe in plain language. You interpret, then show me back the same 5 values. Wait for confirmation, iterate if I push back.

Once the style values are locked, save my answers to `config.md` in this format:

```markdown
# Brand Config

- niche: [my answer]
- target viewer: [my answer]
- brand voice: [my answer]
- primary color: [hex, default #F5F0E8]
- accent color: [hex, default #D97757]
- display font: [Google Font name, default "Playfair Display"]
- ui font: [Google Font name, default "Inter"]
- mono font: [Google Font name, default "JetBrains Mono"]
- watermark text: [my answer or blank]
- social handle: [my answer or blank]
- lead magnet destination URL: [my answer or "TBD"]
- next step link: [my answer]
- output directory: [my answer or default]
```

After saving, read it back to me so I can confirm it's correct.

## Step 4 — Add my first reference example

The skill needs at least one reference example carousel to model the deck arc, word counts, and italic rhythm after. Walk me through adding one:

1. **Ask me where to get the reference carousel.** Options, in order of reliability:
    - **(Best)** I have the slide images locally (PNG, JPG, screenshots — give you the path to the folder, you read them directly)
    - **(Sometimes works)** I have a TikTok or Instagram carousel URL. Note: TikTok and Instagram block most fetch attempts, so this path often fails silently. If you try and get blocked, fall back to local images.
    - **(Lowest confidence)** I want to describe the carousel pattern in chat without actual images. The breakdown will be flagged as low-confidence in `notes.md`.
    - I want to skip this step and add a reference later

2. **If I provide a reference**, run the analysis pattern (described in the **Carousel Blueprint** section below Section 14):
    - For each slide: record the role (Hook / Promise / Asset / Diagnosis / Mechanism / Proof / Stakes / CTA, or whatever the reference uses)
    - Count words per element (headline, subhead, kicker, code block, footer)
    - Note italic accent word per slide if any
    - Note background color rhythm (cream / coral alternation pattern)
    - Note caption length, comment CTA placement, and lead magnet presence
    - Save the breakdown to `reference-examples/[carousel-name-kebab]/notes.md`

3. **Show me the breakdown** before saving so I can confirm it captures what makes the carousel work.

## Step 5 — Dry run

Without actually building a real carousel, do a **dry-run smoke test**:

1. Pretend the user (me) is invoking `/build-carousel`.
2. Walk through what the Step 0 intake message from the skill would look like (the three-question prompt from `SKILL.md` Step 0). Show the message as the skill would phrase it, populated with my reference example names from `reference-examples/`.
3. Show me what defaults the skill would pull from my `config.md`, and what's still missing.

The point of this dry run is to surface any setup gap before I try a real build.

## Step 6 — Done

Once Steps 1 through 5 pass, give me a 5-bullet recap:

- Skill folder location
- Prerequisites status (Chrome + Python 3)
- Brand config saved at [path]
- Reference examples available: [count + names]
- Ready to invoke `/build-carousel` for real

**IMPORTANT — conditional warning at recap:**

- If `reference-examples/` has at least one subfolder with a `notes.md` inside, tell me: "You're set. Type `/build-carousel` whenever you're ready to make your first carousel."
- If `reference-examples/` is empty (no examples yet), tell me clearly: "**Setup is complete, but `/build-carousel` cannot run yet.** The skill stops at Step 0 intake when no reference examples exist. To unblock, paste this prompt again and complete Step 4, or follow `reference-examples/README.md` to add one manually."

Do not let me leave setup thinking I can invoke the skill if no reference exists. The skill will hard-stop and the failure will feel like a bug rather than the intended gate.

---

# Caption Blueprint

> Defines the format, length, structure, and QA rules for the caption produced by every run of `/build-carousel`.

The caption is the carousel rendered as prose, same voice, same vocabulary, half the words.

---

## 1. Target metrics

- **Length:** 90 to 110 words
- **Reading level:** high school (same bar as the slides)
- **Em dashes:** zero
- **Voice:** matches the deck verbatim where possible

---

## 2. Required structure (in this order)

1. **Hook** — slide 1 + slide 2 combined into one line. Pattern: `[Problem statement]. Here's how to fix it.`
2. **Comment CTA** — immediately after the hook. Pattern: `Comment [WORD] and I'll DM you the [asset].`
3. **Diagnosis** — one sentence echoing the diagnosis slide. Pattern: `[Subject]'s default isn't [virtue], it's [opposing flaw].`
4. **Why it happens** — short paragraph extending the diagnosis. Use the diagnosis slide's subhead's plain-language version where possible.
5. **Setup steps** — the asset slide path or instructions, framed as a one-line action: `Fix it in 30 seconds: [path]. Paste the prompt on slide [N].`
6. **Mechanism** — the mechanism slide in prose. End on the mechanism slide's subhead's punch line ("Same X. Different Y. Every Z changes.")
7. **Save + Follow** _(optional)_ — combined as one closing line when `config.md` has a social handle set. Pattern: `Save this for setup. Follow @[handle] for more.` Skip the follow line entirely when `social handle` in `config.md` is blank.

If the reference example uses a different caption shape, follow it instead. The 7-section structure above is the most common viral carousel caption shape but isn't mandatory.

---

## 3. Comment CTA placement rule

**Comment CTA goes second** (right after the hook), not at the end.

Reasoning:

- TikTok / IG truncate captions at ~125 characters
- Putting the CTA in the truncated zone catches the highest read-rate
- Save + follow at the end is enough; the comment trigger needs to be at the top

---

## 4. Vocabulary inheritance from the deck

The caption inherits the deck's locked vocabulary. If the deck uses the word `yes-man`, the caption uses `yes-man` (not "agreeable" or "people-pleaser"). If the deck italicizes `honest`, the caption uses `honest` in the same sentence position.

This keeps the deck and the caption a single voice. Viewers who only read the caption see the same brand language; viewers who only see the deck recognize the caption phrasing.

---

## 5. Em dash audit

Common places em dashes sneak in, replace them all:

| Sneaky em dash                                           | Fix                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Save this — the prompt is on slide 3`                   | `Save this for setup.` (or split into two sentences)                        |
| `[Subject] is trained to be helpful — and in AI talk...` | Replace with comma: `[Subject] is trained to be helpful, and in AI talk...` |
| `— @handle` (attribution)                                | Just `Follow @handle for more.` no leading dash                             |
| `helpful — but wrong`                                    | Restructure: `helpful, but wrong`                                           |

Run the em-dash audit before declaring the caption done:

```bash
grep -E "[—–]" <caption-file>
# Should return zero matches
```

Use `-E` not `-P`, BSD grep on macOS lacks `-P` and will silently return empty matches even when em dashes exist.

---

## 6. Example caption shape (90 to 110 words)

This is the canonical shape, swap the content for your subject:

```
[Problem statement]. Here's how to fix it.

Comment [KEYWORD] and I'll DM you the [asset name].

[Subject]'s default isn't [virtue], it's [opposing flaw]. [One sentence explaining the consequence in plain English.]

Fix it in 30 seconds: [setup path or instruction summary]. Paste the [asset] on slide [N].

You're not changing the [thing-that-isnt-changing]. You're changing what it's trying to do. [One sentence on the new behavior]. Same [unchanged-thing]. Different [thing-that-changed]. Every [unit] changes.

Save this for setup. Follow @[handle] for more.
```

Word count of the template above (without filler brackets): ~93 words. Stay in the 90 to 110 window — aim for ~100 words as the target middle so revisions in either direction stay within the band.

If `social handle` in `config.md` is blank, drop the final line entirely. The caption can end cleanly on the mechanism punch line.

---

## 7. Caption QA Checklist

Run this before declaring the caption done (Step 10 of `SKILL.md`).

- [ ] Length is 90 to 110 words
- [ ] Comment CTA is on line 2 (right after the hook)
- [ ] Hook combines slide 1 + slide 2 into one sentence
- [ ] Diagnosis line echoes the diagnosis slide's headline
- [ ] Mechanism section ends on the mechanism slide's subhead punch line
- [ ] Save + Follow closing line uses `@[handle]` from `config.md`, OR is dropped entirely when `social handle` is blank
- [ ] Vocabulary inherits from the deck (same italic words, same locked phrases)
- [ ] Reading level is high school across the caption
- [ ] Zero em dashes (`—`) or en dashes (`–`) anywhere
- [ ] `grep -E "[—–]" <caption-file>` returns zero matches (use `-E` not `-P`)

---

# Carousel Blueprint — Slide Structure, Design, Layout

> Defines the slide structure rules, brand constants, design system, and QA checklist for the carousel deck produced by `/build-carousel`.

---

## 1. Reference-Driven Structure

The structure of every new carousel is driven by the reference example picked at intake. Match the reference's slide count, beat sequence, italic word usage, text-on-screen overlays, and word counts per element. The new carousel is an **alternate version** of the reference: same effect, same value delivered to the viewer, different subject + content.

**What does NOT vary across carousels (brand constants):**

- Color palette — read from `config.md` (primary + accent). Defaults are a warm cream + coral.
- Output dimensions — 1080 x 1350 px.
- Watermark positioning when watermark is present — top-left.
- Em dash ban — no `—` anywhere in deck text or caption.
- High-school reading level.

**What CAN vary per reference example:**

- Slide count (8, 10, 12, or whatever count the reference uses)
- Beat sequence / narrative arc
- Italic word usage (some references use one per slide, some skip italics entirely)
- Primary/accent alternation pattern (strict alternation, grouped, or no pattern at all)
- Word counts per slide element
- Text-on-screen overlays
- Typography (default = the stack in Section 3; per-reference override possible via the reference's `notes.md`)

The reference example's `notes.md` is the source of truth for everything that varies. Read it, match it. Don't impose one reference's arc on a different reference.

### The canonical 8-slide arc (when the reference uses it)

When the reference example follows the most common viral carousel shape, the 8 slides typically play these roles:

| #   | Background | Role          | What it does                                                                                           | Italic word                                          |
| --- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | primary    | **Hook**      | Single-statement provocation. Names the problem in plain language.                                     | The defining word of the deck (the "wrong" behavior) |
| 2   | accent     | **Promise**   | "Here's how to _fix_ it." + setup steps in a code box                                                  | `fix` (or equivalent verb)                           |
| 3   | primary    | **The Asset** | The actual deliverable in a mono code block. Kicker reads `COPY THIS. PASTE IT. SAVE.`                 | (no italic; kicker carries it)                       |
| 4   | primary    | **Diagnosis** | "X isn't the same as _Y_." Subhead with accent side bar explains the underlying cause                  | The opposing virtue (the "right" behavior)           |
| 5   | accent     | **Mechanism** | "You're not changing the _X_." Explains what's actually changing                                       | The thing that _isn't_ changing                      |
| 6   | primary    | **Proof**     | Kicker `SAME QUESTION. DIFFERENT ANSWER.` + headline + before/after dialogue in a mono block           | Domain-specific (e.g., the changed-output word)      |
| 7   | accent     | **Stakes**    | Faded oversized watermark of the "wrong" word + headline + subhead. The "this matters because..." beat | The shaper word                                      |
| 8   | primary    | **CTA**       | Pull quote -> attribution line -> tagline -> accent CTA box with the trigger word                      | A short phrase, not single word                      |

When your chosen reference follows a different arc, follow whatever its `notes.md` describes.

---

## 2. Color system

Read from `config.md`:

```css
--primary: #f5f0e8; /* default: warm cream — light slides */
--primary-light: #faf9f5; /* derived: cream text on accent slides */
--primary-faint: #ede7dd; /* derived: code block tints */
--accent: #d97757; /* default: warm coral — accent slides + emphasis */
--accent-deep: #bf5c3f; /* derived: code block text on primary */
--accent-soft: #e8a88c; /* derived: italic on accent, subhead bars */
--text: #1f1f1e; /* primary text on primary slides */
--text-muted: #6b6862; /* subhead text on primary slides */
--text-faint: #b5afa4; /* attribution / labels */
```

When `config.md` overrides primary or accent, derive the `-light`, `-faint`, `-deep`, `-soft` shades automatically (the slide template handles this with CSS color-mix or pre-computed offsets).

- Italic on primary slide → accent
- Italic on accent slide → lighter primary (slightly transparent)
- Code block on primary → tinted primary with accent side bar
- Code block on accent → translucent white

---

## 3. Typography

The font stack is configurable per user. `config.md` declares three fonts that flow into the slide template via CSS custom properties:

- `display font` — used for headlines, subheads, and italic accent words. Default: Playfair Display.
- `ui font` — used for kickers, labels, and watermarks (all caps, tracked-out). Default: Inter.
- `mono font` — used for code blocks. Default: JetBrains Mono.

When the user provides an example image or plain-language description during setup, the skill proposes Google Font names for these three slots and saves them to `config.md`. On every build, the skill rewrites the Google Fonts `<link>` import tag (marked with `<!-- BUILD: GOOGLE_FONTS_IMPORT -->`) and overwrites `--font-display`, `--font-ui`, `--font-mono` in the template's `:root` block so the chosen fonts actually load.

### Default weight + line-height map (apply regardless of which fonts are picked)

| Use                         | Font slot      | Weight              | Notes                                   |
| --------------------------- | -------------- | ------------------- | --------------------------------------- |
| Display headlines           | `display font` | 700 (or 900 italic) | High-contrast preferred                 |
| Italic accent word          | `display font` | 700 italic          | Same family, italic style               |
| Kickers / labels (all caps) | `ui font`      | 600                 | Tracked-out 0.18em letter-spacing       |
| Body / subhead              | `display font` | 400                 | Lighter weight, line-height 1.45 to 1.5 |
| Code blocks                 | `mono font`    | 400                 | Line-height 1.55                        |
| Watermarks                  | `ui font`      | 500                 | Tracked-out 0.32em letter-spacing       |

All fonts must be available on Google Fonts (the slide template imports via `<link>`).

---

## 4. Slide dimensions and layout

- **Canvas:** 1080 x 1350 px (Instagram and TikTok carousel native size)
- **Edge padding:** 90px left/right, 70px top, 90px bottom
- **Watermark top-left:** absolute, top: 70px, left: 90px (when watermark text is set in `config.md`)
- **No bottom-right tag.** This is non-negotiable — clean edge-to-edge.

---

## 5. Italic word rules (when the reference uses italic accents)

If the chosen reference example uses italic accent words on its slides:

- Match the reference's per-slide italic pattern (where the reference has one, the new deck has one)
- Italic word should be the deck's **defining vocabulary** — the thing the deck is _about_
- Build a vocabulary chain across the deck
- Don't italicize purely for stylistic emphasis — italic = the deck's about-ness word, not a typography decoration

If the chosen reference does NOT use italic accent words, skip this entirely. Plain serif throughout.

### Example italic chain pattern

A deck about "the difference between agreement and honesty" might have an italic chain that goes:

`yes-man -> fix -> (none) -> honest -> model -> practice -> tone -> "Make it ask:"`

Each word advances the argument. The chain reads as a mini-summary of the deck.

---

## 6. Watermarks

- **Top-left, every slide:** the watermark text from `config.md` in Inter 500, 20px, letter-spacing 0.32em, opacity 0.32 on primary / 0.42 on accent
- **When `config.md` watermark text is blank:** skip the watermark entirely on every slide
- **No bottom-right handle/tag.** Clean edge.
- **Stakes-slide oversized watermark** (optional, when the reference uses one): the deck's "wrong" word (or its echo) repeated and clipped, ~200px Playfair Display 700, opacity 0.16, positioned across the top of the slide

---

## 7. Code block treatment

### Asset slide (the slide carrying the deliverable)

```
- Background: tinted primary (e.g. mix of primary and accent)
- Left border: 6px solid accent
- Padding: 56px 70px
- Font: JetBrains Mono 36px for 1 to 2 line assets; drop to 28-32px for 3 to 5+ line stacks
- Color: accent-deep
- Line-height: 1.55
```

Most multi-line asset content (a 5-step stack, a 4-line checklist, a paragraph-length prompt) needs 28-32px to fit cleanly in 1080x1350. Test the actual render and adjust.

### Proof slide (before/after, when the reference uses one)

```
- Background: tinted primary
- Padding: 56px 60px
- Two rows: "before" and "after"
- "before" label: muted gray, "after" label: accent 500-weight
- "before" quote: text-muted, "after" quote: accent-deep, 500-weight
```

### Promise slide (settings path, when the reference uses one)

```
- Background: translucent white over the accent slide
- Padding: 32px 40px
- Font: JetBrains Mono 28px
- Color: primary-light
- Use -> arrows for navigation paths (NEVER em dashes)
```

---

## 8. Word count rules

**Word counts are derived from the reference example provided at intake, not from a fixed table.** Match the reference within +/-1 per element.

### Step 1 — Measure the provided reference

For every slide of the reference carousel, count words for each on-slide element (headline, subhead, kicker, code block, footer). Log the result in `notes.md` before drafting copy. Italic glyphs count as one word; numerals (`1.`, `50`) count as one word; arrow tokens in code paths (`→`) don't count.

### Step 2 — Match the reference's slide count + sequence

The new deck has the **same slide count and beat sequence as the reference**. For each slide of the new deck, use the analogous reference slide's word counts as the target.

### Step 3 — Apply +/-1 tolerance

If the reference's slide 1 headline has 5 words, the new deck's slide 1 headline must have 4 to 6 words. Same +/-1 tolerance per element across the deck.

**Exception for path-like or list-like elements** (settings paths with arrow tokens, navigation step lists, file paths): shorter than the reference is fine; longer should still respect +1. Padding a 6-word path to hit an 8-word reference target produces awkward output. Treat +/-1 as the upper bound, with "shorter is allowed when it reads naturally."

### Caption length is platform-driven, not example-driven

Caption target stays at 90 to 110 words regardless of reference length. See `caption-blueprint.md` for the reasoning (TikTok / IG truncation at ~125 characters, comment CTA placement).

---

## 9. Language rules — high-school readable

The deck reads at a high-school level. **Banned words and phrases:**

| Banned                                              | Use instead                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| optimizing for                                      | trying to do                                                                       |
| validates / smooths over gaps / confirms your frame | agrees with bad ideas / skips the holes / tells you you're right when you're wrong |
| compound (verb)                                     | help forever / stack / add up                                                      |
| frame / framing                                     | goal / what it's going for                                                         |
| pleasant                                            | nice                                                                               |
| rigorous, agreeable                                 | (use plain swaps that match the actual behavior)                                   |
| Train it to ask                                     | Make it ask                                                                        |

If a word feels like it would be on a SaaS landing page or in an AI tool's marketing copy, replace it with what a 16-year-old would actually say.

---

## 10. Em dash rule

**No em dashes (`—`) or en dashes (`–`) anywhere.** In the deck source HTML, the deck rendered text, or the caption.

Replacements:

- Em dash for a pause → comma
- Em dash for a break → period (split into two sentences)
- Em dash for an aside → restructure or use parentheses
- Em dash in attribution (like `— @handle`) → small horizontal bar div instead, OR drop the dash entirely

This includes any before/after quotes and any attribution lines.

---

## 11. Asset rules

- The asset is on the slide the reference uses for its asset (commonly slide 3, but the reference's `notes.md` decides). The asset is **never gated.**
- Same word count as the reference's asset slide, or shorter.
- 10x sharper than the reference, that's the value proposition vs. just copying.
- The lead magnet (DM trigger) is the _same content_, delivered as plain text via DM. The value is copy-paste convenience for mobile users, not new content.
- This is the rule that protects the deck's value, viewers who don't comment still get the goods. Comments are for follow-up + algorithm signal, not access.

---

## 12. CTA word rules

- **Single word.** Easy to type on mobile. No special characters.
- **Behavior word** that names what the asset _does_, not the persona it adopts. (Example: `MENTOR` is the obvious choice for a coaching prompt, but if the prompt is a flaw-finder, the right word is `REAL` or `HONEST`. Match what the asset DOES.)
- **Brandable as a series**, should work as the comment trigger across future drops, building viewer recognition.
- Appears on the CTA slide (commonly slide 8) in an accent-colored box, and as line 2 of the caption.

---

## 13. Layout watch-outs

These come up in nearly every render pass. Bake them into every audit.

1. **Headline wrap to extra line** → reduce font size 10 to 20%
2. **Tight fits** → add `letter-spacing: -0.02em`
3. **Headline / subhead overlap** → 3-line headlines need >=80px clearance above the subhead
4. **Orphan articles** at line ends ("a", "the" alone) → restructure the line break
5. **Black bar at bottom of rendered PNG** → body bg isn't matching slide bg in single-render mode. The inline `?only=N` script must set `document.body.style.background` AND `document.documentElement.style.background` to the slide's color.
6. **3-line headlines on accent slides** are okay (slide 5 commonly uses this), just guarantee subhead clearance
7. **Italic word kerning** → italic glyphs are wider; lines that fit at regular weight may overflow with italics. Test the actual rendered output, don't trust the source.
8. **Watermark overlap** → if slide content reaches the top-left corner, either push content down ~80px or set watermark text to blank in `config.md` for that build

---

## 14. Adding a new reference example (the analysis pattern)

When the user wants to add a new reference example to `reference-examples/`:

1. Create `reference-examples/[carousel-name-kebab]/` (descriptive subfolder name, kebab-cased recommended).
2. Drop the source slides into the folder (PNGs, screenshots of each slide, or a single source file).
3. Analyze each slide and derive `notes.md` with:
    - Slide count and arc / beat sequence
    - Per-slide role (Hook / Promise / Asset / etc.)
    - Background color pattern (e.g., "1,3,4,6,8 primary; 2,5,7 accent")
    - Italic word per slide (or "no italics")
    - Word counts per element per slide
    - Caption length and comment CTA placement
    - Lead magnet status (yes/no and topic if yes)
    - Banned-language audit (list of words from Section 9 that DO appear in the reference, since you may want to keep some that are domain-appropriate)
4. Confirm the analysis with the user before locking the cache.

### `notes.md` required sections (in this order)

```markdown
# [Reference Carousel Name]

## Subject

[One paragraph: what is this carousel about?]

## Files in this folder

- [List the source files dropped in: slide PNGs, screenshots, etc.]

## Slide arc

| #   | Background | Role    | Words / Element                    | Italic            |
| --- | ---------- | ------- | ---------------------------------- | ----------------- |
| 1   | primary    | Hook    | Headline: 5                        | the-defining-word |
| 2   | accent     | Promise | Headline: 5, Subhead: 14, Code: ~8 | fix               |
| ... | ...        | ...     | ...                                | ...               |

## Italic word chain

`word-1 -> word-2 -> ... -> word-N`
(or: "no italics used")

## Caption shape

- Length: ~93 words
- Comment CTA placement: line 2 (after hook)
- Save / follow placement: closing line

## Lead magnet status

- Yes / no
- If yes: topic = [Topic Name]

## What makes this work

[2 to 3 sentences naming the single most replicable pattern from this carousel.]
```

Existing reference examples stay untouched. The new one is queryable on the next `/build-carousel` run.

---

## 15. Carousel QA Checklist

Run this before delivery to the user (Step 10 of `SKILL.md`).

### Structure

- [ ] Slide count matches the chosen reference
- [ ] Beat sequence (Hook -> Promise -> Asset -> ...) matches the reference
- [ ] Background color pattern matches the reference
- [ ] Asset slide carries the actual deliverable (not a teaser)

### Word counts

- [ ] Every element is within +/-1 of the reference's analogous slide
- [ ] Word counts logged in the reference's `notes.md` were used as the target

### Italics

- [ ] If the reference uses italics, the new deck has italics on the same slides
- [ ] Italic words form a chain (each word advances the argument)
- [ ] Italic word colors meet the contrast rule (accent on primary, lighter primary on accent)

### Watermark

- [ ] Watermark text from `config.md` renders top-left (or, when blank in config, no watermark renders)
- [ ] No bottom-right tag

### Language

- [ ] Banned words from Section 9 are absent OR replaced with the high-school equivalent
- [ ] Reading level is high-school across every slide
- [ ] Every technical term has a plain-English translation on first use OR is dropped

### Em dashes

- [ ] Zero `—` or `–` characters in the source HTML
- [ ] Zero `—` or `–` characters appear in rendered slides
- [ ] Run `grep -E "[—–]" <slides.html>` — should return zero matches. Use `-E` not `-P` (BSD grep on macOS lacks `-P`).

### Asset

- [ ] Same word count as the reference's asset slide, or shorter
- [ ] Plain English, no jargon
- [ ] Self-contained (works without context from other slides)
- [ ] Different from any prior carousel's asset

### CTA word

- [ ] Single word, all caps, 4 to 10 chars
- [ ] Behavior word, names what the asset DOES (not the persona it adopts)
- [ ] Different from any prior carousel's CTA keyword

### Render

- [ ] All slides rendered at 1080 x 1350 px exactly
- [ ] No black bar at bottom of any PNG (body bg matches slide bg)
- [ ] No headline wrap orphans or text overlap
- [ ] Italic glyphs don't overflow their containers

### Cross-artifact consistency

- [ ] Topic Name appears in slide 1 (hook) and slide N (CTA) implicitly
- [ ] When lead magnet attached: Topic Name also appears verbatim as the lead magnet H1
- [ ] Caption inherits the deck's locked vocabulary (italic words from the deck appear in the caption in the same sentence positions where possible)

---

# Lead Magnet Blueprint

> Defines the structure, content rules, and QA checklist for the lead magnet doc produced by Step 9 of `/build-carousel` (only when the user attached a lead magnet at intake).

---

## 1. What This Covers

When the user said "yes" to the lead magnet question at intake (Step 0 question 3), the skill builds:

| #   | Deliverable         | What It Is                                                                                                  | Where It Lives                                           |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | **Lead magnet doc** | The high-school-reading-level template the lead opens after they comment the keyword. 10 required sections. | `<output-dir>/[YYYY-MM-DD]-[kebab-title]-lead-magnet.md` |

When the user said "no", this entire blueprint is skipped, the skill produces only the slide deck and caption.

---

## 2. Funnel Position

```
carousel posted on TikTok / Instagram
  -> viewer comments the keyword
    -> you (or your DM tool) DM the lead magnet destination URL
      -> lead opens the lead magnet doc (`lead-magnet.md` hosted on your platform of choice)
        -> lead reads + applies the template
          -> conversion (book a call, sign up, buy, your downstream funnel)
```

This skill builds the lead magnet content. You host it (Skool, Notion, Beehiiv, Substack, your own site, etc.) and you handle the DM workflow.

The `[lead magnet destination URL]` set in `config.md` is the URL you DM to commenters. It points to the page where you publish the lead magnet doc.

---

## 3. Lead Magnet Doc — 10 Required Sections

Every lead magnet doc has these 10 sections in this order.

### Section 1 — Title

The **Topic Name** chosen in Step 3d, verbatim, no suffix.

- Same exact string as appears implicitly in the carousel deck (slide 1 hook + final CTA slide).
- Do NOT include the word "lead magnet" anywhere.
- Do NOT prefix with "Lead Magnet —", "Template —", or similar.
- Do NOT suffix with date, keyword, or version number.
- If your Topic Name is naturally branded with "Kit", "Stack", "OS", etc., those are fine, just keep it consistent.

### Section 2 — What This Is

2 to 3 sentences. Answer:

- What does the template do?
- Who is it for?
- What does the reader end up with?

Plain English. No jargon. No "this powerful framework". Just a clear description.

### Section 3 — What You'll Need

Tools, accounts, rough time commitment. Format as a table or bulleted list.

- Every paid tool flagged with price (`$20/month`, `$50 one-time`)
- Free tools marked free
- Skills / prerequisites named (e.g. "basic familiarity with [tool]")
- Time estimate (`~30 minutes one-time setup`, `~5 minutes per use`)

If a paid tool can be substituted with a free alternative, name the alternative.

### Section 4 — The Story (Short Recap)

3 to 5 sentences recapping the case study / use case that the carousel told. Anchors the template to the story the viewer just swiped through.

- Same protagonist or subject as in the deck
- Same wow number / outcome as in the deck's hook (if any)
- Same turning point or insight
- Brief, this is a recap, not a re-tell. The viewer already saw the deck.

If there's no validated case study, recap the framing instead: "Here's what this would look like for someone in [situation]..."

### Section 5 — The Template Itself

The actual reusable asset. This is the core of the lead magnet. NEVER freestyle this, it's always the specific concrete thing that the carousel promised on the asset slide.

The lead magnet is the **same content** as the carousel's asset slide, delivered copy-paste-friendly, with any expanded usage notes that wouldn't fit on the slide.

Pick the shape that matches what was packaged:

| Shape                 | Content                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Prompt**            | The full prompt text in a code block. Include `[BRACKETS]` for fields the user customizes.                   |
| **Workflow**          | Numbered steps. Each step says exactly what to click / type / paste. Screenshots optional but helpful.       |
| **Config**            | The config file with inline comments explaining each field.                                                  |
| **Checklist**         | The full checklist with a 1-line "why" for each item.                                                        |
| **Stack walkthrough** | A multi-tool stack: list every tool, what role each plays, how they wire together, with diagrams if helpful. |

Use `[BRACKETS]` for fields the user fills in. Replace generic advice with concrete defaults wherever possible.

### Section 6 — How to Use It

Step-by-step walk-through of applying the template. Numbered. Each step <=2 sentences. The reader should be able to follow this on first read without prior context.

Example:

```markdown
1. Open the prompt in Section 5 and replace every `[BRACKET]` with your specific info.
2. Paste the filled-in prompt into Claude (or your AI tool of choice). The output should match the example below.
3. Copy the output and paste it into [destination tool].
4. Run a test with one sample input. Confirm it produces the expected result.
5. If the test passes, you're ready to use it for real.
```

### Section 7 — Common Mistakes

3 to 5 failure modes with the fix for each. Plain language.

Example:

```markdown
- **The output is too generic.** Fix: replace the placeholder `[CONTEXT]` with 3+ sentences of specific context, not just keywords.
- **The tool says it can't find the file.** Fix: check the file path. Most often the file is in a subfolder, not the root.
- **You get rate-limited on the third call.** Fix: add a 2-second delay between calls, or upgrade to the paid tier.
```

### Section 8 — What "Done" Looks Like

Describe the end state concretely so the reader knows they succeeded.

- What does success look like? (a working asset, a sent email, a deployed page, etc.)
- How do they verify it's working?
- What's the first sign of failure?

### Section 9 — Next Step

Soft offer with a hyperlinked URL pointing to the user's `[next step link]` from `config.md`.

- Keep it gentle: 1 to 2 sentences max.
- Soft framing: "If you want help getting this built..." / "If this looks like something you'd want help with..." not "You need this."
- The URL is a clickable hyperlink (blue + underlined in the rendered version), not plain text.
- This is the highest-leverage line in the doc. Don't waste it on a hard sell.

Example:

```markdown
## Next Step

If you want help getting this set up in your business, book a free 15-minute call with us [here](https://your-next-step-url.com).
```

### Section 10 — Credits / Source

Link to the original case study / use case source (if external). External link only.

- Do NOT cite this skill.
- Do NOT cite blueprints, knowledge bases, or internal references.
- Do NOT link to the carousel that promoted this lead magnet.
- Include the key numbers from the case study (the wow number from the deck's hook, the timeline, any verified metric).

If the source is your own internal experience (no external case study), this section can be:

```markdown
## Credits

Based on internal work with [type of client] from [month/year]. Specific metrics are private but the pattern is the same.
```

---

## 4. Reading Level (MANDATORY)

Write the entire lead magnet at a **high-school reading level**:

- Short sentences. Plain words.
- No jargon without a 1-line plain-English explanation right after.
- Prefer "the tool that sends the message" over "the webhook dispatcher".
- Use concrete examples over abstractions.
- If a step has a technical name, lead with what it _does_ first, then the name in parens.
- No insider acronyms (SaaS, GTM, MRR, CAC, LTV, ICP, CRM, API) without translation.

**Target:** a motivated high-schooler could follow this and actually build the thing.

**Test:** read the doc out loud as if to a high-school junior. Anything they'd need explained, simplify.

---

## 5. Em-Dash Rule (MANDATORY)

Zero em dashes (`—`) and zero en dashes (`–`) in the lead magnet doc. Same rule as the deck and the caption.

- Default replacement: swap `—` for `, ` (comma + space).
- For title-style separators, use a colon.
- Run `grep -E "[—–]" lead-magnet.md`, should return zero matches. Use `-E` not `-P` (BSD grep on macOS lacks `-P`).

---

## 6. Placeholder Hyperlinks (when config has TBD URLs)

If `config.md` has `lead magnet destination URL: TBD`, the lead magnet doc itself is fine to ship as-is, the URL doesn't appear inside the doc. The TBD only matters if you reference the hosting page from within the doc body (which we don't by default).

If `next step link` in `config.md` is `TBD` or blank, use the literal placeholder string `<TO BE FILLED>` in the Section 9 hyperlink target so it's easy to grep later when you've decided on the URL.

Example:

```markdown
## Next Step

If you want help getting this set up, book a free call with us [here](<TO BE FILLED>).
```

After you publish and pick a real URL, paste it to the skill and it'll patch every `<TO BE FILLED>` placeholder in this lead magnet (or any other lead magnet that references the same TBD value).

---

## 7. Lead Magnet QA Checklist

Run this before declaring the lead magnet done (Step 10 of `SKILL.md`, when LM is built).

- [ ] All 10 required sections present, in order
- [ ] **Title is the Topic Name verbatim**, no prefix, no suffix
- [ ] **Phrase "lead magnet" appears nowhere** in the filename or body
- [ ] Reading level is high-school (no unexplained jargon)
- [ ] Every technical term has a plain-English translation on first use OR is dropped
- [ ] **Template itself is the actual reusable asset** (not a description of one)
- [ ] Template content matches the carousel's asset slide (same content, expanded usage notes okay)
- [ ] Walk-through steps in Section 6 are numbered and <=2 sentences each
- [ ] Section 7 (Common Mistakes) has at least 3 entries with fixes
- [ ] Section 8 ("Done" Looks Like) describes the end state concretely
- [ ] Section 9 (Next Step) is a soft offer, not a hard sell
- [ ] **Section 9 Next Step link matches `[next step link]` from `config.md`** and is a clickable hyperlink (or uses `<TO BE FILLED>` placeholder when the config value is `TBD`)
- [ ] Section 10 (Credits) contains ONLY the external source link + key numbers (no internal references, no carousel link, no skill citation)
- [ ] Content matches the carousel, same story recap, same template the carousel promised
- [ ] Zero em dashes (`—`) or en dashes (`–`) anywhere

---

[HOOK: slide 1 + slide 2 combined into one line. Pattern: "[Problem statement]. Here's how to fix it."]

Comment [KEYWORD] and I'll DM you the [asset name].

[DIAGNOSIS: one sentence echoing the diagnosis slide. Pattern: "[Subject]'s default isn't [virtue], it's [opposing flaw]."] [WHY IT HAPPENS: one or two sentences extending the diagnosis in plain English.]

Fix it in 30 seconds: [setup path or instruction summary]. Paste the [asset] on slide [N].

You're not changing the [thing-that-isnt-changing]. You're changing what it's trying to do. [One sentence on the new behavior.] Same [unchanged-thing]. Different [thing-that-changed]. Every [unit] changes.

Save this for setup. Follow @[handle] for more.

---

# [Topic Name]

> Filename of this doc when published = `[Topic Name]` (kebab-cased, no suffix, no prefix, no "Lead Magnet" anywhere). The H1 above is the same string in title case.

---

## What This Is

[2 to 3 sentences. What does the template do? Who is it for? What does the reader end up with? Plain English, no jargon.]

---

## What You'll Need

| Item     | Purpose                  | Cost                               |
| -------- | ------------------------ | ---------------------------------- |
| [Tool 1] | [What it does in 1 line] | [Free / $X/mo / $X one-time]       |
| [Tool 2] | [What it does]           | [Cost]                             |
| [Tool 3] | [What it does]           | [Cost]                             |
| Time     | One-time setup + per-use | [~X min one-time / ~Y min per use] |

[Optional: list any required skills or prerequisites here. E.g., "basic familiarity with [tool category]" or "you've used [adjacent tool] before."]

---

## The Story

[3 to 5 sentences recapping the case study or use case the carousel told. Anchors this template to the story the viewer just swiped through.]

- **Subject or Protagonist:** [Same as in the deck]
- **Starting point:** [What they were dealing with]
- **The turning point:** [The move they made or the insight that landed]

[If no validated case study, frame as: "Here's what this would look like for someone in [situation]..."]

---

## The Template Itself

[The actual reusable asset. Same content as the carousel's asset slide, expanded with any usage notes that wouldn't fit on the slide. Pick ONE shape based on what was packaged:]

### If it's a prompt:

```
[Full prompt text in a code block.]
[Use [BRACKETS] for fields the user fills in.]
[Be specific, "Use voice 11labs-Marissa" is better than "pick a warm voice".]
```

### If it's a workflow:

1. [Step 1: what to click / type / paste. Be specific.]
2. [Step 2: same level of specificity.]
3. [Step 3...]
4. [...]

### If it's a config:

```yaml
# [Field name]: [what this field controls]
field_one: [default value]

# [Field name]: [what this field controls]
field_two: [default value]
```

### If it's a checklist:

- [ ] [Item 1], [1-line why this matters]
- [ ] [Item 2], [1-line why]
- [ ] [Item 3], [1-line why]

### If it's a stack walkthrough (multi-tool):

| Tool     | Role in the stack | What it connects to |
| -------- | ----------------- | ------------------- |
| [Tool A] | [What it does]    | [Tool B]            |
| [Tool B] | [What it does]    | [Tool C]            |
| [Tool C] | [What it does]    | [Output]            |

[Diagram or wiring description if helpful.]

---

## How to Use It

1. [First step, <=2 sentences. What to do first. Be concrete.]
2. [Second step, <=2 sentences.]
3. [Third step, <=2 sentences.]
4. [Fourth step, <=2 sentences.]
5. [Fifth step, <=2 sentences.]

[Continue numbering until the reader has a working asset. Each step <=2 sentences. No "best practices" interlude, just the steps.]

---

## Common Mistakes

- **[Mistake 1, short, specific]** Fix: [The actual fix in 1 line.]
- **[Mistake 2]** Fix: [The fix.]
- **[Mistake 3]** Fix: [The fix.]
- **[Mistake 4, optional]** Fix: [The fix.]
- **[Mistake 5, optional]** Fix: [The fix.]

[Minimum 3. The more failure modes you document, the more leads will actually succeed.]

---

## What "Done" Looks Like

[Describe the end state concretely. The reader should be able to tell from your description whether they succeeded.]

- **Success looks like:** [What working looks like, a deployed page, a sent email, a working bot, etc.]
- **How to verify:** [The check the reader runs to confirm it's working.]
- **First sign of failure:** [What goes wrong first when something is off.]

---

## Next Step

If you want help getting this set up for your business, [book a free call](YOUR-NEXT-STEP-URL).

[Replace `YOUR-NEXT-STEP-URL` with the value of `[next step link]` from `config.md`. If that value is `TBD` or blank, use the literal placeholder `<TO BE FILLED>` so it's easy to grep later. The hyperlink text should be soft, "book a free call", "see if this fits", "talk to us", not hard sell. 1 to 2 sentences max for the whole section.]

---

## Credits

- **Source:** [Link to the original case study / use case, if external. External-only link.]
- **Key numbers cited:** [Same as the carousel's hook + proof slides if any, keep the numbers consistent across all artifacts.]

[Do NOT cite this skill. Do NOT cite blueprints. Do NOT link to the carousel. Credits is for the external source only.]

---

# Template: Slide (HTML)

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<title>[CAROUSEL TITLE]</title>
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<!-- BUILD: GOOGLE_FONTS_IMPORT
     The skill rewrites this <link> tag when building slides.html from this template,
     based on the display/ui/mono fonts in config.md. If you're hand-editing this file
     to use different fonts, rewrite the href below with the matching Google Fonts URL. -->
		<link
			href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700;1,900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
			rel="stylesheet"
		/>
		<!-- END: GOOGLE_FONTS_IMPORT -->
		<style>
			:root {
				/* Brand palette + fonts. When the skill builds your slides.html from this template,
       it reads config.md and overwrites --primary, --accent, and the three --font-*
       variables. If you're hand-editing this file, replace the values below with your
       config.md palette and Google Font names before rendering. The shade variables
       (light/faint/deep/soft) are derived, adjust if your custom palette needs different
       contrast. */
				--primary: #f5f0e8;
				--primary-light: #faf9f5;
				--primary-faint: #ede7dd;
				--accent: #d97757;
				--accent-deep: #bf5c3f;
				--accent-soft: #e8a88c;
				--text: #1f1f1e;
				--text-muted: #6b6862;
				--text-faint: #b5afa4;

				--font-display: 'Playfair Display', serif;
				--font-ui: 'Inter', sans-serif;
				--font-mono: 'JetBrains Mono', monospace;
			}

			* {
				box-sizing: border-box;
				margin: 0;
				padding: 0;
			}

			html,
			body {
				background: #1a1a1a;
				font-family: var(--font-display);
			}

			body {
				padding: 40px 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 40px;
			}

			.slide {
				width: 1080px;
				height: 1350px;
				position: relative;
				overflow: hidden;
			}

			.slide.primary {
				background: var(--primary);
				color: var(--text);
			}
			.slide.accent {
				background: var(--accent);
				color: var(--primary-light);
			}

			/* Top-left watermark, rendered only when watermark text is non-empty.
     Replace [WATERMARK TEXT] with the value from config.md, or delete this
     element entirely on every slide when watermark text is blank. */
			.wm-top {
				position: absolute;
				top: 70px;
				left: 90px;
				font-family: var(--font-ui);
				font-size: 20px;
				font-weight: 500;
				letter-spacing: 0.32em;
				color: var(--text);
				opacity: 0.32;
			}
			.slide.accent .wm-top {
				color: var(--primary-light);
				opacity: 0.42;
			}

			/* Typography helpers */
			.serif-display {
				font-family: var(--font-display);
				font-weight: 700;
				line-height: 1.05;
				letter-spacing: -0.01em;
			}
			.italic-accent {
				font-style: italic;
				color: var(--accent);
				font-weight: 700;
			}
			.italic-primary {
				font-style: italic;
				color: var(--primary-light);
				opacity: 0.78;
				font-weight: 700;
			}
			.italic-accent-soft {
				font-style: italic;
				color: var(--accent-soft);
				font-weight: 700;
			}

			.kicker {
				font-family: var(--font-ui);
				font-size: 28px;
				font-weight: 600;
				letter-spacing: 0.18em;
				color: var(--accent);
				text-transform: uppercase;
			}

			.body-sub {
				font-family: var(--font-display);
				font-weight: 400;
				font-size: 32px;
				line-height: 1.45;
				color: var(--text-muted);
			}
			.slide.accent .body-sub {
				color: var(--primary-light);
				opacity: 0.82;
			}

			.mono {
				font-family: var(--font-mono);
			}

			/* Code block on primary slide (asset slide pattern) */
			.codebox-primary {
				background: var(--primary-faint);
				border-left: 6px solid var(--accent);
				padding: 56px 70px;
				font-family: var(--font-mono);
				font-size: 36px;
				line-height: 1.55;
				color: var(--accent-deep);
			}

			/* Code block on accent slide (settings path pattern) */
			.codebox-accent {
				background: rgba(255, 255, 255, 0.12);
				padding: 32px 40px;
				font-family: var(--font-mono);
				font-size: 28px;
				color: var(--primary-light);
				line-height: 1.6;
				border-radius: 4px;
			}

			/* Headline base */
			.headline {
				position: absolute;
				left: 0;
				right: 0;
				text-align: center;
				padding: 0 90px;
				font-family: var(--font-display);
				font-weight: 700;
				line-height: 1.1;
			}

			/* Per-slide positioning. Adjust top / bottom values per the reference
     example you're matching. The classes below are starting points. */
			.pos-hook {
				top: 620px;
				font-size: 124px;
			}
			.pos-promise {
				bottom: 380px;
				font-size: 132px;
				line-height: 1;
			}
			.pos-stat {
				top: 480px;
				font-size: 96px;
			}
			.pos-stakes {
				top: 540px;
				font-size: 92px;
				letter-spacing: -0.02em;
			}

			/* CTA box pattern (final slide) */
			.cta-box {
				background: var(--accent);
				color: var(--primary-light);
				padding: 40px 60px;
				font-family: var(--font-display);
				font-size: 56px;
				font-weight: 700;
				text-align: center;
			}
			.cta-box .keyword {
				background: rgba(255, 255, 255, 0.16);
				padding: 4px 18px;
				border-radius: 4px;
			}
		</style>
	</head>
	<body>
		<!-- ============================================================
     SLIDE 1: HOOK (primary background)
     Reference role: name the problem in plain language
     Word budget: match reference's slide 1 headline within +/-1
     ============================================================ -->
		<section class="slide primary" data-slide="1">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div class="headline pos-hook serif-display">
				[HOOK HEADLINE: 5 words example, "Your [thing] is a
				[problem-word]"]
			</div>
		</section>

		<!-- ============================================================
     SLIDE 2: PROMISE (accent background)
     Reference role: here's how to fix it + setup path
     ============================================================ -->
		<section class="slide accent" data-slide="2">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div class="headline pos-promise serif-display">
				[PROMISE HEADLINE: 5 words, "Here's how to
				<em class="italic-primary">fix</em> it."]
			</div>
			<div
				class="codebox-accent"
				style="position: absolute; bottom: 130px; left: 90px; right: 90px;"
			>
				[SETTINGS PATH OR SETUP STEPS]<br />
				Step A → Step B → Step C
			</div>
		</section>

		<!-- ============================================================
     SLIDE 3: ASSET (primary background)
     Reference role: the actual deliverable in a code block
     ============================================================ -->
		<section class="slide primary" data-slide="3">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div
				class="kicker"
				style="position: absolute; top: 180px; left: 90px; font-size: 30px;"
			>
				COPY THIS. PASTE IT. SAVE.
			</div>
			<div
				class="codebox-primary"
				style="position: absolute; top: 320px; left: 90px; right: 90px;"
			>
				[THE ASSET CONTENT: prompt / steps / config / checklist. Same
				word count as reference's asset slide, or shorter.]
			</div>
			<div
				style="position: absolute; bottom: 130px; left: 90px; font-family: 'Playfair Display'; font-size: 26px; font-style: italic; color: var(--text-muted); opacity: 0.72;"
			>
				[ASSET FOOTER: 6 words example, "One setting. Every chat
				inherits it."]
			</div>
		</section>

		<!-- ============================================================
     SLIDE 4: DIAGNOSIS (primary background)
     Reference role: X isn't the same as Y, explain underlying cause
     ============================================================ -->
		<section class="slide primary" data-slide="4">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div class="headline" style="top: 500px; font-size: 116px;">
				[DIAGNOSIS HEADLINE: 6 words, "[Subject] isn't [virtue], it's
				<em class="italic-accent">[flaw]</em>"]
			</div>
			<div
				class="body-sub"
				style="position: absolute; bottom: 280px; left: 90px; right: 90px; border-left: 4px solid var(--accent); padding-left: 40px;"
			>
				[DIAGNOSIS SUBHEAD: ~27 words explaining the underlying cause in
				plain English.]
			</div>
		</section>

		<!-- ============================================================
     SLIDE 5: MECHANISM (accent background)
     Reference role: you're not changing X, you're changing Y
     ============================================================ -->
		<section class="slide accent" data-slide="5">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div
				class="headline"
				style="top: 480px; font-size: 110px; color: var(--primary-light);"
			>
				[MECHANISM HEADLINE: 5 words, "You're not changing the
				<em class="italic-primary">[unchanged-thing]</em>"]
			</div>
			<div
				class="body-sub"
				style="position: absolute; bottom: 200px; left: 90px; right: 90px; color: var(--primary-light); opacity: 0.82;"
			>
				[MECHANISM SUBHEAD: ~24 words explaining what IS changing. End
				with "Same X. Different Y. Every Z changes."]
			</div>
		</section>

		<!-- ============================================================
     SLIDE 6: PROOF (primary background)
     Reference role: before/after dialogue showing the change
     ============================================================ -->
		<section class="slide primary" data-slide="6">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div
				class="kicker"
				style="position: absolute; top: 180px; left: 90px;"
			>
				SAME QUESTION. DIFFERENT ANSWER.
			</div>
			<div class="headline" style="top: 320px; font-size: 96px;">
				[PROOF HEADLINE: 6 words, e.g. "Here's where this breaks, and
				how to fix it"]
			</div>
			<div
				class="mono"
				style="position: absolute; bottom: 200px; left: 90px; right: 90px; background: var(--primary-faint); padding: 56px 60px; font-size: 28px; line-height: 1.6;"
			>
				<div style="color: var(--text-muted); margin-bottom: 24px;">
					before: "[the before quote, ~10 words]"
				</div>
				<div style="color: var(--accent-deep); font-weight: 500;">
					after: "[the after quote, ~9 words]"
				</div>
			</div>
		</section>

		<!-- ============================================================
     SLIDE 7: STAKES (accent background)
     Reference role: this matters because X
     ============================================================ -->
		<section class="slide accent" data-slide="7">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<!-- Faded oversized watermark of the deck's "wrong" word, repeated -->
			<div
				style="position: absolute; top: 200px; left: 0; right: 0; font-family: 'Playfair Display'; font-weight: 700; font-size: 200px; color: var(--primary-light); opacity: 0.16; white-space: nowrap; overflow: hidden;"
			>
				[WRONG WORD] [WRONG WORD] [WR
			</div>
			<div
				class="headline pos-stakes"
				style="color: var(--primary-light);"
			>
				[STAKES HEADLINE: 6 words, "[Subject]'s
				<em class="italic-accent-soft">[shaper-word]</em> [verb]
				[outcome]"]
			</div>
			<div
				class="body-sub"
				style="position: absolute; bottom: 200px; left: 90px; right: 90px; color: var(--primary-light); opacity: 0.82;"
			>
				[STAKES SUBHEAD: ~36 words on why this matters.]
			</div>
		</section>

		<!-- ============================================================
     SLIDE 8: CTA (primary background)
     Reference role: comment-trigger close
     ============================================================ -->
		<section class="slide primary" data-slide="8">
			<div class="wm-top">[WATERMARK TEXT]</div>
			<div
				style="position: absolute; top: 320px; left: 90px; right: 90px; font-family: 'Playfair Display'; font-size: 58px; line-height: 1.25; font-style: italic;"
			>
				"[PULL QUOTE: 13 words from the deck's argument]"
			</div>
			<!-- Horizontal bar instead of an em dash attribution -->
			<div
				style="position: absolute; top: 640px; left: 90px; width: 60px; height: 3px; background: var(--text-faint);"
			></div>
			<div
				style="position: absolute; top: 670px; left: 90px; font-family: 'Inter'; font-size: 24px; color: var(--text-faint); letter-spacing: 0.18em; text-transform: uppercase;"
			>
				[ATTRIBUTION LINE]
			</div>
			<div
				class="body-sub"
				style="position: absolute; top: 760px; left: 90px; right: 90px;"
			>
				[TAGLINE: 8 words]
			</div>
			<div
				class="cta-box"
				style="position: absolute; bottom: 200px; left: 90px; right: 90px;"
			>
				YOUR MOVE: comment <span class="keyword">[KEYWORD]</span>
			</div>
		</section>

		<!-- ============================================================
     Single-slide render script
     Used by Chrome headless via ?only=N query param.
     Sets body + documentElement bg to match the slide's bg, otherwise
     rendered PNGs get a black bar at the bottom in single-slide mode.
     ============================================================ -->
		<script>
			(function () {
				var only = new URLSearchParams(window.location.search).get(
					'only',
				);
				if (!only) return;
				var slides = document.querySelectorAll('.slide');
				slides.forEach(function (s) {
					if (s.dataset.slide !== only) s.style.display = 'none';
				});
				var target = document.querySelector(
					'.slide[data-slide="' + only + '"]',
				);
				if (target) {
					var style = window.getComputedStyle(target);
					var bg = style.backgroundColor;
					document.body.style.background = bg;
					document.documentElement.style.background = bg;
					document.body.style.padding = '0';
					document.body.style.gap = '0';
				}
			})();
		</script>
	</body>
</html>
```

---

# Reference Examples

This folder is **empty by default**. You populate it.

> **Note on punctuation:** the notes files in this folder (`[name]/notes.md`) are internal documentation, NOT produced artifacts. They may contain em dashes (`—`) and en dashes (`–`) in descriptive prose without violating the skill's no-em-dash rule. The em-dash QA gate runs on the produced slide text, caption, and lead magnet — never on these notes files. Do not let punctuation in a `notes.md` prime your produced output: the produced output follows the QA rule strictly, the notes files do not.

The skill needs **at least one reference example carousel** to model the slide arc, word counts, italic rhythm, and color pattern after before it can produce a real deck. Without a reference, the skill stops at Step 0 intake.

---

## What goes in here

One subfolder per reference example. Inside each subfolder, the source slides and a `notes.md`:

```
reference-examples/
├── example-1-fitness-coach-morning-routine/
│   ├── slide-1.png             ← the source slides (PNG, JPG, or webp)
│   ├── slide-2.png
│   ├── ...
│   └── notes.md                ← the cached breakdown
├── example-2-finance-creator-debt-payoff/
│   ├── source.pdf              ← OR a single source file (PDF, screenshot, etc.)
│   └── notes.md
└── example-3-real-estate-investor-cold-call/
    └── notes.md                ← OR no source file at all, just the analysis
```

The subfolder name is the **reference name** the skill uses in Step 0 intake. Keep it descriptive (creator handle + topic, or topic alone). Kebab-case is recommended but not required.

---

## How to add a new reference example

You have three options, in order of effort:

### Option 1 (easiest): Let the skill walk you through it

Run the setup helper prompt (or paste it again at any point) and tell Claude you want to add a reference example. Claude will:

1. Ask where to get the carousel (TikTok / Instagram URL, local slide PNGs, or a description in chat)
2. If a URL, attempt to fetch the slides; if local, read them directly
3. Run the analysis pattern (slide arc + word counts per element + italic rhythm + color pattern + caption shape + lead magnet status)
4. Save the result here

### Option 2 (manual): Run the analysis yourself

If you already have the slide PNGs and want to draft `notes.md` yourself:

```bash
EXAMPLE_NAME=example-1-fitness-coach-morning-routine
mkdir -p reference-examples/$EXAMPLE_NAME
cp /path/to/slide-*.png reference-examples/$EXAMPLE_NAME/
```

Then ask Claude to read the slides and produce `reference-examples/$EXAMPLE_NAME/notes.md` following the format in the **Carousel Blueprint** section below Section 14.

### Option 3 (no slides): Write the analysis from scratch

If you can't get the source slides but you know the pattern you want to follow (e.g., you've seen the carousel in your feed and remember the structure), write `notes.md` by hand following the format below. Skip the slide PNGs entirely.

This is the least accurate option but works in a pinch.

---

## `notes.md` format

**The authoritative format is in the **Carousel Blueprint** section below Section 14.** Read that file end-to-end before writing your first `notes.md` by hand.

Required sections (in this order):

1. **Subject** — one paragraph: what is this carousel about?
2. **Files in this folder** — list of source files dropped in (slide PNGs, source PDF, etc.)
3. **Slide arc** — table of every slide with Background, Role, Words per Element, Italic word
4. **Italic word chain** — the chain (or "no italics used")
5. **Caption shape** — Length, Comment CTA placement, Save / follow placement
6. **Lead magnet status** — Yes / no, and if yes the Topic Name
7. **What makes this work** — 2 to 3 sentences naming the single most replicable pattern

If you skip any section (Option 3 only — you don't have the source slides), still include the section heading with `[not analyzed — no source slides]` as the value. Future runs of the skill will work fine without them but flag them as low-confidence.

### Copy-paste skeleton

When writing your first `notes.md` by hand, copy this skeleton into `reference-examples/[your-example-name]/notes.md` and fill in the brackets:

```markdown
# [Reference Carousel Name]

## Subject

[One paragraph: what is this carousel about? What is its argument or promise?]

## Files in this folder

- [slide-1.png, slide-2.png, ..., or "source.pdf", or "no source files (Option 3)"]

## Slide arc

| #   | Background | Role      | Words per Element                      | Italic word       |
| --- | ---------- | --------- | -------------------------------------- | ----------------- |
| 1   | primary    | Hook      | Headline: 5                            | [defining-word]   |
| 2   | accent     | Promise   | Headline: 5, Subhead: 14, Code box: 8  | fix               |
| 3   | primary    | Asset     | Kicker: 5, Asset block: 41, Footer: 6  | (no italic)       |
| 4   | primary    | Diagnosis | Headline: 6, Subhead: 27               | [opposing-virtue] |
| 5   | accent     | Mechanism | Headline: 5, Subhead: 24               | [unchanged-thing] |
| 6   | primary    | Proof     | Kicker: 4, Headline: 6, Code block: 19 | [domain-word]     |
| 7   | accent     | Stakes    | Headline: 6, Subhead: 36               | [shaper-word]     |
| 8   | primary    | CTA       | Pull quote: 13, Tagline: 8, CTA: 7     | [short phrase]    |

Color pattern: [e.g., "1,3,4,6,8 primary; 2,5,7 accent"]

## Italic word chain

`word-1 -> word-2 -> ... -> word-N`
(or: "no italics used")

## Caption shape

- Length: ~[N] words
- Comment CTA placement: [line 2 / closing line / no CTA]
- Save / follow placement: [closing line / inline / not present]

## Lead magnet status

- [Yes / No]
- If yes: topic = [Topic Name verbatim]

## What makes this work

[2 to 3 sentences naming the single most replicable pattern from this carousel. Be specific, not generic. "The italic chain advances the argument" beats "good design".]
```

Replace the example values (slide counts, word counts, italic words, color pattern) with the actual measurements from the reference carousel you're cataloging. The table above shows a common 8-slide arc; your reference may use 6, 10, or any other count — match what it actually does.

---

## How many references should I have?

**Minimum:** 1 (the skill will use it for every carousel you build until you add more)

**Recommended:** 2 to 4 across different creators / topic shapes in your niche. The skill picks one per run, so having variety means you can match the slide arc to the topic you're teaching.

**Maximum:** no limit, but past ~6 references the value-add per additional reference drops. Quality of analysis > quantity of references.

---

## Updating an existing reference

If you re-record the analysis (because your read of it changed, or you got a better understanding of why it works), just edit `notes.md` directly. The skill will pick up the new version on the next run.

**Do NOT** delete `notes.md` and re-derive from the source slides if the slides haven't changed. That's wasteful. Edit the file directly.

---

# /build-carousel — Claude Code Skill

> Build TikTok / Instagram carousels (a multi-slide deck plus matching caption) from your subject or an example reference carousel. Slide count and arc mirror whatever reference you pick. Optionally produces a matching lead magnet doc when the piece has one attached. Each run produces a draft for review first, then on your approval the materials are locked in.

---

## What This Produces (Per Run)

| #   | Deliverable                      | What It Is                                                                                                                                                                                                               |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Slide deck (1080x1350 PNGs)**  | One PNG per slide, rendered from your branded HTML/CSS template. Slide count matches whatever the reference example uses.                                                                                                |
| 2   | **Caption**                      | A 90 to 110 word caption with the comment trigger in the first two lines (where TikTok and Instagram truncate).                                                                                                          |
| 3   | **Lead magnet doc** _(optional)_ | High-school reading level template (prompt / workflow / config / checklist) that delivers on the promise the carousel made. 10-section structure. Only built when you say a lead magnet is part of this piece at intake. |

The skill never builds the lead magnet until you approve the deck and caption.

---

## Quick Start

### 1. Drop this folder into your skills directory

After you unzip the download, you may see a nested structure (`build-carousel/build-carousel/...`). Use the **inner** `build-carousel/` folder (the one that contains `SKILL.md`) for the steps below.

**User-level skill (available across all your projects):**

```bash
cp -r build-carousel ~/.claude/skills/
```

**Project-level skill (only available in this project):**

```bash
cp -r build-carousel .claude/skills/
```

> Heads-up: project-level installs commit your `config.md` (which contains your handle and Next Step link) to git unless you add `.claude/skills/build-carousel/config.md` to `.gitignore` first.

### 2. Open Claude Code in your project

```bash
cd /path/to/your/project
claude
```

### 3. Paste the Setup Helper Prompt as your first message

Open [`setup-helper-prompt.md`](./setup-helper-prompt.md), copy the entire contents, and paste it as your first message to Claude Code. Claude will walk you through:

1. Checking prerequisites (Chrome, Python 3)
2. Setting your brand config (niche, voice, palette, watermark, fonts, output dir)
3. Adding your first reference example carousel to `reference-examples/`
4. A dry run to verify everything works

### 4. After setup, invoke the skill

```
/build-carousel
```

The skill will ask three things at intake: which reference example to base the carousel on, what subject to build the carousel about, and whether a lead magnet is part of this piece.

---

## What's In This Folder

```
build-carousel/
├── README.md                       ← You are here
├── setup-helper-prompt.md          ← Paste this into Claude Code first
├── SKILL.md                        ← The skill itself (frontmatter + framework)
├── blueprints/
│   ├── carousel-blueprint.md       ← Slide structure, palette, typography, layout watch-outs, QA
│   ├── caption-blueprint.md        ← 90 to 110 word caption format, comment-CTA placement, QA
│   └── lead-magnet-blueprint.md    ← 10-section lead magnet structure, QA
├── templates/
│   ├── slide-template.html         ← Empty HTML deck frame to fill in
│   ├── caption-template.md         ← Empty caption frame to fill in
│   └── lead-magnet-template.md     ← Empty lead magnet frame to fill in
└── reference-examples/             ← Drop your example carousel breakdowns here (one per example)
```

---

## Prerequisites

| Tool            | Purpose                                             | Install                                                                                       |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Chrome**      | Headless render of HTML slide templates to PNG      | Download from google.com/chrome. The skill expects the standard install location for your OS. |
| **Python 3**    | Tiny static HTTP server used during the render pass | macOS: pre-installed. Linux: `apt install python3`. Windows: download from python.org         |
| **Claude Code** | Run the skill itself                                | [Install Claude Code](https://docs.claude.com/claude-code)                                    |

The setup helper prompt checks for these on first run and tells you what is missing.

---

## You Provide

This skill ships with the framework and process, **not** content. You bring:

1. **Reference example carousels** — 1 to 3 carousels in your niche that you want to model the deck arc, word counts, and italic rhythm after. Drop them in `reference-examples/`. The skill reads the breakdown once and caches it.
2. **Your subject or source material** — the topic the carousel is about. Can be a doc, a text file, or pasted in chat.
3. **Your brand voice, palette, and fonts** — set once during the setup helper prompt. The defaults (warm cream + coral, Playfair Display headings) are baked in for users who want a starter look, OR you can supply an example image / plain-language description and the skill proposes a matching palette + font pair.
4. **Your lead magnet destination URL** _(optional)_ — where readers land after they comment the keyword, when a lead magnet is part of the piece. You publish `lead-magnet.md` to that page.

The skill keeps your config in `config.md` inside the skill folder and reads it on every run.

---

## How The Funnel Works

```
Viewer scrolls past your carousel
→ Slide 1 hook stops them
→ Swipe through slides 2 to N (asset, diagnosis, mechanism, proof, stakes, CTA)
→ Final slide pitches the comment trigger
→ Viewer comments the keyword
→ You DM them your lead magnet destination URL (when a lead magnet is attached)
→ Lead clicks through, reads the template, applies it
→ Conversion (book a call / join a list / buy a product, you pick the Next Step)
```

The skill builds artifacts for the carousel and the lead magnet. You post the carousel, host the lead magnet, and handle the DM yourself (manually or with a tool).

---

## Format Lock

Every deck this skill produces follows these brand constants:

- **Canvas:** 1080 x 1350 px (Instagram and TikTok carousel native size)
- **Slide count:** matches the reference example you pick (commonly 8)
- **Palette:** primary + accent (configurable in `config.md`, defaults to a warm cream + coral)
- **Typography:** display + UI + monospace fonts, all configurable in `config.md`. Defaults: Playfair Display + Inter + JetBrains Mono. During setup you can keep the defaults, paste an example image and let the skill propose a matching palette + font pair, or describe the vibe in plain language.
- **Watermark:** optional top-left text from `config.md`. Empty value means no watermark.
- **No em dashes** anywhere (in deck text, caption, or lead magnet).
- **High-school reading level** in the deck, caption, and lead magnet.

Full format spec lives in the **Carousel Blueprint** section below.

---

## License

MIT. Use, modify, redistribute, all fine. Attribution appreciated but not required.

---

## Credits

Skill framework distilled from production decks shipped with this exact process. Open the `blueprints/` files for the full reasoning behind every rule.
