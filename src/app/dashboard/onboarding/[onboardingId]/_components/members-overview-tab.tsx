"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, GripVertical, RefreshCw } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OnboardingMembersColumn,
  OnboardingMembersOverview,
} from "@/lib/onboarding/dashboard-schemas";
import { cn } from "@/lib/utils";

const STORAGE_KEY_PREFIX = "onboarding-members-columns";

type SortState = {
  columnId: string;
  direction: "asc" | "desc";
};

type ColumnState = OnboardingMembersColumn & { order: number };

type MembersOverviewTabProps = {
  onboardingId: string;
  data: OnboardingMembersOverview;
};

function getPriorityClassName(priority?: number) {
  if (!priority) return "";
  if (priority >= 10) return "hidden 2xl:table-cell";
  if (priority >= 8) return "hidden xl:table-cell";
  if (priority >= 6) return "hidden lg:table-cell";
  if (priority >= 4) return "hidden md:table-cell";
  return "";
}

function formatNumber(value: unknown, suffix?: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "–";
  }
  return suffix ? `${value} ${suffix}` : value.toString();
}

function formatDateValue(value: unknown, format?: string) {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "–";
  }
  if (format === "year") {
    return date.getFullYear();
  }
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function limitList<T>(items: T[], maxItems = 3) {
  if (items.length <= maxItems) {
    return { visible: items, hidden: 0 };
  }
  return { visible: items.slice(0, maxItems), hidden: items.length - maxItems };
}

function resolveIntent(intent?: string) {
  switch (intent) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "critical":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function resolveStatusTone(status?: string) {
  switch (status) {
    case "approved":
      return {
        iconClass: "text-success",
        badgeClass: "border-success/60 bg-success/10 text-success", // semantic tokens present
      };
    case "rejected":
      return {
        iconClass: "text-destructive",
        badgeClass: "border-destructive/50 bg-destructive/10 text-destructive",
      };
    default:
      return {
        iconClass: "text-warning",
        badgeClass: "border-warning/60 bg-warning/10 text-warning",
      };
  }
}

function usePersistedColumns(onboardingId: string, initial: ColumnState[]) {
  const storageKey = `${STORAGE_KEY_PREFIX}-${onboardingId}`;
  const [columns, setColumns] = useState<ColumnState[]>(initial);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ColumnState[];
        setColumns(
          parsed.map((column, index) => ({
            ...column,
            order: typeof column.order === "number" ? column.order : index,
          })),
        );
        return;
      } catch (error) {
        console.warn("Failed to parse column config", error);
      }
    }
    setColumns(initial);
  }, [storageKey, initial]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(columns));
  }, [columns, storageKey]);

  return [columns, setColumns] as const;
}

function renderAvatarCell(value: unknown, renderRule?: Record<string, unknown>) {
  if (!value || typeof value !== "object") return "–";
  const data = value as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name : "Unbekannt";
  const email = typeof data.email === "string" ? data.email : undefined;
  const subtextKey = typeof renderRule?.subtext === "string" ? (renderRule.subtext as string) : undefined;
  const helperKey = typeof renderRule?.helper === "string" ? (renderRule.helper as string) : undefined;
  const subtext =
    (subtextKey && typeof data[subtextKey] === "string" ? (data[subtextKey] as string) : undefined) ?? email;
  const helperValue = helperKey && typeof (data as Record<string, unknown>)[helperKey] === "string"
    ? ((data as Record<string, unknown>)[helperKey] as string)
    : undefined;

  return (
    <div className="flex items-start gap-3">
      <UserAvatar
        name={name}
        email={email}
        size={36}
        className="mt-0.5 text-sm font-semibold text-foreground"
      />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-tight text-foreground">{name}</p>
        {subtext ? (
          <p className="text-xs text-muted-foreground">{subtext}</p>
        ) : null}
        {helperValue ? (
          <p className="text-[11px] text-muted-foreground/80">{helperValue}</p>
        ) : null}
      </div>
    </div>
  );
}

