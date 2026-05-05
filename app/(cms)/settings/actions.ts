"use server";

import { revalidatePath } from "next/cache";
import { updateSiteSettings } from "@/lib/db/settings";
import { getTrips } from "@/lib/db/trips";
import { revalidateWebsite } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";
import { nextSequentialId } from "@/lib/ids";
import { uploadImage } from "@/lib/storage/upload";
import { getServiceClient } from "@/lib/supabase/server";

const WEBSITE_SURFACE_PATHS = [
  "/",
  "/join-a-trip",
  "/beyond-ordinary",
  "/signature-journeys",
  "/plan-a-trip",
  "/gift-a-trip",
  "/about",
  "/careers",
  "/sitemap.xml",
];

type MediaResponse = { success: boolean; url?: string; error?: string };
const CMS_MEDIA_BUCKET = "cms-media";
const HERO_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const HERO_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
// PDF is needed for trip itinerary uploads (app/(cms)/trips/actions.ts).
const ITINERARY_DOC_MIME_TYPES = ["application/pdf"] as const;
const HERO_MEDIA_MIME_TYPES = [
  ...HERO_IMAGE_MIME_TYPES,
  ...HERO_VIDEO_MIME_TYPES,
  ...ITINERARY_DOC_MIME_TYPES,
] as const;
const HERO_MEDIA_FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

function getBucketAllowedMimeTypes(bucket: unknown): string[] {
  if (!bucket || typeof bucket !== "object") return [];
  const value =
    (bucket as { allowedMimeTypes?: unknown }).allowedMimeTypes ??
    (bucket as { allowed_mime_types?: unknown }).allowed_mime_types;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getBucketFileSizeLimit(bucket: unknown): number | undefined {
  if (!bucket || typeof bucket !== "object") return undefined;
  const value =
    (bucket as { fileSizeLimit?: unknown }).fileSizeLimit ??
    (bucket as { file_size_limit?: unknown }).file_size_limit;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getFileExtension(file: File, fallback: string): string {
  const ext = file.name.split(".").pop()?.trim().toLowerCase();
  return ext || fallback;
}

export async function fetchHeroMediaImagesAction(): Promise<{ url: string; alt?: string }[]> {
  try {
    const db = getServiceClient();
    const { data } = await db
      .from("site_gallery")
      .select("image_url, alt_text")
      .in("category", ["hero", "cover"])
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row: { image_url: string; alt_text: string | null }) => ({
      url: row.image_url,
      alt: row.alt_text ?? undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Re-exposed for trip itinerary uploads. Same logic, narrower public name.
 * Keeps a single place that mutates the cms-media bucket.
 */
export async function ensureCmsMediaBucketAllowsItineraryUploads(): Promise<void> {
  return ensureCmsMediaBucketSupportsHeroMediaUploads();
}

async function ensureCmsMediaBucketSupportsHeroMediaUploads(): Promise<void> {
  const db = getServiceClient();
  const { data: bucket, error } = await db.storage.getBucket(CMS_MEDIA_BUCKET);
  if (error) throw error;

  const existingMimeTypes = getBucketAllowedMimeTypes(bucket);
  const nextMimeTypes = [...new Set([...existingMimeTypes, ...HERO_MEDIA_MIME_TYPES])];

  const hasAllHeroMediaMimeTypes = HERO_MEDIA_MIME_TYPES.every((type) =>
    existingMimeTypes.includes(type),
  );
  const existingFileSizeLimit = getBucketFileSizeLimit(bucket);
  const nextFileSizeLimit = Math.max(existingFileSizeLimit ?? 0, HERO_MEDIA_FILE_SIZE_LIMIT_BYTES);
  const hasExpectedFileSizeLimit = (existingFileSizeLimit ?? 0) >= HERO_MEDIA_FILE_SIZE_LIMIT_BYTES;
  if (hasAllHeroMediaMimeTypes && hasExpectedFileSizeLimit) return;

  const needsUpdate =
    existingMimeTypes.length !== nextMimeTypes.length ||
    existingMimeTypes.some((type) => !nextMimeTypes.includes(type)) ||
    !hasExpectedFileSizeLimit;

  if (!needsUpdate) return;

  const { error: updateError } = await db.storage.updateBucket(CMS_MEDIA_BUCKET, {
    public: Boolean((bucket as { public?: unknown }).public),
    fileSizeLimit: nextFileSizeLimit,
    allowedMimeTypes: nextMimeTypes,
  });

  if (updateError) throw updateError;
}

export async function uploadHeroImageAction(formData: FormData): Promise<MediaResponse> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, error: "No image selected" };
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Please upload an image file" };
    }

    await ensureCmsMediaBucketSupportsHeroMediaUploads();

    const ext = getFileExtension(file, "jpg");
    const path = `settings/hero/images/${Date.now()}.${ext}`;
    const publicUrl = await uploadImage(file, path);

    const db = getServiceClient();
    const galleryId = await nextSequentialId("site_gallery", "gallery_id", "SGL");
    const { error } = await db.from("site_gallery").insert({
      gallery_id: galleryId,
      image_url: publicUrl,
      category: "hero",
      is_active: true,
      is_featured: false,
      display_order: 0,
    });
    if (error) throw error;

    return { success: true, url: publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function uploadHeroVideoAction(formData: FormData): Promise<MediaResponse> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, error: "No video selected" };
    if (!file.type.startsWith("video/")) {
      return { success: false, error: "Please upload a video file" };
    }

    await ensureCmsMediaBucketSupportsHeroMediaUploads();

    const ext = getFileExtension(file, "mp4");
    const path = `settings/hero/videos/${Date.now()}.${ext}`;
    const publicUrl = await uploadImage(file, path);
    return { success: true, url: publicUrl };
  } catch (err) {
    const message = (err as Error).message;
    if (message.toLowerCase().includes("maximum allowed size")) {
      return {
        success: false,
        error: "Video is too large. Keep homepage hero videos under 50MB.",
      };
    }
    return { success: false, error: message };
  }
}

export async function updateSettingsAction(
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateSiteSettings(data);
    await logActivity({ table_name: "site_settings", record_id: "global", action: "UPDATE", new_values: data });
    revalidatePath("/settings");
    const trips = await getTrips();
    const tripPaths = trips
      .map((trip) => trip.slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => `/trips/${slug}`);
    await revalidateWebsite([...new Set([...WEBSITE_SURFACE_PATHS, ...tripPaths])], [
      "site-features",
      "site-settings",
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
