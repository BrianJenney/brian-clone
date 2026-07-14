/**
 * Datetime normalization helpers.
 *
 * Qdrant's datetime index only range-filters RFC3339 values. Some sources
 * (e.g. LinkedIn CSV exports) provide "2022-11-03 07:09:05" (space, no
 * timezone), which must be converted before it's stored.
 */

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SPACE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

/**
 * Returns an RFC3339 datetime string. Values already in RFC3339 are returned
 * unchanged; "2022-11-03 07:09:05" becomes "2022-11-03T07:09:05Z" (wall-clock
 * digits preserved, labeled UTC). Returns null for unrecognized shapes so
 * callers can decide whether to keep the raw value or drop it.
 */
export function toRFC3339(value: string): string | null {
  if (RFC3339.test(value)) return value;
  const m = value.match(SPACE);
  if (m) return `${m[1]}T${m[2]}Z`;
  return null;
}
