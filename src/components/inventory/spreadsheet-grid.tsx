"use client";

import * as React from "react";

import {
  cellDisplay,
  commitCellValue,
  filterOptions,
  type DraftRow,
  type GridColumn,
  type GridOption,
} from "@/lib/inventory/bulk-grid";
import { parseClipboardTable, toClipboardTable } from "@/lib/inventory/grid-clipboard";
import { cn } from "@/lib/utils";

type Pos = { row: number; col: number };

export type GridSelection = { rowStart: number; rowEnd: number; colStart: number; colEnd: number };

const ROW_HEADER_WIDTH = 64;
const HISTORY_LIMIT = 100;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Tabelle zum Erfassen wie in einer Tabellenkalkulation. Unter der letzten Zeile steht immer
 * eine leere Zeile; wer dort etwas einträgt, legt eine neue Zeile an (`newRow`).
 *
 * Tastatur: Pfeile/Tab bewegen, Umschalt erweitert die Auswahl, Enter/F2 oder einfach tippen
 * bearbeitet, Entf leert, Strg+D füllt nach unten, Strg+C/V kopiert/fügt ein (auch aus Excel),
 * Strg+Z/Strg+Y macht rückgängig/wiederholt.
 */
export function SpreadsheetGrid({
  columns,
  rows,
  onRowsChange,
  newRow,
  errors,
  renderRowHeader,
  onSelectionChange,
  onSubmit,
  gridRef,
  className,
}: {
  columns: GridColumn[];
  rows: DraftRow[];
  onRowsChange: (rows: DraftRow[]) => void;
  newRow: () => DraftRow;
  errors: Map<string, Record<string, string>>;
  renderRowHeader: (row: DraftRow | null, index: number) => React.ReactNode;
  onSelectionChange?: (selection: GridSelection) => void;
  onSubmit?: () => void;
  gridRef?: React.Ref<{ focusCell: (row: number, col: number) => void }>;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cellRefs = React.useRef(new Map<string, HTMLTableCellElement>());
  const [active, setActive] = React.useState<Pos>({ row: 0, col: 0 });
  const [anchor, setAnchor] = React.useState<Pos>({ row: 0, col: 0 });
  const [editing, setEditing] = React.useState<{ value: string; highlight: number } | null>(null);
  const dragging = React.useRef(false);
  const undoStack = React.useRef<DraftRow[][]>([]);
  const redoStack = React.useRef<DraftRow[][]>([]);

  const rowCount = rows.length + 1; // + leere Zeile
  // Vorschau der leeren Zeile: zeigt die Vorgaben, die eine neue Zeile übernimmt.
  const ghost = React.useMemo(() => newRow(), [newRow]);
  const lastCol = columns.length - 1;

  const selection: GridSelection = {
    rowStart: Math.min(active.row, anchor.row),
    rowEnd: Math.max(active.row, anchor.row),
    colStart: Math.min(active.col, anchor.col),
    colEnd: Math.max(active.col, anchor.col),
  };

  React.useEffect(() => {
    onSelectionChange?.(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei echter Änderung melden
  }, [selection.rowStart, selection.rowEnd, selection.colStart, selection.colEnd]);

  // Spalten können sich ändern (Spaltenauswahl) – Auswahl im gültigen Bereich halten.
  React.useEffect(() => {
    if (active.col > lastCol || active.row >= rowCount) {
      const next = { row: clamp(active.row, 0, rowCount - 1), col: clamp(active.col, 0, lastCol) };
      setActive(next);
      setAnchor(next);
    }
  }, [active, lastCol, rowCount]);

  React.useEffect(() => {
    const cell = cellRefs.current.get(`${active.row}:${active.col}`);
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  React.useImperativeHandle(gridRef, () => ({
    focusCell: (row: number, col: number) => {
      const next = { row: clamp(row, 0, rowCount - 1), col: clamp(col, 0, lastCol) };
      setActive(next);
      setAnchor(next);
      setEditing(null);
      containerRef.current?.focus({ preventScroll: true });
    },
  }));

  const update = (next: DraftRow[]) => {
    undoStack.current.push(rows);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    onRowsChange(next);
  };

  /** Schreibt Werte in Zellen; Zeilen hinter dem Ende werden angelegt. */
  const writeCells = (writes: { row: number; col: number; value: string }[]) => {
    const next = [...rows];
    let changed = false;
    for (const write of writes) {
      const column = columns[write.col];
      if (!column) continue;
      while (next.length <= write.row) next.push(newRow());
      const row = next[write.row]!;
      if (row.savedCode) continue;
      const value = write.value ? commitCellValue(column, row, write.value) : "";
      if ((row.cells[column.key] ?? "") === value) continue;
      next[write.row] = {
        ...row,
        cells: { ...row.cells, [column.key]: value },
        serverError: undefined,
      };
      changed = true;
    }
    if (changed) update(next);
  };

  const move = (pos: Pos, extend = false) => {
    const next = { row: clamp(pos.row, 0, rowCount - 1), col: clamp(pos.col, 0, lastCol) };
    setActive(next);
    if (!extend) setAnchor(next);
  };

  const focusGrid = () => containerRef.current?.focus({ preventScroll: true });

  const rowAt = (index: number) => rows[index] ?? null;
  const canEdit = (index: number) => !rowAt(index)?.savedCode;

  const startEditing = (initial?: string) => {
    if (!canEdit(active.row) || !columns[active.col]) return;
    setAnchor(active);
    const column = columns[active.col]!;
    const current = cellDisplay(column, rowAt(active.row) ?? ghost).text;
    setEditing({ value: initial ?? current, highlight: initial === undefined ? -1 : 0 });
  };

  const commitEditing = (value: string, after: Pos | null) => {
    writeCells([{ row: active.row, col: active.col, value }]);
    setEditing(null);
    if (after) move(after);
    focusGrid();
  };

  const clearSelection = () => {
    const writes: { row: number; col: number; value: string }[] = [];
    for (let row = selection.rowStart; row <= Math.min(selection.rowEnd, rows.length - 1); row++) {
      for (let col = selection.colStart; col <= selection.colEnd; col++) {
        writes.push({ row, col, value: "" });
      }
    }
    writeCells(writes);
  };

  const fillDown = () => {
    const single = selection.rowStart === selection.rowEnd;
    const source = single ? selection.rowStart - 1 : selection.rowStart;
    const sourceRow = rowAt(source);
    if (!sourceRow) return;
    const next = [...rows];
    for (let row = source + 1; row <= selection.rowEnd; row++) {
      while (next.length <= row) next.push(newRow());
      const target = next[row]!;
      if (target.savedCode) continue;
      const cells = { ...target.cells };
      for (let col = selection.colStart; col <= selection.colEnd; col++) {
        const key = columns[col]!.key;
        cells[key] = sourceRow.cells[key] ?? "";
      }
      next[row] = { ...target, cells };
    }
    update(next);
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(rows);
    onRowsChange(previous);
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(rows);
    onRowsChange(next);
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (editing) return;
    const mod = event.ctrlKey || event.metaKey;
    const { row, col } = active;
    const key = event.key;
    let handled = true;

    if (mod && key === "Enter") onSubmit?.();
    else if (mod && key.toLowerCase() === "d") fillDown();
    else if (mod && key.toLowerCase() === "z" && !event.shiftKey) undo();
    else if (mod && (key.toLowerCase() === "y" || (key.toLowerCase() === "z" && event.shiftKey)))
      redo();
    else if (mod && key.toLowerCase() === "a") {
      setAnchor({ row: 0, col: 0 });
      setActive({ row: rowCount - 1, col: lastCol });
    } else if (key === "ArrowDown")
      move({ row: mod ? rowCount - 1 : row + 1, col }, event.shiftKey);
    else if (key === "ArrowUp") move({ row: mod ? 0 : row - 1, col }, event.shiftKey);
    else if (key === "ArrowRight") move({ row, col: mod ? lastCol : col + 1 }, event.shiftKey);
    else if (key === "ArrowLeft") move({ row, col: mod ? 0 : col - 1 }, event.shiftKey);
    else if (key === "Home") move({ row: mod ? 0 : row, col: 0 }, event.shiftKey);
    else if (key === "End") move({ row: mod ? rowCount - 1 : row, col: lastCol }, event.shiftKey);
    else if (key === "Tab") {
      if (event.shiftKey) move(col > 0 ? { row, col: col - 1 } : { row: row - 1, col: lastCol });
      else move(col < lastCol ? { row, col: col + 1 } : { row: row + 1, col: 0 });
    } else if (key === "Enter") {
      if (event.shiftKey) move({ row: row - 1, col });
      else startEditing();
    } else if (key === "F2") startEditing();
    else if (key === "Delete" || key === "Backspace") clearSelection();
    else if (key === "Escape") setAnchor(active);
    else if (key.length === 1 && !mod && !event.altKey) startEditing(key);
    else handled = false;

    if (handled) event.preventDefault();
  };

  const onCopy = (event: React.ClipboardEvent) => {
    if (editing) return;
    event.preventDefault();
    const table: string[][] = [];
    for (let row = selection.rowStart; row <= selection.rowEnd; row++) {
      const draft = rowAt(row);
      const line: string[] = [];
      for (let col = selection.colStart; col <= selection.colEnd; col++) {
        line.push(draft ? cellDisplay(columns[col]!, draft).text : "");
      }
      table.push(line);
    }
    event.clipboardData.setData("text/plain", toClipboardTable(table));
  };

  const onPaste = (event: React.ClipboardEvent) => {
    if (editing) return;
    event.preventDefault();
    const table = parseClipboardTable(event.clipboardData.getData("text/plain"));
    if (!table.length) return;
    // Ein einzelner Wert füllt die ganze Auswahl, sonst ab der aktiven Zelle.
    const writes: { row: number; col: number; value: string }[] = [];
    if (table.length === 1 && table[0]!.length === 1) {
      for (let row = selection.rowStart; row <= selection.rowEnd; row++) {
        for (let col = selection.colStart; col <= selection.colEnd; col++) {
          writes.push({ row, col, value: table[0]![0]! });
        }
      }
    } else {
      table.forEach((line, rowOffset) =>
        line.forEach((value, colOffset) => {
          const col = selection.colStart + colOffset;
          if (col <= lastCol) writes.push({ row: selection.rowStart + rowOffset, col, value });
        }),
      );
      setAnchor({ row: selection.rowStart, col: selection.colStart });
      setActive({
        row: selection.rowStart + table.length - 1,
        col: Math.min(lastCol, selection.colStart + Math.max(...table.map((l) => l.length)) - 1),
      });
    }
    writeCells(writes);
  };

  const inSelection = (row: number, col: number) =>
    row >= selection.rowStart &&
    row <= selection.rowEnd &&
    col >= selection.colStart &&
    col <= selection.colEnd;

  const totalWidth = ROW_HEADER_WIDTH + columns.reduce((sum, column) => sum + column.width, 0);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="grid"
      aria-rowcount={rowCount}
      aria-colcount={columns.length}
      onKeyDown={onGridKeyDown}
      onCopy={onCopy}
      onPaste={onPaste}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      // Fixierte Kopfzeile und erste Spalten: scrollIntoView soll Zellen nicht darunter schieben.
      style={{
        scrollPaddingTop: 32,
        scrollPaddingLeft: ROW_HEADER_WIDTH + (columns[0]?.width ?? 0),
      }}
      className={cn(
        "relative overflow-auto rounded-lg border border-border bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <table className="table-fixed border-separate border-spacing-0" style={{ width: totalWidth }}>
        <colgroup>
          <col style={{ width: ROW_HEADER_WIDTH }} />
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 h-8 border-r border-b border-border bg-muted px-2 text-left text-xs font-medium text-muted-foreground">
              #
            </th>
            {columns.map((column, col) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "sticky top-0 z-20 h-8 truncate border-r border-b border-border bg-muted px-2 text-left text-xs font-medium text-muted-foreground",
                  col === 0 && "left-16 z-30",
                  col >= selection.colStart && col <= selection.colEnd && "text-foreground",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => {
            const draft = rowAt(rowIndex);
            const shown = draft ?? ghost;
            const rowErrors = draft ? errors.get(draft.id) : undefined;
            const saved = Boolean(draft?.savedCode);
            const rowSelected = rowIndex >= selection.rowStart && rowIndex <= selection.rowEnd;
            return (
              <tr key={draft?.id ?? "__ghost__"} className={cn(saved && "text-muted-foreground")}>
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 h-8 truncate border-r border-b border-border bg-muted/70 px-2 text-left text-xs font-normal text-muted-foreground backdrop-blur",
                    rowSelected && "bg-accent text-foreground",
                    draft?.serverError && "text-destructive",
                  )}
                  title={draft?.serverError}
                >
                  {renderRowHeader(draft, rowIndex)}
                </th>
                {columns.map((column, col) => {
                  const isActive = active.row === rowIndex && active.col === col;
                  const selected = inSelection(rowIndex, col);
                  const display = cellDisplay(column, shown);
                  const inactive = column.inactive?.(shown);
                  const error = rowErrors?.[column.key];
                  const placeholder = saved ? "" : column.placeholder?.(shown);
                  return (
                    <td
                      key={column.key}
                      ref={(node) => {
                        const id = `${rowIndex}:${col}`;
                        if (node) cellRefs.current.set(id, node);
                        else cellRefs.current.delete(id);
                      }}
                      role="gridcell"
                      aria-selected={selected}
                      aria-invalid={error ? true : undefined}
                      title={error}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        // Fokuswechsel übernimmt eine laufende Bearbeitung (Blur im Editor).
                        focusGrid();
                        dragging.current = true;
                        move({ row: rowIndex, col }, event.shiftKey);
                        event.preventDefault();
                      }}
                      onMouseEnter={() => {
                        if (dragging.current) setActive({ row: rowIndex, col });
                      }}
                      onDoubleClick={() => startEditing()}
                      className={cn(
                        "relative h-8 cursor-cell truncate border-r border-b border-border px-2 select-none",
                        col === 0 && "sticky left-16 z-[5] bg-card font-medium",
                        selected && !isActive && "bg-primary/10",
                        col === 0 &&
                          selected &&
                          !isActive &&
                          "bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))]",
                        inactive && "bg-muted/40 text-muted-foreground/60",
                        !draft && "text-muted-foreground/60",
                        (error || display.unresolved) && "bg-destructive/10 text-destructive",
                        isActive && "outline-2 -outline-offset-2 outline-primary",
                      )}
                    >
                      {isActive && editing ? (
                        <CellEditor
                          column={column}
                          row={shown}
                          state={editing}
                          onState={setEditing}
                          onCommit={(value, direction) => {
                            const target =
                              direction === "down"
                                ? { row: rowIndex + 1, col }
                                : direction === "up"
                                  ? { row: rowIndex - 1, col }
                                  : direction === "right"
                                    ? col < lastCol
                                      ? { row: rowIndex, col: col + 1 }
                                      : { row: rowIndex + 1, col: 0 }
                                    : direction === "left"
                                      ? { row: rowIndex, col: Math.max(0, col - 1) }
                                      : null;
                            commitEditing(value, target);
                          }}
                          onCancel={() => {
                            setEditing(null);
                            focusGrid();
                          }}
                        />
                      ) : display.text ? (
                        <span
                          className={cn(
                            column.type === "number" && "block text-right tabular-nums",
                          )}
                        >
                          {display.text}
                        </span>
                      ) : placeholder && !inactive ? (
                        <span className="text-muted-foreground/50">{placeholder}</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Direction = "down" | "up" | "right" | "left" | null;

function CellEditor({
  column,
  row,
  state,
  onState,
  onCommit,
  onCancel,
}: {
  column: GridColumn;
  row: DraftRow;
  state: { value: string; highlight: number };
  onState: (state: { value: string; highlight: number }) => void;
  onCommit: (value: string, direction: Direction) => void;
  onCancel: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Enter/Tab/Esc beenden die Bearbeitung; das folgende Blur darf nicht nochmals übernehmen.
  const done = React.useRef(false);
  const finish = (value: string, direction: Direction) => {
    if (done.current) return;
    done.current = true;
    onCommit(value, direction);
  };
  const options: GridOption[] = React.useMemo(
    () => (column.type === "select" ? filterOptions(column.options?.(row) ?? [], state.value) : []),
    [column, row, state.value],
  );
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
    const cell = input.parentElement;
    if (column.type === "select" && cell) setRect(cell.getBoundingClientRect());
  }, [column.type]);

  const pick = (option: GridOption | undefined, direction: Direction) =>
    finish(option ? option.value : state.value, direction);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const isSelect = column.type === "select";
    const highlighted = state.highlight >= 0 ? options[state.highlight] : undefined;
    // Ohne gezielte Wahl wird bei getipptem Text der beste Treffer übernommen.
    const best = highlighted ?? (state.value.trim() ? options[0] : undefined);
    if (event.key === "Enter") {
      event.preventDefault();
      if (isSelect) pick(best, event.shiftKey ? "up" : "down");
      else finish(state.value, event.shiftKey ? "up" : "down");
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (isSelect) pick(best, event.shiftKey ? "left" : "right");
      else finish(state.value, event.shiftKey ? "left" : "right");
    } else if (event.key === "Escape") {
      event.preventDefault();
      done.current = true;
      onCancel();
    } else if (isSelect && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      onState({
        ...state,
        highlight: clamp(state.highlight + delta, 0, Math.max(0, options.length - 1)),
      });
    } else if (!isSelect && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      finish(state.value, event.key === "ArrowDown" ? "down" : "up");
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        value={state.value}
        inputMode={column.type === "number" ? "decimal" : undefined}
        onChange={(event) =>
          onState({ value: event.target.value, highlight: event.target.value ? 0 : -1 })
        }
        onKeyDown={onKeyDown}
        onBlur={() => finish(state.value, null)}
        onMouseDown={(event) => event.stopPropagation()}
        aria-label={column.label}
        className={cn(
          "absolute inset-0 h-full w-full bg-background px-2 text-sm outline-2 -outline-offset-2 outline-primary",
          column.type === "number" && "text-right tabular-nums",
        )}
      />
      {column.type === "select" && rect ? (
        <ul
          role="listbox"
          className="fixed z-50 max-h-64 min-w-48 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
          style={{ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 220) }}
        >
          {options.length ? (
            options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={index === state.highlight}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  pick(option, null);
                }}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-3 px-2 py-1",
                  index === state.highlight && "bg-accent text-accent-foreground",
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.hint ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>
                ) : null}
              </li>
            ))
          ) : (
            <li className="px-2 py-1 text-muted-foreground">Kein Treffer</li>
          )}
        </ul>
      ) : null}
    </>
  );
}
