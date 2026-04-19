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
 * Read the learning resources JSON and return the set of lead-magnet programs.
 * Pulls directly from `data/resources/learning-resources.json`.
 */
export async function getLeadMagnets(): Promise<LeadMagnetsPayload> {
	const resourcesPath = path.join(
		process.cwd(),
		'data',
		'resources',
		'learning-resources.json',
	);
	const raw = await fs.readFile(resourcesPath, 'utf-8');
	const resources = JSON.parse(raw) as Array<LeadMagnet & { type?: string; title?: string }>;

	// Return all resources as lead magnets, normalizing title/name
	const lead_magnets = resources.map(({ type: _type, title, ...rest }) => ({
		...rest,
		name: rest.name || title || 'Untitled',
	}));

	return {
		business_name: 'Parsity',
		mission: 'Empowering developers through practical, hands-on learning',
		lead_magnets,
	};
}
