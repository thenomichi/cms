"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { TripImagesView } from "./TripImagesView";
import { SiteGalleryMomentsView } from "./SiteGalleryMomentsView";
import type { DbTripGallery, DbSiteGallery, DbRawMoment } from "@/lib/types";

const MEDIA_TABS = [
  { id: "trips", label: "Trip Images" },
  { id: "site", label: "Site Gallery & Moments" },
];

interface Props {
  initialTripImages: (DbTripGallery & { trip_name: string | null })[];
  initialSiteImages: DbSiteGallery[];
  initialRawMoments: DbRawMoment[];
  tripOptions: { value: string; label: string }[];
}

export function MediaClient({
  initialTripImages,
  initialSiteImages,
  initialRawMoments,
  tripOptions,
}: Props) {
  const [activeTab, setActiveTab] = useState("trips");

  return (
    <>
      <div className="mb-6">
        <Tabs tabs={MEDIA_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === "trips" ? (
        <TripImagesView
          initialTripImages={initialTripImages}
          tripOptions={tripOptions}
        />
      ) : (
        <SiteGalleryMomentsView
          initialSiteImages={initialSiteImages}
          initialRawMoments={initialRawMoments}
        />
      )}
    </>
  );
}
