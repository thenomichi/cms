"use server";

import { exclusionCreateSchema } from "@/lib/schemas/exclusion";
import { addExclusion } from "@/lib/db/exclusions";
import type { DbExclusion } from "@/lib/types";
import { logActivity } from "@/lib/audit";

export async function addExclusionAction(input: {
  name: string;
  is_popular?: boolean;
}): Promise<{ success: boolean; exclusion?: DbExclusion; error?: string }> {
  try {
    const parsed = exclusionCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const exclusion = await addExclusion(parsed.data);
    void logActivity({
      table_name: "exclusions",
      record_id: exclusion.exclusion_id,
      action: "INSERT",
      new_values: { name: exclusion.name, is_popular: exclusion.is_popular },
    }).catch((err) => console.error("[logActivity] swallowed:", err));
    return { success: true, exclusion };
  } catch (err) {
    console.error("[addExclusionAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to add exclusion" };
  }
}
