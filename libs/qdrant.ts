import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
dotenv.config();

export const qdrantClient = new QdrantClient({
	url: process.env.QDRANT_URL!,
	apiKey: process.env.QDRANT_API_KEY!,
});

// Collection names for different content types
export const COLLECTIONS = {
	TRANSCRIPTS: 'brian-transcripts',
	ARTICLES: 'brian-articles',
	POSTS: 'brian-posts',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// Vector dimension size for text-embedding-3-small
const VECTOR_SIZE = 512;

/**
 * Initialize a specific collection if it doesn't exist
 */
export async function initializeCollection(
	collectionName: CollectionName
): Promise<void> {
	const collections = await qdrantClient.getCollections();
	const collectionExists = collections.collections.some(
		(collection) => collection.name === collectionName
	);

	if (!collectionExists) {
		await qdrantClient.createCollection(collectionName, {
			vectors: {
				size: VECTOR_SIZE,
				distance: 'Cosine',
			},
		});
	}
}
