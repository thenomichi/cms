import { getDestinations } from "@/lib/db/destinations";
import { DestinationsClient } from "./_components/DestinationsClient";

export default async function DestinationsPage() {
  const destinations = await getDestinations();
  return <DestinationsClient destinations={destinations} />;
}
