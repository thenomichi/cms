import { getServiceClient } from "@/lib/supabase/server";
import type {
  DbTrip,
  DbTripContent,
  DbTripItinerary,
  DbTripInclusion,
  DbTripFaq,
  DbTripGallery,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// List trips (with destination name)
// ---------------------------------------------------------------------------

export interface TripWithDestination extends DbTrip {
  destination_name: string | null;
}

export async function getTrips(filters?: {
  tripType?: string;
  search?: string;
}): Promise<TripWithDestination[]> {
  const db = getServiceClient();
  let query = db
    .from("trips")
    .select("*, destinations(destination_name)")
    .order("created_at", { ascending: false });

  if (filters?.tripType) {
    query = query.eq("trip_type", filters.tripType);
  }
  if (filters?.search) {
    query = query.ilike("trip_name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getTrips failed: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const dest = row.destinations as { destination_name: string } | null;
    const { destinations: _, ...trip } = row;
    return {
      ...trip,
      destination_name: dest?.destination_name ?? null,
    } as TripWithDestination;
  });
}

// ---------------------------------------------------------------------------
// Single trip with all child data
// ---------------------------------------------------------------------------

export interface TripFull extends DbTrip {
  destination_name: string | null;
  content: DbTripContent[];
  itinerary: DbTripItinerary[];
  inclusions: DbTripInclusion[];
  faqs: DbTripFaq[];
  gallery: DbTripGallery[];
}

export async function getTripById(id: string): Promise<TripFull | null> {
  const db = getServiceClient();

  const [tripRes, contentRes, itineraryRes, inclusionsRes, faqsRes, galleryRes] =
    await Promise.all([
      db
        .from("trips")
        .select("*, destinations(destination_name)")
        .eq("trip_id", id)
        .single(),
      db
        .from("trip_content")
        .select("*")
        .eq("trip_id", id)
        .order("content_order", { ascending: true }),
      db
        .from("trip_itinerary")
        .select("*")
        .eq("trip_id", id)
        .order("day_number", { ascending: true }),
      db
        .from("trip_inclusions")
        .select("*")
        .eq("trip_id", id)
        .order("display_order", { ascending: true }),
      db
        .from("trip_faqs")
        .select("*")
        .eq("trip_id", id)
        .order("display_order", { ascending: true }),
      db
        .from("trip_gallery")
        .select("*")
        .eq("trip_id", id)
        .order("display_order", { ascending: true }),
    ]);

  if (tripRes.error || !tripRes.data) return null;

  const row = tripRes.data as Record<string, unknown>;
  const dest = row.destinations as { destination_name: string } | null;
  const { destinations: _, ...trip } = row;

  return {
    ...trip,
    destination_name: dest?.destination_name ?? null,
    content: (contentRes.data ?? []) as DbTripContent[],
    itinerary: (itineraryRes.data ?? []) as DbTripItinerary[],
    inclusions: (inclusionsRes.data ?? []) as DbTripInclusion[],
    faqs: (faqsRes.data ?? []) as DbTripFaq[],
    gallery: (galleryRes.data ?? []) as DbTripGallery[],
  } as TripFull;
}

// ---------------------------------------------------------------------------
// Unique slug generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique slug for a trip. If "ladakh" is taken, tries "ladakh-jan-2026",
 * then "ladakh-2", "ladakh-3", etc. Excludes the current trip when editing.
 */
export async function generateUniqueSlug(
  baseName: string,
  startDate: string | null,
  excludeTripId?: string,
): Promise<string> {
  const db = getServiceClient();
  const { slugify } = await import("@/lib/utils");
  const base = slugify(baseName);
  if (!base) return `trip-${Date.now()}`;

  async function slugExists(slug: string): Promise<boolean> {
    let query = db
      .from("trips")
      .select("trip_id", { count: "exact", head: true })
      .eq("slug", slug);
    if (excludeTripId) query = query.neq("trip_id", excludeTripId);
    const { count } = await query;
    return (count ?? 0) > 0;
  }

  // Try base slug first
  if (!(await slugExists(base))) return base;

  // Try with month-year suffix from start_date (e.g., "ladakh-jan-2026")
  if (startDate) {
    const d = new Date(startDate);
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const monthSlug = `${base}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
    if (!(await slugExists(monthSlug))) return monthSlug;
  }

  // Fallback: numeric suffix
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!(await slugExists(candidate))) return candidate;
  }

  // Ultimate fallback
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Create / Update / Delete
// ---------------------------------------------------------------------------

export async function createTrip(
  data: Partial<DbTrip> & { trip_id: string },
): Promise<string> {
  const db = getServiceClient();
  const { error } = await db.from("trips").insert(data);
  if (error) throw new Error(`createTrip failed: ${error.message}`);
  return data.trip_id;
}

export async function updateTrip(
  id: string,
  data: Partial<DbTrip>,
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("trips").update(data).eq("trip_id", id);
  if (error) throw new Error(`updateTrip failed: ${error.message}`);
}

export async function deleteTrip(id: string): Promise<void> {
  const db = getServiceClient();

  // Delete children first (cascade doesn't always apply via service key)
  await Promise.all([
    db.from("trip_content").delete().eq("trip_id", id),
    db.from("trip_itinerary").delete().eq("trip_id", id),
    db.from("trip_inclusions").delete().eq("trip_id", id),
    db.from("trip_faqs").delete().eq("trip_id", id),
    db.from("trip_gallery").delete().eq("trip_id", id),
  ]);

  const { error } = await db.from("trips").delete().eq("trip_id", id);
  if (error) throw new Error(`deleteTrip failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Toggle fields
// ---------------------------------------------------------------------------

export async function toggleTripField(
  id: string,
  field: "is_listed" | "show_on_homepage",
  value: boolean,
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("trips")
    .update({ [field]: value })
    .eq("trip_id", id);
  if (error) throw new Error(`toggleTripField failed: ${error.message}`);
}
