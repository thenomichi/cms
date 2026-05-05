"use server";

import { revalidatePath } from "next/cache";
import {
  getSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
} from "@/lib/db/suggestions";
import type { DbCustomizedTripRequest } from "@/lib/types";
import { logActivity } from "@/lib/audit";
import { suggestionStatusSchema } from "@/lib/schemas/trip";

export async function fetchSuggestions(
  status?: string,
): Promise<DbCustomizedTripRequest[]> {
  return getSuggestions(status);
}

export async function updateSuggestionStatusAction(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  const parsed = suggestionStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  try {
    await updateSuggestionStatus(id, parsed.data);
    await logActivity({ table_name: "customized_trip_requests", record_id: id, action: "UPDATE", new_values: { status: parsed.data } });
    revalidatePath("/suggestions");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteSuggestionAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteSuggestion(id);
    await logActivity({ table_name: "customized_trip_requests", record_id: id, action: "DELETE" });
    revalidatePath("/suggestions");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
