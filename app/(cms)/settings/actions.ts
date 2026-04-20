"use server";

import { revalidatePath } from "next/cache";
import { updateSiteSettings } from "@/lib/db/settings";
import { revalidateHome } from "@/lib/revalidate";

export async function updateSettingsAction(
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateSiteSettings(data);
    revalidatePath("/settings");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
