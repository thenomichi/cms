"use server";

import { revalidatePath } from "next/cache";
import {
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from "@/lib/db/team";
import { revalidateAbout } from "@/lib/revalidate";
import type { DbTeamMember } from "@/lib/types";

export async function fetchTeamMembers(): Promise<DbTeamMember[]> {
  return getTeamMembers();
}

export async function createTeamMemberAction(
  payload: Omit<DbTeamMember, "member_id" | "user_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createTeamMember(payload);
    revalidatePath("/team");
    await revalidateAbout();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateTeamMemberAction(
  id: string,
  payload: Partial<Omit<DbTeamMember, "member_id" | "created_at" | "updated_at">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateTeamMember(id, payload);
    revalidatePath("/team");
    await revalidateAbout();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteTeamMemberAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteTeamMember(id);
    revalidatePath("/team");
    await revalidateAbout();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
