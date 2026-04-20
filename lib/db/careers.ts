import { getServiceClient } from "@/lib/supabase/server";
import type { DbCareerListing } from "@/lib/types";
import { nextSequentialId } from "@/lib/ids";

export async function getCareerListings(): Promise<DbCareerListing[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("career_listings")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbCareerListing[];
}

export async function createCareerListing(
  payload: Omit<DbCareerListing, "career_id" | "created_at" | "updated_at">,
): Promise<DbCareerListing> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("career_listings")
    .insert({ ...payload, career_id: await nextSequentialId("career_listings", "career_id", "CAR") })
    .select()
    .single();

  if (error) throw error;
  return data as DbCareerListing;
}

export async function updateCareerListing(
  id: string,
  payload: Partial<Omit<DbCareerListing, "career_id" | "created_at" | "updated_at">>,
): Promise<DbCareerListing> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("career_listings")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("career_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbCareerListing;
}

export async function deleteCareerListing(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("career_listings")
    .delete()
    .eq("career_id", id);

  if (error) throw error;
}
