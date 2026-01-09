import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/medium-articles
 * Scrape Medium articles and store in Qdrant
 * Query params:
 *   - days: Number of days to look back (defaults to 7)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const searchParams = request.nextUrl.searchParams;
		const days = parseInt(searchParams.get('days') || '7', 10);

		// For now, return a placeholder response
		// The actual scraping can be implemented or delegated to the Python serverless function
		return NextResponse.json({
			success: true,
			message: `Medium articles endpoint - looking back ${days} days`,
			note: 'This endpoint can be implemented to scrape Medium articles or call the Python serverless function',
		});
	} catch (error) {
		console.error('Error in medium-articles route:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to process Medium articles',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/medium-articles
 * Manual trigger to scrape articles with custom days
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const days = body.days || 7;

		// For now, return a placeholder response
		return NextResponse.json({
			success: true,
			message: `Medium articles endpoint - looking back ${days} days`,
			note: 'This endpoint can be implemented to scrape Medium articles or call the Python serverless function',
		});
	} catch (error) {
		console.error('Error in medium-articles route:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to process Medium articles',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
