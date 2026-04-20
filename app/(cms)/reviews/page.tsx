import { getReviews } from "@/lib/db/reviews";
import { ReviewsClient } from "./_components/ReviewsClient";

export default async function ReviewsPage() {
  const reviews = await getReviews();
  return <ReviewsClient reviews={reviews} />;
}
