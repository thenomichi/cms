import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import type { DbTripItinerary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTripItinerary(
  tripId: string,
): Promise<DbTripItinerary[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("trip_itinerary")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true });
  if (error) throw new Error(`getTripItinerary failed: ${error.message}`);
  return (data ?? []) as DbTripItinerary[];
}

// ---------------------------------------------------------------------------
// Save (atomic replace)
// ---------------------------------------------------------------------------

export interface ItineraryDayInput {
  day_number: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  meals?: string | null;
  accommodation?: string | null;
  tags?: string | null;
}

export async function saveTripItinerary(
  tripId: string,
  days: ItineraryDayInput[],
): Promise<void> {
  const db = getServiceClient();

  // Delete all existing
  await db.from("trip_itinerary").delete().eq("trip_id", tripId);

  if (days.length === 0) return;

  // Generate IDs sequentially to avoid duplicate IDs from parallel queries
  const rows = [];
  for (let idx = 0; idx < days.length; idx++) {
    const day = days[idx];
    rows.push({
      itinerary_id: await nextSequentialId("trip_itinerary", "itinerary_id", "ITIN"),
      trip_id: tripId,
      day_number: day.day_number,
      title: day.title,
      subtitle: day.subtitle ?? null,
      description: day.description ?? null,
      meals: day.meals ?? null,
      accommodation: day.accommodation ?? null,
      tags: day.tags ?? null,
      display_order: idx,
      is_active: true,
    });
  }

  const { error } = await db.from("trip_itinerary").insert(rows);
  if (error) throw new Error(`saveTripItinerary failed: ${error.message}`);
}
