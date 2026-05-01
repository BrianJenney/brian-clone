Solid stack choices. Let me push back on one thing before we draft though: **Next.js running Python scripts is a trap you don't need to fall into.** You've built enough production systems to know that mixing runtimes in a Next.js API route gets ugly fast - cold starts, dependency management, deployment headaches on Vercel.

Cleaner split: Python is a separate FastAPI service (or just a CLI for ingestion), Next.js talks to it over HTTP, or Next.js talks directly to Qdrant + Anthropic API and Python is _only_ for the offline ingestion pipeline. The latter is simpler and probably what you want.

Let me draft the plan with that in mind.

---

## The Plan

### System architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OFFLINE: Ingestion Pipeline (Python, runs periodically)    │
│                                                              │
│  yt-dlp ──► metadata + thumbnails ──► Claude (describe)     │
│                                            │                 │
│                                            ▼                 │
│                                    Qdrant (vectors +         │
│                                     structured metadata)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ONLINE: Next.js App (TypeScript)                           │
│                                                              │
│  User input ──► Claude (expand concept) ──► Qdrant query    │
│                                                  │           │
│                                                  ▼           │
│  UI ◄── Claude (analyze patterns) ◄── retrieved thumbnails  │
└─────────────────────────────────────────────────────────────┘
```

Two completely separate codebases. They share nothing except the Qdrant instance. This is the right call because the ingestion runs maybe weekly and the app runs continuously - totally different operational profiles.

### Phase 1: Data collection (Python)

**Tools:**

- `yt-dlp` - video metadata extraction (don't actually download videos, just metadata)
- `httpx` or `requests` - fetching thumbnails (they're at predictable URLs, no scraping needed)
- `anthropic` - Claude SDK for image analysis
- `qdrant-client` - vector DB
- `crawl4ai` - actually, **probably skip this**. yt-dlp gets you everything from YouTube directly. Crawl4AI is for when you need to scrape rendered web pages. YouTube has structured data via yt-dlp + the Data API.

**The pipeline:**

```python
# Pseudocode for the ingestion flow
channels = [
    "@Fireship", "@t3dotgg", "@ThePrimeagen",
    "@WebDevSimplified", "@bawolff",  # etc.
]

for channel in channels:
    videos = yt_dlp_get_channel_videos(channel, last_n_months=12)

    for video in videos:
        # Skip if we've already processed this video
        if exists_in_qdrant(video.id):
            continue

        # Performance normalization
        perf_score = video.views / channel.subscriber_count_at_publish
        if perf_score < threshold:  # Filter for top performers only
            continue

        # Get thumbnail (always at this URL)
        thumb_url = f"https://img.youtube.com/vi/{video.id}/maxresdefault.jpg"
        thumb_bytes = download(thumb_url)

        # Claude analyzes the thumbnail
        analysis = claude.analyze_thumbnail(thumb_bytes, video.title)
        # Returns: composition, colors, text, faces, emotion, style tags, etc.

        # Embed the description (text embedding)
        embedding = embed(analysis.description + " " + video.title)

        # Store in Qdrant
        qdrant.upsert(
            id=video.id,
            vector=embedding,
            payload={
                "title": video.title,
                "channel": channel.name,
                "thumbnail_url": thumb_url,
                "views": video.views,
                "perf_score": perf_score,
                "publish_date": video.publish_date,
                **analysis.structured_metadata  # face_count, has_text, colors, etc.
            }
        )
