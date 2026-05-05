"use client";

import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { NumericInput } from "@/components/ui/NumericInput";
import type { TripFormState } from "../TripFormModal";
import type { DbDestination } from "@/lib/types";
import { TRIP_TYPE_OPTIONS } from "@/lib/constants";
import { slugify } from "@/lib/utils";

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const SELECT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

interface BasicTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
  destinations: DbDestination[];
}

export function BasicTab({ form, updateField, destinations }: BasicTabProps) {
  const previewSlug = slugify(form.trip_name);
  const isCustomTrip = form.trip_type === "Signature Journey" || form.trip_type === "Customized Trips Only";

  return (
    <div className="space-y-5">
      {/* ── Trip Identity ── */}
      <FormSection title="Trip Identity">
        <div className="space-y-4">
          <FormField label="Trip Name" required>
            <input
              type="text"
              className={INPUT}
              value={form.trip_name}
              onChange={(e) => updateField("trip_name", e.target.value)}
              placeholder="e.g. Hampi Heritage Walk"
            />
          </FormField>

          {previewSlug && (
            <div className="rounded-lg bg-surface3 border border-line2 px-4 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-mid">Website URL</p>
              <p className="mt-0.5 text-sm text-ink">
                thenomichi.com/trips/<span className="font-semibold text-rust">{previewSlug}</span>
              </p>
              <p className="mt-1 text-[11px] text-fog">
                Auto-generated from the trip name. If this URL is already taken, a suffix will be added automatically.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Trip Type" required>
              <select
                className={SELECT}
                value={form.trip_type}
                onChange={(e) => updateField("trip_type", e.target.value)}
              >
                {TRIP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Destination">
              <select
                className={SELECT}
                value={form.destination_id}
                onChange={(e) => updateField("destination_id", e.target.value)}
              >
                <option value="">Select destination</option>
                {destinations.map((d) => (
                  <option key={d.destination_id} value={d.destination_id}>
                    {d.destination_name} ({d.country}) — {d.destination_id}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* ── Schedule ── */}
      <FormSection title="Schedule">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Duration (Days)" required>
              <NumericInput
                value={form.duration_days}
                onChange={(val) => {
                  const days = val ?? 1;
                  updateField("duration_days", days);
                  // Auto-set nights = days - 1 (standard travel convention)
                  updateField("duration_nights", Math.max(0, days - 1));
                }}
                min={1}
                max={90}
              />
            </FormField>
            <div>
              <FormField label="Duration (Nights)" hint="Auto-calculated (days − 1)">
                <div className="flex h-9 items-center rounded-lg border border-line2 bg-surface3 px-3 text-sm text-ink">
                  {form.duration_nights}
                  <span className="ml-1 text-mid">nights</span>
                </div>
              </FormField>
              {form.duration_nights !== Math.max(0, form.duration_days - 1) && (
                <p className="mt-1 text-[11px] text-sem-amber">
                  Nights adjusted manually — standard is {Math.max(0, form.duration_days - 1)} nights for {form.duration_days} days
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Start Date" hint="Must be a future date">
              <input
                type="date"
                className={INPUT}
                min={new Date().toISOString().split("T")[0]}
                value={form.start_date}
                onChange={(e) => {
                  const startDate = e.target.value;
                  updateField("start_date", startDate);
                  // Auto-calculate end date from start date + duration
                  if (startDate && form.duration_days > 0) {
                    const end = new Date(startDate);
                    end.setDate(end.getDate() + form.duration_days - 1);
                    updateField("end_date", end.toISOString().split("T")[0]);
                  }
                }}
              />
            </FormField>
            <FormField label="End Date" hint={form.start_date ? "Auto-calculated from start date + days" : undefined}>
              <div className="flex h-9 items-center rounded-lg border border-line2 bg-surface3 px-3 text-sm text-ink">
                {form.end_date || <span className="text-fog">Set a start date first</span>}
              </div>
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* ── Pricing ── */}
      <FormSection title="Pricing">
        {isCustomTrip ? (
          // Signature / Plan a Trip — negotiated pricing
          <div className="space-y-4">
            <div className="rounded-lg bg-surface3 border border-line2 px-4 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-mid">Pricing Model</p>
              <p className="mt-0.5 text-sm text-ink">Custom / quote-based pricing for bespoke journeys</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Starting Price" hint="Indicative price shown on the website" required>
                <NumericInput
                  value={form.quoted_price}
                  onChange={(val) => updateField("quoted_price", val)}
                  placeholder="e.g. 85000"
                  min={0}
                  prefix="₹"
                />
              </FormField>
              <FormField label="Advance Payment %" hint="Collected at booking (default 50%)">
                <NumericInput
                  value={form.advance_pct}
                  onChange={(val) => updateField("advance_pct", val ?? 50)}
                  min={0}
                  max={100}
                  suffix="%"
                />
              </FormField>
            </div>
          </div>
        ) : (
          // Community / Beyond Ordinary — fixed pricing with optional discount
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Trip Price" hint="Per person" required>
                <NumericInput
                  value={form.mrp_price}
                  onChange={(val) => {
                    updateField("mrp_price", val);
                    const mrp = val ?? 0;
                    const disc = form.discount_pct ?? 0;
                    updateField("selling_price", disc > 0 ? Math.round(mrp * (1 - disc / 100)) : mrp);
                  }}
                  placeholder="e.g. 28000"
                  min={0}
                  prefix="₹"
                />
              </FormField>
              <FormField label="Offer Discount" hint="Optional — leave empty for no discount">
                <NumericInput
                  value={form.discount_pct}
                  onChange={(val) => {
                    updateField("discount_pct", val);
                    const mrp = form.mrp_price ?? 0;
                    const disc = val ?? 0;
                    updateField("selling_price", disc > 0 ? Math.round(mrp * (1 - disc / 100)) : mrp);
                  }}
                  placeholder="0"
                  min={0}
                  max={100}
                  suffix="%"
                />
              </FormField>
            </div>
            <FormField label="Advance Payment %" hint="Collected at booking (default 50%)">
              <NumericInput
                value={form.advance_pct}
                onChange={(val) => updateField("advance_pct", val ?? 50)}
                min={0}
                max={100}
                suffix="%"
              />
            </FormField>
            {(form.discount_pct ?? 0) > 0 && (form.mrp_price ?? 0) > 0 && (
              <div className="rounded-lg border border-sem-green/20 bg-sem-green-bg px-4 py-2.5">
                <p className="text-sm text-sem-green">
                  <span className="line-through text-mid">₹{(form.mrp_price ?? 0).toLocaleString("en-IN")}</span>
                  {" → "}
                  <span className="font-bold">₹{(form.selling_price ?? 0).toLocaleString("en-IN")}</span>
                  <span className="ml-2 text-xs">({form.discount_pct}% off — traveller saves ₹{((form.mrp_price ?? 0) - (form.selling_price ?? 0)).toLocaleString("en-IN")})</span>
                </p>
              </div>
            )}
          </div>
        )}
      </FormSection>

      {/* ── Capacity & Logistics ── */}
      <FormSection title="Capacity & Logistics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Total Slots" hint="Maximum travellers for this trip">
            <NumericInput
              value={form.total_slots}
              onChange={(val) => updateField("total_slots", val)}
              placeholder="e.g. 16"
              min={0}
            />
          </FormField>
          <FormField label="Departure City">
            <input
              type="text"
              className={INPUT}
              value={form.departure_city}
              onChange={(e) => updateField("departure_city", e.target.value)}
              placeholder="e.g. Bengaluru"
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}
