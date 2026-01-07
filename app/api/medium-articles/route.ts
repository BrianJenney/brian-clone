import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * POST /api/medium-articles
 * Trigger a crawl of recent Medium articles using Crawl4AI
 * Optionally accepts { days: number } in the body to specify how many days back to look
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => ({}));
		const days = body.days || 7;

		const scriptPath = path.join(
			process.cwd(),
			'scripts',
			'python',
			'crawl_medium.py'
		);

		// Use venv Python if available
		const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python3');

		return new Promise((resolve) => {
			const env = {
				...process.env,
				DAYS_TO_SCRAPE: String(days),
			};

			const pythonProcess = spawn(pythonPath, [scriptPath], {
				env,
				cwd: process.cwd(),
			});

			let stdout = '';
			let stderr = '';

			pythonProcess.stdout.on('data', (data) => {
				stdout += data.toString();
				console.log('[crawl4ai]', data.toString());
			});

			pythonProcess.stderr.on('data', (data) => {
				stderr += data.toString();
				console.error('[crawl4ai]', data.toString());
			});

			pythonProcess.on('close', (code) => {
				if (code === 0) {
					// Try to parse the last JSON output from stdout
					const lines = stdout.trim().split('\n');
					let results = null;

					// Look for JSON result in output
					for (let i = lines.length - 1; i >= 0; i--) {
						try {
							if (lines[i].startsWith('{')) {
								results = JSON.parse(lines[i]);
								break;
							}
						} catch {
							continue;
						}
					}

					resolve(
						NextResponse.json({
							success: true,
							message: `Crawl completed for articles from last ${days} days`,
							output: stdout,
							results,
						})
					);
				} else {
					resolve(
						NextResponse.json(
							{
								success: false,
								error: 'Crawl process failed',
								exitCode: code,
								stdout,
								stderr,
							},
							{ status: 500 }
						)
					);
				}
			});

			pythonProcess.on('error', (error) => {
				resolve(
					NextResponse.json(
						{
							success: false,
							error: 'Failed to start crawl process',
							details: error.message,
						},
						{ status: 500 }
					)
				);
			});
		});
	} catch (error) {
		console.error('Error triggering Medium crawl:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to trigger crawl',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/medium-articles
 * Same as POST but uses default 7 days
 */
export async function GET() {
	const scriptPath = path.join(
		process.cwd(),
		'scripts',
		'python',
		'crawl_medium.py'
	);

	// Use venv Python if available
	const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python3');

	return new Promise((resolve) => {
		const pythonProcess = spawn(pythonPath, [scriptPath], {
			env: process.env,
			cwd: process.cwd(),
		});

		let stdout = '';
		let stderr = '';

		pythonProcess.stdout.on('data', (data) => {
			stdout += data.toString();
			console.log('[crawl4ai]', data.toString());
		});

		pythonProcess.stderr.on('data', (data) => {
			stderr += data.toString();
			console.error('[crawl4ai]', data.toString());
		});

		pythonProcess.on('close', (code) => {
			if (code === 0) {
				resolve(
					NextResponse.json({
						success: true,
						message: 'Crawl completed for articles from last 7 days',
						output: stdout,
					})
				);
			} else {
				resolve(
					NextResponse.json(
						{
							success: false,
							error: 'Crawl process failed',
							exitCode: code,
							stdout,
							stderr,
						},
						{ status: 500 }
					)
				);
			}
		});

		pythonProcess.on('error', (error) => {
			resolve(
				NextResponse.json(
					{
						success: false,
						error: 'Failed to start crawl process',
						details: error.message,
					},
					{ status: 500 }
				)
			);
		});
	});
}
