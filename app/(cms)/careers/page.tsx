import { getCareerListings } from "@/lib/db/careers";
import { CareersClient } from "./_components/CareersClient";

export default async function CareersPage() {
  const listings = await getCareerListings();
  return <CareersClient initialData={listings} />;
}
