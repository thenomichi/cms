"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import type { TripWithDestination, TripFull } from "@/lib/db/trips";
import type { DbDestination } from "@/lib/types";
import { cn, formatPrice, formatDate } from "@/lib/utils";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterPills } from "@/components/ui/FilterPills";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TripFormModal } from "./TripFormModal";
import {
  deleteTripAction,
  toggleTripFieldAction,
  cloneAsBatchAction,
} from "../actions";

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Community", label: "Soulful Escapes" },
  { value: "Beyond Ordinary", label: "Beyond Ordinary" },
  { value: "Signature Journey", label: "Signature" },
];

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

// User-facing label per trip_type DB value. "Community" was renamed to
// "Soulful Escapes" on the website; the DB value stays "Community" for FK
// compatibility. Update both maps together.
const TRIP_TYPE_LABEL: Record<string, string> = {
  Community: "Soulful Escapes",
  "Beyond Ordinary": "Beyond Ordinary",
  "Signature Journey": "Signature Journey",
  "Customized Trips Only": "Customized Trips Only",
};

function typeBadge(type: string | null) {
  const map: Record<string, "blue" | "purple" | "amber" | "green"> = {
    Community: "blue",
    "Beyond Ordinary": "purple",
    "Signature Journey": "amber",
    "Customized Trips Only": "green",
  };
  const label = type ? TRIP_TYPE_LABEL[type] ?? type : "—";
  return <Badge variant={map[type ?? ""] ?? "gray"}>{label}</Badge>;
}

