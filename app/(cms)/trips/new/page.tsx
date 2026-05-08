import { redirect } from "next/navigation";
import { listDepartureCities } from "@/lib/db/departure-cities";
import { findResumableDraft } from "@/lib/db/trips";
import { getServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/supabase/server-auth";
import type { DbDestination } from "@/lib/types";
import { NewTripWrapper } from "./NewTripWrapper";

export default async function NewTripPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const sb = getServiceClient();
  const [destRes, departureCities, resumable] = await Promise.all([
    sb
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
    listDepartureCities(),
    findResumableDraft(session.user.id),
  ]);

  return (
    <NewTripWrapper
      userId={session.user.id}
      destinations={(destRes.data ?? []) as DbDestination[]}
      departureCities={departureCities}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
      resumable={resumable}
    />
  );
}
