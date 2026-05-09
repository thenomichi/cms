"use server";

import { revalidatePath } from "next/cache";
import {
  getTripGalleryImages,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  toggleGalleryFeatured,
  toggleGalleryCover,
  getSiteGalleryImages,
  createSiteGalleryImage,
  updateSiteGalleryImage,
  deleteSiteGalleryImage,
  getRawMoments,
  createRawMoment,
  updateRawMoment,
  deleteRawMoment,
} from "@/lib/db/media";
import { getStorageProvider } from "@/lib/storage";
import { buildPath } from "@/lib/storage/paths";
import { validateUploadInput } from "@/lib/storage/validate";
import type { UploadTicket } from "@/lib/storage/provider";
import { revalidateHome } from "@/lib/revalidate";
import type { DbTripGallery, DbSiteGallery, DbRawMoment } from "@/lib/types";
import { logActivity } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Trip Gallery — Direct-upload prepare + register
// ---------------------------------------------------------------------------

export async function prepareTripGalleryUploadAction(input: {
  tripId: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }> {
  const v = validateUploadInput("tripGallery", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("tripGallery", { tripId: input.tripId, fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function registerTripGalleryAction(input: {
  tripId: string;
  path: string;
  publicUrl: string;
  category: string;
  altText?: string;
  caption?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await createGalleryImage({
      trip_id: input.tripId,
      image_url: input.publicUrl,
      image_path: input.path,
      thumbnail_url: null,
      alt_text: input.altText ?? null,
      caption: input.caption ?? null,
      category: input.category as DbTripGallery["category"],
      is_cover: false,
      is_featured: false,
      is_active: true,
      photographer: null,
      display_order: 0,
    });
    await logActivity({
      table_name: "trip_gallery",
      record_id: input.tripId,
      action: "INSERT",
      new_values: { category: input.category, image_url: input.publicUrl, image_path: input.path },
    });
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Site Gallery — Direct-upload prepare + register
// ---------------------------------------------------------------------------

export async function prepareSiteGalleryUploadAction(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }> {
  const v = validateUploadInput("siteGallery", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("siteGallery", { fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function registerSiteGalleryAction(input: {
  path: string;
  publicUrl: string;
  category: string;
  altText?: string;
  caption?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await createSiteGalleryImage({
      trip_id: null,
      image_url: input.publicUrl,
      image_path: input.path,
      thumbnail_url: null,
      alt_text: input.altText ?? null,
      caption: input.caption ?? null,
      category: input.category,
      location: null,
      photographer: null,
      is_featured: false,
      is_active: true,
      display_order: 0,
    });
    await logActivity({
      table_name: "site_gallery",
      record_id: input.publicUrl,
      action: "INSERT",
      new_values: { category: input.category, image_url: input.publicUrl, image_path: input.path },
    });
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Raw Moments — Direct-upload prepare + register
// ---------------------------------------------------------------------------

export async function prepareRawMomentUploadAction(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }> {
  const v = validateUploadInput("rawMoment", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("rawMoment", { fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function registerRawMomentAction(input: {
  path: string;
  publicUrl: string;
  location?: string;
  caption?: string;
  tags?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    await createRawMoment({
      image_url: input.publicUrl,
      image_path: input.path,
      location: input.location ?? null,
      caption: input.caption ?? null,
      tags: input.tags ?? [],
      is_featured: false,
      display_order: 0,
    });
    await logActivity({
      table_name: "raw_moments",
      record_id: input.publicUrl,
      action: "INSERT",
      new_values: { location: input.location, image_url: input.publicUrl, image_path: input.path },
    });
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Trip Gallery — CRUD
// ---------------------------------------------------------------------------

export async function fetchTripGalleryImages(
  tripId?: string,
): Promise<(DbTripGallery & { trip_name: string | null })[]> {
  return getTripGalleryImages(tripId);
}

export async function createGalleryImageAction(
  payload: Omit<DbTripGallery, "gallery_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createGalleryImage(payload);
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateGalleryImageAction(
  id: string,
  payload: Partial<Omit<DbTripGallery, "gallery_id" | "created_at" | "updated_at">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateGalleryImage(id, payload);
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteGalleryImageAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteGalleryImage(id);
    await logActivity({ table_name: "trip_gallery", record_id: id, action: "DELETE" });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function toggleGalleryFeaturedAction(
  id: string,
  value: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await toggleGalleryFeatured(id, value);
    await logActivity({ table_name: "trip_gallery", record_id: id, action: "UPDATE", new_values: { is_featured: value } });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function toggleGalleryCoverAction(
  tripId: string,
  galleryId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await toggleGalleryCover(tripId, galleryId);
    await logActivity({ table_name: "trip_gallery", record_id: galleryId, action: "UPDATE", new_values: { is_cover: true, trip_id: tripId } });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Site Gallery — CRUD
// ---------------------------------------------------------------------------

export async function fetchSiteGalleryImages(): Promise<DbSiteGallery[]> {
  return getSiteGalleryImages();
}

export async function createSiteGalleryImageAction(
  payload: Omit<DbSiteGallery, "gallery_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createSiteGalleryImage(payload);
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateSiteGalleryImageAction(
  id: string,
  payload: Partial<Omit<DbSiteGallery, "gallery_id" | "created_at" | "updated_at">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateSiteGalleryImage(id, payload);
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteSiteGalleryImageAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteSiteGalleryImage(id);
    await logActivity({ table_name: "site_gallery", record_id: id, action: "DELETE" });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Raw Moments — CRUD
// ---------------------------------------------------------------------------

export async function fetchRawMoments(): Promise<DbRawMoment[]> {
  return getRawMoments();
}

export async function createRawMomentAction(
  payload: Omit<DbRawMoment, "moment_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createRawMoment(payload);
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateRawMomentAction(
  id: string,
  payload: Partial<Omit<DbRawMoment, "moment_id" | "created_at" | "updated_at">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateRawMoment(id, payload);
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteRawMomentAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteRawMoment(id);
    await logActivity({ table_name: "raw_moments", record_id: id, action: "DELETE" });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Link / Category / Metadata helpers
// ---------------------------------------------------------------------------

/** Link an existing image to a different trip (creates a new gallery row with the same URL) */
export async function linkImageToTripAction(
  imageUrl: string,
  targetTripId: string,
  category: string = "gallery",
): Promise<{ success: boolean; error?: string }> {
  try {
    const { nextSequentialId } = await import("@/lib/ids");
    const id = await nextSequentialId("trip_gallery", "gallery_id", "GAL");
    const sb = (await import("@/lib/supabase/server")).getServiceClient();
    await sb.from("trip_gallery").insert({
      gallery_id: id,
      trip_id: targetTripId,
      image_url: imageUrl,
      category,
      is_cover: false,
      is_featured: false,
      is_active: true,
      display_order: 0,
    });
    await logActivity({ table_name: "trip_gallery", record_id: id, action: "INSERT", new_values: { trip_id: targetTripId, category, image_url: imageUrl } });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Change the category of a trip gallery image */
export async function changeCategoryAction(
  galleryId: string,
  category: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateGalleryImage(galleryId, { category });
    await logActivity({ table_name: "trip_gallery", record_id: galleryId, action: "UPDATE", new_values: { category } });
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
