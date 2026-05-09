"use server";

import { revalidatePath } from "next/cache";
import { updateSiteSettings } from "@/lib/db/settings";
import { getTrips } from "@/lib/db/trips";
import { revalidateWebsite } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";
import { nextSequentialId } from "@/lib/ids";
import { getStorageProvider } from "@/lib/storage";
import { buildPath } from "@/lib/storage/paths";
import { validateUploadInput } from "@/lib/storage/validate";
import type { UploadTicket } from "@/lib/storage/provider";
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
// PDF is needed for trip itinerary uploads (app/(cms)/trips/actions.ts).
const ITINERARY_DOC_MIME_TYPES = ["application/pdf"] as const;

function getBucketAllowedMimeTypes(bucket: unknown): string[] {
  if (!bucket || typeof bucket !== "object") return [];
  const value =
    (bucket as { allowedMimeTypes?: unknown }).allowedMimeTypes ??
    (bucket as { allowed_mime_types?: unknown }).allowed_mime_types;
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function getBucketFileSizeLimit(bucket: unknown): number | undefined {
  if (!bucket || typeof bucket !== "object") return undefined;
  const value =
    (bucket as { fileSizeLimit?: unknown }).fileSizeLimit ??
    (bucket as { file_size_limit?: unknown }).file_size_limit;
  if (typeof value === "number") return value;
  return undefined;
}

function getFileExtension(file: File, fallback: string): string {
  return file.name.split(".").pop() ?? fallback;
}

export async function fetchHeroMediaImagesAction(): Promise<{ url: string; alt?: string }[]> {
  const db = getServiceClient();
  const { data } = await db
    .from("site_gallery")
    .select("image_url, alt_text")
    .in("category", ["hero", "cover"])
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((r: { image_url: string; alt_text: string | null }) => ({
    url: r.image_url,
    alt: r.alt_text ?? undefined,
  }));
}

/** Re-exposed for trip itinerary uploads. Same logic, narrower public name. */
export async function ensureCmsMediaBucketAllowsItineraryUploads(): Promise<void> {
  return ensureCmsMediaBucketSupportsHeroMediaUploads();
}

async function ensureCmsMediaBucketSupportsHeroMediaUploads(): Promise<void> {
  const db = getServiceClient();
  const { data: bucket, error: bucketError } = await db.storage.getBucket(CMS_MEDIA_BUCKET);
  if (bucketError) throw bucketError;

  const currentTypes = getBucketAllowedMimeTypes(bucket);
  const currentLimit = getBucketFileSizeLimit(bucket);

  const HERO_MEDIA_MIME_TYPES = [
    "image/jpeg", "image/png", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
    ...ITINERARY_DOC_MIME_TYPES,
  ];
  const HERO_MEDIA_FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

  const needsMimeUpdate = HERO_MEDIA_MIME_TYPES.some((t) => !currentTypes.includes(t));
  const needsSizeUpdate =
    currentLimit === undefined || currentLimit < HERO_MEDIA_FILE_SIZE_LIMIT_BYTES;

  if (needsMimeUpdate || needsSizeUpdate) {
    const { error: updateError } = await db.storage.updateBucket(CMS_MEDIA_BUCKET, {
      public: true,
      allowedMimeTypes: [...new Set([...currentTypes, ...HERO_MEDIA_MIME_TYPES])],
      fileSizeLimit: HERO_MEDIA_FILE_SIZE_LIMIT_BYTES,
    });
    if (updateError) throw updateError;
  }
}

// ---------------------------------------------------------------------------
// Hero Image — Direct-upload prepare + register
// ---------------------------------------------------------------------------

export async function prepareHeroImageUploadAction(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }> {
  const v = validateUploadInput("heroImage", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("heroImage", { fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function registerHeroImageAction(input: {
  path: string;
  publicUrl: string;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const db = getServiceClient();
    const galleryId = await nextSequentialId("site_gallery", "gallery_id", "SGL");
    const { error } = await db.from("site_gallery").insert({
      gallery_id: galleryId,
      image_url: input.publicUrl,
      image_path: input.path,
      category: "hero",
      is_active: true,
      is_featured: false,
      display_order: 0,
    });
    if (error) throw error;
    await logActivity({
      table_name: "site_gallery",
      record_id: galleryId,
      action: "INSERT",
      new_values: { category: "hero", image_url: input.publicUrl, image_path: input.path },
    });
    return { success: true, url: input.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Hero Video — Direct-upload prepare + register (no DB row)
// ---------------------------------------------------------------------------

export async function prepareHeroVideoUploadAction(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }> {
  const v = validateUploadInput("heroVideo", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("heroVideo", { fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function registerHeroVideoAction(input: {
  path: string;
  publicUrl: string;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  // Video registration does not insert a DB row — the URL is returned directly
  // to be stored in site_settings by the caller.
  return { success: true, url: input.publicUrl };
}

// ---------------------------------------------------------------------------
// Settings CRUD
// ---------------------------------------------------------------------------

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
