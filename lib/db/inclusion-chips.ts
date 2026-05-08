import { getServiceClient } from "@/lib/supabase/server";
import type { DbInclusionChip } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function listInclusionChips(): Promise<DbInclusionChip[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("inclusion_chips")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbInclusionChip[];
}

export async function addInclusionChip(input: {
  name: string;
  icon: string;
  category: string;
}): Promise<DbInclusionChip> {
  const db = getServiceClient();
  const idCandidate = slugify(input.name);
  const { data, error } = await db
    .from("inclusion_chips")
    .insert({
      chip_id: idCandidate,
      name: input.name,
      icon: input.icon,
      category: input.category,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbInclusionChip;
}
