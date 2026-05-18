import { ScreeningCatalogEditor } from "./_components/ScreeningCatalogEditor";
import { getOrCreateDraftCatalog, countTripsWithScreeningEnabled } from "@/lib/db/screening";

export const dynamic = "force-dynamic";

export default async function ScreeningPage() {
  const [draft, enabledTripCount] = await Promise.all([
    getOrCreateDraftCatalog(),
    countTripsWithScreeningEnabled(),
  ]);
  return <ScreeningCatalogEditor draft={draft} enabledTripCount={enabledTripCount} />;
}
