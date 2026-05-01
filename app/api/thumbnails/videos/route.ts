import { z } from 'zod';
import { qdrantClient, COLLECTIONS } from '@/libs/qdrant';

const requestSchema = z.object({
	videoIds: z.array(z.string()).min(1).max(20),
});

export async function POST(req: Request) {
	// For production, thumbnail ingestion should be done via CLI:
	// yarn thumbnails:videos VIDEO_ID_1 VIDEO_ID_2
	// This endpoint is disabled in production builds.
	return Response.json(
		{
			error: 'Video ingestion disabled in production. Use CLI: yarn thumbnails:videos <ids>',
			hint: 'Run: .venv/bin/python api/youtube-transcripts/thumbnails.py --videos VIDEO_ID',
		},
		{ status: 501 }
	);
}

export async function GET() {
	try {
		const collectionInfo = await qdrantClient.getCollection(
			COLLECTIONS.THUMBNAILS
		);

		return Response.json({
			collection: COLLECTIONS.THUMBNAILS,
			points_count: collectionInfo.points_count,
			vectors_count: collectionInfo.vectors_count,
			status: collectionInfo.status,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return Response.json({ error: message }, { status: 500 });
	}
}
