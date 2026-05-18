"use client";

import { useState } from "react";
import { TripEditor } from "../_components/TripEditor";
import { ResumeDraftModal } from "../_components/ResumeDraftModal";
import type { DbTrip, DbDepartureCity, DbDestination, DbExclusion, DbInclusionChip } from "@/lib/types";
import type { FullCatalogVersion } from "@/lib/db/screening";

interface Props {
  userId: string;
  destinations: DbDestination[];
  departureCities: DbDepartureCity[];
  exclusions: DbExclusion[];
  inclusionChips: DbInclusionChip[];
  websiteUrl: string;
  resumable: DbTrip | null;
  activeCatalog: FullCatalogVersion | null;
}

export function NewTripWrapper({
  userId,
  destinations,
  departureCities,
  exclusions,
  inclusionChips,
  websiteUrl,
  resumable,
  activeCatalog,
}: Props) {
  const [showResume, setShowResume] = useState(!!resumable);
  return (
    <>
      {showResume && resumable && (
        <ResumeDraftModal draft={resumable} onDismiss={() => setShowResume(false)} />
      )}
      <TripEditor
        trip={null}
        destinations={destinations}
        departureCities={departureCities}
        exclusions={exclusions}
        inclusionChips={inclusionChips}
        websiteUrl={websiteUrl}
        userId={userId}
        activeCatalog={activeCatalog}
        initialVariantAxes={[]}
      />
    </>
  );
}
