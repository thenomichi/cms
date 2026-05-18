"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScoringRulesCard } from "./ScoringRulesCard";
import { QuestionCard } from "./QuestionCard";
import { AddQuestionModal } from "./AddQuestionModal";
import type { CatalogFormState, QuestionFormState } from "./types";
import { buildCatalogFormState } from "./types";
import type { FullCatalogVersion } from "@/lib/db/screening";
import { saveDraftAction, publishCatalogAction, deleteQuestionAction } from "../actions";

interface ScreeningCatalogEditorProps {
  draft: FullCatalogVersion;
  enabledTripCount: number;
}

export function ScreeningCatalogEditor({
  draft,
  enabledTripCount,
}: ScreeningCatalogEditorProps) {
  const [form, setForm] = useState<CatalogFormState>(() => buildCatalogFormState(draft));
  const [draftVersionId, setDraftVersionId] = useState(draft.version.catalog_version_id);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(form));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = JSON.stringify(form) !== savedSnapshot;

  // Debounced autosave (800 ms). The lint rule wants setState out of effects,
  // but autosave is exactly the "sync external state" exception the docs
  // sanction — we mark the network call as in-flight while it's running.
  useEffect(() => {
    if (!isDirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSave(form);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  async function doSave(snapshot: CatalogFormState) {
    const res = await saveDraftAction(draftVersionId, snapshot);
    if (res.ok) {
      setSavedSnapshot(JSON.stringify(snapshot));
      setStatus("saved");
    } else {
      setStatus("error");
      toast.error(res.error);
    }
  }

  const handleSaveDraft = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus("saving");
    await doSave(form);
  };

  const handlePublish = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isDirty) await doSave(form);
    if (form.questions.length === 0) {
      toast.error("Add at least one question before publishing.");
      return;
    }
    startTransition(async () => {
      const res = await publishCatalogAction(draftVersionId);
      if (res.ok) {
        toast.success("Published to website");
        setDraftVersionId(res.newDraftId);
        setSavedSnapshot(JSON.stringify(form));
        setStatus("saved");
      } else {
        toast.error(res.error);
      }
      setConfirmPublish(false);
    });
  };

  const updateQuestion = (i: number, next: QuestionFormState) => {
    const questions = [...form.questions];
    questions[i] = next;
    setForm({ ...form, questions });
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.questions.length) return;
    const questions = [...form.questions];
    [questions[i], questions[j]] = [questions[j], questions[i]];
    setForm({ ...form, questions });
  };

  const handleDelete = async (i: number) => {
    const q = form.questions[i];
    if (q.question_id) {
      const res = await deleteQuestionAction(q.question_id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    }
    const questions = form.questions.filter((_, j) => j !== i);
    const next = { ...form, questions };
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
  };

  const handleAddQuestion = (q: QuestionFormState) => {
    setForm({ ...form, questions: [...form.questions, q] });
  };

  const optionsCount = form.questions.reduce((acc, q) => acc + q.options.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <StatusPill status={status} isDirty={isDirty} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleSaveDraft} disabled={!isDirty}>
            Save draft
          </Button>
          <Button onClick={() => setConfirmPublish(true)} disabled={isPending}>
            Publish to website
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have unsaved changes — customers still see the currently-published questions until you publish.
        </div>
      )}

      <ScoringRulesCard
        flagIfRedAtLeast={form.flag_if_red_at_least}
        flagIfYellowAtLeast={form.flag_if_yellow_at_least}
        onChange={({ flagIfRedAtLeast, flagIfYellowAtLeast }) =>
          setForm({
            ...form,
            flag_if_red_at_least: flagIfRedAtLeast,
            flag_if_yellow_at_least: flagIfYellowAtLeast,
          })
        }
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Questions</h3>
        {form.questions.map((q, i) => (
          <QuestionCard
            key={q.question_id ?? `new-${i}`}
            question={q}
            index={i}
            totalCount={form.questions.length}
            onChange={(next) => updateQuestion(i, next)}
            onDelete={() => void handleDelete(i)}
            onMoveUp={() => moveQuestion(i, -1)}
            onMoveDown={() => moveQuestion(i, 1)}
          />
        ))}
        <Button variant="ghost" onClick={() => setAddOpen(true)}>
          + Add question
        </Button>
      </div>

      <AddQuestionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddQuestion}
      />

      <ConfirmDialog
        open={confirmPublish}
        title="Publish to website?"
        message={`You're about to publish ${form.questions.length} questions and ${optionsCount} answer choices. Affects ${enabledTripCount} Soulful Escapes trips with Fit Check turned on. Customers will see the new questions immediately.`}
        confirmLabel="Publish to website"
        cancelLabel="Cancel"
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />
    </div>
  );
}

function StatusPill({ status, isDirty }: { status: string; isDirty: boolean }) {
  if (isDirty && status === "saving") return <span className="text-xs text-mid">● Saving…</span>;
  if (!isDirty && status === "saved") return <span className="text-xs text-sem-green">● Saved</span>;
  if (status === "error") return <span className="text-xs text-sem-red">● Save failed</span>;
  if (isDirty) return <span className="text-xs text-amber-700">● Unsaved changes</span>;
  return <span className="text-xs text-mid">● Up to date</span>;
}
