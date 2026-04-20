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
import { logActivity } from "@/lib/audit";

export async function fetchCareerListings(): Promise<DbCareerListing[]> {
  return getCareerListings();
}

export async function createCareerAction(
  payload: Omit<DbCareerListing, "career_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const career = await createCareerListing(payload);
    await logActivity({ table_name: "career_listings", record_id: career.career_id, action: "INSERT", new_values: { title: payload.title, department: payload.department } });
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
    await logActivity({ table_name: "career_listings", record_id: id, action: "UPDATE", new_values: { title: payload.title, department: payload.department } });
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
    await logActivity({ table_name: "career_listings", record_id: id, action: "DELETE" });
    revalidatePath("/careers");
    await revalidateCareers();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
