"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NumericInput } from "@/components/ui/NumericInput";
import { Toggle } from "@/components/ui/Toggle";
import { FilterPills } from "@/components/ui/FilterPills";
import { AddVariantAxisModal, type AddAxisResult } from "./AddVariantAxisModal";
import { getPresetByAxisKey } from "./variant-presets";
import {
  upsertVariantAxisAction,
  deleteVariantAxisAction,
  upsertVariantOptionAction,
  deleteVariantOptionAction,
  refreshVariantAxesAction,
} from "../../actions";
import type { FullVariantAxis, DbVariantOption } from "@/lib/db/trip-variants";
import type { VariantDiscountMode } from "@/lib/schemas/trip-variants";

interface VariantsTabProps {
  groupSlug: string | null;
  tripSlug: string;
  initialAxes: FullVariantAxis[];
  onGotoBasic: () => void;
  /** Trip's base pricing — used for the context card + prefills. */
  baseMrp: number | null;
  baseSelling: number | null;
}

const MODE_PILLS = [
  { value: "percent", label: "Discount %" },
  { value: "flat", label: "Flat discount" },
  { value: "exact", label: "Exact price" },
];

// ---------- Helpers ----------

const FMT = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Apply a discount-mode change to an option, recomputing dependent fields. */
function applyMode(
  opt: DbVariantOption,
  mode: VariantDiscountMode,
): Partial<DbVariantOption> {
  if (mode === "percent") {
    // Move whatever the current discount is into discount_pct
    const pct = opt.mrp_per_pax > 0
      ? Math.round(((opt.mrp_per_pax - opt.price_per_pax) / opt.mrp_per_pax) * 100)
      : 0;
    return { discount_mode: "percent", discount_pct: pct, discount_amount: null };
  }
  if (mode === "flat") {
    const amt = opt.mrp_per_pax - opt.price_per_pax;
    return { discount_mode: "flat", discount_amount: amt, discount_pct: null };
  }
  return { discount_mode: "exact", discount_pct: 0, discount_amount: 0 };
}

/** Recompute price_per_pax from mode-specific fields when MRP / discount changes. */
function recomputeSelling(
  mrp: number,
  mode: VariantDiscountMode,
  pct: number | null,
  amt: number | null,
  exactSelling: number,
): number {
  if (mode === "percent") {
    return Math.max(0, Math.round(mrp * (1 - (pct ?? 0) / 100)));
  }
  if (mode === "flat") {
    return Math.max(0, mrp - (amt ?? 0));
  }
  return Math.min(mrp, exactSelling);
}

/** True if the trip group has multi-axis variants. For "Starts from" we sum the cheapest active option per axis. */
function computeStartsFrom(axes: FullVariantAxis[], fallbackSelling: number | null): number | null {
  if (axes.length === 0) return fallbackSelling;
  let total = 0;
  for (const axis of axes) {
    const activeOpts = axis.options.filter((o) => o.is_active);
    if (activeOpts.length === 0) return null;
    const cheapest = Math.min(...activeOpts.map((o) => o.price_per_pax));
    total += cheapest;
  }
  return total;
}

// ---------- Component ----------

