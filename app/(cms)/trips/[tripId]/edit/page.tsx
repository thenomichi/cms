import { notFound } from "next/navigation";
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
  const [trip, destRes] = await Promise.all([
    getTripById(tripId),
    getServiceClient()
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
  ]);
  if (!trip) notFound();

  return (
    <TripEditor
      trip={trip}
      destinations={(destRes.data ?? []) as DbDestination[]}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
    />
  );
}
