"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { SortableList } from "@/components/ui/SortableList";
import type { TripFormState } from "../types";
import type { FaqInput } from "@/lib/db/trip-faqs";

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const TEXTAREA =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-y";

interface FaqsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
}

type FaqWithId = FaqInput & { _id: string };

export function FaqsTab({ form, updateField }: FaqsTabProps) {
  const { faqs } = form;
  const containerRef = useRef<HTMLDivElement>(null);
  // Index of the FAQ that was just added — drives the scroll-and-focus
  // effect. Tracks via state so the effect re-fires for repeated adds.
  const [pendingFocusIdx, setPendingFocusIdx] = useState<number | null>(null);

  const faqsWithIds: FaqWithId[] = faqs.map((f, idx) => ({ ...f, _id: `faq-${idx}` }));

  function updateFaq(index: number, patch: Partial<FaqInput>) {
    const next = [...faqs];
    next[index] = { ...next[index], ...patch };
    updateField("faqs", next);
  }

  function addFaq() {
    const newIdx = faqs.length;
    updateField("faqs", [...faqs, { question: "", answer: "", category: null }]);
    setPendingFocusIdx(newIdx);
  }

  // After the new FAQ row mounts, scroll it into view and focus its
  // Question input so the user immediately sees and can type into it.
  useEffect(() => {
    if (pendingFocusIdx === null) return;
    if (!containerRef.current) return;
    const row = containerRef.current.querySelector<HTMLElement>(
      `[data-faq-index="${pendingFocusIdx}"]`,
    );
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = row.querySelector<HTMLInputElement>("input[type='text']");
    if (input) input.focus({ preventScroll: true });
    setPendingFocusIdx(null);
  }, [pendingFocusIdx, faqs.length]);

  function removeFaq(index: number) {
    updateField("faqs", faqs.filter((_, i) => i !== index));
  }

  const handleReorder = useCallback(
    (reordered: FaqWithId[]) => {
      updateField(
        "faqs",
        reordered.map(({ _id: _drop, ...rest }) => rest),
      );
    },
    [updateField],
  );

  return (
    <div className="space-y-4" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">FAQs</h3>
          <p className="mt-0.5 text-xs text-mid">
            Common questions and answers shown on the trip detail page. Drag to reorder.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={addFaq}>
          <Plus className="h-3.5 w-3.5" />
          Add FAQ
        </Button>
      </div>

      {faqsWithIds.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-surface3 px-4 py-8 text-center">
          <p className="text-sm text-mid">
            No FAQs yet. Click <strong>Add FAQ</strong> to start.
          </p>
        </div>
      )}

      {faqsWithIds.length > 0 && (
        <SortableList
          items={faqsWithIds}
          getId={(item) => item._id}
          onReorder={handleReorder}
          renderItem={(item) => {
            const idx = faqs.findIndex((_, i) => `faq-${i}` === item._id);
            return (
              <div
                className="flex flex-1 flex-col gap-3"
                data-faq-index={idx}
              >
                <FormField label="Question" required>
                  <input
                    type="text"
                    className={INPUT}
                    value={item.question}
                    onChange={(e) => updateFaq(idx, { question: e.target.value })}
                    placeholder="e.g. What's the cancellation policy?"
                  />
                </FormField>
                <FormField label="Answer" required>
                  <textarea
                    className={TEXTAREA}
                    rows={3}
                    value={item.answer}
                    onChange={(e) => updateFaq(idx, { answer: e.target.value })}
                    placeholder="Write the answer in plain text. Keep it short and clear."
                  />
                </FormField>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeFaq(idx)}
                    className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-mid transition-colors hover:bg-sem-red-bg hover:text-sem-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
