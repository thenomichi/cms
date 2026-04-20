"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toggle } from "@/components/ui/Toggle";
import { AnnouncementFormModal } from "./AnnouncementFormModal";
import type { AnnouncementWithTrip } from "@/lib/db/announcements";
import { formatDate } from "@/lib/utils";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementActive,
} from "../actions";

interface TripOption {
  trip_id: string;
  trip_name: string;
}

interface AnnouncementsClientProps {
  announcements: AnnouncementWithTrip[];
  trips: TripOption[];
}

const TAG_VARIANT: Record<string, "green" | "red" | "amber" | "blue" | "purple" | "gray" | "rust"> = {
  new: "green",
  alert: "red",
  offer: "amber",
  sold_out: "rust",
  event: "purple",
};

export function AnnouncementsClient({
  announcements: initialAnnouncements,
  trips,
}: AnnouncementsClientProps) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  useEffect(() => { setAnnouncements(initialAnnouncements); }, [initialAnnouncements]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementWithTrip | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementWithTrip | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search) return announcements;
    const q = search.toLowerCase();
    return announcements.filter(
      (a) =>
        a.headline.toLowerCase().includes(q) ||
        (a.sub_text ?? "").toLowerCase().includes(q) ||
        a.tag_type.toLowerCase().includes(q),
    );
  }, [announcements, search]);

  const handleCreate = async (data: Record<string, unknown>) => {
    const result = await createAnnouncement(data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("Announcement created");
    router.refresh();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editing) return;
    const result = await updateAnnouncement(editing.announcement_id, data);
    if (result.error) {
      toast.error("Validation failed");
      return;
    }
    toast.success("Announcement updated");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    // Optimistic: remove from local state immediately
    setAnnouncements((prev) =>
      prev.filter((a) => a.announcement_id !== deleted.announcement_id),
    );
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteAnnouncement(deleted.announcement_id);
      if (res.success) {
        toast.success("Announcement deleted");
      } else {
        // Revert on failure
        setAnnouncements((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Delete failed");
      }
    });
  };

  const handleToggleActive = (ann: AnnouncementWithTrip) => {
    const newValue = !ann.is_active;
    // Optimistic: update local state immediately
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.announcement_id === ann.announcement_id
          ? { ...a, is_active: newValue }
          : a,
      ),
    );
    startTransition(async () => {
      const res = await toggleAnnouncementActive(
        ann.announcement_id,
        newValue,
      );
      if (res.success) {
        toast.success(
          ann.is_active
            ? "Announcement deactivated"
            : "Announcement activated",
        );
      } else {
        // Revert on failure
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.announcement_id === ann.announcement_id
              ? { ...a, is_active: !newValue }
              : a,
          ),
        );
        toast.error(res.error ?? "Toggle failed");
      }
    });
  };

  const formatTagLabel = (tag: string) =>
    tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search announcements..."
          className="w-72"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📢"
          title="No announcements yet"
          description="Create banners, promos, and alerts for the website homepage."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Announcement
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Card
              key={a.announcement_id}
              className="flex flex-col justify-between"
            >
              <div>
                {/* Tag type badge */}
                <div className="mb-2">
                  <Badge variant={TAG_VARIANT[a.tag_type] ?? "gray"}>
                    {formatTagLabel(a.tag_type)}
                  </Badge>
                </div>

                {/* Headline */}
                <h4 className="text-sm font-semibold text-ink line-clamp-2">
                  {a.headline}
                </h4>

                {/* Sub text */}
                {a.sub_text && (
                  <p className="mt-1 text-xs text-mid line-clamp-2">
                    {a.sub_text}
                  </p>
                )}

                {/* CTA */}
                {a.cta_label && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-rust">
                    <ExternalLink className="h-3 w-3" />
                    <span>{a.cta_label}</span>
                    {a.cta_link && (
                      <span className="text-fog truncate max-w-[140px]">
                        {a.cta_link}
                      </span>
                    )}
                  </div>
                )}

                {/* Date range */}
                <div className="mt-2 text-xs text-mid">
                  {a.starts_at || a.ends_at ? (
                    <>
                      {formatDate(a.starts_at)} {"\u2192"}{" "}
                      {formatDate(a.ends_at)}
                    </>
                  ) : (
                    "Always active"
                  )}
                </div>

                {/* Trip association */}
                {a.trip_name && (
                  <div className="mt-2">
                    <Badge variant="blue">{a.trip_name}</Badge>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-1.5">
                  <Toggle
                    checked={a.is_active}
                    onChange={() => handleToggleActive(a)}
                    disabled={isPending}
                  />
                  <span className="text-xs text-mid">Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => {
                      setEditing(a);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => setDeleteTarget(a)}
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
      <AnnouncementFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
        announcement={editing}
        trips={trips}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message={`Delete "${deleteTarget?.headline}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
