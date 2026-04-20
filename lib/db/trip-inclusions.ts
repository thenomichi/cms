import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import type { DbTripInclusion } from "@/lib/types";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTripInclusions(tripId: string): Promise<{
  inclusions: DbTripInclusion[];
  exclusions: DbTripInclusion[];
}> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("trip_inclusions")
    .select("*")
    .eq("trip_id", tripId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`getTripInclusions failed: ${error.message}`);

  const all = (data ?? []) as DbTripInclusion[];
  return {
    inclusions: all.filter((r) => r.inclusion_type === "inclusion"),
    exclusions: all.filter((r) => r.inclusion_type === "exclusion"),
  };
}

// ---------------------------------------------------------------------------
// Save (atomic replace)
// ---------------------------------------------------------------------------

export interface InclusionInput {
  icon?: string | null;
  name: string;
  note?: string | null;
}

export interface ExclusionInput {
  name: string;
}

export async function saveTripInclusions(
  tripId: string,
  inclusions: InclusionInput[],
  exclusions: ExclusionInput[],
): Promise<void> {
  const db = getServiceClient();

  // Delete all existing
  await db.from("trip_inclusions").delete().eq("trip_id", tripId);

  // Generate IDs sequentially to avoid duplicate IDs from parallel queries
  const rows = [];
  for (let idx = 0; idx < inclusions.length; idx++) {
    const item = inclusions[idx];
    rows.push({
      inclusion_id: await nextSequentialId("trip_inclusions", "inclusion_id", "INC"),
      trip_id: tripId,
      inclusion_type: "inclusion" as const,
      icon: item.icon ?? null,
      name: item.name,
      note: item.note ?? null,
      display_order: idx,
      is_active: true,
    });
  }
  for (let idx = 0; idx < exclusions.length; idx++) {
    const item = exclusions[idx];
    rows.push({
      inclusion_id: await nextSequentialId("trip_inclusions", "inclusion_id", "INC"),
      trip_id: tripId,
      inclusion_type: "exclusion" as const,
      icon: null,
      name: item.name,
      note: null,
      display_order: idx,
      is_active: true,
    });
  }

  if (rows.length === 0) return;

  const { error } = await db.from("trip_inclusions").insert(rows);
  if (error) throw new Error(`saveTripInclusions failed: ${error.message}`);
}
