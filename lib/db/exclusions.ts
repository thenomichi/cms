import { getServiceClient } from "@/lib/supabase/server";
import type { DbExclusion } from "@/lib/types";
import { slugify } from "@/lib/utils";

async function generateUniqueExclusionId(
  name: string,
): Promise<string> {
  const db = getServiceClient();
  const base = slugify(name) || "custom-exclusion";

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { count, error } = await db
      .from("exclusions")
      .select("exclusion_id", { count: "exact", head: true })
      .eq("exclusion_id", candidate);
    if (error) throw error;
    if ((count ?? 0) === 0) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export async function listExclusions(): Promise<DbExclusion[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("exclusions")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbExclusion[];
}

export async function addExclusion(input: {
  name: string;
  category?: string;
  is_popular?: boolean;
}): Promise<DbExclusion> {
  const db = getServiceClient();
  const idCandidate = await generateUniqueExclusionId(input.name);
  const { data, error } = await db
    .from("exclusions")
    .insert({
      exclusion_id: idCandidate,
      name: input.name,
      category: input.category ?? "Other",
      is_popular: input.is_popular ?? false,
    })
    .select("*")
    .single();
  if (error) {
    if (error.message.toLowerCase().includes("exclusions_name")) {
      throw new Error(`Exclusion "${input.name}" already exists`);
    }
    throw error;
  }
  return data as DbExclusion;
}
