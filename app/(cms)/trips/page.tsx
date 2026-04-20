import { getTrips } from "@/lib/db/trips";
import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";
import { TripsClient } from "./_components/TripsClient";

export default async function TripsPage() {
  const [trips, destRes] = await Promise.all([
    getTrips(),
    getServiceClient()
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
  ]);

  const destinations = (destRes.data ?? []) as DbDestination[];

  return <TripsClient initialTrips={trips} destinations={destinations} />;
}
