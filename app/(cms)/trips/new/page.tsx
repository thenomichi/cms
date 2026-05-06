import { getServiceClient } from "@/lib/supabase/server";
import type { DbDestination } from "@/lib/types";
import { TripEditor } from "../_components/TripEditor";

export default async function NewTripPage() {
  const sb = getServiceClient();
  const { data } = await sb
    .from("destinations")
    .select("*")
    .eq("is_active", true)
    .order("destination_name");

  return (
    <TripEditor
      trip={null}
      destinations={(data ?? []) as DbDestination[]}
      websiteUrl={process.env.WEBSITE_URL ?? "http://localhost:3000"}
    />
  );
}
