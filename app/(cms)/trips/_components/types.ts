import type { TripFull } from "@/lib/db/trips";
import type { ItineraryDayInput } from "@/lib/db/trip-itinerary";
import type { InclusionInput, ExclusionInput } from "@/lib/db/trip-inclusions";

// ---------------------------------------------------------------------------
// Form state shape
// ---------------------------------------------------------------------------

export interface TripFormState {
  trip_name: string;
  slug: string;
  trip_type: string;
  trip_sub_type: string;
  trip_category: string;
  destination_id: string;
  duration_days: number;
  duration_nights: number;
  start_date: string;
  end_date: string;
  mrp_price: number | null;
  selling_price: number | null;
  discount_pct: number | null;
  quoted_price: number | null;
  advance_pct: number;
  total_slots: number | null;
  batch_number: string;
  group_slug: string | null;
  departure_city: string;
  departure_airport: string;
  booking_kind: string;
  currency_code: string;
  overview: string;
  description: string;
  tagline: string;
  highlights: string[];
  itinerary: ItineraryDayInput[];
  inclusions: InclusionInput[];
  exclusions: ExclusionInput[];
  status: string;
  is_listed: boolean;
  show_on_homepage: boolean;
  // Trip Itinerary PDF URL (DB column is dossier_url for historical reasons —
  // the website's "Download Itinerary" button reads this column).
  dossier_url: string;
}

export function buildInitialState(trip: TripFull | null): TripFormState {
  if (!trip) {
    return {
      trip_name: "", slug: "", trip_type: "Community", trip_sub_type: "",
      trip_category: "", destination_id: "", duration_days: 1, duration_nights: 0,
      start_date: "", end_date: "", mrp_price: null, selling_price: null,
      discount_pct: null, quoted_price: null, advance_pct: 50, total_slots: null,
      batch_number: "", group_slug: null, departure_city: "", departure_airport: "",
      booking_kind: "trip", currency_code: "INR",
      overview: "", description: "", tagline: "", highlights: [],
      itinerary: [], inclusions: [], exclusions: [],
      status: "Draft", is_listed: false, show_on_homepage: false,
      dossier_url: "",
    };
  }

  const contentOf = (type: string) =>
    trip.content.find((c) => c.content_type === type)?.content_text ?? "";
  const highlights = trip.content
    .filter((c) => c.content_type === "highlight")
    .sort((a, b) => a.content_order - b.content_order)
    .map((c) => c.content_text);

  return {
    trip_name: trip.trip_name ?? "", slug: trip.slug ?? "",
    trip_type: trip.trip_type ?? "Community",
    trip_sub_type: trip.trip_sub_type ?? "", trip_category: trip.trip_category ?? "",
    destination_id: trip.destination_id ?? "",
    duration_days: trip.duration_days ?? 1, duration_nights: trip.duration_nights ?? 0,
    start_date: trip.start_date ?? "", end_date: trip.end_date ?? "",
    mrp_price: trip.mrp_price, selling_price: trip.selling_price,
    discount_pct: trip.discount_pct, quoted_price: trip.quoted_price,
    advance_pct: trip.advance_pct ?? 50, total_slots: trip.total_slots,
    batch_number: trip.batch_number ?? "",
    group_slug: trip.group_slug ?? null,
    departure_city: trip.departure_city ?? "", departure_airport: trip.departure_airport ?? "",
    booking_kind: trip.booking_kind ?? "trip", currency_code: trip.currency_code ?? "INR",
    overview: contentOf("overview"), description: contentOf("description"),
    tagline: contentOf("tagline"), highlights,
    itinerary: trip.itinerary.map((d) => ({
      day_number: d.day_number, title: d.title, subtitle: d.subtitle,
      description: d.description, meals: d.meals, accommodation: d.accommodation, tags: d.tags,
    })),
    inclusions: trip.inclusions
      .filter((i) => i.inclusion_type === "inclusion")
      .map((i) => ({ icon: i.icon, name: i.name, note: i.note })),
    exclusions: trip.inclusions
      .filter((i) => i.inclusion_type === "exclusion")
      .map((i) => ({ name: i.name })),
    status: trip.status ?? "Draft", is_listed: trip.is_listed ?? false,
    show_on_homepage: trip.show_on_homepage ?? false,
    dossier_url: trip.dossier_url ?? "",
  };
}

// ---------------------------------------------------------------------------
// Steps — same structure for both create and edit
// ---------------------------------------------------------------------------

export interface StepDef {
  id: string;
  label: string;
  desc: string;
  num: string;
}

export const STEPS_CREATE: StepDef[] = [
  { id: "basic", label: "Trip Info", desc: "Name, type, dates & pricing", num: "1" },
  { id: "details", label: "Description", desc: "Overview, tagline & highlights", num: "2" },
  { id: "itinerary", label: "Itinerary", desc: "Day-by-day plan", num: "3" },
  { id: "inclusions", label: "What's Included", desc: "Inclusions & exclusions", num: "4" },
  { id: "settings", label: "Review & Publish", desc: "Status & visibility", num: "5" },
];

export const STEPS_EDIT: StepDef[] = [
  { id: "basic", label: "Trip Info", desc: "Name, type, dates & pricing", num: "1" },
  { id: "details", label: "Description", desc: "Overview, tagline & highlights", num: "2" },
  { id: "itinerary", label: "Itinerary", desc: "Day-by-day plan", num: "3" },
  { id: "inclusions", label: "What's Included", desc: "Inclusions & exclusions", num: "4" },
  { id: "gallery", label: "Gallery", desc: "Trip images & cover photo", num: "5" },
  { id: "settings", label: "Publish Settings", desc: "Status & visibility", num: "6" },
];

// ---------------------------------------------------------------------------
// Step validation
// ---------------------------------------------------------------------------

export function validateStep(step: string, form: TripFormState): string | null {
  switch (step) {
    case "basic":
      if (!form.trip_name.trim()) return "Trip name is required";
      if (!form.trip_type) return "Trip type is required";
      if (form.duration_days < 1) return "Duration must be at least 1 day";
      return null;
    case "details":
      return null;
    case "itinerary":
      return null;
    case "inclusions":
      return null;
    case "settings":
      return null;
    default:
      return null;
  }
}
