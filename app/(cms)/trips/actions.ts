"use server";

import { tripBasicSchema } from "@/lib/schemas/trip";
import { nextTripId, nextSequentialId } from "@/lib/ids";
import { getServiceClient } from "@/lib/supabase/server";
import { createTrip, updateTrip, deleteTrip, toggleTripField, generateUniqueSlug } from "@/lib/db/trips";
import { upsertTripContent, upsertHighlights } from "@/lib/db/trip-content";
import { saveTripItinerary, type ItineraryDayInput } from "@/lib/db/trip-itinerary";
import {
  saveTripInclusions,
  type InclusionInput,
  type ExclusionInput,
} from "@/lib/db/trip-inclusions";
import { revalidateTrip } from "@/lib/revalidate";

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
    dossier_url: string | null;
    dossier_published_at: string | null;
  };
}

function parseTripFormData(formData: FormData): TripFormPayload {
  const raw = formData.get("payload") as string;
  return JSON.parse(raw) as TripFormPayload;
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

    // Create trip record
    await createTrip({
      trip_id: tripId,
      ...parsed.data,
      slug,
      // Keep total_seats and total_slots in sync
      total_slots: parsed.data.total_slots,
      status: payload.settings.status,
      is_listed: payload.settings.is_listed,
      show_on_homepage: payload.settings.show_on_homepage,
      dossier_url: payload.settings.dossier_url,
      dossier_published_at: payload.settings.dossier_published_at,
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

    // Regenerate slug from current trip name (unique, excluding this trip)
    const slug = await generateUniqueSlug(
      parsed.data.trip_name,
      parsed.data.start_date ?? null,
      tripId,
    );

    // Update trip record
    await updateTrip(tripId, {
      ...parsed.data,
      slug,
      total_slots: parsed.data.total_slots,
      status: payload.settings.status,
      is_listed: payload.settings.is_listed,
      show_on_homepage: payload.settings.show_on_homepage,
      dossier_url: payload.settings.dossier_url,
      dossier_published_at: payload.settings.dossier_published_at,
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
    await revalidateTrip(slug);
    return { success: true };
  } catch (err) {
    console.error("[toggleTripFieldAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle field",
    };
  }
}
