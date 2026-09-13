import { getRoles } from '@/scripts/rounds-roles.mjs';

export type RoundsRolesPayload = {
	jobs?: Array<Record<string, unknown>>;
	[key: string]: unknown;
};

/**
 * Fetches a page of the recruiter roles catalog from Rounds.so.
 * Requires ROUNDS_EMAIL and ROUNDS_PASSWORD to be set.
 */
export async function getRoundsRoles(cursor = 0): Promise<RoundsRolesPayload> {
	return getRoles(cursor);
}
