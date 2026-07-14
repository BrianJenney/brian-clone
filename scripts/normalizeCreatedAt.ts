import "dotenv/config";
import { COLLECTIONS, qdrantClient } from "../libs/qdrant";
import { toRFC3339 } from "../libs/utils/datetime";

/**
 * Normalizes LinkedIn post `createdAt` values to RFC3339 so Qdrant's datetime
 * index can range-filter them. Bulk-imported posts were stored as
 * "2022-11-03 07:09:05" (space, no timezone), which the datetime index does
 * not match — leaving ~85% of posts invisible to date filtering.
 *
 * Transform: "2022-11-03 07:09:05" -> "2022-11-03T07:09:05Z"
 * (space -> T, append Z; the wall-clock digits are preserved and labeled UTC.)
 *
 * Dry-run by default. Pass --apply to write changes.
 *   yarn tsx scripts/normalizeCreatedAt.ts            # report only
 *   yarn tsx scripts/normalizeCreatedAt.ts --apply    # write
 */

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const APPLY = process.argv.includes("--apply");

type Fix = { id: string | number; from: string; to: string };

async function main() {
  let offset: string | number | undefined | null;
  const fixes: Fix[] = [];
  const unknown: { id: string | number; value: string }[] = [];
  let total = 0;
  let alreadyOk = 0;
  let missing = 0;

  do {
    const r = await qdrantClient.scroll(COLLECTIONS.POSTS, {
      limit: 500,
      with_payload: ["createdAt"],
      offset: offset ?? undefined,
    });
    for (const p of r.points) {
      total++;
      const v = (p.payload as Record<string, unknown>)?.createdAt;
      if (typeof v !== "string" || v.length === 0) {
        missing++;
        continue;
      }
      if (RFC3339.test(v)) {
        alreadyOk++;
        continue;
      }
      const to = toRFC3339(v);
      if (to) fixes.push({ id: p.id, from: v, to });
      else unknown.push({ id: p.id, value: v });
    }
    offset = r.next_page_offset as string | number | null;
  } while (offset !== null && offset !== undefined);

  console.log(`total posts:      ${total}`);
  console.log(`already RFC3339:  ${alreadyOk}`);
  console.log(`missing/empty:    ${missing}`);
  console.log(`to normalize:     ${fixes.length}`);
  console.log(`unknown shape:    ${unknown.length}`);
  console.log("\nsample transforms:");
  for (const f of fixes.slice(0, 5)) console.log(`  ${f.from}  ->  ${f.to}`);

  if (unknown.length > 0) {
    console.log("\n⚠ unknown createdAt shapes (left untouched):");
    for (const u of unknown.slice(0, 10))
      console.log(`  id=${u.id} value=${JSON.stringify(u.value)}`);
  }

  if (!APPLY) {
    console.log(
      `\n(dry-run) re-run with --apply to write ${fixes.length} update(s).`,
    );
    return;
  }

  console.log(`\napplying ${fixes.length} updates...`);
  const CHUNK = 25;
  let done = 0;
  for (let i = 0; i < fixes.length; i += CHUNK) {
    const batch = fixes.slice(i, i + CHUNK);
    await Promise.all(
      batch.map((f) =>
        qdrantClient.setPayload(COLLECTIONS.POSTS, {
          payload: { createdAt: f.to },
          points: [f.id],
          wait: false,
        }),
      ),
    );
    done += batch.length;
    if (done % 100 === 0 || done === fixes.length)
      console.log(`  ${done}/${fixes.length}`);
  }
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
