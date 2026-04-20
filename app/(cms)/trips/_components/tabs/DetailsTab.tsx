"use client";

import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { ListBuilder } from "@/components/ui/ListBuilder";
import type { TripFormState } from "../TripFormModal";

// ---------------------------------------------------------------------------
// Shared input classes
// ---------------------------------------------------------------------------

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const TEXTAREA =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-y";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DetailsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
}

export function DetailsTab({ form, updateField }: DetailsTabProps) {
  return (
    <div className="space-y-5">
      {/* ── Quick Summary ── */}
      <FormSection title="Quick Summary">
        <FormField label="Tagline" hint="One-liner shown below the trip name">
          <input
            type="text"
            className={INPUT}
            value={form.tagline}
            onChange={(e) => updateField("tagline", e.target.value)}
            placeholder="e.g. Where heritage meets adventure"
          />
        </FormField>
      </FormSection>

      {/* ── Trip Description ── */}
      <FormSection title="Trip Description">
        <div className="space-y-4">
          <FormField label="Overview" hint="Short overview shown on the trip card">
            <textarea
              className={TEXTAREA}
              rows={3}
              value={form.overview}
              onChange={(e) => updateField("overview", e.target.value)}
              placeholder="A brief overview of the trip..."
            />
          </FormField>

          <FormField label="Description" hint="Full trip description for the detail page">
            <textarea
              className={TEXTAREA}
              rows={6}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Detailed description of the trip experience..."
            />
          </FormField>
        </div>
      </FormSection>

      {/* ── Key Highlights ── */}
      <FormSection title="Key Highlights">
        <FormField label="Highlights" hint="Key highlights of the trip">
          <ListBuilder
            items={form.highlights}
            onChange={(items) => updateField("highlights", items)}
            placeholder="Enter a highlight..."
          />
        </FormField>
      </FormSection>
    </div>
  );
}
