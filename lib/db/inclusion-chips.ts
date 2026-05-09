import { getServiceClient } from "@/lib/supabase/server";
import type { DbInclusionChip } from "@/lib/types";
import { slugify } from "@/lib/utils";

async function generateUniqueInclusionChipId(
  name: string,
): Promise<string> {
  const db = getServiceClient();
  const base = slugify(name) || "custom-inclusion";

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { count, error } = await db
      .from("inclusion_chips")
      .select("chip_id", { count: "exact", head: true })
      .eq("chip_id", candidate);
    if (error) throw error;
    if ((count ?? 0) === 0) return candidate;
  }

  return `${base}-${Date.now()}`;
}

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
  const idCandidate = await generateUniqueInclusionChipId(input.name);
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
  if (error) {
    if (error.message.toLowerCase().includes("inclusion_chips_name")) {
      throw new Error(`Inclusion "${input.name}" already exists`);
    }
    throw error;
  }
  return data as DbInclusionChip;
}
