/**
 * Other Medium authors whose articles get pulled into the shared `brian-articles`
 * collection (tagged with `author`) alongside Brian's own writing, for reference.
 * `lookupWriting` excludes these by default so "Brian's writing" search stays
 * scoped to Brian - see the `must_not` in buildFilter.
 */
export const TRACKED_MEDIUM_AUTHORS = {
	jproco: { name: 'jproco', handle: '@jproco' },
} as const;

export type TrackedAuthorKey = keyof typeof TRACKED_MEDIUM_AUTHORS;
