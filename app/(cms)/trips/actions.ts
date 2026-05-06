"use server";

import { tripBasicSchema } from "@/lib/schemas/trip";
import { nextTripId, nextSequentialId } from "@/lib/ids";
import { getServiceClient } from "@/lib/supabase/server";
import { createTrip, updateTrip, deleteTrip, toggleTripField, generateUniqueSlug, cloneAsBatch, getTripById, isPubliclyListable, TripNotListableError } from "@/lib/db/trips";
import { upsertTripContent, upsertHighlights } from "@/lib/db/trip-content";
import { saveTripItinerary, type ItineraryDayInput } from "@/lib/db/trip-itinerary";
import {
  saveTripInclusions,
  type InclusionInput,
  type ExclusionInput,
} from "@/lib/db/trip-inclusions";
import { revalidateTrip } from "@/lib/revalidate";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/audit";

/**
 * Fire `logActivity` without awaiting. Errors are logged but never
 * propagated to the caller — activity logging is best-effort and
 * should never block the user-visible save path.
 */
function logActivityAsync(input: Parameters<typeof logActivity>[0]): void {
  void logActivity(input).catch((err) => {
    console.error("[logActivity] swallowed error:", err);
  });
}

// Memoize the bucket allowlist check at module scope. The check is
// idempotent and read-mostly; running it once per server lifetime is
// safe and removes a hot-path import + roundtrip per upload.
let _bucketAllowlistReady: Promise<void> | null = null;
function ensureBucketAllowlistOnce(): Promise<void> {
  if (!_bucketAllowlistReady) {
    _bucketAllowlistReady = (async () => {
      const { ensureCmsMediaBucketAllowsItineraryUploads } = await import(
        "@/app/(cms)/settings/actions"
      );
      await ensureCmsMediaBucketAllowsItineraryUploads();
    })().catch((err) => {
      // If the check fails, clear the cache so the next upload retries
      // (rather than poisoning the cache for the rest of the process).
      _bucketAllowlistReady = null;
      throw err;
    });
  }
  return _bucketAllowlistReady;
}

// ---------------------------------------------------------------------------
// Shared form-data parsing
// ---------------------------------------------------------------------------

interface TripFormPayload {
  basic: Record<string, unknown>;
  overview: string;
  description: string;
  tagline: string;
  highlights: string[];
  itinerary: ItineraryDayInput[];
  inclusions: InclusionInput[];
  exclusions: ExclusionInput[];
  settings: {
    status: string;
    is_listed: boolean;
    show_on_homepage: boolean;
    // dossier_url is historical naming — the website's "Download Itinerary"
    // link reads this column. CMS exposes it as "Trip Itinerary".
    dossier_url: string | null;
  };
}

function parseTripFormData(formData: FormData): TripFormPayload {
  const raw = formData.get("payload") as string;
  return JSON.parse(raw) as TripFormPayload;
}

/**
 * Reject saves that try to enable is_listed or show_on_homepage on a trip
 * whose status doesn't allow public listing (Draft or Cancelled). Returns
 * an error message, or null if the combination is valid.
 */
