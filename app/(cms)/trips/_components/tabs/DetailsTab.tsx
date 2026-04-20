"use client";

import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { ListBuilder } from "@/components/ui/ListBuilder";
import { RichEditor } from "@/components/ui/RichEditor";
import type { TripFormState } from "../TripFormModal";

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

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
            <RichEditor
              value={form.overview}
              onChange={(html) => updateField("overview", html)}
              placeholder="A brief overview of the trip..."
            />
          </FormField>

          <FormField label="Description" hint="Full trip description for the detail page">
            <RichEditor
              value={form.description}
              onChange={(html) => updateField("description", html)}
              placeholder="Detailed description of the trip experience..."
            />
          </FormField>
        </div>
      </FormSection>

      {/* ── Key Highlights ── */}
      <FormSection title="Key Highlights">
        <FormField label="Highlights" hint="Key highlights — drag to reorder">
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
