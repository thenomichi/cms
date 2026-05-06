"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, ArrowLeft } from "lucide-react";
import type { TripFull } from "@/lib/db/trips";
import type { DbDestination, DbTripGallery } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createTripAction, updateTripAction } from "../actions";
import { BasicTab } from "./tabs/BasicTab";
import { DetailsTab } from "./tabs/DetailsTab";
import { ItineraryTab } from "./tabs/ItineraryTab";
import { InclusionsTab } from "./tabs/InclusionsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { GalleryTab } from "./tabs/GalleryTab";
import { PreviewControls } from "./preview/PreviewControls";
import { PreviewFrame } from "./preview/PreviewFrame";
import { usePreviewBridge } from "./preview/usePreviewBridge";
import { useUnsavedChanges } from "./preview/useUnsavedChanges";
import { useDragResize } from "./preview/useDragResize";
import { useDerivedTripFields } from "./useDerivedTripFields";
import { useTripDirty } from "./useTripDirty";
import {
  type TripFormState,
  buildInitialState,
  STEPS_CREATE,
  STEPS_EDIT,
  validateStep,
} from "./types";

interface TripEditorProps {
  trip: TripFull | null;
  destinations: DbDestination[];
  websiteUrl: string;
}

export function TripEditor({ trip, destinations, websiteUrl }: TripEditorProps) {
  const router = useRouter();
  const isEditing = !!trip;
  const steps = isEditing ? STEPS_EDIT : STEPS_CREATE;

  const [form, setForm] = useState<TripFormState>(() => buildInitialState(trip));
  const [initialForm, setInitialForm] = useState<TripFormState>(() => buildInitialState(trip));

  useDerivedTripFields(form, setForm);

  const [stepIndex, setStepIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<"card" | "detail">("card");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [darkMode, setDarkMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [galleryOverride, setGalleryOverride] = useState<DbTripGallery[] | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { leftPct, isDragging, containerRef: splitRef, onMouseDown: onDividerMouseDown } = useDragResize(55);

  const { isDirty, markDirty, reset: resetDirty } = useTripDirty();

  useUnsavedChanges(isDirty);

  const { iframeReady, setMode, setDarkMode: sendDarkMode } = usePreviewBridge({
    iframeRef,
    form,
    trip,
    destinations,
    websiteUrl,
    galleryOverride,
    currentMode: previewMode,
  });

  const activeStep = steps[stepIndex]?.id ?? "basic";

  const updateField = useCallback(
    <K extends keyof TripFormState>(key: K, value: TripFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      markDirty(String(key));
    },
    [markDirty],
  );

  function handleModeChange(mode: "card" | "detail") {
    setPreviewMode(mode);
    setMode(mode);
  }

  function handleDarkModeChange(dark: boolean) {
    setDarkMode(dark);
    sendDarkMode(dark);
  }

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
        discount_pct: form.discount_pct, discount_amount: form.discount_amount, quoted_price: form.quoted_price,
        advance_pct: form.advance_pct, total_slots: form.total_slots,
        batch_number: form.batch_number || null, group_slug: form.group_slug,
        tagline: form.tagline || null,
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
      },
    };

    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));

    startTransition(async () => {
      const res = isEditing
        ? await updateTripAction(trip.trip_id, fd)
        : await createTripAction(fd);
      if (res.success) {
        if (isEditing) {
          toast.success("Trip updated");
          setInitialForm({ ...form });
          resetDirty();
        } else {
          toast.success("Trip created!");
          router.push("/trips");
        }
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });
  }

  function handleBackNavigation() {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      router.push("/trips");
    }
  }

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div
      className="flex flex-col"
      style={{
        margin: "-28px",
        width: "calc(100% + 56px)",
        height: "calc(100vh - 60px)",
        maxWidth: "calc(100% + 56px)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-mid hover:bg-surface3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-sm font-semibold text-ink truncate">
            {isEditing ? `Edit: ${trip.trip_name}` : "Create New Trip"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDirty && (
            <span className="text-[11px] text-rust font-medium whitespace-nowrap">Unsaved changes</span>
          )}
          <Button onClick={handleSave} loading={isPending}>
            <Check className="h-4 w-4" />
            {isEditing ? "Save Changes" : "Save"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div ref={splitRef} className="flex min-h-0 flex-1 overflow-hidden">
        {/* Form panel */}
        <div className="min-w-0 overflow-y-auto" style={{ width: `${leftPct}%` }}>
          <div className="p-6 space-y-5">
            {/* Batch group context banner */}
            {isEditing && form.group_slug && (
              <div
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 0,
                  fontSize: 13,
                  color: "var(--mid)",
                }}
              >
                <strong style={{ color: "var(--ink)" }}>
                  This trip is part of a batch group.
                </strong>
                <br />
                Changes to dates, pricing, and slots only affect this batch. Content
                changes (itinerary, gallery, inclusions) only affect this batch.
              </div>
            )}

            {/* Step indicator */}
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
                  const canClick = isEditing || i <= stepIndex;

                  return (
                    <button
                      key={step.id}
                      onClick={() => {
                        if (!canClick) return;
                        if (!isEditing && i > stepIndex) return;
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
                        {isCompleted ? "\u2713" : step.num}
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
                onGalleryChange={setGalleryOverride}
              />
            )}
            {activeStep === "settings" && (
              <>
                <SettingsTab
                  form={form}
                  updateField={updateField}
                  tripId={trip?.trip_id ?? null}
                />
                {!isEditing && form.trip_name && (
                  <div className="rounded-lg border border-line bg-surface p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mid">Summary</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div><span className="text-mid">Name:</span> <span className="font-medium">{form.trip_name}</span></div>
                      <div><span className="text-mid">Type:</span> <span className="font-medium">{form.trip_type}</span></div>
                      <div><span className="text-mid">Duration:</span> <span className="font-medium">{form.duration_days}D / {form.duration_nights}N</span></div>
                      {form.start_date && <div><span className="text-mid">Start:</span> <span className="font-medium">{form.start_date}</span></div>}
                      {(form.mrp_price || form.quoted_price) && (
                        <div><span className="text-mid">Price:</span> <span className="font-medium">{"\u20B9"}{((form.selling_price ?? form.quoted_price ?? form.mrp_price) ?? 0).toLocaleString("en-IN")}</span></div>
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

            {/* Footer navigation */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <Button
                variant="secondary"
                onClick={stepIndex === 0 ? handleBackNavigation : handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
                {stepIndex === 0 ? "Cancel" : "Back"}
              </Button>

              <div className="flex items-center gap-2">
                {isEditing && (
                  <Button onClick={handleSave} loading={isPending}>
                    <Check className="h-4 w-4" />
                    Save Changes
                  </Button>
                )}
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
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={onDividerMouseDown}
          className="group relative z-10 flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-line/60 hover:bg-rust/20 transition-colors"
          title="Drag to resize"
        >
          {/* Wide invisible hit target */}
          <div className="absolute inset-y-0 -left-2 -right-2" />
          {/* Grip dots */}
          <div className="flex flex-col gap-1 opacity-40 group-hover:opacity-80 transition-opacity">
            <div className="h-1 w-1 rounded-full bg-mid" />
            <div className="h-1 w-1 rounded-full bg-mid" />
            <div className="h-1 w-1 rounded-full bg-mid" />
            <div className="h-1 w-1 rounded-full bg-mid" />
            <div className="h-1 w-1 rounded-full bg-mid" />
          </div>
        </div>

        {/* Transparent overlay during drag — prevents iframe from stealing mouse events */}
        {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}

        {/* Preview panel */}
        <div className="min-w-0 flex flex-col" style={{ width: `${100 - leftPct}%` }}>
          <PreviewControls
            previewMode={previewMode}
            onModeChange={handleModeChange}
            viewport={viewport}
            onViewportChange={setViewport}
            iframeReady={iframeReady}
            darkMode={darkMode}
            onDarkModeChange={handleDarkModeChange}
          />
          <PreviewFrame
            websiteUrl={websiteUrl}
            iframeRef={iframeRef}
            iframeReady={iframeReady}
            viewport={viewport}
            previewMode={previewMode}
          />
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showExitConfirm}
        onCancel={() => setShowExitConfirm(false)}
        onConfirm={() => router.push("/trips")}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave"
        variant="danger"
      />
    </div>
  );
}
