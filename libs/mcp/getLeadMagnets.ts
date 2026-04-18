import * as fs from 'fs/promises';
import * as path from 'path';

export interface LeadMagnet {
	name: string;
	url: string;
	price: string;
	duration?: string;
	format?: string;
	description: string;
	topics?: string[];
	target_audience?: string;
	curriculum?: Record<string, string> | string[];
	upsell?: string;
}

export interface LeadMagnetsPayload {
	business_name: string;
	mission: string;
	lead_magnets: LeadMagnet[];
}

/**
 * Read the business overview JSON and return the set of lead-magnet programs.
 * Pulls directly from `data/context/business-overview.json` (same source the
 * existing business-context tool uses).
 */
export async function getLeadMagnets(): Promise<LeadMagnetsPayload> {
	const overviewPath = path.join(
		process.cwd(),
		'data',
		'context',
		'business-overview.json',
	);
	const raw = await fs.readFile(overviewPath, 'utf-8');
	const overview = JSON.parse(raw) as {
		business_name: string;
		mission: string;
		programs: Array<LeadMagnet & { type: string }>;
	};

	const lead_magnets = (overview.programs ?? [])
		.filter((p) => p.type === 'lead_magnet')
		.map(({ type: _type, ...rest }) => rest);

	return {
		business_name: overview.business_name,
		mission: overview.mission,
		lead_magnets,
	};
}
