"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { ListBuilder } from "@/components/ui/ListBuilder";
import { EMPLOYMENT_TYPES } from "@/lib/constants";
import { careerSchema } from "@/lib/schemas/trip";
import { createCareerAction, updateCareerAction } from "../actions";
import type { DbCareerListing } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  listing: DbCareerListing | null;
}

const EMPTY = {
  title: "",
  department: "",
  location: "Remote",
  employment_type: "full-time",
  description: "",
  responsibilities: [] as string[],
  requirements: [] as string[],
  is_open: true,
  display_order: 0,
};

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const selectClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-none";

export function CareerFormModal({ open, onClose, onSaved, listing }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (listing) {
        setForm({
          title: listing.title,
          department: listing.department,
          location: listing.location ?? "Remote",
          employment_type: listing.employment_type ?? "full-time",
          description: listing.description ?? "",
          responsibilities: listing.responsibilities ?? [],
          requirements: listing.requirements ?? [],
          is_open: listing.is_open ?? true,
          display_order: listing.display_order ?? 0,
        });
      } else {
        setForm(EMPTY);
      }
      setErrors({});
    }
  }, [open, listing]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit() {
    const parsed = careerSchema.safeParse({
      ...form,
      description: form.description || null,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const payload = {
      ...parsed.data,
      description: parsed.data.description ?? null,
      ...(listing ? {} : { display_order: 0 }),
    };

    const res = listing
      ? await updateCareerAction(listing.career_id, payload as never)
      : await createCareerAction(payload as never);

    setSaving(false);

    if (res.success) {
      toast.success(listing ? "Listing updated" : "Listing created");
      onSaved();
    } else {
      toast.error(res.error ?? "Something went wrong");
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={listing ? "Edit Career Listing" : "Add Career Listing"}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {listing ? "Save Changes" : "Create Listing"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Job Details ── */}
        <FormSection title="Job Details">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Job Title" required error={errors.title}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputClass}
                placeholder="e.g. Operations Manager"
              />
            </FormField>

            <FormField label="Department" required error={errors.department}>
              <input
                type="text"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                className={inputClass}
                placeholder="e.g. Operations"
              />
            </FormField>

            <FormField label="Location" error={errors.location}>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className={inputClass}
                placeholder="Remote / Mumbai"
              />
            </FormField>

            <FormField label="Employment Type" error={errors.employment_type}>
              <select
                value={form.employment_type}
                onChange={(e) => set("employment_type", e.target.value)}
                className={selectClass}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        {/* ── Description ── */}
        <FormSection title="Description">
          <FormField label="Description" error={errors.description}>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="Describe the role..."
            />
          </FormField>
        </FormSection>

        {/* ── Requirements ── */}
        <FormSection title="Requirements">
          <div className="space-y-4">
            <FormField label="Responsibilities">
              <ListBuilder
                items={form.responsibilities}
                onChange={(items) => set("responsibilities", items)}
                placeholder="Add a responsibility..."
              />
            </FormField>

            <FormField label="Requirements">
              <ListBuilder
                items={form.requirements}
                onChange={(items) => set("requirements", items)}
                placeholder="Add a requirement..."
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── Status ── */}
        <FormSection title="Status">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
            <div>
              <p className="text-sm font-medium text-ink">Open for Applications</p>
              <p className="text-xs text-mid">Accept new applications for this role</p>
            </div>
            <Toggle checked={form.is_open} onChange={(v) => set("is_open", v)} />
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
}
