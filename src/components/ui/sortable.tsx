"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy };

export function DndSortableProvider({
  children,
  onDragEnd,
}: {
  children: ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}

type SortableItemProps = {
  id: string;
  children: (sortable: ReturnType<typeof useSortable>) => ReactNode;
};

export function SortableItem({ id, children }: SortableItemProps) {
  const sortable = useSortable({ id });
  return <>{children(sortable)}</>;
}
