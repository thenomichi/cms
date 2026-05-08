import { getServiceClient } from "@/lib/supabase/server";
import type { DbExclusion } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function listExclusions(): Promise<DbExclusion[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("exclusions")
    .select("*")
    .eq("is_active", true)
    .order("is_popular", { ascending: false })
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbExclusion[];
}

export async function addExclusion(input: {
  name: string;
  is_popular?: boolean;
}): Promise<DbExclusion> {
  const db = getServiceClient();
  // Generate a stable id from the slug. UNIQUE constraint on `name`
  // protects against duplicate entries via case-sensitive collision; ids
  // collide separately via the slug shape.
  const idCandidate = slugify(input.name);
  const { data, error } = await db
    .from("exclusions")
    .insert({
      exclusion_id: idCandidate,
      name: input.name,
      is_popular: input.is_popular ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbExclusion;
}
