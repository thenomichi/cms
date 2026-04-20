"use client";

import { useState, useEffect } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import type { DbTripFaq } from "@/lib/types";

interface TripOption {
  trip_id: string;
  trip_name: string;
}

interface FaqFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  faq?: (DbTripFaq & { trip_name?: string | null }) | null;
  trips: TripOption[];
}

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-none";
const selectClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

export function FaqFormModal({
  open,
  onClose,
  onSubmit,
  faq,
  trips,
}: FaqFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tripId, setTripId] = useState("");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (faq) {
      setQuestion(faq.question);
      setAnswer(faq.answer);
      setTripId(faq.trip_id || "");
      setCategory(faq.category ?? "");
      setIsActive(faq.is_active);
    } else {
      setQuestion("");
      setAnswer("");
      setTripId("");
      setCategory("");
      setIsActive(true);
    }
  }, [faq, open]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        question,
        answer,
        trip_id: tripId || null,
        category: category || null,
        ...(faq ? {} : { display_order: 0 }),
        is_active: isActive,
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
      title={faq ? "Edit FAQ" : "New FAQ"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            {faq ? "Save Changes" : "Create FAQ"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Question & Answer ── */}
        <FormSection title="Question & Answer">
          <div className="space-y-4">
            <FormField label="Question" required>
              <input
                className={inputClass}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is the cancellation policy?"
              />
            </FormField>

            <FormField label="Answer" required>
              <textarea
                className={textareaClass}
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write the answer..."
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── Classification ── */}
        <FormSection title="Classification">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Trip" hint="Leave empty for a global FAQ">
              <select
                className={selectClass}
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
              >
                <option value="">Global (all trips)</option>
                {trips.map((t) => (
                  <option key={t.trip_id} value={t.trip_id}>
                    {t.trip_name} — {t.trip_id}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Category">
              <input
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="General, Booking, Travel..."
              />
            </FormField>
          </div>
        </FormSection>

        {/* ── Status ── */}
        <FormSection title="Status">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
            <div>
              <p className="text-sm font-medium text-ink">Active</p>
              <p className="text-xs text-mid">Show this FAQ on the website</p>
            </div>
            <Toggle checked={isActive} onChange={setIsActive} />
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
}
