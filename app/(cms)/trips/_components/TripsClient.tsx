"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { TripWithDestination, TripFull } from "@/lib/db/trips";
import type { DbDestination } from "@/lib/types";
import { formatPrice, formatDate } from "@/lib/utils";
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
} from "../actions";

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Community", label: "Community" },
  { value: "Beyond Ordinary", label: "Beyond Ordinary" },
  { value: "Signature Journey", label: "Signature" },
];

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function typeBadge(type: string | null) {
  const map: Record<string, "blue" | "purple" | "amber" | "green"> = {
    Community: "blue",
    "Beyond Ordinary": "purple",
    "Signature Journey": "amber",
    "Plan a Trip": "green",
  };
  return <Badge variant={map[type ?? ""] ?? "gray"}>{type ?? "—"}</Badge>;
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

  // Toggle handlers — optimistic update
  function handleToggle(
    trip: TripWithDestination,
    field: "is_listed" | "show_on_homepage",
    value: boolean,
  ) {
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
  const tableData = filtered as RowType[];

  const columns: Column<RowType>[] = [
    {
      key: "trip_name",
      header: "Trip",
      render: (row) => {
        const t = row as TripWithDestination;
        return (
          <div className="min-w-[200px]">
            <p className="font-medium text-ink">{t.trip_name ?? "Untitled"}</p>
            <p className="text-xs text-mid">{t.destination_name ?? "—"}</p>
            <p className="font-mono text-[10px] text-fog">{t.trip_id}</p>
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
    </div>
  );
}
