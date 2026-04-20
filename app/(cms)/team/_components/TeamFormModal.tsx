"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { TEAM_ROLES } from "@/lib/constants";
import { teamMemberSchema } from "@/lib/schemas/trip";
import { createTeamMemberAction, updateTeamMemberAction } from "../actions";
import type { DbTeamMember } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  member: DbTeamMember | null;
}

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  role: "Operations",
  bio: "",
  photo_url: "",
  instagram: "",
  display_order: 0,
  is_active: true,
};

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const selectClass =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-none";

export function TeamFormModal({ open, onClose, onSaved, member }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (member) {
        setForm({
          full_name: member.full_name,
          email: member.email ?? "",
          phone: member.phone ?? "",
          role: member.role,
          bio: member.bio ?? "",
          photo_url: member.photo_url ?? "",
          instagram: member.instagram ?? "",
          display_order: member.display_order ?? 0,
          is_active: member.is_active,
        });
      } else {
        setForm(EMPTY);
      }
      setErrors({});
    }
  }, [open, member]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit() {
    const parsed = teamMemberSchema.safeParse({
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      bio: form.bio || null,
      photo_url: form.photo_url || null,
      instagram: form.instagram || null,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const payload = {
      ...parsed.data,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      bio: parsed.data.bio ?? null,
      photo_url: parsed.data.photo_url ?? null,
      instagram: parsed.data.instagram ?? null,
      ...(member ? {} : { display_order: 0 }),
    };

    const res = member
      ? await updateTeamMemberAction(member.member_id, payload as never)
      : await createTeamMemberAction(payload as never);

    setSaving(false);

    if (res.success) {
      toast.success(member ? "Member updated" : "Member created");
      onSaved();
    } else {
      toast.error(res.error ?? "Something went wrong");
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={member ? "Edit Team Member" : "Add Team Member"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {member ? "Save Changes" : "Create Member"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Personal Info ── */}
        <FormSection title="Personal Info">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Full Name" required error={errors.full_name}>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                className={inputClass}
                placeholder="e.g. Ravi Kumar"
              />
            </FormField>

            <FormField label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass}
                placeholder="ravi@thenomichi.com"
              />
            </FormField>

            <FormField label="Phone" error={errors.phone}>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputClass}
                placeholder="+91 98765 43210"
              />
            </FormField>

            <FormField label="Role" required error={errors.role}>
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                className={selectClass}
              >
                {TEAM_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        {/* ── Profile ── */}
        <FormSection title="Profile">
          <div className="space-y-4">
            <FormField label="Bio" error={errors.bio}>
              <textarea
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                rows={3}
                className={textareaClass}
                placeholder="A short bio..."
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Photo URL" error={errors.photo_url}>
                <input
                  type="text"
                  value={form.photo_url}
                  onChange={(e) => set("photo_url", e.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
              </FormField>

              <FormField label="Instagram" error={errors.instagram}>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  className={inputClass}
                  placeholder="@handle"
                />
              </FormField>
            </div>
          </div>
        </FormSection>

        {/* ── Status ── */}
        <FormSection title="Status">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 p-4">
            <div>
              <p className="text-sm font-medium text-ink">Active</p>
              <p className="text-xs text-mid">Show this team member on the website</p>
            </div>
            <Toggle checked={form.is_active} onChange={(v) => set("is_active", v)} />
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
}
