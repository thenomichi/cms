"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { TripFormState } from "../types";
import type { TripFull } from "@/lib/db/trips";
import type { DbDestination, DbTripGallery } from "@/lib/types";

interface UsePreviewBridgeArgs {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  form: TripFormState;
  trip: TripFull | null;
  destinations: DbDestination[];
  websiteUrl: string;
  galleryOverride?: DbTripGallery[] | null;
  currentMode?: "card" | "detail";
}

function pickImages(gallery: DbTripGallery[]) {
  const sorted = [...gallery].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return a.display_order - b.display_order;
  });
  const cover = sorted[0]
    ? sorted[0].thumbnail_url ?? sorted[0].image_url
    : null;
  const images = sorted.map((g) => g.thumbnail_url ?? g.image_url);
  return { cover, images };
}

function buildPayload(
  form: TripFormState,
  trip: TripFull | null,
  destinations: DbDestination[],
  galleryOverride?: DbTripGallery[] | null,
) {
  const dest = destinations.find((d) => d.destination_id === form.destination_id);
  const gallery = galleryOverride ?? trip?.gallery ?? [];
  const { cover, images } = pickImages(gallery);

  return {
    trip_name: form.trip_name,
    slug: form.slug,
    trip_type: form.trip_type,
    trip_sub_type: form.trip_sub_type,
    trip_category: form.trip_category,
    destination_name: dest?.destination_name ?? "",
    destination_country: dest?.country ?? "",
    is_domestic: dest?.is_domestic ?? true,
    duration_days: form.duration_days,
    duration_nights: form.duration_nights,
    start_date: form.start_date,
    end_date: form.end_date,
    mrp_price: form.mrp_price,
    selling_price: form.selling_price,
    quoted_price: form.quoted_price,
    advance_pct: form.advance_pct,
    total_slots: form.total_slots,
    booked_slots: trip?.booked_slots ?? 0,
    departure_city: form.departure_city,
    overview: form.overview,
    description: form.description,
    tagline: form.tagline,
    highlights: form.highlights.filter(Boolean),
    itinerary: form.itinerary,
    inclusions: form.inclusions,
    exclusions: form.exclusions,
    status: form.status,
    is_listed: form.is_listed,
    show_on_homepage: form.show_on_homepage,
    cover_image: cover,
    gallery_images: images,
    trip_id: trip?.trip_id,
    group_slug: form.group_slug,
    batch_number: form.batch_number,
  };
}

export function usePreviewBridge({
  iframeRef,
  form,
  trip,
  destinations,
  websiteUrl,
  galleryOverride,
  currentMode = "card",
}: UsePreviewBridgeArgs) {
  const [iframeReady, setIframeReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest payload in a ref so the PREVIEW_READY handler can send it
  // immediately without stale closure issues.
  const payload = useMemo(
    () => buildPayload(form, trip, destinations, galleryOverride),
    [form, trip, destinations, galleryOverride],
  );
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  // Send payload to iframe
  const sendPayload = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "PREVIEW_UPDATE", payload: payloadRef.current },
      "*",
    );
  }, [iframeRef]);

  // Track current mode in a ref so the ready handler always has the latest
  const modeRef = useRef(currentMode);
  modeRef.current = currentMode;

  // Listen for PREVIEW_READY — send mode + data immediately every time it fires.
  // We accept this from any origin since it's just a readiness signal with no payload.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "PREVIEW_READY") return;
      setIframeReady(true);
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "SET_MODE", mode: modeRef.current },
          "*",
        );
        iframeRef.current?.contentWindow?.postMessage(
          { type: "PREVIEW_UPDATE", payload: payloadRef.current },
          "*",
        );
      }, 50);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [websiteUrl, sendPayload, iframeRef]);

  // Debounced send on every form change (only when iframe is ready)
  useEffect(() => {
    if (!iframeReady) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(sendPayload, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [iframeReady, payload, sendPayload]);

  const setMode = useCallback(
    (mode: "card" | "detail") => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "SET_MODE", mode },
        "*",
      );
    },
    [iframeRef],
  );

  const setDarkMode = useCallback(
    (dark: boolean) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "SET_THEME", dark },
        "*",
      );
    },
    [iframeRef],
  );

  return { iframeReady, setMode, setDarkMode };
}
