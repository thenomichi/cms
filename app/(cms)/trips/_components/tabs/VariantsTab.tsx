"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NumericInput } from "@/components/ui/NumericInput";
import { Toggle } from "@/components/ui/Toggle";
import { AddVariantAxisModal, type AddAxisResult } from "./AddVariantAxisModal";
import {
  upsertVariantAxisAction,
  deleteVariantAxisAction,
  upsertVariantOptionAction,
  deleteVariantOptionAction,
  refreshVariantAxesAction,
} from "../../actions";
import type { FullVariantAxis } from "@/lib/db/trip-variants";

interface VariantsTabProps {
  groupSlug: string | null;
  tripSlug: string;
  initialAxes: FullVariantAxis[];
  onGotoBasic: () => void;
}

export function VariantsTab({
  groupSlug,
  tripSlug,
  initialAxes,
  onGotoBasic,
}: VariantsTabProps) {
  const [axes, setAxes] = useState<FullVariantAxis[]>(initialAxes);
  const [addOpen, setAddOpen] = useState(false);
  const [deletingAxisId, setDeletingAxisId] = useState<string | null>(null);
  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);

  if (!groupSlug) {
    return (
      <EmptyState
        icon="⚠"
        title="No trip group set"
        description="Price options are shared across all batches of a trip group. Set a Trip Group on the Basic tab to add price choices."
        action={<Button onClick={onGotoBasic}>Set trip group →</Button>}
      />
    );
  }

  const refresh = async () => {
    const updated = await refreshVariantAxesAction(groupSlug);
    setAxes(updated);
  };

  const handleAdd = async (preset: AddAxisResult) => {
    const axisInput =
      "custom" in preset
        ? { axis_label: preset.axis_label, axis_description: null, is_required: true }
        : {
            axis_label: preset.axis_label,
            axis_description: preset.axis_description,
            is_required: true,
          };
    const res = await upsertVariantAxisAction(groupSlug, tripSlug, axisInput);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (!("custom" in preset)) {
      for (const opt of preset.starter_options) {
        await upsertVariantOptionAction(res.axisId, tripSlug, {
          option_label: opt.label,
          option_sublabel: null,
          price_per_pax: opt.price,
          is_active: true,
        });
      }
    }
    await refresh();
    toast.success("Price choice added");
  };

  const handleUpdateOption = async (
    axisId: string,
    optionId: string | undefined,
    patch: Partial<{ option_label: string; price_per_pax: number; is_active: boolean }>,
  ) => {
    const axis = axes.find((a) => a.variant_axis_id === axisId);
    const opt = axis?.options.find((o) => o.variant_option_id === optionId);
    if (!opt) return;
    const res = await upsertVariantOptionAction(axisId, tripSlug, {
      variant_option_id: opt.variant_option_id,
      option_label: patch.option_label ?? opt.option_label,
      option_sublabel: opt.option_sublabel,
      price_per_pax: patch.price_per_pax ?? opt.price_per_pax,
      is_active: patch.is_active ?? opt.is_active,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleAddOption = async (axisId: string) => {
    const res = await upsertVariantOptionAction(axisId, tripSlug, {
      option_label: "New option",
      option_sublabel: null,
      price_per_pax: 0,
      is_active: true,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleDeleteAxis = async () => {
    if (!deletingAxisId) return;
    const res = await deleteVariantAxisAction(deletingAxisId, tripSlug);
    if (!res.ok) toast.error(res.error);
    setDeletingAxisId(null);
    await refresh();
  };

  const handleDeleteOption = async () => {
    if (!deletingOptionId) return;
    const res = await deleteVariantOptionAction(deletingOptionId, tripSlug);
    if (!res.ok) toast.error(res.error);
    setDeletingOptionId(null);
    await refresh();
  };

  if (axes.length === 0) {
    return (
      <>
        <EmptyState
          icon="🎟"
          title="This trip has one fixed price per person"
          description="Add a price choice if customers should pick between options at booking — like room sharing or travel mode."
          action={<Button onClick={() => setAddOpen(true)}>+ Add a price choice</Button>}
        />
        <AddVariantAxisModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={(p) => void handleAdd(p)}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Trip Variants</h3>
        <Button onClick={() => setAddOpen(true)}>+ Add price choice</Button>
      </div>

      {axes.map((axis) => {
        const activeCount = axis.options.filter((o) => o.is_active).length;
        return (
          <div key={axis.variant_axis_id} className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-ink">{axis.axis_label}</h4>
                {axis.axis_description && (
                  <p className="mt-1 text-xs text-mid">{axis.axis_description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeletingAxisId(axis.variant_axis_id)}
                className="rounded p-1 text-mid hover:bg-surface3"
                aria-label="Delete axis"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
              Price options are shared across all batches in this trip group. To charge a different
              price for a specific batch, change that batch&apos;s base price on the Trip Info tab.
            </div>

            <div className="space-y-2">
              {axis.options.map((opt) => (
                <div
                  key={opt.variant_option_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface3 p-3"
                >
                  <input
                    type="text"
                    defaultValue={opt.option_label}
                    onBlur={(e) => {
                      const next = e.target.value;
                      if (next !== opt.option_label) {
                        void handleUpdateOption(
                          axis.variant_axis_id,
                          opt.variant_option_id,
                          { option_label: next },
                        );
                      }
                    }}
                    className="min-w-[160px] flex-1 rounded border border-line bg-surface px-2 py-1 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-mid">₹</span>
                    <NumericInput
                      value={opt.price_per_pax}
                      onChange={(v) =>
                        void handleUpdateOption(
                          axis.variant_axis_id,
                          opt.variant_option_id,
                          { price_per_pax: Math.max(0, v ?? 0) },
                        )
                      }
                      min={0}
                      max={1_000_000}
                      className="w-28"
                      showSteppers={false}
                    />
                  </div>
                  <label className="flex items-center gap-1">
                    <Toggle
                      checked={opt.is_active}
                      onChange={(v) =>
                        void handleUpdateOption(
                          axis.variant_axis_id,
                          opt.variant_option_id,
                          { is_active: v },
                        )
                      }
                    />
                    <span className="text-xs text-mid">Show</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDeletingOptionId(opt.variant_option_id)}
                    className="rounded p-1 text-mid hover:bg-line"
                    aria-label="Delete option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              onClick={() => void handleAddOption(axis.variant_axis_id)}
              className="mt-3"
            >
              + Add option
            </Button>

            {activeCount < 2 && (
              <p className="mt-3 text-xs text-sem-red">
                Add at least one more option, or remove this whole price choice.
              </p>
            )}

            <p className="mt-3 text-xs text-mid">
              <Info className="mr-1 inline h-3 w-3" />
              Customers already in the funnel keep the price they were quoted.
            </p>
          </div>
        );
      })}

      <AddVariantAxisModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(p) => void handleAdd(p)}
      />

      <ConfirmDialog
        open={deletingAxisId !== null}
        title="Delete this price choice?"
        message="Customers booking after now won't see it. (Bookings already placed are not affected.)"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteAxis()}
        onCancel={() => setDeletingAxisId(null)}
      />
      <ConfirmDialog
        open={deletingOptionId !== null}
        title="Remove this option?"
        message="Customers booking after now won't see it."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteOption()}
        onCancel={() => setDeletingOptionId(null)}
      />
    </div>
  );
}
