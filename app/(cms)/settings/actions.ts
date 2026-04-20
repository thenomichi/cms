"use server";

import { revalidatePath } from "next/cache";
import { updateSiteSettings } from "@/lib/db/settings";
import { revalidateHome } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";

export async function updateSettingsAction(
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateSiteSettings(data);
    await logActivity({ table_name: "site_settings", record_id: "global", action: "UPDATE", new_values: data });
    revalidatePath("/settings");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
