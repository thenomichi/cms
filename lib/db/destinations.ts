import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";

export async function getDestinations(): Promise<DbDestination[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("destinations")
    .select("*")
    .order("display_order", { ascending: true })
    .order("destination_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbDestination[];
}

export async function getDestinationById(
  id: string,
): Promise<DbDestination | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("destinations")
    .select("*")
    .eq("destination_id", id)
    .single();

  if (error) return null;
  return data as DbDestination;
}

/**
 * Generate a unique destination_code from destination_name.
 * E.g., "Ladakh" → "LADAKH", "Ladakh" (duplicate) → "LADAKH-2"
 */
export async function generateUniqueDestCode(
  name: string,
  excludeId?: string,
): Promise<string> {
  const sb = getServiceClient();
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!base) return `DEST-${Date.now()}`;

  async function codeExists(code: string): Promise<boolean> {
    let query = sb
      .from("destinations")
      .select("destination_id", { count: "exact", head: true })
      .eq("destination_code", code);
    if (excludeId) query = query.neq("destination_id", excludeId);
    const { count } = await query;
    return (count ?? 0) > 0;
  }

  if (!(await codeExists(base))) return base;
  for (let i = 2; i <= 99; i++) {
    if (!(await codeExists(`${base}-${i}`))) return `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createDestination(
  payload: Omit<DbDestination, "created_at" | "updated_at">,
): Promise<DbDestination> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("destinations")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as DbDestination;
}

export async function updateDestination(
  id: string,
  payload: Partial<
    Omit<DbDestination, "destination_id" | "created_at" | "updated_at">
  >,
): Promise<DbDestination> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("destinations")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("destination_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbDestination;
}

export async function deleteDestination(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("destinations")
    .delete()
    .eq("destination_id", id);

  if (error) throw error;
}
