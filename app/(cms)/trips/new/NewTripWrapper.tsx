"use client";

import { useState } from "react";
import { TripEditor } from "../_components/TripEditor";
import { ResumeDraftModal } from "../_components/ResumeDraftModal";
import type { DbTrip, DbDepartureCity, DbDestination } from "@/lib/types";

interface Props {
  userId: string;
  destinations: DbDestination[];
  departureCities: DbDepartureCity[];
  websiteUrl: string;
  resumable: DbTrip | null;
}

export function NewTripWrapper({
  userId,
  destinations,
  departureCities,
  websiteUrl,
  resumable,
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
        websiteUrl={websiteUrl}
        userId={userId}
      />
    </>
  );
}
