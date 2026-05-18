"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { FilterPills } from "@/components/ui/FilterPills";
import { Toggle } from "@/components/ui/Toggle";
import type { QuestionFormState } from "./types";
import type { ScreeningKind } from "@/lib/schemas/screening";

const KIND_OPTIONS = [
  { value: "single", label: "○ Pick one" },
  { value: "multi", label: "☑ Pick many" },
  { value: "textarea", label: "✎ Long answer" },
];

interface AddQuestionModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (q: QuestionFormState) => void;
}

export function AddQuestionModal({ open, onClose, onAdd }: AddQuestionModalProps) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<ScreeningKind>("single");
  const [isScored, setIsScored] = useState(true);
  const [isRequired, setIsRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Please enter the question.");
      return;
    }
    const options =
      kind === "textarea"
        ? []
        : [
            { label: "Option 1", tag: null, is_deal_breaker: false },
            { label: "Option 2", tag: null, is_deal_breaker: false },
          ];
    onAdd({
      prompt: trimmed,
      kind,
      is_scored: isScored,
      is_required: isRequired,
      options,
    });
    setPrompt("");
    setKind("single");
    setIsScored(true);
    setIsRequired(true);
    setError(null);
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add a question"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd}>Add question</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-mid">What customers will see</label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setError(null); }}
            placeholder="e.g. What kind of trip excites you?"
            maxLength={300}
            rows={3}
            className="w-full rounded-lg border border-line bg-surface3 px-3 py-2 text-sm"
          />
          {error && <p className="mt-1 text-xs text-sem-red">{error}</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-mid">Answer style</p>
          <FilterPills options={KIND_OPTIONS} value={kind} onChange={(v) => setKind(v as ScreeningKind)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <Toggle checked={isScored} onChange={setIsScored} />
            <span className="text-sm text-ink">Use this answer to flag customers</span>
          </label>
          <label className="flex items-center gap-2">
            <Toggle checked={isRequired} onChange={setIsRequired} />
            <span className="text-sm text-ink">Customers must answer this</span>
          </label>
        </div>
      </div>
    </FormModal>
  );
}
