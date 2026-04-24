import { getReviews } from "@/lib/db/reviews";
import { getTrips } from "@/lib/db/trips";
import { ReviewsClient } from "./_components/ReviewsClient";

export default async function ReviewsPage() {
  const [reviews, trips] = await Promise.all([getReviews(), getTrips()]);

  const tripOptions = trips.map((t) => ({
    trip_id: t.trip_id,
    trip_name: t.trip_name ?? "Untitled",
  }));

  return <ReviewsClient reviews={reviews} trips={tripOptions} />;
}
