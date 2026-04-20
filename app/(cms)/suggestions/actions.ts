"use server";

import { revalidatePath } from "next/cache";
import {
  getSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
} from "@/lib/db/suggestions";
import type { DbCustomizedTripRequest } from "@/lib/types";

export async function fetchSuggestions(
  status?: string,
): Promise<DbCustomizedTripRequest[]> {
  return getSuggestions(status);
}

export async function updateSuggestionStatusAction(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateSuggestionStatus(id, status);
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
    revalidatePath("/suggestions");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
