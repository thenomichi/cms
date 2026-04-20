"use server";

import { revalidatePath } from "next/cache";
import {
  getCareerListings,
  createCareerListing,
  updateCareerListing,
  deleteCareerListing,
} from "@/lib/db/careers";
import { revalidateCareers } from "@/lib/revalidate";
import type { DbCareerListing } from "@/lib/types";

export async function fetchCareerListings(): Promise<DbCareerListing[]> {
  return getCareerListings();
}

export async function createCareerAction(
  payload: Omit<DbCareerListing, "career_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createCareerListing(payload);
    revalidatePath("/careers");
    await revalidateCareers();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateCareerAction(
  id: string,
  payload: Partial<Omit<DbCareerListing, "career_id" | "created_at" | "updated_at">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateCareerListing(id, payload);
    revalidatePath("/careers");
    await revalidateCareers();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteCareerAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteCareerListing(id);
    revalidatePath("/careers");
    await revalidateCareers();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
