"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableList } from "@/components/ui/SortableList";
import { FaqFormModal } from "./FaqFormModal";
import type { FaqWithTrip } from "@/lib/db/trip-faqs";
import { createFaq, updateFaq, deleteFaq, toggleFaqActive, reorderFaqs } from "../actions";

interface TripOption {
  trip_id: string;
  trip_name: string;
}

interface FaqsClientProps {
  faqs: FaqWithTrip[];
  trips: TripOption[];
}

const selectClass =
  "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

export function FaqsClient({
  faqs: initialFaqs,
  trips,
}: FaqsClientProps) {
  const router = useRouter();
  const [faqs, setFaqs] = useState(initialFaqs);
  useEffect(() => { setFaqs(initialFaqs); }, [initialFaqs]);
  const [tripFilter, setTripFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FaqWithTrip | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FaqWithTrip | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!tripFilter) return faqs;
    if (tripFilter === "__global") return faqs.filter((f) => !f.trip_id);
    return faqs.filter((f) => f.trip_id === tripFilter);
  }, [faqs, tripFilter]);

  const handleCreate = async (data: Record<string, unknown>) => {
    const result = await createFaq(data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("FAQ created");
    router.refresh();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editing) return;
    const result = await updateFaq(editing.faq_id, data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("FAQ updated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    // Optimistic: remove from local state immediately
    setFaqs((prev) => prev.filter((f) => f.faq_id !== deleted.faq_id));
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteFaq(deleted.faq_id, deleted.trip_id || undefined);
      if (res.success) {
        toast.success("FAQ deleted");
      } else {
        // Revert on failure
        setFaqs((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Delete failed");
      }
    });
  };

  const handleReorder = (reordered: FaqWithTrip[]) => {
    // Optimistic: update local state immediately
    setFaqs(reordered);
    const orderedIds = reordered.map((f) => f.faq_id);
    startTransition(async () => {
      const res = await reorderFaqs(orderedIds);
      if (res.success) {
        toast.success("Order saved");
      } else {
        // Revert on failure
        setFaqs(initialFaqs);
        toast.error(res.error ?? "Reorder failed");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <select
          className={selectClass}
          value={tripFilter}
          onChange={(e) => setTripFilter(e.target.value)}
        >
          <option value="">All FAQs</option>
          <option value="__global">Global only</option>
          {trips.map((t) => (
            <option key={t.trip_id} value={t.trip_id}>
              {t.trip_name} — {t.trip_id}
            </option>
          ))}
        </select>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New FAQ
        </Button>
      </div>

      {/* Sortable FAQ list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="❓"
          title="No FAQs found"
          description="Create your first FAQ or adjust the filter above."
        />
      ) : (
        <SortableList
          items={filtered}
          getId={(faq) => faq.faq_id}
          onReorder={handleReorder}
          renderItem={(faq) => (
            <div className="space-y-2">
              {/* Row 1: Question + badges */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink line-clamp-2 flex-1">
                  {faq.question}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {faq.trip_name ? (
                    <Badge variant="blue">{faq.trip_name}</Badge>
                  ) : (
                    <Badge variant="gray">Global</Badge>
                  )}
                  {faq.category && (
                    <Badge variant="gray">{faq.category}</Badge>
                  )}
                </div>
              </div>

              {/* Row 2: Answer preview */}
              <p className="text-xs text-mid line-clamp-1">{faq.answer}</p>

              {/* Row 3: Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-line2">
                <div className="flex items-center gap-1.5">
                  <Toggle
                    checked={faq.is_active}
                    onChange={(val) => {
                      setFaqs((prev) =>
                        prev.map((f) =>
                          f.faq_id === faq.faq_id ? { ...f, is_active: val } : f,
                        ),
                      );
                      startTransition(async () => {
                        const res = await toggleFaqActive(
                          faq.faq_id,
                          val,
                          faq.trip_id || undefined,
                        );
                        if (res.success) {
                          toast.success(val ? "FAQ activated" : "FAQ deactivated");
                        } else {
                          setFaqs((prev) =>
                            prev.map((f) =>
                              f.faq_id === faq.faq_id
                                ? { ...f, is_active: !val }
                                : f,
                            ),
                          );
                        toast.error(res.error ?? "Toggle failed");
                      }
                    });
                  }}
                  disabled={isPending}
                />
                  <span className="text-[11px] text-mid">{faq.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(faq);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(faq);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-sem-red" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {/* Modals */}
      <FaqFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
        faq={editing}
        trips={trips}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete FAQ"
        message={`Delete "${deleteTarget?.question}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
