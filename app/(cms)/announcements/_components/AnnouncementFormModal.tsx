"use client";

import { useState, useEffect } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { RichTextInput, toHtml, fromHtml } from "@/components/ui/RichTextInput";
import { CtaLinkPicker } from "@/components/ui/CtaLinkPicker";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { Button } from "@/components/ui/Button";
import { fetchBannerImages, uploadBannerImage } from "../actions";
import { Toggle } from "@/components/ui/Toggle";
import type { DbAnnouncement } from "@/lib/types";

interface TripOption {
  trip_id: string;
  trip_name: string;
  slug?: string;
}

interface AnnouncementFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  announcement?: DbAnnouncement | null;
  trips: TripOption[];
}

const TAG_TYPES = [
  { value: "new", label: "New" },
  { value: "alert", label: "Alert" },
  { value: "offer", label: "Offer" },
  { value: "sold_out", label: "Sold Out" },
  { value: "event", label: "Event" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-none";
const selectClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

export function AnnouncementFormModal({
  open,
  onClose,
  onSubmit,
  announcement,
  trips,
}: AnnouncementFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [tagType, setTagType] = useState("new");
  const [headline, setHeadline] = useState("");
  const [subText, setSubText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaLink, setCtaLink] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [tripId, setTripId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (announcement) {
      setTagType(announcement.tag_type);
      setHeadline(fromHtml(announcement.headline));
      setSubText(announcement.sub_text ?? "");
      setCtaLabel(announcement.cta_label ?? "");
      setCtaLink(announcement.cta_link ?? "");
      setBackgroundImageUrl(announcement.background_image_url ?? "");
      setTripId(announcement.trip_id ?? "");
      setStartsAt(announcement.starts_at ?? "");
      setEndsAt(announcement.ends_at ?? "");
      setIsActive(announcement.is_active);
    } else {
      setTagType("new");
      setHeadline("");
      setSubText("");
      setCtaLabel("");
      setCtaLink("");
      setBackgroundImageUrl("");
      setTripId("");
      setStartsAt("");
      setEndsAt("");
      setIsActive(true);
    }
  }, [announcement, open]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        tag_type: tagType,
        headline: toHtml(headline),
        sub_text: subText || null,
        cta_label: ctaLabel || null,
        cta_link: ctaLink || null,
        background_image_url: backgroundImageUrl || null,
        trip_id: tripId || null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        is_active: isActive,
        ...(announcement ? {} : { display_order: 0 }),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={announcement ? "Edit Announcement" : "New Announcement"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            {announcement ? "Save Changes" : "Create Announcement"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Content ── */}
        <FormSection title="Content">
          <div className="space-y-4">
            <FormField label="Tag Type" required>
              <select
                className={selectClass}
                value={tagType}
                onChange={(e) => setTagType(e.target.value)}
              >
                {TAG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Headline" required>
              <RichTextInput
                value={headline}
                onChange={setHeadline}
                placeholder="e.g. Hampi Heritage Trail is *back* for booking"
              />
            </FormField>

            <FormField label="Sub Text">
              <textarea
                className={textareaClass}
                rows={2}
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                placeholder="Additional details..."
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── Call to Action ── */}
        <FormSection title="Call to Action" description="The button shown on the announcement banner">
          <CtaLinkPicker
            labelValue={ctaLabel}
            linkValue={ctaLink}
            onLabelChange={setCtaLabel}
            onLinkChange={setCtaLink}
            trips={trips.map((t) => ({ trip_id: t.trip_id, trip_name: t.trip_name, slug: t.slug }))}
          />
        </FormSection>

        {/* ── Scheduling ── */}
        <FormSection title="Scheduling" description="Leave both empty for an always-active announcement">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Starts At" hint={startsAt ? "Must be a future date" : undefined}>
              <input
                type="datetime-local"
                className={inputClass}
                min={new Date().toISOString().slice(0, 16)}
                value={startsAt}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setStartsAt(newStart);
                  // Auto-clear ends_at if it's before the new starts_at
                  if (newStart && endsAt && endsAt < newStart) {
                    setEndsAt("");
                  }
                }}
              />
            </FormField>

            <FormField label="Ends At" hint={startsAt ? "Must be after start date" : undefined}>
              <input
                type="datetime-local"
                className={inputClass}
                min={startsAt || new Date().toISOString().slice(0, 16)}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── Display ── */}
        <FormSection title="Display">
          <div className="space-y-4">
            <FormField label="Banner Image">
              <ImagePicker
                value={backgroundImageUrl}
                onChange={setBackgroundImageUrl}
                fetchImages={fetchBannerImages}
                uploadImage={uploadBannerImage}
                label="Banner Image"
                hint="Used as the announcement banner background"
                aspectHint="Recommended: 1200×400px (3:1 banner ratio)"
              />
            </FormField>

            <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Active</p>
                <p className="text-xs text-mid">Show this announcement on the website</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} />
            </div>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
}
