import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import type { DbTripContent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTripContent(
  tripId: string,
): Promise<DbTripContent[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("trip_content")
    .select("*")
    .eq("trip_id", tripId)
    .order("content_order", { ascending: true });
  if (error) throw new Error(`getTripContent failed: ${error.message}`);
  return (data ?? []) as DbTripContent[];
}

// ---------------------------------------------------------------------------
// Upsert a single content row
// ---------------------------------------------------------------------------

export async function upsertTripContent(
  tripId: string,
  contentType: string,
  text: string,
  order = 0,
): Promise<void> {
  const db = getServiceClient();

  // Check if this content type already exists for the trip
  const { data: existing } = await db
    .from("trip_content")
    .select("content_id")
    .eq("trip_id", tripId)
    .eq("content_type", contentType)
    .eq("content_order", order)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("trip_content")
      .update({ content_text: text, updated_at: new Date().toISOString() })
      .eq("content_id", existing.content_id);
    if (error) throw new Error(`upsertTripContent update failed: ${error.message}`);
  } else {
    const { error } = await db.from("trip_content").insert({
      content_id: await nextSequentialId("trip_content", "content_id", "TC"),
      trip_id: tripId,
      content_type: contentType,
      content_text: text,
      content_order: order,
      is_active: true,
    });
    if (error) throw new Error(`upsertTripContent insert failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteTripContent(contentId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("trip_content")
    .delete()
    .eq("content_id", contentId);
  if (error) throw new Error(`deleteTripContent failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Bulk upsert highlights
// ---------------------------------------------------------------------------

export async function upsertHighlights(
  tripId: string,
  highlights: string[],
): Promise<void> {
  const db = getServiceClient();

  // Delete all existing highlights for this trip
  await db
    .from("trip_content")
    .delete()
    .eq("trip_id", tripId)
    .eq("content_type", "highlight");

  if (highlights.length === 0) return;

  // Insert new ones
  // Generate IDs sequentially to avoid duplicate IDs from parallel queries
  const rows = [];
  for (let idx = 0; idx < highlights.length; idx++) {
    rows.push({
      content_id: await nextSequentialId("trip_content", "content_id", "TC"),
      trip_id: tripId,
      content_type: "highlight",
      content_text: highlights[idx],
      content_order: idx,
      is_active: true,
    });
  }

  const { error } = await db.from("trip_content").insert(rows);
  if (error) throw new Error(`upsertHighlights failed: ${error.message}`);
}
