"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Trash2,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FilterPills } from "@/components/ui/FilterPills";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  updateSuggestionStatusAction,
  deleteSuggestionAction,
} from "../actions";
import type { DbCustomizedTripRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const PIPELINE_STAGES = [
  { value: "", label: "All" },
  { value: "New Request", label: "New Request" },
  { value: "In Discussion", label: "In Discussion" },
  { value: "Proposal Sent", label: "Proposal Sent" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Lost", label: "Lost" },
];

const STAGE_ORDER = [
  "New Request",
  "In Discussion",
  "Proposal Sent",
  "Confirmed",
  "Lost",
];

const STATUS_VARIANT: Record<string, "green" | "blue" | "purple" | "amber" | "red" | "gray"> = {
  "New Request": "blue",
  "In Discussion": "amber",
  "Proposal Sent": "purple",
  Confirmed: "green",
  Lost: "red",
};

function getNextStage(current: string): string | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

interface Props {
  initialData: DbCustomizedTripRequest[];
}

export function SuggestionsClient({ initialData }: Props) {
  const [suggestions, setSuggestions] = useState(initialData);
  useEffect(() => { setSuggestions(initialData); }, [initialData]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DbCustomizedTripRequest | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = suggestions.filter((s) => {
    if (filter && s.pipeline_status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.destination_interested.toLowerCase().includes(q) ||
        s.request_id.toLowerCase().includes(q) ||
        (s.type_of_experience?.toLowerCase().includes(q) ?? false) ||
        (s.source?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  async function handleStatusChange(id: string, newStatus: string) {
    const oldSuggestion = suggestions.find((s) => s.request_id === id);
    if (!oldSuggestion) return;
    const oldStatus = oldSuggestion.pipeline_status;
    // Optimistic: update local state immediately
    setSuggestions((prev) =>
      prev.map((s) =>
        s.request_id === id ? { ...s, pipeline_status: newStatus } : s,
      ),
    );
    startTransition(async () => {
      const res = await updateSuggestionStatusAction(id, newStatus);
      if (res.success) {
        toast.success(`Status updated to "${newStatus}"`);
      } else {
        // Revert on failure
        setSuggestions((prev) =>
          prev.map((s) =>
            s.request_id === id
              ? { ...s, pipeline_status: oldStatus }
              : s,
          ),
        );
        toast.error(res.error ?? "Failed to update");
      }
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    // Optimistic: remove from local state immediately
    setSuggestions((prev) =>
      prev.filter((s) => s.request_id !== deleted.request_id),
    );
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteSuggestionAction(deleted.request_id);
      if (res.success) {
        toast.success("Suggestion deleted");
      } else {
        // Revert on failure
        setSuggestions((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Failed to delete");
      }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by destination, type, source..."
            className="w-80"
          />
          <Badge variant="gray">{filtered.length} requests</Badge>
        </div>
        <FilterPills options={PIPELINE_STAGES} value={filter} onChange={setFilter} />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No suggestions"
          description={
            filter || search
              ? "No results match your filters"
              : "No trip requests have come in yet"
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const nextStage = getNextStage(s.pipeline_status);
            return (
              <div
                key={s.request_id}
                className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-fog"
              >
                {/* Header: Destination + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-rust shrink-0" />
                    <h3 className="text-sm font-semibold text-ink line-clamp-1">
                      {s.destination_interested}
                    </h3>
                  </div>
                  <Badge variant={STATUS_VARIANT[s.pipeline_status] ?? "gray"}>
                    {s.pipeline_status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="mt-3 space-y-1.5">
                  {s.travel_month && (
                    <div className="flex items-center gap-1.5 text-xs text-mid">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{s.travel_month}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-mid">
                    <Users className="h-3 w-3 shrink-0" />
                    <span>{s.number_of_pax} pax</span>
                  </div>
                  {s.budget_per_person && (
                    <div className="flex items-center gap-1.5 text-xs text-mid">
                      <DollarSign className="h-3 w-3 shrink-0" />
                      <span>{s.budget_per_person}/person</span>
                    </div>
                  )}
                </div>

                {/* Experience type + Requirements */}
                {(s.type_of_experience || s.special_requirements) && (
                  <div className="mt-3 space-y-1">
                    {s.type_of_experience && (
                      <p className="text-xs text-mid">
                        <span className="font-medium text-ink">Experience:</span>{" "}
                        {s.type_of_experience}
                      </p>
                    )}
                    {s.special_requirements && (
                      <p className="text-xs text-mid line-clamp-2">
                        <span className="font-medium text-ink">Requirements:</span>{" "}
                        {s.special_requirements}
                      </p>
                    )}
                  </div>
                )}

                {/* Source + Date */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-fog">
                  <span>via {s.source}</span>
                  <span>{formatDate(s.created_at)}</span>
                </div>

                {/* Footer: Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <div className="flex items-center gap-1.5">
                    {nextStage && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusChange(s.request_id, nextStage)}
                      >
                        <ArrowRight className="h-3 w-3" />
                        {nextStage}
                      </Button>
                    )}
                    {s.pipeline_status !== "Lost" && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusChange(s.request_id, "Lost")}
                      >
                        Lost
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-sem-red" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete suggestion"
        message={`Are you sure you want to delete this request for "${deleteTarget?.destination_interested}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
