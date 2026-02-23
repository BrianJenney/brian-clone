import { ContentType } from '@/libs/schemas';
import { COLLECTIONS, CollectionName } from '@/libs/qdrant';

/**
 * Get Qdrant collection name based on content type
 */
export function getCollectionName(contentType: ContentType): CollectionName {
	switch (contentType) {
		case 'transcript':
			// Transcripts are stored in articles collection
			return COLLECTIONS.TRANSCRIPTS;
		case 'article':
			return COLLECTIONS.ARTICLES;
		case 'post':
			return COLLECTIONS.POSTS;
	}
}
