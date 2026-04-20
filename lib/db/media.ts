import { getServiceClient } from "@/lib/supabase/server";
import type { DbTripGallery, DbSiteGallery, DbRawMoment } from "@/lib/types";
import { nextSequentialId } from "@/lib/ids";

// ---------------------------------------------------------------------------
// Trip Gallery
// ---------------------------------------------------------------------------

export async function getTripGalleryImages(
  tripId?: string,
): Promise<(DbTripGallery & { trip_name: string | null })[]> {
  const sb = getServiceClient();
  let query = sb
    .from("trip_gallery")
    .select("*, trips(trip_name)")
    .order("display_order", { ascending: true });

  if (tripId) {
    query = query.eq("trip_id", tripId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const trip = row.trips as { trip_name: string } | null;
    const { trips: _, ...rest } = row;
    return {
      ...rest,
      trip_name: trip?.trip_name ?? null,
    } as DbTripGallery & { trip_name: string | null };
  });
}

export async function createGalleryImage(
  payload: Omit<DbTripGallery, "gallery_id" | "created_at" | "updated_at">,
): Promise<DbTripGallery> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("trip_gallery")
    .insert({ ...payload, gallery_id: await nextSequentialId("trip_gallery", "gallery_id", "GAL") })
    .select()
    .single();

  if (error) throw error;
  return data as DbTripGallery;
}

export async function updateGalleryImage(
  id: string,
  payload: Partial<Omit<DbTripGallery, "gallery_id" | "created_at" | "updated_at">>,
): Promise<DbTripGallery> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("trip_gallery")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("gallery_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbTripGallery;
}

export async function deleteGalleryImage(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("trip_gallery")
    .delete()
    .eq("gallery_id", id);

  if (error) throw error;
}

export async function toggleGalleryFeatured(
  id: string,
  value: boolean,
): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("trip_gallery")
    .update({ is_featured: value, updated_at: new Date().toISOString() })
    .eq("gallery_id", id);

  if (error) throw error;
}

export async function toggleGalleryCover(
  tripId: string,
  galleryId: string,
): Promise<void> {
  const sb = getServiceClient();
  // Unset all covers for this trip
  const { error: unsetError } = await sb
    .from("trip_gallery")
    .update({ is_cover: false, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId);

  if (unsetError) throw unsetError;

  // Set the chosen one
  const { error: setError } = await sb
    .from("trip_gallery")
    .update({ is_cover: true, updated_at: new Date().toISOString() })
    .eq("gallery_id", galleryId);

  if (setError) throw setError;
}

// ---------------------------------------------------------------------------
// Site Gallery
// ---------------------------------------------------------------------------

export async function getSiteGalleryImages(): Promise<DbSiteGallery[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("site_gallery")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbSiteGallery[];
}

export async function createSiteGalleryImage(
  payload: Omit<DbSiteGallery, "gallery_id" | "created_at" | "updated_at">,
): Promise<DbSiteGallery> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("site_gallery")
    .insert({ ...payload, gallery_id: await nextSequentialId("site_gallery", "gallery_id", "SGL") })
    .select()
    .single();

  if (error) throw error;
  return data as DbSiteGallery;
}

export async function updateSiteGalleryImage(
  id: string,
  payload: Partial<Omit<DbSiteGallery, "gallery_id" | "created_at" | "updated_at">>,
): Promise<DbSiteGallery> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("site_gallery")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("gallery_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbSiteGallery;
}

export async function deleteSiteGalleryImage(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("site_gallery")
    .delete()
    .eq("gallery_id", id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Raw Moments
// ---------------------------------------------------------------------------

export async function getRawMoments(): Promise<DbRawMoment[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("raw_moments")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbRawMoment[];
}

export async function createRawMoment(
  payload: Omit<DbRawMoment, "moment_id" | "created_at" | "updated_at">,
): Promise<DbRawMoment> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("raw_moments")
    .insert({ ...payload, moment_id: await nextSequentialId("raw_moments", "moment_id", "MOM") })
    .select()
    .single();

  if (error) throw error;
  return data as DbRawMoment;
}

export async function updateRawMoment(
  id: string,
  payload: Partial<Omit<DbRawMoment, "moment_id" | "created_at" | "updated_at">>,
): Promise<DbRawMoment> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("raw_moments")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("moment_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbRawMoment;
}

export async function deleteRawMoment(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("raw_moments")
    .delete()
    .eq("moment_id", id);

  if (error) throw error;
}
