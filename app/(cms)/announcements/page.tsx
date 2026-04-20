import { getAnnouncements } from "@/lib/db/announcements";
import { getTrips } from "@/lib/db/trips";
import { AnnouncementsClient } from "./_components/AnnouncementsClient";

export default async function AnnouncementsPage() {
  const [announcements, trips] = await Promise.all([
    getAnnouncements(),
    getTrips(),
  ]);

  const tripOptions = trips.map((t) => ({
    trip_id: t.trip_id,
    trip_name: t.trip_name ?? "Untitled",
    slug: t.slug ?? undefined,
  }));

  return (
    <AnnouncementsClient announcements={announcements} trips={tripOptions} />
  );
}