function renderBadgeListCell(value: unknown, renderRule?: Record<string, unknown>) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return <span className="text-muted-foreground">–</span>;

  const maxBadges = typeof renderRule?.maxBadges === "number" ? renderRule.maxBadges : undefined;
  const tone = typeof renderRule?.tone === "string" ? renderRule.tone : "default";
  const intentMap = (renderRule?.intentMap ?? {}) as Record<string, string>;
  const { visible, hidden } = limitList(items, maxBadges ?? items.length);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((item, index) => {
        const label = typeof item === "string" ? item : (item as { label?: string }).label;
        const intentKey = typeof item === "string" ? item : (item as { label?: string; intent?: string; value?: number }).intent;
        const value = typeof item === "object" && item && "value" in item && typeof (item as { value?: number }).value === "number"
          ? Math.round(((item as { value: number }).value ?? 0) * 100)
          : null;
        const intent = intentMap[intentKey ?? ""] ?? (typeof intentKey === "string" ? intentKey : undefined);

        return (
          <Badge
            key={`${label}-${index}`}
            variant={tone === "muted" ? "secondary" : "outline"}
            className={cn(
              "flex items-center gap-1 rounded-md border-border/70 px-2 py-1 text-xs font-medium",
              intent ? resolveIntent(intent) : "",
            )}
          >
            <span>{label ?? "–"}</span>
            {value !== null ? <span className="text-[10px] text-muted-foreground">{value}%</span> : null}
          </Badge>
        );
      })}
      {hidden > 0 ? (
        <Badge variant="secondary" className="rounded-md px-2 py-1 text-[11px] text-muted-foreground">
          +{hidden}
        </Badge>
      ) : null}
    </div>
  );
}

function renderTextCell(value: unknown, renderRule?: Record<string, unknown>) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">–</span>;
  }

  let primary: string;
  let helper: string | undefined;

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    primary = typeof record.label === "string"
      ? record.label
      : typeof record.value === "string"
        ? record.value
        : typeof record.value === "number"
          ? record.value.toString()
          : String(Object.values(record)[0] ?? value);
    helper = typeof record.helper === "string" ? record.helper : undefined;
    const helperKey = typeof renderRule?.helperKey === "string" ? (renderRule.helperKey as string) : undefined;
    if (!helper && helperKey && typeof record[helperKey] === "string") {
      helper = record[helperKey] as string;
    }
  } else {
    primary = String(value);
  }

  return (
    <div className="space-y-0.5">
      <p className="text-sm text-foreground">{primary}</p>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function renderListCell(value: unknown, renderRule?: Record<string, unknown>) {
  const items = Array.isArray(value) ? (value.filter((item) => typeof item === "string") as string[]) : [];
  if (items.length === 0) return <span className="text-muted-foreground">–</span>;
  const maxItems = typeof renderRule?.maxItems === "number" ? renderRule.maxItems : undefined;
  const { visible, hidden } = limitList(items, maxItems ?? items.length);

  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-foreground">
      {visible.map((item) => (
        <span
          key={item}
          className="rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {item}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{hidden}</span>
      ) : null}
    </div>
  );
}

function renderIconStatusCell(value: unknown, renderRule?: Record<string, unknown>) {
  if (!value || typeof value !== "object") return <span className="text-muted-foreground">–</span>;
  const data = value as Record<string, unknown>;
  const status = typeof data.status === "string" ? data.status : "pending";
  const tooltip = typeof data.tooltip === "string" ? data.tooltip : undefined;
  const tone = resolveStatusTone(status);
  const legend = (renderRule?.legend ?? {}) as Record<string, string>;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-medium",
        tone.badgeClass,
      )}
      title={tooltip ?? legend[status] ?? undefined}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full border", tone.iconClass)} aria-hidden />
      <span>{legend[status] ?? status}</span>
    </div>
  );
}

function renderCell(column: OnboardingMembersColumn, row: OnboardingMembersOverview["rows"][number]) {
  const value = row.values[column.id];
  switch (column.type) {
    case "avatar":
      return renderAvatarCell(value, column.renderRule);
    case "badge-list":
      return renderBadgeListCell(value, column.renderRule);
    case "number":
      return <span className="text-sm text-foreground">{formatNumber(value, column.renderRule?.suffix as string)}</span>;
    case "date":
      return <span className="text-sm text-foreground">{formatDateValue(value, column.renderRule?.format as string)}</span>;
    case "icon-status":
      return renderIconStatusCell(value, column.renderRule);
    case "list":
      return renderListCell(value, column.renderRule);
    default:
      return renderTextCell(value, column.renderRule);
  }
}

