"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Static pages that are always available as CTA targets
const STATIC_PAGES = [
  { value: "/join-a-trip", label: "Join a Trip (listing page)" },
  { value: "/beyond-ordinary", label: "Beyond Ordinary (listing page)" },
  { value: "/signature-journeys", label: "Signature Journeys (listing page)" },
  { value: "/plan-a-trip", label: "Plan a Trip (enquiry form)" },
  { value: "/gift-a-trip", label: "Gift a Trip" },
  { value: "/contact", label: "Contact Us" },
  { value: "/about", label: "About Nomichi" },
  { value: "/careers", label: "Careers" },
];

const CTA_LABELS = [
  "Book Now",
  "View Trip",
  "Explore",
  "Learn More",
  "Plan Your Trip",
  "Get in Touch",
  "Gift a Trip",
  "Join Waitlist",
  "Request Invite",
];

interface TripOption {
  trip_id: string;
  trip_name: string;
  slug?: string;
}

interface CtaLinkPickerProps {
  linkValue: string;
  labelValue: string;
  onLinkChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  trips?: TripOption[];
}

export function CtaLinkPicker({
  linkValue,
  labelValue,
  onLinkChange,
  onLabelChange,
  trips = [],
}: CtaLinkPickerProps) {
  const [mode, setMode] = useState<"pick" | "custom">(
    linkValue && !STATIC_PAGES.some((p) => p.value === linkValue) && !linkValue.startsWith("/trips/")
      ? "custom"
      : "pick",
  );

  const inputClass =
    "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
  const selectClass =
    "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {/* CTA Label — dropdown with common options + custom */}
        <div className="space-y-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink3">
            Button Text
          </label>
          <select
            className={selectClass}
            value={CTA_LABELS.includes(labelValue) ? labelValue : "__custom__"}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                onLabelChange("");
              } else {
                onLabelChange(e.target.value);
              }
            }}
          >
            <option value="">Select...</option>
            {CTA_LABELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="__custom__">Custom text...</option>
          </select>
          {((!CTA_LABELS.includes(labelValue) && labelValue) || labelValue === "") && (
            <input
              className={inputClass}
              value={labelValue}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Type custom button text..."
            />
          )}
        </div>

        {/* CTA Link — mode toggle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink3">
              Links To
            </label>
            <button
              type="button"
              onClick={() => setMode(mode === "pick" ? "custom" : "pick")}
              className="text-[10px] font-medium text-rust hover:text-rust-d"
            >
              {mode === "pick" ? "Enter custom URL" : "Pick from list"}
            </button>
          </div>

          {mode === "pick" ? (
            <select
              className={selectClass}
              value={linkValue}
              onChange={(e) => onLinkChange(e.target.value)}
            >
              <option value="">Select a page...</option>

              {/* Trip pages */}
              {trips.length > 0 && (
                <optgroup label="Trips">
                  {trips.map((t) => (
                    <option key={t.trip_id} value={`/trips/${t.slug ?? t.trip_id}`}>
                      {t.trip_name} — {t.trip_id}
                    </option>
                  ))}
                </optgroup>
              )}

              {/* Static pages */}
              <optgroup label="Pages">
                {STATIC_PAGES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </optgroup>
            </select>
          ) : (
            <input
              className={inputClass}
              value={linkValue}
              onChange={(e) => onLinkChange(e.target.value)}
              placeholder="e.g. /trips/bali or https://wa.me/..."
            />
          )}
        </div>
      </div>

      {/* Preview */}
      {linkValue && labelValue && (
        <div className="rounded-lg bg-surface3 px-4 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-mid">Preview</p>
          <p className="mt-0.5 text-sm">
            <span className="inline-flex items-center gap-1 rounded-md bg-rust px-3 py-1 text-xs font-medium text-white">
              {labelValue}
            </span>
            <span className="ml-2 text-xs text-fog">→ {linkValue}</span>
          </p>
        </div>
      )}
    </div>
  );
}
