"use client";

import * as React from "react";
import type { TaskStatus } from "@prisma/client";

import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BoardColumn } from "@/lib/departments/board";

import { ResponsivePanel } from "@/components/ui/responsive-panel";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "zählt als offen" },
  { value: "doing", label: "zählt als in Arbeit" },
  { value: "done", label: "zählt als erledigt" },
];

const fieldClass =
  "h-10 rounded-lg border border-border bg-background px-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function ColumnsPanel({
  open,
  onOpenChange,
  columns,
  onRename,
  onMove,
  onDelete,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: BoardColumn[];
  onRename: (column: BoardColumn, name: string, status: TaskStatus) => void;
  onMove: (column: BoardColumn, direction: -1 | 1) => void;
  onDelete: (column: BoardColumn) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [toDelete, setToDelete] = React.useState<BoardColumn | null>(null);

  return (
    <>
      <ResponsivePanel
        open={open}
        onOpenChange={onOpenChange}
        title="Spalten anpassen"
        description="Spalten des Aufgaben-Boards umbenennen, sortieren oder löschen"
      >
        <ul className="space-y-2">
          {columns.map((column, index) => (
            <li key={column.id} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex items-center gap-1.5">
                <input
                  aria-label="Name der Spalte"
                  defaultValue={column.name}
                  maxLength={40}
                  className={`${fieldClass} min-w-0 flex-1`}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value && value !== column.name) onRename(column, value, column.status);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  aria-label={`${column.name} nach links`}
                  disabled={index === 0}
                  onClick={() => onMove(column, -1)}
                >
                  <ArrowLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  aria-label={`${column.name} nach rechts`}
                  disabled={index === columns.length - 1}
                  onClick={() => onMove(column, 1)}
                >
                  <ArrowRightIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive"
                  aria-label={`${column.name} löschen`}
                  disabled={columns.length <= 1}
                  onClick={() => setToDelete(column)}
                >
                  <TrashIcon />
                </Button>
              </div>
              <select
                aria-label={`Bedeutung von ${column.name}`}
                value={column.status}
                className={`${fieldClass} w-full text-muted-foreground`}
                onChange={(event) => {
                  const status = STATUS_OPTIONS.find(
                    (option) => option.value === event.target.value,
                  );
                  if (status) onRename(column, column.name, status.value);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onCreate(name.trim());
            setName("");
          }}
        >
          <input
            aria-label="Neue Spalte"
            placeholder="Neue Spalte"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            className={`${fieldClass} h-11 min-w-0 flex-1`}
          />
          <Button type="submit" variant="outline" className="h-11">
            <PlusIcon /> Hinzufügen
          </Button>
        </form>
      </ResponsivePanel>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(value) => !value && setToDelete(null)}
        title={`Spalte „${toDelete?.name ?? ""}“ löschen?`}
        description="Ihre Aufgaben wandern in die erste Spalte."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) onDelete(toDelete);
          setToDelete(null);
        }}
      />
    </>
  );
}
