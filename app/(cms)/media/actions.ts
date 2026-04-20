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
import { uploadImage } from "@/lib/storage/upload";
import { revalidateHome } from "@/lib/revalidate";
import { generateId } from "@/lib/utils";
import type { DbTripGallery, DbSiteGallery, DbRawMoment } from "@/lib/types";

// ---------------------------------------------------------------------------
// Upload Actions (handle FormData with files → Storage → DB)
// ---------------------------------------------------------------------------

export async function uploadTripGalleryAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No file provided" };

    const tripId = formData.get("trip_id") as string | null;
    const category = (formData.get("category") as string) || "gallery";
    const altText = formData.get("alt_text") as string | null;
    const caption = formData.get("caption") as string | null;

    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `trip-gallery/${tripId ?? "unassigned"}/${Date.now()}.${ext}`;
    const publicUrl = await uploadImage(file, storagePath);

    await createGalleryImage({
      trip_id: tripId ?? null,
      image_url: publicUrl,
      thumbnail_url: null,
      alt_text: altText ?? null,
      caption: caption ?? null,
      category: category as DbTripGallery["category"],
      is_cover: false,
      is_featured: false,
      is_active: true,
      photographer: null,
      display_order: 0,
    });

    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function uploadSiteGalleryAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No file provided" };

    const caption = formData.get("caption") as string | null;
    const altText = formData.get("alt_text") as string | null;

    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `site-gallery/${Date.now()}.${ext}`;
    const publicUrl = await uploadImage(file, storagePath);

    await createSiteGalleryImage({
      trip_id: null,
      image_url: publicUrl,
      thumbnail_url: null,
      alt_text: altText ?? null,
      caption: caption ?? null,
      category: "gallery",
      location: null,
      photographer: null,
      is_featured: false,
      is_active: true,
      display_order: 0,
    });

    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function uploadRawMomentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No file provided" };

    const location = formData.get("location") as string | null;
    const caption = formData.get("caption") as string | null;

    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `raw-moments/${Date.now()}.${ext}`;
    const publicUrl = await uploadImage(file, storagePath);

    await createRawMoment({
      image_url: publicUrl,
      location: location ?? null,
      caption: caption ?? null,
      tags: [],
      is_featured: false,
      display_order: 0,
    });

    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Trip Gallery
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
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Site Gallery
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
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Raw Moments
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
    revalidatePath("/media");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
