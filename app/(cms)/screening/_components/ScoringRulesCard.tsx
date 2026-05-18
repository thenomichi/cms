"use client";

import { NumericInput } from "@/components/ui/NumericInput";

interface ScoringRulesCardProps {
  flagIfRedAtLeast: number;
  flagIfYellowAtLeast: number;
  onChange: (next: { flagIfRedAtLeast: number; flagIfYellowAtLeast: number }) => void;
}

export function ScoringRulesCard({
  flagIfRedAtLeast,
  flagIfYellowAtLeast,
  onChange,
}: ScoringRulesCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">Scoring rules</h3>
      <p className="mb-4 text-sm text-mid">Flag a customer when they pick:</p>
      <div className="flex flex-wrap items-center gap-3">
        <NumericInput
          value={flagIfRedAtLeast}
          onChange={(v) =>
            onChange({ flagIfRedAtLeast: Math.max(1, v ?? 1), flagIfYellowAtLeast })
          }
          min={1}
          step={1}
          showSteppers
          className="w-24"
        />
        <span className="text-sm text-ink">red answers (or more)</span>
        <span className="text-sm font-medium text-mid">OR</span>
        <NumericInput
          value={flagIfYellowAtLeast}
          onChange={(v) =>
            onChange({ flagIfRedAtLeast, flagIfYellowAtLeast: Math.max(1, v ?? 1) })
          }
          min={1}
          step={1}
          showSteppers
          className="w-24"
        />
        <span className="text-sm text-ink">yellow answers (or more)</span>
      </div>
      <p className="mt-3 text-xs text-mid">
        With these settings, picking {flagIfRedAtLeast} red OR {flagIfYellowAtLeast} yellows = flagged.
      </p>
    </div>
  );
}
