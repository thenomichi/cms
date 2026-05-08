import { notFound, redirect } from "next/navigation";
import { listDepartureCities } from "@/lib/db/departure-cities";
import { getTripById } from "@/lib/db/trips";
import { getServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/supabase/server-auth";
import type { DbDestination } from "@/lib/types";
import { TripEditor } from "../../_components/TripEditor";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

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
      userId={session.user.id}
    />
  );
}
