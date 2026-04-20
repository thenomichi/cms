import { getServiceClient } from "@/lib/supabase/server";

/**
 * Log a CMS action to the audit_log table.
 * Fire-and-forget — never throws, never blocks the main action.
 */
export async function logActivity(params: {
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "TOGGLE";
  new_values?: Record<string, unknown> | null;
  performed_by?: string;
}): Promise<void> {
  try {
    const db = getServiceClient();
    await db.from("audit_log").insert({
      table_name: params.table_name,
      record_id: params.record_id,
      action: params.action,
      new_values: params.new_values ?? null,
      old_values: null,
      performed_by: params.performed_by ?? "cms-admin",
    });
  } catch {
    // Silent — audit logging should never break the main operation
    console.warn("[audit] Failed to log activity:", params);
  }
}
