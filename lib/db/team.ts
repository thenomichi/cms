import { getServiceClient } from "@/lib/supabase/server";
import type { DbTeamMember } from "@/lib/types";
import { nextSequentialId } from "@/lib/ids";

export async function getTeamMembers(): Promise<DbTeamMember[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("team_members")
    .select("*")
    .order("display_order", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbTeamMember[];
}

export async function createTeamMember(
  payload: Omit<DbTeamMember, "member_id" | "user_id" | "created_at" | "updated_at">,
): Promise<DbTeamMember> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("team_members")
    .insert({ ...payload, member_id: await nextSequentialId("team_members", "member_id", "TM", 4) })
    .select()
    .single();

  if (error) throw error;
  return data as DbTeamMember;
}

export async function updateTeamMember(
  id: string,
  payload: Partial<Omit<DbTeamMember, "member_id" | "created_at" | "updated_at">>,
): Promise<DbTeamMember> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("team_members")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("member_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbTeamMember;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from("team_members").delete().eq("member_id", id);
  if (error) throw error;
}
