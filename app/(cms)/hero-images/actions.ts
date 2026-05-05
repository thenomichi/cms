"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit";

export type PageHeroKey =
  | "soulful-escapes"
  | "beyond-ordinary"
  | "signature-journeys"
  | "home"
  | "plan-a-trip"
  | "about";

export async function updatePageHeroImage(
  pageKey: PageHeroKey,
  data: { image_light?: string | null; image_dark?: string | null; alt_text?: string | null },
): Promise<{ success: boolean; error?: string }> {
  try {
    const sb = getServiceClient();
    const { error } = await sb
      .from("page_hero_images")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("page_key", pageKey);

    if (error) throw error;

    await logActivity({
      table_name: "page_hero_images",
      record_id: pageKey,
      action: "UPDATE",
      new_values: data,
    });

    revalidatePath("/hero-images");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
