import { getServiceClient } from "@/lib/supabase/server";
import type { DbTrip } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  // Meaningful numbers
  activeTrips: number;
  totalTrips: number;
  pendingReviews: number;
  totalReviews: number;
  newSuggestions: number;
  totalSuggestions: number;
  totalGalleryImages: number;

  // Upcoming departures (next 60 days)
  upcomingDepartures: (DbTrip & { destination_name: string | null })[];

  // Needs attention items
  tripsNeedingImages: { trip_id: string; trip_name: string }[];
  draftTrips: { trip_id: string; trip_name: string }[];

  // Recent trips
  recentTrips: (DbTrip & { destination_name: string | null })[];
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getServiceClient();
  const now = new Date().toISOString();
  const sixtyDaysLater = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    activeTripsRes,
    totalTripsRes,
    pendingReviewsRes,
    totalReviewsRes,
    newSuggestionsRes,
    totalSuggestionsRes,
    galleryRes,
    upcomingRes,
    recentTripsRes,
    draftTripsRes,
  ] = await Promise.all([
    // Active = listed + not cancelled
    db.from("trips").select("*", { count: "exact", head: true })
      .eq("is_listed", true).neq("status", "Cancelled"),
    db.from("trips").select("*", { count: "exact", head: true }),
    // Pending = not approved
    db.from("reviews").select("*", { count: "exact", head: true })
      .eq("is_approved", false),
    db.from("reviews").select("*", { count: "exact", head: true }),
    // New = pipeline_status is 'New Request'
    db.from("customized_trip_requests").select("*", { count: "exact", head: true })
      .eq("pipeline_status", "New Request"),
    db.from("customized_trip_requests").select("*", { count: "exact", head: true }),
    db.from("trip_gallery").select("*", { count: "exact", head: true }),
    // Upcoming departures in next 60 days
    db.from("trips").select("*, destinations(destination_name)")
      .gte("start_date", now.split("T")[0])
      .lte("start_date", sixtyDaysLater.split("T")[0])
      .neq("status", "Cancelled")
      .order("start_date", { ascending: true })
      .limit(10),
    // Recent 5
    db.from("trips").select("*, destinations(destination_name)")
      .order("created_at", { ascending: false }).limit(5),
    // Draft trips (not yet listed)
    db.from("trips").select("trip_id, trip_name")
      .eq("status", "Draft").limit(5),
  ]);

  // Map destination joins
  const mapTrips = (rows: Record<string, unknown>[]) =>
    rows.map((row) => {
      const dest = row.destinations as { destination_name: string } | null;
      const { destinations: _, ...trip } = row;
      return { ...trip, destination_name: dest?.destination_name ?? null } as DbTrip & { destination_name: string | null };
    });

  // Trips with no gallery images
  const tripsWithImages = await db.from("trip_gallery")
    .select("trip_id")
    .not("trip_id", "is", null);
  const tripIdsWithImages = new Set(
    (tripsWithImages.data ?? []).map((r: { trip_id: string }) => r.trip_id),
  );
  const allListedTrips = await db.from("trips")
    .select("trip_id, trip_name")
    .eq("is_listed", true);
  const tripsNeedingImages = (allListedTrips.data ?? [])
    .filter((t: { trip_id: string }) => !tripIdsWithImages.has(t.trip_id))
    .slice(0, 5) as { trip_id: string; trip_name: string }[];

  return {
    activeTrips: activeTripsRes.count ?? 0,
    totalTrips: totalTripsRes.count ?? 0,
    pendingReviews: pendingReviewsRes.count ?? 0,
    totalReviews: totalReviewsRes.count ?? 0,
    newSuggestions: newSuggestionsRes.count ?? 0,
    totalSuggestions: totalSuggestionsRes.count ?? 0,
    totalGalleryImages: galleryRes.count ?? 0,
    upcomingDepartures: mapTrips(upcomingRes.data ?? []),
    recentTrips: mapTrips(recentTripsRes.data ?? []),
    tripsNeedingImages,
    draftTrips: (draftTripsRes.data ?? []).slice(0, 5) as { trip_id: string; trip_name: string }[],
  };
}
