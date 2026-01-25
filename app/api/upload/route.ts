import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
	UploadRequestSchema,
	UploadResponse,
	ContentType,
} from '@/libs/schemas';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import {
	getCollectionName,
	chunkTextWithOverlap,
	noChunking,
	Chunk,
} from '@/libs/utils';

/**
 * Get chunks based on content type
 */
function getChunks(text: string, contentType: ContentType): Chunk[] {
	if (contentType === 'post') {
		return noChunking(text);
	}
	// Articles and transcripts use chunking with overlap
	return chunkTextWithOverlap(text, 1500);
}

/**
 * POST /api/upload
 * Upload content with automatic chunking based on type
 */
export async function POST(request: NextRequest) {
	try {
		// Parse and validate request body
		const body = await request.json();
		const validationResult = UploadRequestSchema.safeParse(body);

		if (!validationResult.success) {
			return NextResponse.json(
				{
					success: false,
					error: 'Validation error',
					details: validationResult.error.errors,
				},
				{ status: 400 }
			);
		}

		const { text, contentType, metadata } = validationResult.data;

		// Get collection and ensure it exists
		const collectionName = getCollectionName(contentType);

		// Chunk the text based on content type
		const chunks = getChunks(text, contentType);

		// Generate base ID for this upload
		const baseId = uuidv4();
		const chunkIds: string[] = [];

		// Process each chunk
		for (const chunk of chunks) {
			// Generate embedding for chunk
			const embedding = await generateEmbedding(chunk.text);

			// Create unique ID for chunk
			const chunkId =
				chunks.length > 1 ? `${baseId}-chunk-${chunk.index}` : baseId;
			chunkIds.push(chunkId);

			// Prepare payload
			const payload: Record<string, any> = {
				text: chunk.text,
				contentType,
				baseId,
				chunkIndex: chunk.index,
				totalChunks: chunk.totalChunks,
				createdAt: new Date().toISOString(),
				...metadata,
			};

			// Upload to Qdrant
			await qdrantClient.upsert(collectionName, {
				wait: true,
				points: [
					{
						id: chunkId,
						vector: embedding,
						payload,
					},
				],
			});
		}

		const response: UploadResponse = {
			success: true,
			message: `Successfully uploaded ${chunks.length} chunk(s) to ${collectionName}`,
			chunkIds,
			chunksCreated: chunks.length,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error uploading content:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to upload content',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
