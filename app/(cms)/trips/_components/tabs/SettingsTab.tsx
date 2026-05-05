"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Toggle } from "@/components/ui/Toggle";
import { TRIP_STATUS_OPTIONS } from "@/lib/constants";
import { uploadTripItineraryAction } from "../../actions";
import type { TripFormState } from "../TripFormModal";

// ---------------------------------------------------------------------------
// Shared input classes
// ---------------------------------------------------------------------------

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const SELECT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

// ---------------------------------------------------------------------------
// Itinerary URL helpers
// ---------------------------------------------------------------------------

function looksLikePdfUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const pathLooksRight = /\.pdf(?:\?|#|$)/i.test(parsed.pathname);
    // Some hosts (e.g. Supabase storage signed URLs) don't have .pdf in the
    // path but are valid; allow any https URL through and let the iframe
    // preview surface obvious failures.
    return pathLooksRight || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
  /** Existing trip ID for upload target; null on create (upload disabled). */
  tripId: string | null;
}

export function SettingsTab({ form, updateField, tripId }: SettingsTabProps) {
  // Draft and Cancelled trips can never be marked Listed or Show-on-Homepage.
  // Disable the toggles to make the constraint visible before save.
  const canBePublic =
    form.status === "Upcoming" ||
    form.status === "Ongoing" ||
    form.status === "Completed";

  function handleStatusChange(newStatus: string) {
    updateField("status", newStatus);
    const stillPublic =
      newStatus === "Upcoming" ||
      newStatus === "Ongoing" ||
      newStatus === "Completed";
    if (!stillPublic) {
      if (form.is_listed) updateField("is_listed", false);
      if (form.show_on_homepage) updateField("show_on_homepage", false);
    }
  }

  // ── Itinerary upload ─────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, startUploading] = useTransition();
  const [previewError, setPreviewError] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed.");
      e.target.value = "";
      return;
    }
    if (!tripId) {
      toast.error("Save the trip first, then come back to upload an itinerary.");
      e.target.value = "";
      return;
    }
    startUploading(async () => {
      const res = await uploadTripItineraryAction(tripId, file);
      if (res.success && res.url) {
        updateField("dossier_url", res.url);
        setPreviewError(false);
        toast.success("Itinerary uploaded. Don't forget to save the trip.");
      } else {
        toast.error(res.error ?? "Upload failed");
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const previewable = form.dossier_url && looksLikePdfUrl(form.dossier_url);

  return (
    <div className="space-y-5">
      {/* ── Publishing ── */}
      <FormSection title="Publishing">
        <div className="space-y-4">
          <FormField label="Status" required>
            <select
              className={SELECT}
              value={form.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {TRIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>

          {!canBePublic && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Public listing is locked while status is <strong>{form.status}</strong>. Move the trip to Upcoming, Ongoing, or Completed to enable.
            </div>
          )}

          <div
            className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4 aria-disabled:opacity-50"
            aria-disabled={!canBePublic}
          >
            <div>
              <p className="text-sm font-medium text-ink">Listed on Website</p>
              <p className="text-xs text-mid">
                Show this trip on the public website
              </p>
            </div>
            <Toggle
              checked={form.is_listed}
              onChange={(v) => updateField("is_listed", v)}
              disabled={!canBePublic}
            />
          </div>

          <div
            className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4 aria-disabled:opacity-50"
            aria-disabled={!canBePublic}
          >
            <div>
              <p className="text-sm font-medium text-ink">Show on Homepage</p>
              <p className="text-xs text-mid">
                Feature this trip on the homepage carousel
              </p>
            </div>
            <Toggle
              checked={form.show_on_homepage}
              onChange={(v) => updateField("show_on_homepage", v)}
              disabled={!canBePublic}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Trip Itinerary ─────────────────────────────────────────────────── */}
      <FormSection title="Trip Itinerary">
        <p className="text-xs text-mid mb-3">
          Upload a PDF or paste an existing URL. The link appears as
          “Download Itinerary” on the trip detail page on the website.
        </p>

        <div className="space-y-4">
          {/* Upload */}
          <div className="rounded-lg border border-dashed border-line bg-surface2/40 p-4">
            <p className="text-sm font-medium text-ink mb-1">Upload PDF</p>
            <p className="text-xs text-mid mb-3">
              {tripId
                ? "PDF only, max 25MB. Replaces any existing URL on success."
                : "Save the trip first, then come back to upload a PDF."}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={!tripId || isUploading}
              className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-rust file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-rust/90 disabled:opacity-50"
            />
            {isUploading && <p className="mt-2 text-xs text-mid">Uploading…</p>}
          </div>

          {/* OR — direct URL */}
          <FormField
            label="Or paste an itinerary URL"
            hint="Public link to a PDF. Used when there's nothing to upload."
          >
            <input
              type="url"
              className={INPUT}
              value={form.dossier_url}
              onChange={(e) => {
                updateField("dossier_url", e.target.value);
                setPreviewError(false);
              }}
              placeholder="https://example.com/itinerary.pdf"
            />
          </FormField>

          {/* Preview */}
          {form.dossier_url ? (
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-ink">Preview</p>
                <a
                  href={form.dossier_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-rust hover:underline"
                >
                  Open in new tab ↗
                </a>
              </div>
              {previewable && !previewError ? (
                <iframe
                  src={form.dossier_url}
                  title="Itinerary preview"
                  className="h-64 w-full rounded border border-line bg-white"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {!looksLikePdfUrl(form.dossier_url)
                    ? "URL doesn't look like a PDF link. Save anyway if you're sure it works — verify with the “Open in new tab” link."
                    : "Preview failed to load. The PDF may not be publicly accessible. Verify with the “Open in new tab” link before saving."}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </FormSection>
    </div>
  );
}
