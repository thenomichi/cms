// ══════════════════════════════════════════════
// Nomichi CMS — ID Generator
// All sequential IDs go through Postgres RPCs that use a counters table
// updated atomically (UPDATE ... RETURNING). Two parallel CMS calls produce
// distinct IDs — verified live.
// ══════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase/server";

/**
 * Generate a sequential ID via the nm_next_sequential_id RPC.
 * Pattern: PREFIX-{SEQ} where SEQ is zero-padded.
 */
export async function nextSequentialId(
  table: string,
  column: string,
  prefix: string,
  padLength = 3,
): Promise<string> {
  const db = getServiceClient();
  const { data, error } = await db.rpc("nm_next_sequential_id", {
    p_table: table,
    p_column: column,
    p_prefix: prefix,
    p_pad: padLength,
  });
  if (error) throw new Error(`nextSequentialId(${table}, ${prefix}) failed: ${error.message}`);
  return data as string;
}

/**
 * Generate a trip-child sequential ID via the nm_next_trip_child_id RPC.
 * Pattern: PREFIX-{DEST_CODE}-{SEQ}
 */
export async function nextTripChildId(
  table: string,
  column: string,
  prefix: string,
  destCode: string,
  padLength = 2,
): Promise<string> {
  const db = getServiceClient();
  const { data, error } = await db.rpc("nm_next_trip_child_id", {
    p_table: table,
    p_column: column,
    p_prefix: prefix,
    p_dest_code: destCode,
    p_pad: padLength,
  });
  if (error) throw new Error(`nextTripChildId(${table}, ${prefix}-${destCode}) failed: ${error.message}`);
  return data as string;
}

/**
 * Trip ID. Pattern: NM-TRIP-{DOM/INT}-{GT/INV/SJ}-{DEST_CODE}-{SEQ}
 */
export async function nextTripId(
  isDomestic: boolean,
  tripType: string,
  destCode: string,
): Promise<string> {
  const region = isDomestic ? "DOM" : "INT";
  const typeCode =
    tripType === "Beyond Ordinary" ? "INV"
    : tripType === "Signature Journey" ? "SJ"
    : tripType === "Customized Trips Only" ? "CT"
    : "GT"; // Community

  const prefix = `NM-TRIP-${region}-${typeCode}-${destCode}`;
  return nextSequentialId("trips", "trip_id", prefix, 4);
}

/**
 * Pure-string destination ID. Pattern: DEST-{COUNTRY_CODE}-{DEST_CODE}
 */
export function makeDestinationId(country: string, destCode: string): string {
  const countryCode = country.toUpperCase().slice(0, 3);
  return `DEST-${countryCode}-${destCode}`;
}
