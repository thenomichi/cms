import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY");
  }

  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return serviceClient;
}
