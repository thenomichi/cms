"use server";

import { inclusionChipCreateSchema } from "@/lib/schemas/inclusion-chip";
import { addInclusionChip } from "@/lib/db/inclusion-chips";
import type { DbInclusionChip } from "@/lib/types";
import { logActivity } from "@/lib/audit";

export async function addInclusionChipAction(input: {
  name: string;
  icon: string;
  category: string;
}): Promise<{ success: boolean; chip?: DbInclusionChip; error?: string }> {
  try {
    const parsed = inclusionChipCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const chip = await addInclusionChip(parsed.data);
    void logActivity({
      table_name: "inclusion_chips",
      record_id: chip.chip_id,
      action: "INSERT",
      new_values: { name: chip.name, category: chip.category, icon: chip.icon },
    }).catch((err) => console.error("[logActivity] swallowed:", err));
    return { success: true, chip };
  } catch (err) {
    console.error("[addInclusionChipAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add chip",
    };
  }
}
