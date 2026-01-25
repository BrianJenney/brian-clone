import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
dotenv.config();

export const qdrantClient = new QdrantClient({
	url: process.env.QDRANT_URL!,
	apiKey: process.env.QDRANT_API_KEY!,
});

// Collection names for different content types
export const COLLECTIONS = {
	ARTICLES: 'brian-articles',
	POSTS: 'brian-posts',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
