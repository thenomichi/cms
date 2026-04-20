"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Building } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { CareerFormModal } from "./CareerFormModal";
import {
  updateCareerAction,
  deleteCareerAction,
} from "../actions";
import type { DbCareerListing } from "@/lib/types";

const TYPE_VARIANT: Record<string, "green" | "blue" | "purple" | "amber" | "gray"> = {
  "full-time": "green",
  "part-time": "blue",
  contract: "amber",
  internship: "purple",
};

interface Props {
  initialData: DbCareerListing[];
}

export function CareersClient({ initialData }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState(initialData);
  useEffect(() => { setListings(initialData); }, [initialData]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DbCareerListing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbCareerListing | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = listings.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.department.toLowerCase().includes(search.toLowerCase()) ||
      (l.location?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  async function handleToggleOpen(listing: DbCareerListing) {
    const newValue = !listing.is_open;
    // Optimistic: update local state immediately
    setListings((prev) =>
      prev.map((l) =>
        l.career_id === listing.career_id ? { ...l, is_open: newValue } : l,
      ),
    );
    startTransition(async () => {
      const res = await updateCareerAction(listing.career_id, {
        is_open: newValue,
      });
      if (res.success) {
        toast.success(`Listing ${listing.is_open ? "closed" : "opened"}`);
      } else {
        // Revert on failure
        setListings((prev) =>
          prev.map((l) =>
            l.career_id === listing.career_id
              ? { ...l, is_open: !newValue }
              : l,
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
    setListings((prev) =>
      prev.filter((l) => l.career_id !== deleted.career_id),
    );
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteCareerAction(deleted.career_id);
      if (res.success) {
        toast.success(`"${deleted.title}" deleted`);
      } else {
        // Revert on failure
        setListings((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Failed to delete");
      }
    });
  }

  function handleEdit(listing: DbCareerListing) {
    setEditing(listing);
    setModalOpen(true);
  }

  function handleCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSaved() {
    handleModalClose();
    router.refresh();
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search careers..."
          className="w-72"
        />
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Add Listing
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="💼"
          title="No career listings"
          description={
            search ? "No results match your search" : "Add your first career listing"
          }
          action={
            !search ? (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Add Listing
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <div
              key={listing.career_id}
              className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-fog"
            >
              {/* Title + Type Badge */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink line-clamp-1">
                  {listing.title}
                </h3>
                {listing.employment_type && (
                  <Badge variant={TYPE_VARIANT[listing.employment_type] ?? "gray"}>
                    {listing.employment_type}
                  </Badge>
                )}
              </div>

              {/* Department + Location */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-mid">
                  <Building className="h-3 w-3 shrink-0" />
                  <span>{listing.department}</span>
                </div>
                {listing.location && (
                  <div className="flex items-center gap-1.5 text-xs text-mid">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{listing.location}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {listing.description && (
                <p className="mt-3 text-xs text-mid line-clamp-2">
                  {listing.description}
                </p>
              )}

              {/* Footer: Toggle + Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={listing.is_open ?? false}
                    onChange={() => handleToggleOpen(listing)}
                    disabled={isPending}
                  />
                  <span className="text-xs text-mid">
                    {listing.is_open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => handleEdit(listing)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => setDeleteTarget(listing)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-sem-red" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <CareerFormModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        listing={editing}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete career listing"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
