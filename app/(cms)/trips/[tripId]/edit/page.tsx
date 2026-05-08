import { notFound } from "next/navigation";
import { listDepartureCities } from "@/lib/db/departure-cities";
import { listExclusions } from "@/lib/db/exclusions";
import { getTripById, CMS_SHARED_OWNER_ID } from "@/lib/db/trips";
import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";
import { TripEditor } from "../../_components/TripEditor";

// Auth is enforced upstream by app/(cms)/layout.tsx (cms_session cookie).
// Autosave drafts are scoped to a shared owner constant — see /trips/new.

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const [trip, destRes, departureCities, exclusions] = await Promise.all([
    getTripById(tripId),
    getServiceClient()
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
    listDepartureCities(),
    listExclusions(),
  ]);
  if (!trip) notFound();

  return (
    <TripEditor
      trip={trip}
      destinations={(destRes.data ?? []) as DbDestination[]}
      departureCities={departureCities}
      exclusions={exclusions}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
      userId={CMS_SHARED_OWNER_ID}
    />
  );
}
