"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { SortableList } from "@/components/ui/SortableList";
import type { TripFormState } from "../types";
import type { ItineraryDayInput } from "@/lib/db/trip-itinerary";

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const TEXTAREA =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 resize-y";

interface ItineraryTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
}

export function ItineraryTab({ form, updateField }: ItineraryTabProps) {
  const days = form.itinerary;

  function updateDay(index: number, patch: Partial<ItineraryDayInput>) {
    const next = [...days];
    next[index] = { ...next[index], ...patch };
    updateField("itinerary", next);
  }

  function addDay() {
    const nextDayNumber = days.length > 0 ? Math.max(...days.map((d) => d.day_number)) + 1 : 1;
    updateField("itinerary", [
      ...days,
      {
        day_number: nextDayNumber,
        title: "",
        subtitle: null,
        description: null,
        meals: null,
        accommodation: null,
        tags: null,
      },
    ]);
  }

  function removeDay(index: number) {
    const next = days.filter((_, i) => i !== index);
    const renumbered = next.map((d, i) => ({ ...d, day_number: i + 1 }));
    updateField("itinerary", renumbered);
  }

  const handleReorder = useCallback(
    (reordered: ItineraryDayInput[]) => {
      // Re-number days after reorder
      const renumbered = reordered.map((d, i) => ({ ...d, day_number: i + 1 }));
      updateField("itinerary", renumbered);
    },
    [updateField],
  );

  return (
    <div className="space-y-4">
      {days.length === 0 && (
        <p className="py-8 text-center text-sm text-mid">
          No itinerary days yet. Click below to add the first day.
        </p>
      )}

      {days.length > 0 && (
        <SortableList
          items={days}
          getId={(day) => `day-${day.day_number}`}
          onReorder={handleReorder}
          renderItem={(day) => {
            const idx = days.findIndex((d) => d.day_number === day.day_number);
            return (
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-rust">
                    Day {day.day_number}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    onClick={() => removeDay(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-sem-red" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Title" required>
                    <input
                      type="text"
                      className={INPUT}
                      value={day.title}
                      onChange={(e) => updateDay(idx, { title: e.target.value })}
                      placeholder="e.g. Arrival & Welcome Dinner"
                    />
                  </FormField>
                  <FormField label="Subtitle">
                    <input
                      type="text"
                      className={INPUT}
                      value={day.subtitle ?? ""}
                      onChange={(e) => updateDay(idx, { subtitle: e.target.value || null })}
                      placeholder="e.g. Explore the old quarter"
                    />
                  </FormField>
                </div>

                <FormField label="Description">
                  <textarea
                    className={TEXTAREA}
                    rows={2}
                    value={day.description ?? ""}
                    onChange={(e) => updateDay(idx, { description: e.target.value || null })}
                    placeholder="Describe the day's activities..."
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Meals">
                    <input
                      type="text"
                      className={INPUT}
                      value={day.meals ?? ""}
                      onChange={(e) => updateDay(idx, { meals: e.target.value || null })}
                      placeholder="e.g. Breakfast, Lunch, Dinner"
                    />
                  </FormField>
                  <FormField label="Accommodation">
                    <input
                      type="text"
                      className={INPUT}
                      value={day.accommodation ?? ""}
                      onChange={(e) => updateDay(idx, { accommodation: e.target.value || null })}
                      placeholder="e.g. Heritage Resort"
                    />
                  </FormField>
                </div>
              </div>
            );
          }}
        />
      )}

      <Button variant="secondary" onClick={addDay}>
        <Plus className="h-4 w-4" />
        Add Day
      </Button>
    </div>
  );
}
