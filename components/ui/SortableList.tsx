"use client";

import { useState } from "react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Sortable Item wrapper
// ---------------------------------------------------------------------------

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function SortableItem({ id, children, className }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-surface transition-shadow",
        isDragging && "z-50 shadow-lg border-rust/30 bg-rust-tint",
        className,
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex h-full shrink-0 cursor-grab items-center rounded-l-lg px-2 text-fog hover:text-mid active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* Content */}
      <div className="flex-1 py-2 pr-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableList component
// ---------------------------------------------------------------------------

interface SortableListProps<T> {
  /** Items to render. Each must have a unique string id. */
  items: T[];
  /** Extract unique id from item */
  getId: (item: T) => string;
  /** Render the content of each sortable row */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Called with reordered items after drag ends */
  onReorder: (items: T[]) => void;
  /** Optional class for the list container */
  className?: string;
  /** Optional class for each item */
  itemClassName?: string;
}

export function SortableList<T>({
  items,
  getId,
  renderItem,
  onReorder,
  className,
  itemClassName,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => getId(item) === active.id);
    const newIndex = items.findIndex((item) => getId(item) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered);
  }

  const ids = items.map(getId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-2", className)}>
          {items.map((item, index) => (
            <SortableItem
              key={getId(item)}
              id={getId(item)}
              className={itemClassName}
            >
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
