"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { TeamFormModal } from "./TeamFormModal";
import {
  updateTeamMemberAction,
  deleteTeamMemberAction,
} from "../actions";
import type { DbTeamMember } from "@/lib/types";

const ROLE_VARIANT: Record<string, "green" | "blue" | "purple" | "amber" | "rust" | "gray"> = {
  Admin: "purple",
  Sales: "green",
  Operations: "blue",
  Finance: "amber",
  Marketing: "rust",
};

interface Props {
  initialData: DbTeamMember[];
}

export function TeamClient({ initialData }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialData);
  useEffect(() => { setMembers(initialData); }, [initialData]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DbTeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbTeamMember | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      (m.email?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  async function handleToggleActive(member: DbTeamMember) {
    const newValue = !member.is_active;
    // Optimistic: update local state immediately
    setMembers((prev) =>
      prev.map((m) =>
        m.member_id === member.member_id ? { ...m, is_active: newValue } : m,
      ),
    );
    startTransition(async () => {
      const res = await updateTeamMemberAction(member.member_id, {
        is_active: newValue,
      });
      if (res.success) {
        toast.success(
          `${member.full_name} ${member.is_active ? "deactivated" : "activated"}`,
        );
      } else {
        // Revert on failure
        setMembers((prev) =>
          prev.map((m) =>
            m.member_id === member.member_id
              ? { ...m, is_active: !newValue }
              : m,
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
    setMembers((prev) =>
      prev.filter((m) => m.member_id !== deleted.member_id),
    );
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteTeamMemberAction(deleted.member_id);
      if (res.success) {
        toast.success(`${deleted.full_name} deleted`);
      } else {
        // Revert on failure
        setMembers((prev) => [...prev, deleted]);
        toast.error(res.error ?? "Failed to delete");
      }
    });
  }

  function handleEdit(member: DbTeamMember) {
    setEditing(member);
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
          placeholder="Search team members..."
          className="w-72"
        />
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No team members"
          description={
            search ? "No results match your search" : "Add your first team member to get started"
          }
          action={
            !search ? (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <div
              key={member.member_id}
              className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-fog"
            >
              {/* Header: Avatar + Name + Role */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rust-tint text-sm font-bold text-rust">
                  {member.photo_url ? (
                    <img
                      src={member.photo_url}
                      alt={member.full_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    member.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">
                    {member.full_name}
                  </p>
                  <Badge variant={ROLE_VARIANT[member.role] ?? "gray"} className="mt-1">
                    {member.role}
                  </Badge>
                </div>
              </div>

              {/* Contact */}
              {(member.email || member.phone) && (
                <div className="mt-3 space-y-1">
                  {member.email && (
                    <div className="flex items-center gap-1.5 text-xs text-mid">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-mid">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bio */}
              {member.bio && (
                <p className="mt-3 text-xs text-mid line-clamp-2">{member.bio}</p>
              )}

              {/* Footer: Toggle + Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={member.is_active}
                    onChange={() => handleToggleActive(member)}
                    disabled={isPending}
                  />
                  <span className="text-xs text-mid">
                    {member.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => handleEdit(member)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => setDeleteTarget(member)}
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
      <TeamFormModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        member={editing}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete team member"
        message={`Are you sure you want to delete "${deleteTarget?.full_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
