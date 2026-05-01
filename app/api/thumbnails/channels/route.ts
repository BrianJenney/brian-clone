import { z } from 'zod';

const requestSchema = z.object({
	channels: z.array(z.string()).min(1).max(10),
	maxVideos: z.number().min(5).max(100).default(30),
});

export async function POST(req: Request) {
	// For production, thumbnail ingestion should be done via CLI:
	// yarn thumbnails:channels @Fireship @t3dotgg
	// This endpoint is disabled in production builds.
	return Response.json(
		{
			error:
				'Channel ingestion disabled in production. Use CLI: yarn thumbnails:channels <handles>',
			hint: 'Run: .venv/bin/python api/youtube-transcripts/thumbnails.py --channels @ChannelHandle',
		},
		{ status: 501 }
	);
}
