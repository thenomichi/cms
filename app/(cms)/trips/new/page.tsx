import { listDepartureCities } from "@/lib/db/departure-cities";
import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";
import { TripEditor } from "../_components/TripEditor";

export default async function NewTripPage() {
  const sb = getServiceClient();
  const [destRes, departureCities] = await Promise.all([
    sb
      .from("destinations")
      .select("*")
      .eq("is_active", true)
      .order("destination_name"),
    listDepartureCities(),
  ]);

  return (
    <TripEditor
      trip={null}
      destinations={(destRes.data ?? []) as DbDestination[]}
      departureCities={departureCities}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
    />
  );
}
