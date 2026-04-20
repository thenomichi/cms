import { getServiceClient } from "@/lib/supabase/server";

export async function getSiteSettings(): Promise<Record<string, unknown>> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("site_settings")
    .select("data")
    .eq("id", "main")
    .single();

  if (error) throw error;
  return (data?.data ?? {}) as Record<string, unknown>;
}

export async function updateSiteSettings(
  payload: Record<string, unknown>,
): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("site_settings")
    .update({ data: payload, updated_at: new Date().toISOString() })
    .eq("id", "main");

  if (error) throw error;
}
