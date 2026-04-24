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
  batch_count?: number;
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

  const rows = (data ?? []).map((row: Record<string, unknown>) => {
    const dest = row.destinations as { destination_name: string } | null;
    const { destinations: _, ...trip } = row;
    return {
      ...trip,
      destination_name: dest?.destination_name ?? null,
    } as TripWithDestination;
  });

  // Compute batch counts for grouped trips
  const groupSlugs = [
    ...new Set(rows.filter((t) => t.group_slug).map((t) => t.group_slug!)),
  ];
  const batchCounts = new Map<string, number>();
  for (const gs of groupSlugs) {
    batchCounts.set(gs, rows.filter((t) => t.group_slug === gs).length);
  }
  return rows.map((t) => ({
    ...t,
    batch_count: t.group_slug ? batchCounts.get(t.group_slug) ?? 1 : undefined,
  }));
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

// ---------------------------------------------------------------------------
// Clone a trip as a new batch (same experience, different dates/slots)
// ---------------------------------------------------------------------------

export async function cloneAsBatch(
  sourceTripId: string,
  newTripId: string,
  newSlug: string,
): Promise<DbTrip> {
  const sb = getServiceClient();

  // 1. Fetch source trip
  const { data: source, error: srcErr } = await sb
    .from("trips")
    .select("*")
    .eq("trip_id", sourceTripId)
    .single();
  if (srcErr || !source) throw new Error("Source trip not found");

  // 2. Determine group_slug
  const groupSlug = source.group_slug ?? source.slug ?? sourceTripId;

  // 3. Update source's group_slug if it wasn't set
  if (!source.group_slug) {
    await sb
      .from("trips")
      .update({ group_slug: groupSlug, updated_at: new Date().toISOString() })
      .eq("trip_id", sourceTripId);
  }

  // 4. Create new trip row (clone shared fields, clear batch-specific fields)
  const newTrip = {
    trip_id: newTripId,
    slug: newSlug,
    group_slug: groupSlug,
    trip_name: source.trip_name,
    trip_type: source.trip_type,
    trip_sub_type: source.trip_sub_type,
    trip_category: source.trip_category,
    destination_id: source.destination_id,
    duration_days: source.duration_days,
    duration_nights: source.duration_nights,
    departure_city: source.departure_city,
    departure_airport: source.departure_airport,
    advance_pct: source.advance_pct,
    booking_kind: source.booking_kind,
    currency_code: source.currency_code,
    tagline: source.tagline,
    tags: source.tags,
    price_per: source.price_per,
    number_of_pax: source.number_of_pax,
    trip_captain_id: source.trip_captain_id,
    cancellation_policy_id: source.cancellation_policy_id,
    // Batch-specific fields: leave empty for admin to fill
    start_date: null,
    end_date: null,
    mrp_price: source.mrp_price,
    selling_price: source.selling_price,
    discount_pct: source.discount_pct,
    quoted_price: source.quoted_price,
    total_slots: source.total_slots,
    booked_slots: 0,
    status: "Draft",
    is_listed: false,
    show_on_homepage: false,
    batch_number: null,
    dossier_url: null,
    dossier_published_at: null,
  };

  const { data: created, error: createErr } = await sb
    .from("trips")
    .insert(newTrip)
    .select()
    .single();
  if (createErr) throw createErr;

  // 5. Clone child records
  await cloneChildRecords(sb, sourceTripId, newTripId);

  return created as DbTrip;
}

async function cloneChildRecords(
  sb: ReturnType<typeof getServiceClient>,
  sourceTripId: string,
  newTripId: string,
) {
  // Clone trip_content
  const { data: content } = await sb
    .from("trip_content")
    .select("*")
    .eq("trip_id", sourceTripId);
  if (content && content.length > 0) {
    const cloned = content.map((c: Record<string, unknown>, i: number) => ({
      ...c,
      content_id: `${newTripId}-TC-${String(i + 1).padStart(4, "0")}`,
      trip_id: newTripId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await sb.from("trip_content").insert(cloned);
  }

  // Clone trip_itinerary
  const { data: itinerary } = await sb
    .from("trip_itinerary")
    .select("*")
    .eq("trip_id", sourceTripId);
  if (itinerary && itinerary.length > 0) {
    const cloned = itinerary.map((it: Record<string, unknown>, i: number) => ({
      ...it,
      itinerary_id: `${newTripId}-ITIN-${String(i + 1).padStart(4, "0")}`,
      trip_id: newTripId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await sb.from("trip_itinerary").insert(cloned);
  }

  // Clone trip_inclusions
  const { data: inclusions } = await sb
    .from("trip_inclusions")
    .select("*")
    .eq("trip_id", sourceTripId);
  if (inclusions && inclusions.length > 0) {
    const cloned = inclusions.map((inc: Record<string, unknown>, i: number) => ({
      ...inc,
      inclusion_id: `${newTripId}-INC-${String(i + 1).padStart(4, "0")}`,
      trip_id: newTripId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await sb.from("trip_inclusions").insert(cloned);
  }

  // Clone trip_gallery
  const { data: gallery } = await sb
    .from("trip_gallery")
    .select("*")
    .eq("trip_id", sourceTripId);
  if (gallery && gallery.length > 0) {
    const cloned = gallery.map((g: Record<string, unknown>, i: number) => ({
      ...g,
      gallery_id: `${newTripId}-GAL-${String(i + 1).padStart(4, "0")}`,
      trip_id: newTripId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await sb.from("trip_gallery").insert(cloned);
  }

  // Clone trip_faqs
  const { data: faqs } = await sb
    .from("trip_faqs")
    .select("*")
    .eq("trip_id", sourceTripId);
  if (faqs && faqs.length > 0) {
    const cloned = faqs.map((f: Record<string, unknown>, i: number) => ({
      ...f,
      faq_id: `${newTripId}-FAQ-${String(i + 1).padStart(4, "0")}`,
      trip_id: newTripId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await sb.from("trip_faqs").insert(cloned);
  }
}