```

**Key decisions in this phase:**

1. **Use the YouTube Data API alongside yt-dlp.** yt-dlp gets you what's publicly visible without API keys, but the Data API is more reliable and gives you cleaner subscriber counts at publish time. Free tier is 10k units/day which is plenty.

2. **Performance normalization is non-negotiable.** I'd compute `views / channel_subs_at_time_of_publish` AND `views / channel_avg_views_last_30_days`. Use both as filters.

3. **For embeddings, start with one approach, not three.** I'd start with: Claude generates a rich description, embed that with `voyage-3` (Voyage's multimodal model, works well with Claude) or OpenAI's `text-embedding-3-large`. Skip CLIP for v1 - you can add it later if pure-text retrieval feels weak.

4. **Store the structured metadata as Qdrant payload, not in the vector.** This lets you do hybrid filtering: "thumbnails about RAG" (vector search) WHERE `face_count > 0` AND `dominant_color = dark` (payload filter). This is the move.

### Phase 2: The app (Next.js + TypeScript)

**Stack:**

- Next.js 15 App Router
- `@anthropic-ai/sdk` - direct from server actions or route handlers
- `@qdrant/js-client-rest` - yes, there's a JS client, no Python needed at runtime
- Tailwind + shadcn for UI (you've used these)

**The flow:**

```typescript
// app/api/thumbnail/route.ts
export async function POST(req: Request) {
	const { concept } = await req.json();

	// Step 1: Claude expands concept
	const expansion = await claude.messages.create({
		model: 'claude-opus-4-7',
		system: EXPANSION_PROMPT, // We'll draft this
		messages: [{ role: 'user', content: concept }],
	});
	const queries = parseExpansion(expansion);

	// Step 2: Multi-query retrieval against Qdrant
	const allResults = await Promise.all(
		queries.search_concepts.map((q) =>
			qdrant.search({
				collection_name: 'thumbnails',
				vector: await embed(q),
				limit: 10,
				filter: buildFilter(queries), // niche, recency, perf_score
			}),
		),
	);
	const dedupedTopK = rerankByPerformance(allResults);

	// Step 3: Claude analyzes the retrieved set
	const analysis = await claude.messages.create({
		model: 'claude-opus-4-7',
		system: ANALYSIS_PROMPT, // We'll draft this
		messages: [
			{
				role: 'user',
				content: [
					...dedupedTopK.map((t) => ({
						type: 'image',
						source: t.thumbnail,
					})),
					{
						type: 'text',
						text: buildAnalysisQuery(concept, dedupedTopK),
					},
				],
			},
		],
	});

	return Response.json({
		pattern_summary: analysis.pattern_summary,
		directions: analysis.directions, // 3 concrete directions
		references: dedupedTopK,
	});
}
```

**Key decisions:**

1. **Server actions or route handlers, not Edge runtime.** Claude calls take 5-15 seconds with image inputs - you need Node runtime, not Edge.

2. **Stream the response.** Don't make the user wait 20 seconds staring at a spinner. Stream the pattern summary first (fastest), then directions, then reference grid.

3. **Cache aggressively.** Same concept submitted twice should hit cache. Use Vercel KV or just Redis. Concept → expansion is deterministic-ish, can cache for hours.

### Phase 3: Polish (the part that matters)

This is where most projects die. Some things I'd build in from day one:

- **A "why these references?" view** - clicking any reference thumbnail shows what concepts it matched on. Builds trust in the retrieval.
- **A feedback loop** - thumbs up/down on directions. Stored, used later to tune prompts.
- **A "show me underperformers" toggle** - useful debugging tool. If your "top thumbnails" set looks identical to bottom thumbnails, your system isn't working.
- **Niche selector** - dev/AI vs. general tech vs. business. Same RAG, different retrieval filters.

### Build order

1. **Week 1 weekend:** Get yt-dlp + Claude analysis pipeline working for ONE channel. Understand the data shape. Don't touch Qdrant yet - just dump JSON to disk.
2. **Week 2:** Scale ingestion to 15-20 channels, ~500-1000 thumbnails. Set up Qdrant (use their cloud free tier to start). Validate retrieval quality with manual queries in a notebook.
3. **Week 3:** Build the Next.js app. Start with the API route, get it returning structured data. Then UI.
4. **Week 4:** Polish, prompts, the "feels right" tuning. This always takes longer than you think.

---

## Questions before we start drafting prompts

Three things to nail down because they shape everything:

1. **Scope of the niche** - just dev education + AI engineering, or broader (productivity, tech career, etc.)? This determines your channel list and changes retrieval significantly.

2. **Your own thumbnails in or out?** Including your own past thumbnails with performance data is uniquely valuable for _you_ but bloats the system. I'd say in.

3. **Performance threshold** - top 25% by normalized performance? Top 10%? Tighter is better signal but smaller corpus. I'd start at top 30% and tighten later.

Once those are settled, the next thing to draft is the **Claude analysis prompt for ingestion** - what structured metadata you extract from each thumbnail. That's the hinge the whole system swings on, because it determines what you can later filter and retrieve on. Want to go there next?
