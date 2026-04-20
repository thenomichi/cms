"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/SearchInput";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DestinationFormModal } from "./DestinationFormModal";
import type { DbDestination } from "@/lib/types";
import {
  createDestination,
  updateDestination,
  deleteDestination,
  toggleDestinationActive,
} from "../actions";

interface DestinationsClientProps {
  destinations: DbDestination[];
}

export function DestinationsClient({
  destinations: initialDestinations,
}: DestinationsClientProps) {
  const router = useRouter();
  const [destinations, setDestinations] = useState(initialDestinations);
  useEffect(() => { setDestinations(initialDestinations); }, [initialDestinations]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DbDestination | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbDestination | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search) return destinations;
    const q = search.toLowerCase();
    return destinations.filter(
      (d) =>
        d.destination_name.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.destination_code.toLowerCase().includes(q),
    );
  }, [destinations, search]);

  const handleCreate = async (data: Record<string, unknown>) => {
    const result = await createDestination(data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("Destination created");
    router.refresh();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editing) return;
    const result = await updateDestination(editing.destination_id, data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("Destination updated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    // Optimistic: remove from local state immediately
    setDestinations((prev) =>
      prev.filter((d) => d.destination_id !== deleted.destination_id),
    );
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteDestination(deleted.destination_id);
      if (res.success) {
        toast.success("Destination deleted");
      } else {
        // Revert on failure
        setDestinations((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Delete failed");
      }
    });
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "icon",
      header: "Icon",
      render: (row) => (
        <span className="text-lg">{(row.icon as string) || "🌍"}</span>
      ),
    },
    {
      key: "destination_name",
      header: "Name",
      render: (row) => (
        <div>
          <span className="text-sm font-medium text-ink">
            {row.destination_name as string}
          </span>
          <span className="ml-2 text-xs text-fog">
            {row.destination_code as string}
          </span>
        </div>
      ),
    },
    {
      key: "country",
      header: "Country",
      render: (row) => (
        <span className="text-sm text-ink">{row.country as string}</span>
      ),
    },
    {
      key: "is_domestic",
      header: "Type",
      render: (row) =>
        (row.is_domestic as boolean) ? (
          <Badge variant="green">Domestic</Badge>
        ) : (
          <Badge variant="purple">International</Badge>
        ),
    },
    {
      key: "is_active",
      header: "Active",
      render: (row) => (
        <Toggle
          checked={row.is_active as boolean}
          onChange={(val) => {
            const id = row.destination_id as string;
            // Optimistic update
            setDestinations((prev) =>
              prev.map((d) => d.destination_id === id ? { ...d, is_active: val } : d),
            );
            startTransition(async () => {
              const res = await toggleDestinationActive(id, val);
              if (res.success) {
                toast.success(val ? "Destination activated" : "Destination deactivated");
              } else {
                // Revert
                setDestinations((prev) =>
                  prev.map((d) => d.destination_id === id ? { ...d, is_active: !val } : d),
                );
                toast.error(res.error ?? "Toggle failed");
              }
            });
          }}
          disabled={isPending}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const dest = row as unknown as DbDestination;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon
              onClick={(e) => {
                e.stopPropagation();
                setEditing(dest);
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
                setDeleteTarget(dest);
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
      <div className="flex items-center justify-between gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search destinations..."
          className="w-72"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New Destination
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        emptyMessage="No destinations found"
        emptyIcon="🌍"
      />

      {/* Modals */}
      <DestinationFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
        destination={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Destination"
        message={`Delete "${deleteTarget?.destination_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
