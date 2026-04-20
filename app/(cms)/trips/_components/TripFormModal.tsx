"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { TripFull } from "@/lib/db/trips";
import type { DbDestination } from "@/lib/types";
import type { ItineraryDayInput } from "@/lib/db/trip-itinerary";
import type { InclusionInput, ExclusionInput } from "@/lib/db/trip-inclusions";
import { createTripAction, updateTripAction } from "../actions";
import { BasicTab } from "./tabs/BasicTab";
import { DetailsTab } from "./tabs/DetailsTab";
import { ItineraryTab } from "./tabs/ItineraryTab";
import { InclusionsTab } from "./tabs/InclusionsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { GalleryTab } from "./tabs/GalleryTab";

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
  dossier_url: string;
  dossier_published_at: string;
}

function buildInitialState(trip: TripFull | null): TripFormState {
  if (!trip) {
    return {
      trip_name: "", slug: "", trip_type: "Community", trip_sub_type: "",
      trip_category: "", destination_id: "", duration_days: 1, duration_nights: 0,
      start_date: "", end_date: "", mrp_price: null, selling_price: null,
      discount_pct: null, quoted_price: null, advance_pct: 50, total_slots: null,
      batch_number: "", departure_city: "", departure_airport: "",
      booking_kind: "trip", currency_code: "INR",
      overview: "", description: "", tagline: "", highlights: [],
      itinerary: [], inclusions: [], exclusions: [],
      status: "Draft", is_listed: false, show_on_homepage: false,
      dossier_url: "", dossier_published_at: "",
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
    dossier_url: trip.dossier_url ?? "", dossier_published_at: trip.dossier_published_at ?? "",
  };
}

// ---------------------------------------------------------------------------
// Steps — same structure for both create and edit
// ---------------------------------------------------------------------------

const STEPS_CREATE = [
  { id: "basic", label: "Trip Info", desc: "Name, type, dates & pricing", num: "1" },
  { id: "details", label: "Description", desc: "Overview, tagline & highlights", num: "2" },
  { id: "itinerary", label: "Itinerary", desc: "Day-by-day plan", num: "3" },
  { id: "inclusions", label: "What's Included", desc: "Inclusions & exclusions", num: "4" },
  { id: "settings", label: "Review & Publish", desc: "Status & visibility", num: "5" },
];

const STEPS_EDIT = [
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

function validateStep(step: string, form: TripFormState): string | null {
  switch (step) {
    case "basic":
      if (!form.trip_name.trim()) return "Trip name is required";
      if (!form.trip_type) return "Trip type is required";
      if (form.duration_days < 1) return "Duration must be at least 1 day";
      return null;
    case "details":
      return null; // all optional
    case "itinerary":
      return null; // optional for now
    case "inclusions":
      return null;
    case "settings":
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TripFormModalProps {
  open: boolean;
  onClose: () => void;
  trip: TripFull | null;
  destinations: DbDestination[];
}

export function TripFormModal({ open, onClose, trip, destinations }: TripFormModalProps) {
  const isEditing = !!trip;
  const steps = isEditing ? STEPS_EDIT : STEPS_CREATE;
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<TripFormState>(() => buildInitialState(trip));
  const [isPending, startTransition] = useTransition();

  // Reset when trip changes
  const prevTripId = trip?.trip_id ?? null;
  const [lastTripId, setLastTripId] = useState<string | null>(null);
  if (prevTripId !== lastTripId) {
    setLastTripId(prevTripId);
    setForm(buildInitialState(trip));
    setStepIndex(0);
  }

  const activeStep = steps[stepIndex]?.id ?? "basic";

  const updateField = useCallback(
    <K extends keyof TripFormState>(key: K, value: TripFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  function handleNext() {
    const error = validateStep(activeStep, form);
    if (error) {
      toast.error(error);
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  }

  function handleBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function handleSave() {
    const payload = {
      basic: {
        trip_name: form.trip_name, trip_type: form.trip_type,
        trip_sub_type: form.trip_sub_type || null, trip_category: form.trip_category || null,
        destination_id: form.destination_id || null,
        duration_days: form.duration_days, duration_nights: form.duration_nights,
        start_date: form.start_date || null, end_date: form.end_date || null,
        mrp_price: form.mrp_price, selling_price: form.selling_price,
        discount_pct: form.discount_pct, quoted_price: form.quoted_price,
        advance_pct: form.advance_pct, total_slots: form.total_slots,
        batch_number: form.batch_number || null, tagline: form.tagline || null,
        departure_city: form.departure_city || null,
        departure_airport: form.departure_airport || null,
        booking_kind: form.booking_kind, currency_code: form.currency_code,
      },
      overview: form.overview, description: form.description,
      tagline: form.tagline, highlights: form.highlights,
      itinerary: form.itinerary, inclusions: form.inclusions, exclusions: form.exclusions,
      settings: {
        status: form.status, is_listed: form.is_listed,
        show_on_homepage: form.show_on_homepage,
        dossier_url: form.dossier_url || null,
        dossier_published_at: form.dossier_published_at || null,
      },
    };

    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));

    startTransition(async () => {
      const res = isEditing
        ? await updateTripAction(trip.trip_id, fd)
        : await createTripAction(fd);
      if (res.success) {
        toast.success(isEditing ? "Trip updated" : "Trip created!");
        onClose();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });
  }

  const isLastStep = stepIndex === steps.length - 1;

  // Unified footer — same layout, different primary action
  const footer = (
    <div className="flex w-full items-center justify-between">
      <Button
        variant="secondary"
        onClick={stepIndex === 0 ? onClose : handleBack}
      >
        <ChevronLeft className="h-4 w-4" />
        {stepIndex === 0 ? "Cancel" : "Back"}
      </Button>

      <div className="flex items-center gap-2">
        {/* Edit mode: always show save */}
        {isEditing && (
          <Button onClick={handleSave} loading={isPending}>
            <Check className="h-4 w-4" />
            Save Changes
          </Button>
        )}
        {/* Create mode: show Create on last step, Next otherwise */}
        {!isEditing && isLastStep && (
          <Button onClick={handleSave} loading={isPending}>
            <Check className="h-4 w-4" />
            Create Trip
          </Button>
        )}
        {!isEditing && !isLastStep && (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEditing ? `Edit: ${trip.trip_name}` : "Create New Trip"}
      wide
      footer={footer}
    >
      <div className="space-y-5">
        {/* Step indicator — unified for both create and edit */}
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-surface3">
            <div
              className="h-1 rounded-full bg-rust transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Step dots with labels */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {steps.map((step, i) => {
              const isActive = i === stepIndex;
              const isCompleted = i < stepIndex;
              // Create mode: can only go to completed steps or current. Edit: all clickable.
              const canClick = isEditing || i <= stepIndex;

              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (!canClick) return;
                    if (!isEditing && i > stepIndex) return; // enforce linear in create
                    setStepIndex(i);
                  }}
                  disabled={!canClick}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-rust/10 text-rust"
                      : isCompleted
                        ? "text-ink cursor-pointer hover:bg-surface3"
                        : canClick
                          ? "text-mid cursor-pointer hover:bg-surface3"
                          : "text-fog/50 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-rust text-white"
                        : isCompleted
                          ? "bg-sem-green text-white"
                          : "bg-surface3 text-mid"
                    }`}
                  >
                    {isCompleted ? "✓" : step.num}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* Current step description */}
          <p className="text-xs text-mid">{steps[stepIndex]?.desc}</p>
        </div>

        {/* Step content */}
        {activeStep === "basic" && (
          <BasicTab form={form} updateField={updateField} destinations={destinations} />
        )}
        {activeStep === "details" && (
          <DetailsTab form={form} updateField={updateField} />
        )}
        {activeStep === "itinerary" && (
          <ItineraryTab form={form} updateField={updateField} />
        )}
        {activeStep === "inclusions" && (
          <InclusionsTab form={form} updateField={updateField} />
        )}
        {activeStep === "gallery" && isEditing && (
          <GalleryTab
            tripId={trip?.trip_id ?? null}
            gallery={trip?.gallery ?? []}
            onGalleryChange={() => {}}
          />
        )}
        {activeStep === "settings" && (
          <>
            <SettingsTab form={form} updateField={updateField} />
            {/* Create mode: show summary before creating */}
            {!isEditing && form.trip_name && (
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mid">Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div><span className="text-mid">Name:</span> <span className="font-medium">{form.trip_name}</span></div>
                  <div><span className="text-mid">Type:</span> <span className="font-medium">{form.trip_type}</span></div>
                  <div><span className="text-mid">Duration:</span> <span className="font-medium">{form.duration_days}D / {form.duration_nights}N</span></div>
                  {form.start_date && <div><span className="text-mid">Start:</span> <span className="font-medium">{form.start_date}</span></div>}
                  {(form.mrp_price || form.quoted_price) && (
                    <div><span className="text-mid">Price:</span> <span className="font-medium">₹{((form.selling_price ?? form.quoted_price ?? form.mrp_price) ?? 0).toLocaleString("en-IN")}</span></div>
                  )}
                  {form.total_slots && <div><span className="text-mid">Slots:</span> <span className="font-medium">{form.total_slots}</span></div>}
                  <div><span className="text-mid">Highlights:</span> <span className="font-medium">{form.highlights.filter(Boolean).length} items</span></div>
                  <div><span className="text-mid">Itinerary:</span> <span className="font-medium">{form.itinerary.length} days</span></div>
                  <div><span className="text-mid">Inclusions:</span> <span className="font-medium">{form.inclusions.length} items</span></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </FormModal>
  );
}
