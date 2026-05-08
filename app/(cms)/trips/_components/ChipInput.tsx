"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ChipInputProps {
  /** Current chip values, in order. */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional cap. Adds beyond the cap are no-ops. */
  maxChips?: number;
}

/**
 * Layman-friendly chip input. Type a value, press Enter (or comma) to
 * commit a chip; click × to remove; drag to reorder.
 *
 * Storage on the form-state side is `string[]`; the parent is responsible
 * for joining/splitting if the persistence layer wants comma-text. (For
 * trip_itinerary.tags we join on save and split on load.)
 */
export function ChipInput({
  value,
  onChange,
  placeholder = "Type and press Enter to add",
  maxChips,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit() {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    if (maxChips && value.length >= maxChips) return;
    onChange([...value, t]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      // Backspace on empty input pops the last chip — Notion-style.
      onChange(value.slice(0, -1));
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = value.indexOf(String(active.id));
    const newIdx = value.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(value, oldIdx, newIdx));
  }

  return (
    <div className="rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-rust focus-within:ring-1 focus-within:ring-rust/20 transition-colors">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap items-center gap-1.5">
            {value.map((chip, idx) => (
              <Chip key={chip} id={chip} label={chip} onRemove={() => remove(idx)} />
            ))}
            <input
              type="text"
              className="flex-1 min-w-[120px] bg-transparent text-sm text-ink placeholder:text-fog outline-none px-1 py-1"
              placeholder={value.length === 0 ? placeholder : ""}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commit}
            />
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface ChipProps {
  id: string;
  label: string;
  onRemove: () => void;
}

function Chip({ id, label, onRemove }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <span
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 rounded-md border border-line bg-surface3 px-2 py-1 text-xs text-ink cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span>{label}</span>
      <button
        type="button"
        // Stop the dnd-kit pointer listener from claiming the click.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full text-mid hover:bg-line hover:text-rust transition-colors"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