function statusBadge(status: string | null) {
  const map: Record<string, "green" | "blue" | "amber" | "red" | "gray"> = {
    Draft: "gray",
    Upcoming: "blue",
    Ongoing: "green",
    Completed: "amber",
    Cancelled: "red",
  };
  return <Badge variant={map[status ?? ""] ?? "gray"}>{status ?? "—"}</Badge>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TripsClientProps {
  initialTrips: TripWithDestination[];
  destinations: DbDestination[];
}

export function TripsClient({ initialTrips, destinations }: TripsClientProps) {
  const router = useRouter();
  const [trips, setTrips] = useState(initialTrips);

  // Sync local state when server re-fetches data (after router.refresh())
  useEffect(() => {
    setTrips(initialTrips);
  }, [initialTrips]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<TripFull | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TripWithDestination | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [batchTarget, setBatchTarget] = useState<TripWithDestination | null>(null);
  const [isPending, startTransition] = useTransition();

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = trips;
    if (filter !== "all") {
      list = list.filter((t) => t.trip_type === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.trip_name ?? "").toLowerCase().includes(q) ||
          (t.trip_id ?? "").toLowerCase().includes(q) ||
          (t.slug ?? "").toLowerCase().includes(q) ||
          (t.destination_name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [trips, filter, search]);

  // Group batch siblings together in the list
  // Within a group, the original (slug === group_slug) comes first, then by start_date.
  // Trips with no start_date sort last so new drafts don't jump above the original.
  const sortedFiltered = useMemo(() => {
    const result = [...filtered];
    result.sort((a, b) => {
      const aGroup = a.group_slug ?? a.trip_id;
      const bGroup = b.group_slug ?? b.trip_id;
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
      // Original trip (slug === group_slug) always first
      const aIsOriginal = a.slug === a.group_slug ? 0 : 1;
      const bIsOriginal = b.slug === b.group_slug ? 0 : 1;
      if (aIsOriginal !== bIsOriginal) return aIsOriginal - bIsOriginal;
      // Then by start_date, nulls last
      const aDate = a.start_date ?? "\uffff";
      const bDate = b.start_date ?? "\uffff";
      return aDate.localeCompare(bDate);
    });
    return result;
  }, [filtered]);

  // Batch group visual tracking
  const { firstInGroupIds, groupedTripIds } = useMemo(() => {
    const first = new Set<string>();
    const grouped = new Set<string>();
    let prevSlug: string | null = null;
    for (const t of sortedFiltered) {
      if (t.group_slug) {
        grouped.add(t.trip_id);
        if (t.group_slug !== prevSlug) {
          first.add(t.trip_id);
        }
      }
      prevSlug = t.group_slug ?? null;
    }
    return { firstInGroupIds: first, groupedTripIds: grouped };
  }, [sortedFiltered]);

  // Toggle handlers — optimistic update
  function handleToggle(
    trip: TripWithDestination,
    field: "is_listed" | "show_on_homepage",
    value: boolean,
  ) {
    // Block listing a trip without dates set
    if (value && (field === "is_listed" || field === "show_on_homepage") && !trip.start_date) {
      toast.error("Set the trip dates before listing it on the website.");
      return;
    }

    // Optimistic: update local state immediately
    setTrips((prev) =>
      prev.map((t) => (t.trip_id === trip.trip_id ? { ...t, [field]: value } : t)),
    );
    startTransition(async () => {
      const res = await toggleTripFieldAction(
        trip.trip_id,
        field,
        value,
        trip.slug ?? "",
      );
      if (res.success) {
        toast.success(`${field === "is_listed" ? "Listed" : "Homepage"} toggled`);
      } else {
        // Revert on failure
        setTrips((prev) =>
          prev.map((t) => (t.trip_id === trip.trip_id ? { ...t, [field]: !value } : t)),
        );
        toast.error(res.error ?? "Toggle failed");
      }
    });
  }

  // Delete handler — optimistic update
  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    setTrips((prev) => prev.filter((t) => t.trip_id !== deleted.trip_id));
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteTripAction(deleted.trip_id, deleted.slug ?? "");
      if (res.success) {
        toast.success("Trip deleted");
      } else {
        // Revert on failure
        setTrips((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Delete failed");
      }
    });
  }

  // Clone as batch handler
  async function handleConfirmBatch() {
    if (!batchTarget) return;
    const trip = batchTarget;
    setBatchTarget(null);
    setCloning(trip.trip_id);
    try {
      const result = await cloneAsBatchAction(trip.trip_id);
      if (result.success && result.newTripId) {
        toast.success(
          "Batch created! Set dates and pricing for the new batch.",
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to create batch");
      }
    } finally {
      setCloning(null);
    }
  }

  // Open edit modal (fetch full trip data)
  async function handleEdit(trip: TripWithDestination) {
    try {
      const response = await fetch(`/api/trips/${trip.trip_id}`);
      if (!response.ok) {
        // Fall back to basic trip data if API not available
        setEditTrip({
          ...trip,
          content: [],
          itinerary: [],
          inclusions: [],
          faqs: [],
          gallery: [],
        } as TripFull);
        setModalOpen(true);
        return;
      }
      const data = await response.json();
      setEditTrip(data);
      setModalOpen(true);
    } catch {
      // Fall back to basic trip data
      setEditTrip({
        ...trip,
        content: [],
        itinerary: [],
        inclusions: [],
        faqs: [],
        gallery: [],
      } as TripFull);
      setModalOpen(true);
    }
  }

  // Table data needs Record<string, unknown> compat
  type RowType = TripWithDestination & Record<string, unknown>;
  const tableData = sortedFiltered as RowType[];

  const columns: Column<RowType>[] = [
    {
      key: "trip_name",
      header: "Trip",
      render: (row) => {
        const t = row as TripWithDestination;
        const isGrouped = groupedTripIds.has(t.trip_id);
        const isFirst = firstInGroupIds.has(t.trip_id);
        const isChild = isGrouped && !isFirst;
        return (
          <div className="min-w-[200px]">
            {isFirst && (
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-rust-tint px-2 py-0.5 font-medium text-rust">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Batch Group · {t.batch_count ?? 0} batches
                </span>
              </div>
            )}
            <div className={cn(isChild && "ml-3 border-l-2 border-rust/30 pl-3")}>
              <p className="font-medium text-ink">
                {t.trip_name ?? "Untitled"}
              </p>
              <p className="text-xs text-mid">{t.destination_name ?? "—"}</p>
              <p className="font-mono text-[10px] text-fog">{t.trip_id}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "start_date",
      header: "Dates",
      render: (row) => {
        const t = row as TripWithDestination;
        if (!t.start_date) return <span className="text-xs text-fog">Not set</span>;
        return (
          <div className="whitespace-nowrap">
            <p className="text-xs text-ink">{formatDate(t.start_date)}</p>
            {t.end_date && (
              <p className="text-[11px] text-mid">→ {formatDate(t.end_date)}</p>
            )}
            <p className="text-[10px] text-fog">{t.duration_days}D / {t.duration_nights}N</p>
          </div>
        );
      },
    },
    {
      key: "trip_type",
      header: "Type",
      render: (row) => typeBadge((row as TripWithDestination).trip_type),
    },
    {
      key: "selling_price",
      header: "Traveller Pays",
      render: (row) => {
        const t = row as TripWithDestination;
        const displayPrice = t.selling_price ?? t.quoted_price ?? t.mrp_price;
        const hasDiscount = t.mrp_price && t.selling_price && t.mrp_price > t.selling_price;
        return (
          <div>
            <span className="text-sm font-medium text-ink">{formatPrice(displayPrice)}</span>
            {hasDiscount && (
              <p className="text-[10px] text-fog line-through">{formatPrice(t.mrp_price)}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "total_slots",
      header: "Slots",
      render: (row) => {
        const t = row as TripWithDestination;
        return (
          <span className="text-sm">
            {t.booked_slots ?? 0}/{t.total_slots ?? 0}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => statusBadge((row as TripWithDestination).status),
    },
    {
      key: "is_listed",
      header: "Listed",
      render: (row) => {
        const t = row as TripWithDestination;
        return (
          <Toggle
            checked={t.is_listed ?? false}
            onChange={(v) => handleToggle(t, "is_listed", v)}
            disabled={isPending}
          />
        );
      },
    },
    {
      key: "show_on_homepage",
      header: "Homepage",
      render: (row) => {
        const t = row as TripWithDestination;
        return (
          <Toggle
            checked={t.show_on_homepage ?? false}
            onChange={(v) => handleToggle(t, "show_on_homepage", v)}
            disabled={isPending}
          />
        );
      },
    },
    {
      key: "_actions",
      header: "",
      render: (row) => {
        const t = row as TripWithDestination;
        return (
          <div className="flex items-center gap-1">
            {/* Only show "Add Another Batch" on primary/standalone trips — not on batch copies */}
            {(!t.group_slug || firstInGroupIds.has(t.trip_id)) && (
              <div className="group relative">
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  disabled={cloning === t.trip_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBatchTarget(t);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Add another batch
                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(t);
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
                setDeleteTarget(t);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-sem-red" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search trips..."
            className="w-64"
          />
          <FilterPills
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <Button onClick={() => { setEditTrip(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" />
          New Trip
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={tableData}
        rowClassName={(row) => {
          const t = row as TripWithDestination;
          return groupedTripIds.has(t.trip_id) ? "bg-rust-tint/40" : undefined;
        }}
        emptyMessage="No trips found"
        emptyIcon="✈️"
      />

      {/* Trip Form Modal */}
      <TripFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTrip(null); router.refresh(); }}
        trip={editTrip}
        destinations={destinations}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Trip"
        message={`Are you sure you want to delete "${deleteTarget?.trip_name ?? ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Add Another Batch Confirmation */}
      <ConfirmDialog
        open={!!batchTarget}
        onCancel={() => setBatchTarget(null)}
        onConfirm={handleConfirmBatch}
        title="Add Another Batch"
        confirmLabel="Yes, Create Batch"
        cancelLabel="Not Now"
      >
        <div className="mt-3 space-y-3 text-sm text-mid">
          <p>
            You're about to create a new batch of{" "}
            <strong className="text-ink">{batchTarget?.trip_name ?? ""}</strong>.
          </p>

          <div className="rounded-lg border border-line bg-surface2/50 p-3 space-y-2">
            <p className="font-medium text-ink text-xs uppercase tracking-wide">What this does</p>
            <ul className="space-y-1.5 text-[13px]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-sem-green">✓</span>
                Creates a new linked trip with the same itinerary, photos, inclusions, and FAQs
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-sem-green">✓</span>
                You'll set different <strong className="text-ink">dates, pricing, and available slots</strong> for the new batch
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-sem-green">✓</span>
                On the website, all batches appear as one trip with multiple date options
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-surface2/50 p-3 space-y-2">
            <p className="font-medium text-ink text-xs uppercase tracking-wide">Why create batches</p>
            <p className="text-[13px]">
              When the same trip runs on different weekends, batches keep the website clean —
              travellers see one listing and pick their preferred date, instead of seeing
              duplicate trip cards.
            </p>
          </div>

          <p className="text-xs text-fog">
            The new batch will be saved as a Draft. You can edit it and publish when ready.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
