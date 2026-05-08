import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Daily cron: drop Draft rows whose last_autosaved_at is older than 30
 * days. Manual drafts (no last_autosaved_at) are NOT purged — they were
 * created intentionally and may be in long-term planning.
 *
 * Vercel cron triggers GET with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("trips")
    .delete()
    .eq("status", "Draft")
    .not("last_autosaved_at", "is", null)
    .lt("last_autosaved_at", cutoff)
    .select("trip_id");
  if (error) {
    console.error("[purge-drafts]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, purged: data?.length ?? 0 });
}
