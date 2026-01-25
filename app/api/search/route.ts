import { NextRequest, NextResponse } from 'next/server';
import { SearchRequestSchema } from '@/libs/schemas';
import { performSearch } from '@/libs/search';

/**
 * POST /api/search
 * Search across collections using semantic search
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validationResult = SearchRequestSchema.parse(body);
		const response = await performSearch(validationResult);
		return NextResponse.json(response);
	} catch (error) {
		console.error('Error searching content:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to search content',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
