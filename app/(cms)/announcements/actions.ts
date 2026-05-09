"use server";

import { revalidatePath } from "next/cache";
import { announcementSchema } from "@/lib/schemas/trip";
import { nextSequentialId } from "@/lib/ids";
import {
  createAnnouncement as dbCreate,
  updateAnnouncement as dbUpdate,
  deleteAnnouncement as dbDelete,
  toggleAnnouncementActive as dbToggle,
} from "@/lib/db/announcements";
import { revalidateHome } from "@/lib/revalidate";
import { getStorageProvider } from "@/lib/storage";
import { buildPath } from "@/lib/storage/paths";
import { validateUploadInput } from "@/lib/storage/validate";
import type { UploadTicket } from "@/lib/storage/provider";
import { getServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Banner image helpers
// ---------------------------------------------------------------------------

/** Fetch all existing banner/hero images from site_gallery */
export async function fetchBannerImages(): Promise<{ url: string; alt?: string }[]> {
  const db = getServiceClient();
  const { data } = await db
    .from("site_gallery")
    .select("image_url, alt_text")
    .in("category", ["hero", "cover"])
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  // Also get announcement background images already in use
  const { data: annData } = await db
    .from("announcements")
    .select("background_image_url")
    .not("background_image_url", "is", null);

  const images = (data ?? []).map((r: { image_url: string; alt_text: string | null }) => ({
    url: r.image_url,
    alt: r.alt_text ?? undefined,
  }));

  // Add existing announcement backgrounds that might not be in site_gallery
  const existingUrls = new Set(images.map((i) => i.url));
  for (const row of annData ?? []) {
    const url = (row as { background_image_url: string }).background_image_url;
    if (url && !existingUrls.has(url)) {
      images.push({ url, alt: undefined });
      existingUrls.add(url);
    }
  }

  return images;
}

// ---------------------------------------------------------------------------
// Banner — Direct-upload prepare + register
// ---------------------------------------------------------------------------

export async function prepareBannerUploadAction(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }> {
  const v = validateUploadInput("banner", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("banner", { fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function registerBannerAction(input: {
  path: string;
  publicUrl: string;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const db = getServiceClient();
    const id = await nextSequentialId("site_gallery", "gallery_id", "SGL");
    const { error } = await db.from("site_gallery").insert({
      gallery_id: id,
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
      record_id: id,
      action: "INSERT",
      new_values: { category: "hero", image_url: input.publicUrl, image_path: input.path },
    });
    return { success: true, url: input.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createAnnouncement(
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string | Record<string, unknown> }> {
  const parsed = announcementSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const id = await nextSequentialId("announcements", "announcement_id", "ANN");
    const displayOrder =
      typeof formData.display_order === "number" ? formData.display_order : 0;

    await dbCreate({
      announcement_id: id,
      tag_type: parsed.data.tag_type,
      headline: parsed.data.headline,
      sub_text: parsed.data.sub_text ?? null,
      cta_label: parsed.data.cta_label ?? null,
      cta_link: parsed.data.cta_link ?? null,
      background_image_url: parsed.data.background_image_url ?? null,
      trip_id: parsed.data.trip_id ?? null,
      display_order: displayOrder,
      is_active: parsed.data.is_active,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
    });

    await logActivity({ table_name: "announcements", record_id: id, action: "INSERT", new_values: { headline: parsed.data.headline, tag_type: parsed.data.tag_type } });
    revalidatePath("/announcements");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateAnnouncement(
  id: string,
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string | Record<string, unknown> }> {
  const parsed = announcementSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const displayOrder =
      typeof formData.display_order === "number" ? formData.display_order : 0;

    await dbUpdate(id, {
      tag_type: parsed.data.tag_type,
      headline: parsed.data.headline,
      sub_text: parsed.data.sub_text ?? null,
      cta_label: parsed.data.cta_label ?? null,
      cta_link: parsed.data.cta_link ?? null,
      background_image_url: parsed.data.background_image_url ?? null,
      trip_id: parsed.data.trip_id ?? null,
      display_order: displayOrder,
      is_active: parsed.data.is_active,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
    });

    await logActivity({ table_name: "announcements", record_id: id, action: "UPDATE", new_values: { headline: parsed.data.headline, tag_type: parsed.data.tag_type } });
    revalidatePath("/announcements");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteAnnouncement(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbDelete(id);
    await logActivity({ table_name: "announcements", record_id: id, action: "DELETE" });
    revalidatePath("/announcements");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function toggleAnnouncementActive(
  id: string,
  value: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbToggle(id, value);
    await logActivity({ table_name: "announcements", record_id: id, action: "UPDATE", new_values: { is_active: value } });
    revalidatePath("/announcements");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
