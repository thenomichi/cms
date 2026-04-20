"use client";

import { useState, useEffect } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import type { DbReview } from "@/lib/types";

interface ReviewFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  review?: DbReview | null;
}

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-none";
const selectClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

export function ReviewFormModal({
  open,
  onClose,
  onSubmit,
  review,
}: ReviewFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerLocation, setReviewerLocation] = useState("");
  const [tripLocation, setTripLocation] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [showOnHomepage, setShowOnHomepage] = useState(false);

  useEffect(() => {
    if (review) {
      setReviewerName(review.reviewer_name);
      setReviewerLocation(review.reviewer_location ?? "");
      setTripLocation(review.trip_location ?? "");
      setRating(review.rating);
      setReviewText(review.review_text);
      setIsApproved(review.is_approved);
      setIsFeatured(review.is_featured);
      setShowOnHomepage(review.show_on_homepage);
    } else {
      setReviewerName("");
      setReviewerLocation("");
      setTripLocation("");
      setRating(5);
      setReviewText("");
      setIsApproved(false);
      setIsFeatured(false);
      setShowOnHomepage(false);
    }
  }, [review, open]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        reviewer_name: reviewerName,
        reviewer_location: reviewerLocation || null,
        trip_location: tripLocation || null,
        rating,
        review_text: reviewText,
        is_approved: isApproved,
        is_featured: isFeatured,
        show_on_homepage: showOnHomepage,
        ...(review ? {} : { display_order: 0 }),
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
      title={review ? "Edit Review" : "New Review"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            {review ? "Save Changes" : "Create Review"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Reviewer ── */}
        <FormSection title="Reviewer">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Reviewer Name" required>
              <input
                className={inputClass}
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="John Doe"
              />
            </FormField>

            <FormField label="Reviewer Location">
              <input
                className={inputClass}
                value={reviewerLocation}
                onChange={(e) => setReviewerLocation(e.target.value)}
                placeholder="Mumbai, India"
              />
            </FormField>

            <FormField label="Trip Location">
              <input
                className={inputClass}
                value={tripLocation}
                onChange={(e) => setTripLocation(e.target.value)}
                placeholder="Bali, Indonesia"
              />
            </FormField>

            <FormField label="Rating" required>
              <select
                className={selectClass}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {"★".repeat(r)}{"☆".repeat(5 - r)} ({r})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        {/* ── Review ── */}
        <FormSection title="Review">
          <FormField label="Review Text" required>
            <textarea
              className={textareaClass}
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write the review text..."
            />
          </FormField>
        </FormSection>

        {/* ── Visibility ── */}
        <FormSection title="Visibility">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Approved</p>
                <p className="text-xs text-mid">Approve this review for display</p>
              </div>
              <Toggle checked={isApproved} onChange={setIsApproved} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Featured</p>
                <p className="text-xs text-mid">Highlight this review in featured sections</p>
              </div>
              <Toggle checked={isFeatured} onChange={setIsFeatured} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Show on Homepage</p>
                <p className="text-xs text-mid">Display this review on the homepage carousel</p>
              </div>
              <Toggle checked={showOnHomepage} onChange={setShowOnHomepage} />
            </div>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
}
