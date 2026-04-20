"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toggle } from "@/components/ui/Toggle";
import { ReviewFormModal } from "./ReviewFormModal";
import type { DbReview } from "@/lib/types";
import {
  createReview,
  updateReview,
  deleteReview,
  toggleReviewField,
} from "../actions";

interface ReviewsClientProps {
  reviews: DbReview[];
}

export function ReviewsClient({ reviews: initialReviews }: ReviewsClientProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  useEffect(() => { setReviews(initialReviews); }, [initialReviews]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DbReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbReview | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search) return reviews;
    const q = search.toLowerCase();
    return reviews.filter(
      (r) =>
        r.reviewer_name.toLowerCase().includes(q) ||
        r.review_text.toLowerCase().includes(q) ||
        (r.trip_location ?? "").toLowerCase().includes(q),
    );
  }, [reviews, search]);

  const handleCreate = async (data: Record<string, unknown>) => {
    const result = await createReview(data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("Review created");
    router.refresh();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editing) return;
    const result = await updateReview(editing.review_id, data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("Review updated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    // Optimistic: remove from local state immediately
    setReviews((prev) => prev.filter((r) => r.review_id !== deleted.review_id));
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteReview(deleted.review_id);
      if (res.success) {
        toast.success("Review deleted");
      } else {
        // Revert on failure
        setReviews((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Delete failed");
      }
    });
  };

  const handleToggle = (
    review: DbReview,
    field: "is_approved" | "is_featured" | "show_on_homepage",
  ) => {
    const newValue = !review[field];
    // Optimistic: update local state immediately
    setReviews((prev) =>
      prev.map((r) =>
        r.review_id === review.review_id ? { ...r, [field]: newValue } : r,
      ),
    );
    startTransition(async () => {
      const res = await toggleReviewField(review.review_id, field, newValue);
      if (res.success) {
        toast.success(
          `Review ${field.replace("is_", "").replace("_", " ")} toggled`,
        );
      } else {
        // Revert on failure
        setReviews((prev) =>
          prev.map((r) =>
            r.review_id === review.review_id
              ? { ...r, [field]: !newValue }
              : r,
          ),
        );
        toast.error(res.error ?? "Toggle failed");
      }
    });
  };

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search reviews..."
          className="w-72"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New Review
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No reviews yet"
          description="Add your first traveller review to showcase on the website."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Review
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.review_id} className="flex flex-col justify-between">
              <div>
                {/* Star rating */}
                <div className="mb-2 text-base text-rust">
                  {stars(r.rating)}
                </div>

                {/* Review text */}
                <p className="text-sm text-ink line-clamp-3">
                  {r.review_text}
                </p>

                {/* Author */}
                <div className="mt-3 space-y-0.5">
                  <p className="text-sm font-medium text-ink">
                    {r.reviewer_name}
                  </p>
                  {r.reviewer_location && (
                    <p className="text-xs text-mid">{r.reviewer_location}</p>
                  )}
                  {r.trip_location && (
                    <p className="text-xs text-fog">Trip: {r.trip_location}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant={r.is_approved ? "green" : "amber"}>
                    {r.is_approved ? "Approved" : "Pending"}
                  </Badge>
                  {r.is_featured && <Badge variant="purple">Featured</Badge>}
                  {r.show_on_homepage && (
                    <Badge variant="blue">Homepage</Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Toggle
                      checked={r.is_approved}
                      onChange={() => handleToggle(r, "is_approved")}
                      disabled={isPending}
                    />
                    <span className="text-xs text-mid">Approve</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-sem-red" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <ReviewFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
        review={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Review"
        message={`Delete the review by "${deleteTarget?.reviewer_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
