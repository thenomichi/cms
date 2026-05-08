"use client";

import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { ListBuilder } from "@/components/ui/ListBuilder";
import { RichEditor } from "@/components/ui/RichEditor";
import type { TripFormState } from "../types";

interface DetailsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
}

export function DetailsTab({ form, updateField }: DetailsTabProps) {
  return (
    <div className="space-y-5">
      {/* ── About this Journey ── */}
      <FormSection title="About this Journey">
        <FormField
          label="About this Journey"
          hint="The main paragraph shown on the trip detail page under 'About this journey'. Aim for 2–4 sentences that paint the picture."
        >
          <RichEditor
            value={form.overview}
            onChange={(html) => updateField("overview", html)}
            placeholder="e.g. Five days through Kerala's most soulful landscapes — from spice-scented hills to palm-fringed backwaters..."
          />
        </FormField>
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
