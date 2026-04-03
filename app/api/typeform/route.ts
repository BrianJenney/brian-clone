import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
	startTypeformCreation,
	resumeTypeformCreation,
} from '@/app/actions/create-typeform';

/**
 * POST /api/typeform
 *
 * Two modes determined by the request body:
 *
 * 1. Start a new form-creation run:
 *    { action: "start", description: "..." }
 *    → returns { threadId, interrupted: true, formDesign, statusMessage }
 *
 * 2. Resume after human review:
 *    { action: "resume", threadId: "...", approved: true|false, feedback?: "..." }
 *    → if still interrupted (revision loop): { interrupted: true, formDesign, statusMessage }
 *    → if completed: { interrupted: false, result: { id, url, editUrl } }
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		// -----------------------------------------------------------------------
		// Start
		// -----------------------------------------------------------------------
		if (body.action === 'start') {
			const { description } = body;

			if (!description || typeof description !== 'string') {
				return NextResponse.json(
					{ error: 'description is required' },
					{ status: 400 }
				);
			}

			const threadId = uuidv4();
			const outcome = await startTypeformCreation(description, threadId);

			if (!outcome.success) {
				return NextResponse.json(
					{ error: outcome.error ?? 'Failed to start form creation' },
					{ status: 500 }
				);
			}

			return NextResponse.json({
				threadId: outcome.threadId,
				interrupted: outcome.interrupted,
				formDesign: outcome.interruptPayload?.formDesign,
				statusMessage: outcome.interruptPayload?.statusMessage,
			});
		}

		// -----------------------------------------------------------------------
		// Resume
		// -----------------------------------------------------------------------
		if (body.action === 'resume') {
			const { threadId, approved, feedback } = body;

			if (!threadId || typeof threadId !== 'string') {
				return NextResponse.json(
					{ error: 'threadId is required' },
					{ status: 400 }
				);
			}

			if (typeof approved !== 'boolean') {
				return NextResponse.json(
					{ error: 'approved (boolean) is required' },
					{ status: 400 }
				);
			}

			const outcome = await resumeTypeformCreation(
				threadId,
				approved,
				feedback
			);

			if (!outcome.success) {
				return NextResponse.json(
					{ error: outcome.error ?? 'Failed to resume form creation' },
					{ status: 500 }
				);
			}

			return NextResponse.json({
				interrupted: outcome.interrupted,
				formDesign: outcome.interruptPayload?.formDesign,
				statusMessage: outcome.interruptPayload?.statusMessage,
				result: outcome.result,
			});
		}

		return NextResponse.json(
			{ error: 'action must be "start" or "resume"' },
			{ status: 400 }
		);
	} catch (error) {
		console.error('POST /api/typeform error:', error);
		return NextResponse.json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