function validateListableStatus(settings: TripFormPayload["settings"]): string | null {
  const wantsPublic = settings.is_listed || settings.show_on_homepage;
  if (wantsPublic && !isPubliclyListable(settings.status)) {
    return `A trip in status "${settings.status}" cannot be listed on the website or shown on the homepage. Move it to Upcoming, Ongoing, or Completed first.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTripAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = parseTripFormData(formData);
    const parsed = tripBasicSchema.safeParse(payload.basic);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const statusErr = validateListableStatus(payload.settings);
    if (statusErr) return { success: false, error: statusErr };

    // Look up destination to build the trip ID
    let isDomestic = true;
    let destCode = "GEN"; // fallback
    if (parsed.data.destination_id) {
      const db = getServiceClient();
      const { data: dest } = await db.from("destinations")
        .select("is_domestic, destination_code")
        .eq("destination_id", parsed.data.destination_id)
        .single();
      if (dest) {
        isDomestic = dest.is_domestic;
        // Extract short code: "HAMPI" → "HMP" (first 3 consonants or first 3 chars)
        destCode = dest.destination_code.replace(/-/g, "").slice(0, 3).toUpperCase();
      }
    }
    const tripId = await nextTripId(isDomestic, parsed.data.trip_type, destCode);
    const slug = await generateUniqueSlug(
      parsed.data.trip_name,
      parsed.data.start_date ?? null,
    );

    // If status doesn't allow public listing, force the flags off — even if
    // the form sent them on. validateListableStatus already rejects that
    // combination, but defense in depth.
    const canBePublic = isPubliclyListable(payload.settings.status);

    // Create trip record
    await createTrip({
      trip_id: tripId,
      ...parsed.data,
      slug,
      // Keep total_seats and total_slots in sync
      total_slots: parsed.data.total_slots,
      status: payload.settings.status,
      is_listed: canBePublic ? payload.settings.is_listed : false,
      show_on_homepage: canBePublic ? payload.settings.show_on_homepage : false,
      dossier_url: payload.settings.dossier_url,
      // dossier_published_at retired from the CMS form. Always null so the
      // website's bookings page shows the itinerary as soon as dossier_url
      // is set, instead of gating on a date that admins no longer fill.
      dossier_published_at: null,
    });

    // Save content
    await Promise.all([
      payload.overview
        ? upsertTripContent(tripId, "overview", payload.overview)
        : Promise.resolve(),
      payload.description
        ? upsertTripContent(tripId, "description", payload.description)
        : Promise.resolve(),
      payload.tagline
        ? upsertTripContent(tripId, "tagline", payload.tagline)
        : Promise.resolve(),
      upsertHighlights(tripId, payload.highlights.filter(Boolean)),
    ]);

    // Save itinerary
    if (payload.itinerary.length > 0) {
      await saveTripItinerary(tripId, payload.itinerary);
    }

    // Save inclusions / exclusions
    await saveTripInclusions(
      tripId,
      payload.inclusions,
      payload.exclusions,
    );

    logActivityAsync({ table_name: "trips", record_id: tripId, action: "INSERT", new_values: { trip_name: parsed.data.trip_name, status: payload.settings.status, slug } });
    await revalidateTrip(slug);
    return { success: true };
  } catch (err) {
    console.error("[createTripAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create trip",
    };
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTripAction(
  tripId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = parseTripFormData(formData);
    const parsed = tripBasicSchema.safeParse(payload.basic);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const statusErr = validateListableStatus(payload.settings);
    if (statusErr) return { success: false, error: statusErr };

    // Regenerate slug from current trip name (unique, excluding this trip)
    const slug = await generateUniqueSlug(
      parsed.data.trip_name,
      parsed.data.start_date ?? null,
      tripId,
    );

    // If the user moves status to a non-listable state, force the flags off
    // so a trip can never be marked Draft/Cancelled while still public.
    const canBePublic = isPubliclyListable(payload.settings.status);

    // Update trip record
    await updateTrip(tripId, {
      ...parsed.data,
      slug,
      total_slots: parsed.data.total_slots,
      status: payload.settings.status,
      is_listed: canBePublic ? payload.settings.is_listed : false,
      show_on_homepage: canBePublic ? payload.settings.show_on_homepage : false,
      dossier_url: payload.settings.dossier_url,
      // dossier_published_at retired from the CMS form (see createTripAction).
      dossier_published_at: null,
    });

    // Save content
    await Promise.all([
      payload.overview
        ? upsertTripContent(tripId, "overview", payload.overview)
        : Promise.resolve(),
      payload.description
        ? upsertTripContent(tripId, "description", payload.description)
        : Promise.resolve(),
      payload.tagline
        ? upsertTripContent(tripId, "tagline", payload.tagline)
        : Promise.resolve(),
      upsertHighlights(tripId, payload.highlights.filter(Boolean)),
    ]);

    // Save itinerary
    await saveTripItinerary(tripId, payload.itinerary);

    // Save inclusions / exclusions
    await saveTripInclusions(
      tripId,
      payload.inclusions,
      payload.exclusions,
    );

    logActivityAsync({ table_name: "trips", record_id: tripId, action: "UPDATE", new_values: { trip_name: parsed.data.trip_name, status: payload.settings.status, slug } });
    await revalidateTrip(slug);
    return { success: true };
  } catch (err) {
    console.error("[updateTripAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update trip",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteTripAction(
  tripId: string,
  slug: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteTrip(tripId);
    logActivityAsync({ table_name: "trips", record_id: tripId, action: "DELETE" });
    await revalidateTrip(slug);
    return { success: true };
  } catch (err) {
    console.error("[deleteTripAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete trip",
    };
  }
}

// ---------------------------------------------------------------------------
// Itinerary PDF upload
//
// Stores the PDF at cms-media/trip-itinerary/{tripId}-{ts}.pdf and returns
// the public URL. The caller writes the URL into trips.dossier_url (the
// column name is historical — the website uses it as the "Download
// Itinerary" link).
// ---------------------------------------------------------------------------

const ITINERARY_PDF_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ITINERARY_BUCKET_PATH = "trip-itinerary";

export async function uploadTripItineraryAction(
  tripId: string,
  file: File,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!tripId || !/^[A-Za-z0-9_-]+$/.test(tripId)) {
    return { success: false, error: "Invalid trip id" };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "Only PDF files are allowed" };
  }
  if (file.size > ITINERARY_PDF_MAX_BYTES) {
    return { success: false, error: `File exceeds 25MB limit` };
  }

  try {
    // Make sure the cms-media bucket has application/pdf in its allowlist.
    // No-op on bucket configurations that already include it; idempotent.
    await ensureBucketAllowlistOnce();

    const { uploadImage } = await import("@/lib/storage/upload");
    const path = `${ITINERARY_BUCKET_PATH}/${tripId}-${Date.now()}.pdf`;
    const url = await uploadImage(file, path);
    logActivityAsync({
      table_name: "trips",
      record_id: tripId,
      action: "UPDATE",
      new_values: { itinerary_uploaded: true, itinerary_path: path },
    });
    return { success: true, url };
  } catch (err) {
    console.error("[uploadTripItineraryAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

export async function toggleTripFieldAction(
  tripId: string,
  field: "is_listed" | "show_on_homepage",
  value: boolean,
  slug: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await toggleTripField(tripId, field, value);
    logActivityAsync({ table_name: "trips", record_id: tripId, action: "UPDATE", new_values: { [field]: value } });
    await revalidateTrip(slug);
    return { success: true };
  } catch (err) {
    if (err instanceof TripNotListableError) {
      return { success: false, error: err.message };
    }
    console.error("[toggleTripFieldAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle field",
    };
  }
}

// ---------------------------------------------------------------------------
// Clone as Batch
// ---------------------------------------------------------------------------

export async function cloneAsBatchAction(
  sourceTripId: string,
): Promise<{ success: boolean; newTripId?: string; error?: string }> {
  try {
    const source = await getTripById(sourceTripId);
    if (!source) return { success: false, error: "Source trip not found" };

    // Look up destination to build the trip ID (same pattern as createTripAction)
    let isDomestic = true;
    let destCode = "GEN";
    if (source.destination_id) {
      const db = getServiceClient();
      const { data: dest } = await db
        .from("destinations")
        .select("is_domestic, destination_code")
        .eq("destination_id", source.destination_id)
        .single();
      if (dest) {
        isDomestic = dest.is_domestic;
        destCode = dest.destination_code.replace(/-/g, "").slice(0, 3).toUpperCase();
      }
    }

    const newTripId = await nextTripId(
      isDomestic,
      source.trip_type ?? "Community",
      destCode,
    );

    const newSlug = await generateUniqueSlug(
      source.trip_name ?? "batch",
      null, // no start date yet — admin will set it
      sourceTripId, // exclude source from uniqueness check
    );

    await cloneAsBatch(sourceTripId, newTripId, newSlug);

    logActivityAsync({
      table_name: "trips",
      record_id: newTripId,
      action: "INSERT",
      new_values: { cloned_from: sourceTripId, trip_name: source.trip_name },
    });
    revalidatePath("/trips");
    return { success: true, newTripId };
  } catch (err) {
    console.error("[cloneAsBatchAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create batch",
    };
  }
}
