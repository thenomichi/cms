import { getFaqs } from "@/lib/db/trip-faqs";
import { getTrips } from "@/lib/db/trips";
import { FaqsClient } from "./_components/FaqsClient";

export default async function FaqsPage() {
  const [faqs, trips] = await Promise.all([getFaqs(), getTrips()]);

  const tripOptions = trips.map((t) => ({
    trip_id: t.trip_id,
    trip_name: t.trip_name ?? "Untitled",
  }));

  return <FaqsClient faqs={faqs} trips={tripOptions} />;
}
