// ══════════════════════════════════════════════
// Nomichi CMS — ID Generator
// Matches the website's convention exactly.
// Two modes:
//   1. Sequential: REV-004, ANN-004, TM-0002 (for simple entities)
//   2. NomId: NM-BK-A3K2-F8M9 (for transactional entities via website's generator)
// ══════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase/server";

/**
 * Generate a sequential ID by querying the max existing ID in a table.
 * Pattern: PREFIX-{SEQ} where SEQ is zero-padded.
 *
 * Examples:
 *   nextSequentialId("reviews", "review_id", "REV") → "REV-004"
 *   nextSequentialId("team_members", "member_id", "TM") → "TM-0003"
 *   nextSequentialId("announcements", "announcement_id", "ANN") → "ANN-004"
 */
export async function nextSequentialId(
  table: string,
  column: string,
  prefix: string,
  padLength = 3,
): Promise<string> {
  const db = getServiceClient();
  const { data } = await db
    .from(table)
    .select(column)
    .like(column, `${prefix}-%`)
    .order(column, { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastId = (data[0] as unknown as Record<string, string>)[column];
    // Extract the last numeric segment
    const parts = lastId.split("-");
    const lastSeg = parts[parts.length - 1];
    const parsed = parseInt(lastSeg, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return `${prefix}-${String(nextNum).padStart(padLength, "0")}`;
}

/**
 * Generate a trip-child sequential ID.
 * Pattern: PREFIX-{DEST_CODE}-{SEQ}
 *
 * Examples:
 *   nextTripChildId("trip_content", "content_id", "TC", "HMP") → "TC-HMP-04"
 *   nextTripChildId("trip_gallery", "gallery_id", "GAL", "HMP") → "GAL-HMP-04"
 */
export async function nextTripChildId(
  table: string,
  column: string,
  prefix: string,
  destCode: string,
): Promise<string> {
  const db = getServiceClient();
  const pattern = `${prefix}-${destCode}-%`;
  const { data } = await db
    .from(table)
    .select(column)
    .like(column, pattern)
    .order(column, { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastId = (data[0] as unknown as Record<string, string>)[column];
    const parts = lastId.split("-");
    const lastSeg = parts[parts.length - 1];
    const parsed = parseInt(lastSeg, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return `${prefix}-${destCode}-${String(nextNum).padStart(2, "0")}`;
}

/**
 * Generate a trip ID following the Nomichi convention.
 * Pattern: NM-TRIP-{DOM/INT}-{GT/INV}-{DEST_CODE}-{SEQ}
 *
 * @param isDomestic — whether the destination is domestic (India)
 * @param tripType — DB trip_type value
 * @param destCode — short destination code (e.g., "HMP", "JPN")
 */
export async function nextTripId(
  isDomestic: boolean,
  tripType: string,
  destCode: string,
): Promise<string> {
  const region = isDomestic ? "DOM" : "INT";
  const typeCode = tripType === "Beyond Ordinary" ? "INV"
    : tripType === "Signature Journey" ? "SJ"
    : "GT"; // Community and Plan a Trip

  const prefix = `NM-TRIP-${region}-${typeCode}-${destCode}`;

  const db = getServiceClient();
  const { data } = await db
    .from("trips")
    .select("trip_id")
    .like("trip_id", `${prefix}-%`)
    .order("trip_id", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastId = (data[0] as unknown as Record<string, string>).trip_id;
    const parts = lastId.split("-");
    const lastSeg = parts[parts.length - 1];
    const parsed = parseInt(lastSeg, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}

/**
 * Generate a destination ID.
 * Pattern: DEST-{COUNTRY_CODE}-{DEST_CODE}
 */
export function makeDestinationId(country: string, destCode: string): string {
  const countryCode = country.toUpperCase().slice(0, 3);
  return `DEST-${countryCode}-${destCode}`;
}