export function VariantsTab({
  groupSlug,
  tripSlug,
  initialAxes,
  onGotoBasic,
  baseMrp,
  baseSelling,
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

  const usedAxisKeys = axes.map((a) => a.axis_key);
  const baseSet = baseMrp != null && baseMrp > 0 && baseSelling != null && baseSelling > 0;

  const handleAdd = async (preset: AddAxisResult) => {
    const axisInput = {
      axis_label: preset.axis_label,
      axis_description: preset.axis_description,
      is_required: true,
    };
    const res = await upsertVariantAxisAction(groupSlug, tripSlug, axisInput);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Prefill starter options from trip's base pricing.
    const prefillMrp = baseMrp ?? 0;
    const prefillSelling = baseSelling ?? prefillMrp;
    const prefillPct = prefillMrp > 0
      ? Math.round(((prefillMrp - prefillSelling) / prefillMrp) * 100)
      : 0;
    for (const opt of preset.starter_options) {
      await upsertVariantOptionAction(res.axisId, tripSlug, {
        option_label: opt.label,
        option_sublabel: null,
        mrp_per_pax: prefillMrp,
        price_per_pax: prefillSelling,
        discount_pct: prefillPct,
        discount_amount: null,
        discount_mode: "percent",
        is_active: true,
      });
    }
    await refresh();
    toast.success("Price choice added");
  };

  const handleUpdateOption = async (
    axisId: string,
    optionId: string,
    patch: Partial<DbVariantOption>,
  ) => {
    const axis = axes.find((a) => a.variant_axis_id === axisId);
    const opt = axis?.options.find((o) => o.variant_option_id === optionId);
    if (!opt) return;
    const merged: DbVariantOption = { ...opt, ...patch };
    const res = await upsertVariantOptionAction(axisId, tripSlug, {
      variant_option_id: opt.variant_option_id,
      option_label: merged.option_label,
      option_sublabel: merged.option_sublabel,
      mrp_per_pax: merged.mrp_per_pax,
      price_per_pax: merged.price_per_pax,
      discount_pct: merged.discount_pct,
      discount_amount: merged.discount_amount,
      discount_mode: merged.discount_mode,
      is_active: merged.is_active,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleAddOption = async (axis: FullVariantAxis) => {
    const preset = getPresetByAxisKey(axis.axis_key);
    if (!preset) return;
    const used = new Set(axis.options.map((o) => o.option_label));
    const next = preset.allowed_option_labels.find((l) => !used.has(l));
    if (!next) return;
    // Prefill from the previous option on this axis if it exists, else
    // from the trip's base pricing.
    const prev = axis.options[axis.options.length - 1];
    const mrp = prev?.mrp_per_pax ?? baseMrp ?? 0;
    const selling = prev?.price_per_pax ?? baseSelling ?? mrp;
    const mode = (prev?.discount_mode ?? "percent") as VariantDiscountMode;
    const pct = mrp > 0 ? Math.round(((mrp - selling) / mrp) * 100) : 0;
    const res = await upsertVariantOptionAction(axis.variant_axis_id, tripSlug, {
      option_label: next,
      option_sublabel: null,
      mrp_per_pax: mrp,
      price_per_pax: selling,
      discount_pct: mode === "percent" ? pct : null,
      discount_amount: mode === "flat" ? mrp - selling : null,
      discount_mode: mode,
      is_active: true,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleCopyFromAbove = async (axis: FullVariantAxis, index: number) => {
    if (index === 0) return;
    const src = axis.options[index - 1];
    const target = axis.options[index];
    await handleUpdateOption(axis.variant_axis_id, target.variant_option_id, {
      mrp_per_pax: src.mrp_per_pax,
      price_per_pax: src.price_per_pax,
      discount_pct: src.discount_pct,
      discount_amount: src.discount_amount,
      discount_mode: src.discount_mode,
    });
    toast.success("Copied from above");
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

  const startsFrom = computeStartsFrom(axes, baseSelling);

  // Top context card — shown both in empty state and populated state.
  const contextCard = (
    <div className="rounded-xl border border-line bg-surface3 p-5">
      <p className="mb-2 text-xs font-semibold text-mid">💡 Base pricing on the Trip Info tab</p>
      {baseSet ? (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><span className="text-mid">MRP:</span> <span className="font-medium">{FMT(baseMrp ?? 0)} per person</span></div>
            <div><span className="text-mid">Selling price:</span> <span className="font-medium">{FMT(baseSelling ?? 0)} per person</span></div>
          </div>
          <p className="mt-3 text-xs text-mid">
            When a customer picks a variant, the variant&apos;s selling price <em>replaces</em> the
            base selling price above. The MRP shown on the website&apos;s listing card uses each
            variant&apos;s MRP.
          </p>
          {startsFrom != null && axes.length > 0 && (
            <p className="mt-2 text-xs font-medium text-ink">
              📣 Website will show: &ldquo;Starts from {FMT(startsFrom)} per person&rdquo;
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-amber-700">
          ⚠ No base price set. Add an MRP and Selling Price on the Trip Info tab before setting
          variant prices.
        </p>
      )}
    </div>
  );

  if (axes.length === 0) {
    return (
      <div className="space-y-5">
        {contextCard}
        <EmptyState
          icon="🎟"
          title="This trip has one fixed price per person"
          description="Add a price choice if customers should pick between options at booking — like room sharing or travel mode."
          action={
            <Button onClick={() => setAddOpen(true)} disabled={!baseSet}>
              + Add a price choice
            </Button>
          }
        />
        <AddVariantAxisModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={(p) => void handleAdd(p)}
          usedAxisKeys={usedAxisKeys}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {contextCard}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Trip Variants</h3>
        <Button
          onClick={() => setAddOpen(true)}
          disabled={usedAxisKeys.length >= 2 || !baseSet}
        >
          + Add price choice
        </Button>
      </div>

      {axes.map((axis) => {
        const activeCount = axis.options.filter((o) => o.is_active).length;
        const preset = getPresetByAxisKey(axis.axis_key);
        const allowedLabels = preset?.allowed_option_labels ?? [];
        const remaining = allowedLabels.filter(
          (l) => !axis.options.some((o) => o.option_label === l),
        );
        const canAddOption = remaining.length > 0;

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

            <div className="space-y-3">
              {axis.options.map((opt, idx) => (
                <OptionRow
                  key={opt.variant_option_id}
                  axis={axis}
                  option={opt}
                  index={idx}
                  allowedLabels={allowedLabels}
                  onChange={(patch) =>
                    void handleUpdateOption(axis.variant_axis_id, opt.variant_option_id, patch)
                  }
                  onCopyFromAbove={() => void handleCopyFromAbove(axis, idx)}
                  onDelete={() => setDeletingOptionId(opt.variant_option_id)}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              onClick={() => void handleAddOption(axis)}
              className="mt-3"
              disabled={!canAddOption}
            >
              {canAddOption ? "+ Add option" : "All options added"}
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
        usedAxisKeys={usedAxisKeys}
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

// ---------- Option row ----------

interface OptionRowProps {
  axis: FullVariantAxis;
  option: DbVariantOption;
  index: number;
  allowedLabels: readonly string[];
  onChange: (patch: Partial<DbVariantOption>) => void;
  onCopyFromAbove: () => void;
  onDelete: () => void;
}

function OptionRow({
  axis,
  option,
  index,
  allowedLabels,
  onChange,
  onCopyFromAbove,
  onDelete,
}: OptionRowProps) {
  const otherLabels = new Set(
    axis.options
      .filter((o) => o.variant_option_id !== option.variant_option_id)
      .map((o) => o.option_label),
  );
  const choices = allowedLabels.length > 0
    ? allowedLabels.filter((l) => l === option.option_label || !otherLabels.has(l))
    : [option.option_label];

  // Compute display values based on current mode.
  const savings = Math.max(0, option.mrp_per_pax - option.price_per_pax);
  const savingsPct = option.mrp_per_pax > 0
    ? Math.round((savings / option.mrp_per_pax) * 100)
    : 0;

  // Soft-warning checks.
  const isOverDiscount = savingsPct >= 50 && option.is_active;
  const showsAsNoDiscount = savings === 0 && option.is_active;

  const handleMrpChange = (mrp: number) => {
    const newSelling = recomputeSelling(
      mrp,
      option.discount_mode,
      option.discount_pct,
      option.discount_amount,
      option.price_per_pax,
    );
    onChange({ mrp_per_pax: mrp, price_per_pax: newSelling });
  };

  const handlePctChange = (pct: number) => {
    const safe = Math.max(0, Math.min(99, pct));
    const newSelling = recomputeSelling(option.mrp_per_pax, "percent", safe, null, 0);
    onChange({ discount_pct: safe, discount_amount: null, price_per_pax: newSelling });
  };

  const handleFlatChange = (amt: number) => {
    const safe = Math.max(0, Math.min(option.mrp_per_pax, amt));
    const newSelling = recomputeSelling(option.mrp_per_pax, "flat", null, safe, 0);
    onChange({ discount_amount: safe, discount_pct: null, price_per_pax: newSelling });
  };

  const handleExactChange = (selling: number) => {
    const safe = Math.max(0, Math.min(option.mrp_per_pax, selling));
    onChange({ price_per_pax: safe, discount_pct: 0, discount_amount: 0 });
  };

  const handleModeChange = (mode: VariantDiscountMode) => {
    onChange(applyMode(option, mode));
  };

  return (
    <div className="rounded-lg border border-line bg-surface3 p-4">
      {/* Header row: label + active toggle + delete */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={option.option_label}
          onChange={(e) => {
            const next = e.target.value;
            if (next !== option.option_label) onChange({ option_label: next });
          }}
          className="min-w-[180px] flex-1 rounded border border-line bg-surface px-2 py-1 text-sm"
        >
          {choices.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <Toggle
            checked={option.is_active}
            onChange={(v) => onChange({ is_active: v })}
          />
          <span className="text-xs text-mid">Show to customers</span>
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-mid hover:bg-line"
          aria-label="Delete option"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Mode picker + copy-from-above */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-mid">How is this priced?</p>
          <FilterPills
            options={MODE_PILLS}
            value={option.discount_mode}
            onChange={(v) => handleModeChange(v as VariantDiscountMode)}
          />
        </div>
        {index > 0 && (
          <button
            type="button"
            onClick={onCopyFromAbove}
            className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-xs text-ink hover:bg-line2"
            title="Copy MRP + discount from the option above"
          >
            <Copy className="h-3 w-3" /> Copy from above
          </button>
        )}
      </div>

      {/* Pricing grid: MRP | (mode-specific input) | selling */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-mid">MRP (strikethrough)</label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-mid">₹</span>
            <NumericInput
              value={option.mrp_per_pax}
              onChange={(v) => handleMrpChange(Math.max(0, v ?? 0))}
              min={0}
              max={1_000_000}
              className="w-full"
              showSteppers={false}
            />
          </div>
        </div>

        {option.discount_mode === "percent" && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-mid">Discount %</label>
            <div className="flex items-center gap-1">
              <NumericInput
                value={option.discount_pct ?? 0}
                onChange={(v) => handlePctChange(v ?? 0)}
                min={0}
                max={99}
                className="w-full"
                showSteppers={false}
              />
              <span className="text-sm text-mid">%</span>
            </div>
          </div>
        )}

        {option.discount_mode === "flat" && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-mid">Flat discount</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-mid">₹</span>
              <NumericInput
                value={option.discount_amount ?? 0}
                onChange={(v) => handleFlatChange(v ?? 0)}
                min={0}
                max={option.mrp_per_pax}
                className="w-full"
                showSteppers={false}
              />
            </div>
          </div>
        )}

        {option.discount_mode === "exact" && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-mid">Selling price</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-mid">₹</span>
              <NumericInput
                value={option.price_per_pax}
                onChange={(v) => handleExactChange(v ?? 0)}
                min={0}
                max={option.mrp_per_pax}
                className="w-full"
                showSteppers={false}
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-mid">Customer pays</label>
          <div className="rounded border border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink">
            {FMT(option.price_per_pax)}
          </div>
          {savings > 0 ? (
            <p className="mt-1 text-xs text-sem-green">saves {FMT(savings)} ({savingsPct}% off)</p>
          ) : (
            <p className="mt-1 text-xs text-mid">matches MRP — no discount</p>
          )}
        </div>
      </div>

      {/* Soft warnings */}
      {isOverDiscount && (
        <p className="mt-3 text-xs text-amber-700">
          ⚠ This is a {savingsPct}% discount — double-check it&apos;s intentional.
        </p>
      )}
      {showsAsNoDiscount && (
        <p className="mt-2 text-xs text-mid">
          No discount applied — the website will show only the price, not a strikethrough.
        </p>
      )}
    </div>
  );
}
