"use client";

import { useState, useEffect } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import type { DbDestination } from "@/lib/types";

interface DestinationFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  destination?: DbDestination | null;
}

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-none";

export function DestinationFormModal({
  open,
  onClose,
  onSubmit,
  destination,
}: DestinationFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [isDomestic, setIsDomestic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (destination) {
      setName(destination.destination_name);
      setCountry(destination.country);
      setIsDomestic(destination.is_domestic);
      setIsActive(destination.is_active);
      setIcon(destination.icon ?? "");
      setDescription(destination.description ?? "");
    } else {
      setName("");
      setCountry("");
      setIsDomestic(true);
      setIsActive(true);
      setIcon("");
      setDescription("");
    }
  }, [destination, open]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        destination_name: name,
        // destination_code is auto-generated server-side
        country,
        is_domestic: isDomestic,
        is_active: isActive,
        icon: icon || null,
        description: description || null,
        ...(destination ? {} : { display_order: 0 }),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Preview code from name
  const previewCode = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={destination ? "Edit Destination" : "New Destination"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            {destination ? "Save Changes" : "Create Destination"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Location ── */}
        <FormSection title="Location">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Destination Name" required>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Manali"
                />
              </FormField>

              <FormField label="Country" required>
                <input
                  className={inputClass}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="India"
                />
              </FormField>
            </div>

            {/* Code preview -- read-only, auto-generated */}
            {previewCode && (
              <div className="rounded-lg bg-surface3 px-4 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-mid">Destination Code</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{previewCode}</p>
                <p className="text-[11px] text-fog">Auto-generated. A suffix is added if this code already exists.</p>
              </div>
            )}
          </div>
        </FormSection>

        {/* ── Display ── */}
        <FormSection title="Display">
          <div className="space-y-4">
            <FormField label="Icon" hint="Shown in the navigation mega menu">
              <EmojiPicker value={icon} onChange={setIcon} />
            </FormField>

            <FormField label="Description">
              <textarea
                className={textareaClass}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the destination..."
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── Status ── */}
        <FormSection title="Status">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Domestic</p>
                <p className="text-xs text-mid">Mark as a domestic (India) destination</p>
              </div>
              <Toggle checked={isDomestic} onChange={setIsDomestic} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Active</p>
                <p className="text-xs text-mid">Show this destination on the website</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} />
            </div>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
}
