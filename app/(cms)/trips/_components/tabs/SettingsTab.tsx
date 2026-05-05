"use client";

import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Toggle } from "@/components/ui/Toggle";
import { TRIP_STATUS_OPTIONS } from "@/lib/constants";
import type { TripFormState } from "../TripFormModal";

// ---------------------------------------------------------------------------
// Shared input classes
// ---------------------------------------------------------------------------

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const SELECT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
}

export function SettingsTab({ form, updateField }: SettingsTabProps) {
  // Draft and Cancelled trips can never be marked Listed or Show-on-Homepage.
  // Disable the toggles to make the constraint visible before save.
  const canBePublic =
    form.status === "Upcoming" ||
    form.status === "Ongoing" ||
    form.status === "Completed";

  function handleStatusChange(newStatus: string) {
    updateField("status", newStatus);
    // Auto-clear public flags when status moves out of a listable state.
    const stillPublic =
      newStatus === "Upcoming" ||
      newStatus === "Ongoing" ||
      newStatus === "Completed";
    if (!stillPublic) {
      if (form.is_listed) updateField("is_listed", false);
      if (form.show_on_homepage) updateField("show_on_homepage", false);
    }
  }

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

      {/* ── Trip Dossier ── */}
      <FormSection title="Trip Dossier">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Dossier URL" hint="Link to the trip dossier PDF">
            <input
              type="text"
              className={INPUT}
              value={form.dossier_url}
              onChange={(e) => updateField("dossier_url", e.target.value)}
              placeholder="https://..."
            />
          </FormField>
          <FormField label="Dossier Published At">
            <input
              type="date"
              className={INPUT}
              value={form.dossier_published_at}
              onChange={(e) => updateField("dossier_published_at", e.target.value)}
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}
