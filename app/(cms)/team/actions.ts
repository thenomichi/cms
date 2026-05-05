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
import { logActivity } from "@/lib/audit";
import { teamMemberSchema } from "@/lib/schemas/trip";

export async function fetchTeamMembers(): Promise<DbTeamMember[]> {
  return getTeamMembers();
}

export async function createTeamMemberAction(
  payload: Omit<DbTeamMember, "member_id" | "user_id" | "created_at" | "updated_at">,
): Promise<{ success: boolean; error?: string }> {
  const parsed = teamMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const member = await createTeamMember(payload);
    await logActivity({ table_name: "team_members", record_id: member.member_id, action: "INSERT", new_values: { full_name: payload.full_name, role: payload.role } });
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
  // Validate only fields that are present (partial update).
  const parsed = teamMemberSchema.partial().safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await updateTeamMember(id, payload);
    await logActivity({ table_name: "team_members", record_id: id, action: "UPDATE", new_values: { full_name: payload.full_name, role: payload.role } });
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
    await logActivity({ table_name: "team_members", record_id: id, action: "DELETE" });
    revalidatePath("/team");
    await revalidateAbout();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
