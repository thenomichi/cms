import { notFound } from "next/navigation";
import { listDepartureCities } from "@/lib/db/departure-cities";
import { getTripById } from "@/lib/db/trips";
import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";
import { TripEditor } from "../../_components/TripEditor";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const [trip, destRes, departureCities] = await Promise.all([
    getTripById(tripId),
    getServiceClient()
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
    listDepartureCities(),
  ]);
  if (!trip) notFound();

  return (
    <TripEditor
      trip={trip}
      destinations={(destRes.data ?? []) as DbDestination[]}
      departureCities={departureCities}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
    />
  );
}
