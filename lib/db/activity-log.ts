import { getServiceClient } from "@/lib/supabase/server";

export interface ActivityLogEntry {
  log_id: number;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
}

export async function getActivityLog(limit = 50): Promise<ActivityLogEntry[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("audit_log")
    .select("*")
    .eq("performed_by", "cms-admin")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ActivityLogEntry[];
}
