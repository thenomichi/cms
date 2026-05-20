"use client";

import { useState } from "react";
import { Trash2, ChevronUp, ChevronDown, MoreVertical } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { FilterPills } from "@/components/ui/FilterPills";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ScreeningTag } from "@/lib/schemas/screening";
import type { OptionFormState, QuestionFormState } from "./types";

const KIND_OPTIONS = [
  { value: "single", label: "○ Pick one" },
  { value: "multi", label: "☑ Pick many" },
  { value: "text", label: "✎ Long answer" },
];

const TAG_OPTIONS = [
  { value: "green", label: "🟢 Great fit" },
  { value: "yellow", label: "🟡 Some friction" },
  { value: "red", label: "🔴 Not a fit" },
  { value: "none", label: "⚪ No score" },
];

interface QuestionCardProps {
  question: QuestionFormState;
  index: number;
  totalCount: number;
  onChange: (next: QuestionFormState) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function QuestionCard({
  question,
  index,
  totalCount,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: QuestionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingKind, setPendingKind] = useState<string | null>(null);

  const updateOption = (i: number, next: OptionFormState) => {
    const options = [...question.options];
    options[i] = next;
    onChange({ ...question, options });
  };

  const addOption = () => {
    onChange({
      ...question,
      options: [
        ...question.options,
        { label: `Option ${question.options.length + 1}`, tag: null, is_deal_breaker: false },
      ],
    });
  };

  const deleteOption = (i: number) => {
    onChange({ ...question, options: question.options.filter((_, j) => j !== i) });
  };

  const applyKindChange = (newKind: string) => {
    onChange({
      ...question,
      kind: newKind as QuestionFormState["kind"],
      options: newKind === "text" ? [] : question.options,
    });
    setPendingKind(null);
  };

  const handleKindChange = (newKind: string) => {
    if (newKind === question.kind) return;
    if (question.options.length > 0 && (newKind === "text" || question.kind === "text")) {
      setPendingKind(newKind);
    } else {
      applyKindChange(newKind);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-mid">Q{index + 1}</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 hover:bg-surface3"
            aria-label="Question menu"
          >
            <MoreVertical className="h-4 w-4 text-mid" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-line bg-surface shadow-lg">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => { setMenuOpen(false); onMoveUp(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface3 disabled:opacity-40"
              >
                <ChevronUp className="h-4 w-4" /> Move up
              </button>
              <button
                type="button"
                disabled={index === totalCount - 1}
                onClick={() => { setMenuOpen(false); onMoveDown(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface3 disabled:opacity-40"
              >
                <ChevronDown className="h-4 w-4" /> Move down
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sem-red hover:bg-surface3"
              >
                <Trash2 className="h-4 w-4" /> Delete this question
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-ink3">
          What customers will see
        </label>
        <textarea
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="e.g. What kind of trip excites you?"
          maxLength={300}
          rows={2}
          className="w-full rounded-lg border border-line bg-surface3 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-mid">Answer style</p>
        <FilterPills
          options={KIND_OPTIONS}
          value={question.kind}
          onChange={handleKindChange}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <Toggle
            checked={question.is_scored}
            onChange={(v) => onChange({ ...question, is_scored: v })}
          />
          <span className="text-sm text-ink">Use this answer to flag customers</span>
        </label>
        <label className="flex items-center gap-2">
          <Toggle
            checked={question.is_required}
            onChange={(v) => onChange({ ...question, is_required: v })}
          />
          <span className="text-sm text-ink">Customers must answer this</span>
        </label>
      </div>

      {question.kind !== "text" && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-mid">Answer choices</p>
          <div className="space-y-2">
            {question.options.map((o, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface3 p-2"
              >
                <input
                  type="text"
                  value={o.label}
                  onChange={(e) => updateOption(i, { ...o, label: e.target.value })}
                  placeholder="Answer label"
                  className="min-w-[150px] flex-1 rounded border border-line bg-surface px-2 py-1 text-sm"
                />
                <FilterPills
                  options={TAG_OPTIONS}
                  value={o.tag ?? "none"}
                  onChange={(v) =>
                    updateOption(i, {
                      ...o,
                      tag: v === "none" ? null : (v as ScreeningTag),
                      is_deal_breaker: v === "red" ? o.is_deal_breaker : false,
                    })
                  }
                />
                {o.tag === "red" && (
                  <label
                    className="flex items-center gap-1"
                    title="If a customer picks this answer, they can't proceed to payment."
                  >
                    <Toggle
                      checked={o.is_deal_breaker}
                      onChange={(v) => updateOption(i, { ...o, is_deal_breaker: v })}
                    />
                    <span className="text-xs text-mid">Block payment</span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => deleteOption(i)}
                  className="rounded p-1 hover:bg-line"
                  aria-label="Delete option"
                >
                  <Trash2 className="h-4 w-4 text-mid" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={addOption} className="mt-2">
            + Add answer choice
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this question?"
        message="It will be removed from the Fit Check the next time you publish."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={pendingKind !== null}
        title="Change the answer style?"
        message="Changing the answer style removes the current answer choices."
        confirmLabel="Yes, change it"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => pendingKind && applyKindChange(pendingKind)}
        onCancel={() => setPendingKind(null)}
      />
    </div>
  );
}