function ColumnControls({
  columns,
  onUpdate,
  onReset,
}: {
  columns: ColumnState[];
  onUpdate: (next: ColumnState[]) => void;
  onReset: () => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const next = [...columns];
    const fromIndex = next.findIndex((col) => col.id === draggedId);
    const toIndex = next.findIndex((col) => col.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    onUpdate(
      next.map((col, index) => ({
        ...col,
        order: index,
      })),
    );
  };

  const handleToggleVisibility = (id: string) => {
    const next = columns.map((col) => (col.id === id ? { ...col, visible: !col.visible } : col));
    onUpdate(next);
  };

  const handleWidthChange = (id: string, value: number | undefined) => {
    const next = columns.map((col) => (col.id === id ? { ...col, width: value } : col));
    onUpdate(next);
  };

  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Spaltensteuerung</CardTitle>
        <p className="text-sm text-muted-foreground">Reihenfolge, Sichtbarkeit und Breite anpassen.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Zurücksetzen
          </Button>
        </div>
        <div className="space-y-3">
          {columns.map((column) => (
            <div
              key={column.id}
              draggable
              onDragStart={() => handleDragStart(column.id)}
              onDragOver={(event) => {
                event.preventDefault();
                handleDragOver(column.id);
              }}
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2"
            >
              <div className="mt-1 text-muted-foreground" aria-hidden>
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{column.label}</p>
                    <p className="text-xs text-muted-foreground">{column.type}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={column.visible !== false ? "secondary" : "outline"}
                    className="gap-2"
                    onClick={() => handleToggleVisibility(column.id)}
                  >
                    {column.visible !== false ? (
                      <>
                        <Eye className="h-4 w-4" aria-hidden />
                        Sichtbar
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" aria-hidden />
                        Ausgeblendet
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Label htmlFor={`width-${column.id}`} className="text-xs text-muted-foreground">
                    Breite
                  </Label>
                  <Input
                    id={`width-${column.id}`}
                    type="number"
                    min={column.minWidth ?? 80}
                    className="h-8 w-24"
                    value={column.width ?? ""}
                    placeholder="auto"
                    onChange={(event) =>
                      handleWidthChange(
                        column.id,
                        event.target.value === "" ? undefined : Number.parseInt(event.target.value, 10),
                      )
                    }
                  />
                  <span className="text-[11px]">px</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MembersOverviewTab({ onboardingId, data }: MembersOverviewTabProps) {
  const [sort, setSort] = useState<SortState | null>(null);
  const initialColumns: ColumnState[] = useMemo(
    () =>
      data.columns.map((column, index) => ({
        ...column,
        visible: column.visible ?? true,
        order: index,
      })),
    [data.columns],
  );
  const [columns, setColumns] = usePersistedColumns(onboardingId, initialColumns);

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible !== false).sort((a, b) => a.order - b.order),
    [columns],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return data.rows;
    const column = columns.find((col) => col.id === sort.columnId);
    if (!column) return data.rows;
    const sorted = [...data.rows].sort((a, b) => {
      const aValue = a.values[column.id];
      const bValue = b.values[column.id];
      if (column.type === "number") {
        const aNum = typeof aValue === "number" ? aValue : -Infinity;
        const bNum = typeof bValue === "number" ? bValue : -Infinity;
        return aNum - bNum;
      }
      if (column.type === "date") {
        const aDateValue =
          aValue instanceof Date ? aValue : typeof aValue === "string" ? new Date(aValue) : null;
        const bDateValue =
          bValue instanceof Date ? bValue : typeof bValue === "string" ? new Date(bValue) : null;
        const aDate = aDateValue && !Number.isNaN(aDateValue.getTime()) ? aDateValue.getTime() : 0;
        const bDate = bDateValue && !Number.isNaN(bDateValue.getTime()) ? bDateValue.getTime() : 0;
        return aDate - bDate;
      }
      const aStr = typeof aValue === "string" ? aValue : Array.isArray(aValue) ? aValue.join(", ") : "";
      const bStr = typeof bValue === "string" ? bValue : Array.isArray(bValue) ? bValue.join(", ") : "";
      return aStr.localeCompare(bStr, "de", { sensitivity: "base" });
    });
    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [columns, data.rows, sort]);

  const toggleSort = (columnId: string) => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  };

  const handleReset = () => {
    setSort(null);
    setColumns(initialColumns);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="flex flex-col gap-2 border-b border-border/70 pb-4">
          <CardTitle className="text-lg">Mitgliederübersicht</CardTitle>
          <p className="text-sm text-muted-foreground">
            Datengetriebene Tabelle mit dynamischen Spalten, Filtern und Exportfähigkeit.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-medium text-foreground">
              {data.rows.length} Mitglieder
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">Spalten anpassbar</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">Drag & Drop</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border/70">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={cn(
                        "h-11 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                        column.sortable ? "cursor-pointer select-none" : "",
                        getPriorityClassName(column.priority),
                      )}
                      style={{
                        width: column.width ? `${column.width}px` : undefined,
                        minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                      }}
                      onClick={() => column.sortable && toggleSort(column.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span>{column.label}</span>
                        {sort?.columnId === column.id ? (
                          <span className="text-[10px] text-foreground">{sort.direction === "asc" ? "↑" : "↓"}</span>
                        ) : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Keine Mitglieder gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row) => (
                    <TableRow key={row.id} className="border-b border-border/50 hover:bg-muted/40">
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={`${row.id}-${column.id}`}
                          className={cn("px-3 align-top", getPriorityClassName(column.priority))}
                          style={{
                            width: column.width ? `${column.width}px` : undefined,
                            minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                          }}
                        >
                          {renderCell(column, row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <ColumnControls columns={columns} onUpdate={setColumns} onReset={handleReset} />
    </div>
  );
}
