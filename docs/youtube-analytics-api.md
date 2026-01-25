# YouTube Analytics API

This endpoint analyzes your YouTube channel's recent videos, identifies trends, researches similar successful content, and generates topic ideas for future videos.

## Endpoint

`POST /api/youtube-analytics`

## Features

1. **Video Analysis**: Fetches your last N videos (default: 12) and analyzes their performance
2. **Trend Detection**: Identifies top performers, calculates average views and engagement rates
3. **Market Research**: Searches YouTube for similar successful content from the last 3 months based on your top performers
4. **Topic Generation**: Uses OpenAI to generate data-driven video topic ideas (optional)

## Request Body

```json
{
  "channelId": "YOUR_YOUTUBE_CHANNEL_ID",
  "maxVideos": 12,
  "includeTopics": true
}
```

### Parameters

- `channelId` (required): Your YouTube channel ID
- `maxVideos` (optional): Number of recent videos to analyze (default: 12)
- `includeTopics` (optional): Whether to generate topic ideas (default: true)

## Response

```json
{
  "success": true,
  "channelId": "UC...",
  "videos": [
    {
      "id": "video_id",
      "title": "Video Title",
      "description": "...",
      "publishedAt": "2024-01-01T00:00:00Z",
      "url": "https://www.youtube.com/watch?v=...",
      "thumbnailUrl": "...",
      "viewCount": 10000,
      "likeCount": 500,
      "commentCount": 50,
      "engagementRate": 5.5
    }
  ],
  "analysis": {
    "topPerformers": [...],
    "averageViews": 5000,
    "averageEngagement": 3.2,
    "totalVideos": 12,
    "trends": {
      "viewsDistribution": "High: 3, Medium: 6, Low: 3",
      "engagementInsights": "8 of 12 videos have above-average engagement",
      "contentPatterns": "Top performers: Title 1; Title 2; Title 3"
    }
  },
  "researchQueries": [
    {
      "query": "search term",
      "reason": "why this query is relevant"
    }
  ],
  "researchResults": [
    {
      "query": "search term",
      "results": [
        {
          "title": "Video Title",
          "channelName": "Channel Name",
          "views": "100K views",
          "uploadTime": "1 month ago",
          "url": "https://www.youtube.com/watch?v=..."
        }
      ]
    }
  ],
  "topicIdeas": [
    {
      "title": "Suggested Video Title",
      "description": "Brief description of the video concept",
      "rationale": "Why this topic will perform well based on data",
      "estimatedAppeal": "high"
    }
  ]
}
```

## Setup

### 1. Get a YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API Key)
5. Add the API key to your `.env` file:

```env
YOUTUBE_API_KEY=your_api_key_here
```

### 2. Find Your Channel ID

Your channel ID can be found:
- In your YouTube Studio settings
- In the URL when viewing your channel (starts with UC...)
- Using tools like [Comment Picker](https://commentpicker.com/youtube-channel-id.php)

### 3. No Additional Setup Required

The endpoint uses Playwright (already installed) for YouTube research. No additional API keys or services needed!

## Example Usage

### Using the NPM Script (Recommended)

The easiest way to run the YouTube analytics is using the provided script:

```bash
# Analyze with default settings (your default channel, 12 videos, with topics)
npm run analyze-youtube

# Analyze a specific channel
npm run analyze-youtube UC_channel_id_here

# Analyze with custom number of videos
npm run analyze-youtube UC_channel_id_here 20

# Analyze without generating topic ideas (faster, lower cost)
npm run analyze-youtube UC_channel_id_here 12 false
```

The script will:
- Fetch and analyze your videos
- Display trend analysis with emoji formatting
- Show research queries and results
- Generate and display topic ideas with appeal ratings

**Note:** Make sure the dev server is running (`npm run dev`) before running this script, or set `NEXT_PUBLIC_API_URL` to your deployed URL.

### cURL

```bash
curl -X POST http://localhost:3000/api/youtube-analytics \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "UCxyz123...",
    "maxVideos": 12,
    "includeTopics": true
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/youtube-analytics', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    channelId: 'UCxyz123...',
    maxVideos: 12,
    includeTopics: true,
  }),
});

const data = await response.json();
console.log('Top performers:', data.analysis.topPerformers);
console.log('Topic ideas:', data.topicIdeas);
```

## How It Works

1. **Fetch Videos**: Uses YouTube Data API v3 to fetch your channel's recent videos with full statistics
2. **Analyze Performance**:
   - Calculates engagement rate: (likes + comments) / views × 100
   - Identifies top 3 performers by view count
   - Analyzes view distribution (high/medium/low performers)
3. **Generate Research Queries**: Uses GPT-4 to create 2-3 relevant search queries based on your top performers
4. **Research YouTube**: Uses Playwright to scrape YouTube search results for each query, filtering for videos uploaded in the last 3 months (5 results per query)
5. **Generate Topics**: Uses GPT-4 to analyze all data and suggest 5-7 video topic ideas with rationale

## Performance Considerations

- The endpoint makes multiple API calls (YouTube API, Playwright scraping, OpenAI)
- Expected response time: 20-40 seconds depending on configuration
- Playwright launches a headless browser which adds some overhead
- Consider implementing caching for repeated requests
- Rate limits apply to all external APIs used

## Error Handling

The endpoint returns appropriate error messages:

- `400`: Missing or invalid channelId
- `404`: No videos found for channel
- `500`: Server error (API failures, network issues, etc.)

## Notes

- Engagement rate is calculated as: `(likes + comments) / views × 100`
- Topic ideas are optional - set `includeTopics: false` to skip this step and save API costs
- Research queries are limited to 3 to balance thoroughness with API costs
- Each research query fetches up to 5 YouTube search results
- YouTube research results are filtered to only include videos uploaded in the last 3 months to ensure relevance
- The 3-month filter uses YouTube's "This year" filter plus client-side filtering based on upload time text (e.g., "2 months ago", "3 weeks ago")
