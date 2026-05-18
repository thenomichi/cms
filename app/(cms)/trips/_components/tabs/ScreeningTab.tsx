"use client";

import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import type { FullCatalogVersion } from "@/lib/db/screening";

interface ScreeningTabProps {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  activeCatalog: FullCatalogVersion | null;
}

export function ScreeningTab({ enabled, onEnabledChange, activeCatalog }: ScreeningTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-surface3 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-rust" />
          <div>
            <h3 className="text-sm font-semibold text-ink">What is the Trip Fit Check?</h3>
            <p className="mt-1 text-sm text-mid">
              A short questionnaire shown to customers between Traveller Details and Payment.
              Customers whose answers don&apos;t fit a Soulful Escapes vibe are flagged — they can&apos;t pay
              until the Ops team reviews.
            </p>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3">
        <Toggle checked={enabled} onChange={onEnabledChange} />
        <span className="text-sm font-medium text-ink">
          Run Trip Fit Check for this trip
          <span className="ml-2 text-xs font-normal text-mid">
            (default ON for Soulful Escapes)
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Questions customers will see</h3>
            <Link href="/screening" target="_blank">
              <Button variant="ghost" className="gap-1">
                Edit globally <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {activeCatalog && activeCatalog.questions.length > 0 ? (
            <ol className="space-y-4">
              {activeCatalog.questions.map((q, i) => (
                <li key={q.question_id} className="text-sm">
                  <p className="font-medium text-ink">
                    {i + 1}. {q.prompt}
                  </p>
                  {q.kind !== "text" && (
                    <ul className="ml-5 mt-1 list-disc text-mid">
                      {q.options.map((o) => (
                        <li key={o.option_id}>{o.label}</li>
                      ))}
                    </ul>
                  )}
                  {q.kind === "text" && (
                    <p className="ml-5 mt-1 italic text-mid">(long answer)</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-mid">
              No published catalog yet.{" "}
              <Link href="/screening" className="text-rust underline">
                Set up the questions →
              </Link>
            </p>
          )}
          <p className="mt-3 text-xs text-mid">
            ({activeCatalog?.questions.length ?? 0} questions in total — read-only preview)
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-surface3 p-5 text-sm text-mid">
          Customers will skip the Fit Check and go straight from Traveller Details to Payment.
        </div>
      )}
    </div>
  );
}
