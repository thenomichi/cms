import { getServiceClient } from "@/lib/supabase/server";
import type { DbCustomizedTripRequest } from "@/lib/types";

export async function getSuggestions(
  status?: string,
): Promise<DbCustomizedTripRequest[]> {
  const sb = getServiceClient();
  let query = sb
    .from("customized_trip_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("pipeline_status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DbCustomizedTripRequest[];
}

export async function updateSuggestionStatus(
  id: string,
  status: string,
): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("customized_trip_requests")
    .update({
      pipeline_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("request_id", id);

  if (error) throw error;
}

export async function deleteSuggestion(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("customized_trip_requests")
    .delete()
    .eq("request_id", id);

  if (error) throw error;
}
