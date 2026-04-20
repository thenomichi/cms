import { getServiceClient } from "@/lib/supabase/server";
import type { DbAnnouncement } from "@/lib/types";

export interface AnnouncementWithTrip extends DbAnnouncement {
  trip_name: string | null;
}

export async function getAnnouncements(): Promise<AnnouncementWithTrip[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("announcements")
    .select("*, trips!left(trip_name)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as DbAnnouncement),
    trip_name:
      (row.trips as { trip_name: string | null } | null)?.trip_name ?? null,
  }));
}

export async function getAnnouncementById(
  id: string,
): Promise<DbAnnouncement | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("announcements")
    .select("*")
    .eq("announcement_id", id)
    .single();

  if (error) return null;
  return data as DbAnnouncement;
}

export async function createAnnouncement(
  payload: Omit<DbAnnouncement, "created_at" | "updated_at">,
): Promise<DbAnnouncement> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("announcements")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as DbAnnouncement;
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<
    Omit<DbAnnouncement, "announcement_id" | "created_at" | "updated_at">
  >,
): Promise<DbAnnouncement> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("announcements")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("announcement_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbAnnouncement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("announcements")
    .delete()
    .eq("announcement_id", id);

  if (error) throw error;
}

export async function toggleAnnouncementActive(
  id: string,
  value: boolean,
): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("announcements")
    .update({ is_active: value, updated_at: new Date().toISOString() })
    .eq("announcement_id", id);

  if (error) throw error;
}
