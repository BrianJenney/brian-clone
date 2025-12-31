import { NextResponse } from 'next/server';
import z from 'zod/v4';
import { articleWriter } from '@/libs/agents/articleWriter';

// long running agent that writes an article about the given topic
export const maxDuration = 120;

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const validationResult = z.object({ query: z.string() }).parse(body);
		const { query } = validationResult;
		const result = await articleWriter(query);
		return NextResponse.json({ result });
	} catch (error) {
		console.error('Article writer error:', error);
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}
