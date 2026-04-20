import { getTripGalleryImages, getSiteGalleryImages, getRawMoments } from "@/lib/db/media";
import { getTrips } from "@/lib/db/trips";
import { MediaClient } from "./_components/MediaClient";

export default async function MediaPage() {
  const [tripImages, siteImages, rawMoments, trips] = await Promise.all([
    getTripGalleryImages(),
    getSiteGalleryImages(),
    getRawMoments(),
    getTrips(),
  ]);

  const tripOptions = trips.map((t) => ({ value: t.trip_id, label: t.trip_name ?? t.slug ?? "Untitled" }));

  return (
    <MediaClient
      initialTripImages={tripImages}
      initialSiteImages={siteImages}
      initialRawMoments={rawMoments}
      tripOptions={tripOptions}
    />
  );
}
