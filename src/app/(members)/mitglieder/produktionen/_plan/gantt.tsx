"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { HEALTH_DOT, HEALTH_FILL } from "@/components/production/deadline-health";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GANTT_PX_PER_DAY,
  NO_DEPARTMENT,
  buildAxis,
  buildGanttRows,
  dependencyPath,
  milestoneSpan,
  weeklyDensity,
  type GanttRow,
  type GanttZoom,
} from "@/lib/planning/gantt";
import type { MilestoneHealth } from "@/lib/planning/schedule";
import type { PlanMilestone, ProductionPlan } from "@/lib/planning/plan-service";
import { computeDueDates, fromDay, toDay } from "@/lib/planning/schedule";
import { cn } from "@/lib/utils";

import { DAY_FORMAT, SHORT_DAY_FORMAT } from "./format";

/** Verschiebung aus der Zeitleiste: Frist um `deltaDays`, Dauer um `durationDelta`. */
export type TimelineMove = { id: string; deltaDays: number; durationDelta: number };

export type GanttCreate = { departmentId: string | null; dueDate: string; durationDays: number };

export type GanttHoliday = { start: number; end: number; title: string };

type Zoom = GanttZoom | "fit";

const HEADER_HEIGHT = 44;
const BAND_HEIGHT = 22;
const TOP = HEADER_HEIGHT + BAND_HEIGHT;
const ROW_HEIGHT: Record<GanttRow["type"], number> = { group: 32, milestone: 38, task: 28 };
const BAR_HEIGHT = 18;
const ZOOM_STEPS: GanttZoom[] = ["quarter", "month", "week"];

const BAR_BG: Record<MilestoneHealth, string> = {
  ok: "fill-success/25",
  warning: "fill-warning/30",
  critical: "fill-destructive/25",
  overdue: "fill-destructive/25",
  done: "fill-muted-foreground/20",
  unscheduled: "fill-muted-foreground/15",
};

type Drag =
  | { kind: "move" | "start" | "end"; id: string; startX: number; delta: number }
  | { kind: "link"; id: string; x: number; y: number }
  | { kind: "create"; groupId: string; startDay: number; day: number };

const isRed = (milestone: PlanMilestone) =>
  milestone.health === "critical" || milestone.health === "overdue";

/**
 * Gantt-Ansicht des Plans (docs/Plan/zeitleiste-gantt-plan.md): links die Aufgabenliste nach
 * Gewerk, rechts eine Zeile je Meilenstein mit Balken (Beginn bis Frist) oder Raute (Termin).
 * Balken ziehen verschiebt, Kanten ändern die Dauer, Aufziehen in einer Zeile legt an, der Punkt
 * am Balkenende zieht eine Abhängigkeit. Eigene SVG-Umsetzung, keine Gantt-Bibliothek.
 */
export function PlanGantt({
  plan,
  holidays,
  selectedId,
  onSelect,
  onMove,
  onCreate,
  onLink,
}: {
  plan: ProductionPlan;
  holidays: GanttHoliday[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bearbeiten nur mit Planrecht. */
  onMove?: (move: TimelineMove) => void;
  onCreate?: (create: GanttCreate) => void;
  onLink?: (fromId: string, toId: string) => void;
}) {
  const [zoom, setZoom] = React.useState<Zoom>("fit");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [onlyOpen, setOnlyOpen] = React.useState(false);
  const [showCritical, setShowCritical] = React.useState(false);
  const [groupFilter, setGroupFilter] = React.useState<string>("all");
  const [listWidth, setListWidth] = React.useState(260);
  const [viewport, setViewport] = React.useState(800);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const editable = Boolean(onMove);

  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewport(element.clientWidth));
    observer.observe(element);
    setViewport(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const today = toDay(new Date(plan.today));
  const premiere = plan.premiereAt ? toDay(new Date(plan.premiereAt)) : null;
  const finalStart = plan.finalRehearsalStart ? toDay(new Date(plan.finalRehearsalStart)) : null;
  const finalEnd = plan.finalRehearsalEnd ? toDay(new Date(plan.finalRehearsalEnd)) : finalStart;
  const byId = React.useMemo(
    () => new Map(plan.milestones.map((milestone) => [milestone.id, milestone])),
    [plan.milestones],
  );

  const rows = React.useMemo(
    () =>
      buildGanttRows(
        plan.milestones.map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          dueDay: milestone.dueAt ? toDay(new Date(milestone.dueAt)) : null,
          durationDays: milestone.durationDays,
          done: Boolean(milestone.doneAt),
          departmentId: milestone.department?.id ?? null,
          tasks: milestone.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            dueDay: task.dueAt ? toDay(new Date(task.dueAt)) : null,
            done: task.done,
          })),
        })),
        plan.departments,
        {
          collapsed,
          expanded,
          onlyOpen,
          groupFilter: groupFilter === "all" ? null : groupFilter,
        },
      ),
    [plan.milestones, plan.departments, collapsed, expanded, onlyOpen, groupFilter],
  );

  // Zeitraum: alle Balken, heute, Premiere und Endprobenwoche, mit Rand.
  const spanDays = rows.flatMap((row) =>
    row.type === "milestone"
      ? [row.start, row.end]
      : row.type === "task" && row.day !== null
        ? [row.day]
        : [],
  );
  const rangeStart =
    Math.min(today, ...spanDays, ...(premiere !== null ? [premiere - 30] : [])) - 10;
  const rangeEnd =
    Math.max(today + 30, ...spanDays, ...[premiere, finalEnd].filter((day) => day !== null)) + 10;
  const px =
    zoom === "fit"
      ? Math.max(0.5, (viewport - 24) / (rangeEnd - rangeStart + 1))
      : GANTT_PX_PER_DAY[zoom];
  // Rechts Platz für die Beschriftung neben dem letzten Balken.
  const end = zoom === "fit" ? rangeEnd : rangeEnd + Math.ceil(180 / px);
  const start = rangeStart;
  const width = Math.max(viewport, (end - start + 1) * px);
  const x = (day: number) => (day - start) * px;
  const axis = buildAxis(start, end, zoom === "fit" ? (px < 4 ? "quarter" : "month") : zoom);

  // Vorschau beim Ziehen inkl. Folgeverschiebungen über Anker-Ketten.
  const dueShift =
    drag && drag.kind !== "link" && drag.kind !== "create" && drag.kind !== "start"
      ? drag.delta
      : 0;
  const preview = React.useMemo(() => {
    if (!drag || drag.kind === "link" || drag.kind === "create" || !dueShift) return null;
    const moved = plan.milestones.map((milestone) =>
      milestone.id === drag.id
        ? milestone.anchorType === "fixed" && milestone.fixedDate
          ? {
              ...milestone,
              fixedDate: fromDay(toDay(new Date(milestone.fixedDate)) + dueShift).toISOString(),
            }
          : { ...milestone, offsetDays: milestone.offsetDays + dueShift }
        : milestone,
    );
    try {
      return computeDueDates(
        moved.map((milestone) => ({
          id: milestone.id,
          anchorType: milestone.anchorType,
          anchorMilestoneId: milestone.anchorMilestoneId,
          offsetDays: milestone.offsetDays,
          fixedDate: milestone.fixedDate ? new Date(milestone.fixedDate) : null,
        })),
        {
          premiereAt: plan.premiereAt ? new Date(plan.premiereAt) : null,
          finalRehearsalStart: plan.finalRehearsalStart ? new Date(plan.finalRehearsalStart) : null,
        },
      );
    } catch (error) {
      console.error("PlanGantt preview", error);
      return null;
    }
  }, [drag, dueShift, plan]);

  /** Aktuelle Spanne eines Meilensteins inkl. Zieh-Vorschau. */
  const spanOf = (id: string, base: { start: number; end: number }) => {
    const milestone = byId.get(id);
    if (!milestone) return base;
    const previewDate = preview?.get(id);
    const due = previewDate ? toDay(previewDate) : base.end;
    let duration = base.end - base.start;
    if (drag && drag.kind !== "link" && drag.kind !== "create" && drag.id === id) {
      if (drag.kind === "end") duration += drag.delta;
      if (drag.kind === "start") duration -= drag.delta;
    }
    return milestoneSpan(due, Math.max(0, duration));
  };

  // Zeilenpositionen.
  const layout = rows.reduce<{ row: GanttRow; top: number; mid: number }[]>((list, row) => {
    const previous = list.at(-1);
    const top = previous ? previous.top + ROW_HEIGHT[previous.row.type] : TOP;
    list.push({ row, top, mid: top + ROW_HEIGHT[row.type] / 2 });
    return list;
  }, []);
  const lastRow = layout.at(-1);
  const height = lastRow ? lastRow.top + ROW_HEIGHT[lastRow.row.type] : TOP + 48;
  const midById = new Map(
    layout.flatMap((entry) => (entry.row.type === "milestone" ? [[entry.row.id, entry]] : [])),
  );

  // Beim ersten Anzeigen und beim Zoomen auf „heute“ scrollen.
  const scrollToToday = React.useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (today - start) * px - element.clientWidth / 3);
  }, [px, start, today]);
  React.useEffect(() => {
    if (zoom !== "fit") scrollToToday();
  }, [zoom, scrollToToday]);

  // Strg + Mausrad zoomt in Stufen.
  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => {
        const index = ZOOM_STEPS.indexOf(current === "fit" ? "quarter" : current);
        const next = Math.min(
          ZOOM_STEPS.length - 1,
          Math.max(0, index + (event.deltaY < 0 ? 1 : -1)),
        );
        return ZOOM_STEPS[next];
      });
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  const svgPoint = (event: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  const capture = (event: React.PointerEvent) => {
    event.stopPropagation();
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const startBarDrag = (event: React.PointerEvent, id: string, kind: "move" | "start" | "end") => {
    if (!editable || event.button !== 0) return;
    capture(event);
    setDrag({ kind, id, startX: event.clientX, delta: 0 });
  };
  const startLink = (event: React.PointerEvent, id: string) => {
    if (!onLink) return;
    capture(event);
    setDrag({ kind: "link", id, ...svgPoint(event) });
  };
  const startCreate = (event: React.PointerEvent, groupId: string) => {
    if (!onCreate || event.button !== 0) return;
    capture(event);
    const day = start + Math.floor(svgPoint(event).x / px);
    setDrag({ kind: "create", groupId, startDay: day, day });
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    if (drag.kind === "link") {
      setDrag({ ...drag, ...svgPoint(event) });
    } else if (drag.kind === "create") {
      const day = start + Math.floor(svgPoint(event).x / px);
      if (day !== drag.day) setDrag({ ...drag, day });
    } else {
      const milestone = byId.get(drag.id);
      let delta = Math.round((event.clientX - drag.startX) / px);
      // Dauer nie negativ.
      if (milestone && drag.kind === "end") delta = Math.max(-milestone.durationDays, delta);
      if (milestone && drag.kind === "start") delta = Math.min(milestone.durationDays, delta);
      if (delta !== drag.delta) setDrag({ ...drag, delta });
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag(null);
    if (drag.kind === "link") {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-milestone-id]")
        ?.getAttribute("data-milestone-id");
      if (target && target !== drag.id) onLink?.(drag.id, target);
      return;
    }
    if (drag.kind === "create") {
      if (drag.day === drag.startDay) {
        onSelect(null);
        return;
      }
      const from = Math.min(drag.startDay, drag.day);
      const to = Math.max(drag.startDay, drag.day);
      onCreate?.({
        departmentId: drag.groupId === NO_DEPARTMENT ? null : drag.groupId,
        dueDate: fromDay(to).toISOString().slice(0, 10),
        durationDays: to - from,
      });
      return;
    }
    if (drag.delta === 0) {
      onSelect(drag.id);
      return;
    }
    if (drag.kind === "move") onMove?.({ id: drag.id, deltaDays: drag.delta, durationDelta: 0 });
    if (drag.kind === "end") {
      onMove?.({ id: drag.id, deltaDays: drag.delta, durationDelta: drag.delta });
    }
    if (drag.kind === "start") onMove?.({ id: drag.id, deltaDays: 0, durationDelta: -drag.delta });
  };

  const handleBarKey = (event: React.KeyboardEvent, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
      return;
    }
    if (!onMove || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    if (event.shiftKey) {
      const milestone = byId.get(id);
      if (milestone && milestone.durationDays + step >= 0) {
        onMove({ id, deltaDays: 0, durationDelta: step });
      }
    } else {
      onMove({ id, deltaDays: step, durationDelta: 0 });
    }
  };

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startListResize = (event: React.PointerEvent) => {
    const startX = event.clientX;
    const initial = listWidth;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) =>
      setListWidth(Math.min(440, Math.max(160, initial + moveEvent.clientX - startX)));
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  const density = weeklyDensity(plan.rehearsals.map((event) => toDay(new Date(event.start))));
  const maxDensity = Math.max(1, ...density.values());
  const linkFrom = drag?.kind === "link" ? midById.get(drag.id) : null;
  const linkFromMilestone = drag?.kind === "link" ? byId.get(drag.id) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          value={zoom}
          onValueChange={setZoom}
          options={[
            { value: "week", label: "Woche" },
            { value: "month", label: "Monat" },
            { value: "quarter", label: "Quartal" },
            { value: "fit", label: "Alles" },
          ]}
          aria-label="Zoom"
        />
        <Button variant="outline" size="sm" onClick={scrollToToday} disabled={zoom === "fit"}>
          Heute
        </Button>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger aria-label="Gewerk" className="h-9 w-auto min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Gewerke</SelectItem>
            {plan.departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
            <SelectItem value={NO_DEPARTMENT}>Produktion</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={onlyOpen ? "primary" : "outline"}
          size="sm"
          aria-pressed={onlyOpen}
          onClick={() => setOnlyOpen((value) => !value)}
        >
          Nur offene
        </Button>
        <Button
          variant={showCritical ? "primary" : "outline"}
          size="sm"
          aria-pressed={showCritical}
          onClick={() => setShowCritical((value) => !value)}
        >
          Kritischer Pfad
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {editable
          ? "Balken ziehen verschiebt, Kanten ändern die Dauer, in einer Zeile aufziehen legt an, Punkt am Ende auf einen anderen Balken ziehen verknüpft."
          : "Balken antippen für Details."}
      </p>

      <div className="flex overflow-hidden rounded-lg border border-border bg-card">
        {/* Aufgabenliste */}
        <div className="relative shrink-0 border-r border-border" style={{ width: listWidth }}>
          <div
            className="flex items-end justify-between gap-2 border-b border-border px-3 pb-1.5 text-xs font-medium text-muted-foreground"
            style={{ height: TOP }}
          >
            <span>Aufgabe</span>
            <span>Frist</span>
          </div>
          {layout.map(({ row }) => {
            if (row.type === "group") {
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => toggle(setCollapsed, row.group.id)}
                  aria-expanded={!row.collapsed}
                  className="flex w-full items-center gap-1.5 border-b border-border/60 bg-muted/50 px-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  style={{ height: ROW_HEIGHT.group }}
                >
                  {row.collapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {row.group.color ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.group.color }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{row.group.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{row.count}</span>
                </button>
              );
            }
            if (row.type === "task") {
              return (
                <div
                  key={row.key}
                  className="flex items-center gap-2 border-b border-border/40 pl-10 pr-3 text-xs text-muted-foreground"
                  style={{ height: ROW_HEIGHT.task }}
                >
                  <span className={cn("min-w-0 flex-1 truncate", row.done && "line-through")}>
                    {row.title}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {row.day !== null ? SHORT_DAY_FORMAT.format(fromDay(row.day)) : "–"}
                  </span>
                </div>
              );
            }
            const milestone = byId.get(row.id) as PlanMilestone;
            return (
              <div
                key={row.key}
                className={cn(
                  "flex items-center gap-1 border-b border-border/40 pr-3",
                  milestone.id === selectedId && "bg-primary/10",
                )}
                style={{ height: ROW_HEIGHT.milestone }}
              >
                {milestone.tasksTotal ? (
                  <button
                    type="button"
                    onClick={() => toggle(setExpanded, milestone.id)}
                    aria-expanded={expanded.has(milestone.id)}
                    aria-label={`Karten von ${milestone.title}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    {expanded.has(milestone.id) ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                ) : (
                  <span className="w-7 shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(milestone.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", HEALTH_DOT[milestone.health])}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "line-clamp-2 min-w-0 flex-1 text-sm leading-tight",
                      milestone.doneAt && "text-muted-foreground line-through",
                    )}
                  >
                    {milestone.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {SHORT_DAY_FORMAT.format(fromDay(row.end))}
                  </span>
                </button>
              </div>
            );
          })}
          {/* Breite der Liste ziehen */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Breite der Aufgabenliste"
            onPointerDown={startListResize}
            className="absolute inset-y-0 -right-1 w-2 cursor-col-resize hover:bg-primary/20"
          />
        </div>

        {/* Diagramm */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            role="img"
            aria-label="Gantt-Diagramm des Produktionsplans"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDrag(null)}
            className="select-none"
            style={{ touchAction: drag ? "none" : "pan-x pan-y" }}
          >
            <defs>
              <marker
                id="gantt-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground/60" />
              </marker>
              <marker
                id="gantt-arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
              </marker>
              <marker
                id="gantt-arrow-critical"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 z" className="fill-destructive" />
              </marker>
            </defs>

            {/* Gruppenstreifen und Zeilen zum Aufziehen */}
            {layout.map(({ row, top }) => (
              <rect
                key={`bg-${row.key}`}
                x={0}
                y={top}
                width={width}
                height={ROW_HEIGHT[row.type]}
                className={cn(
                  row.type === "group" ? "fill-muted/50" : "fill-transparent",
                  onCreate && row.type !== "task" && "cursor-crosshair",
                )}
                onPointerDown={
                  row.type === "task"
                    ? undefined
                    : (event) =>
                        startCreate(event, row.type === "group" ? row.group.id : row.groupId)
                }
              />
            ))}

            {/* Wochenenden (Wochenzoom) und Ferien */}
            {zoom === "week"
              ? Array.from({ length: end - start + 1 }, (_, index) => start + index)
                  .filter((day) => [0, 6].includes(fromDay(day).getUTCDay()))
                  .map((day) => (
                    <rect
                      key={`we${day}`}
                      x={x(day)}
                      y={TOP}
                      width={px}
                      height={height - TOP}
                      className="pointer-events-none fill-muted/60"
                    />
                  ))
              : null}
            {holidays
              .filter((holiday) => holiday.end >= start && holiday.start <= end)
              .map((holiday) => (
                <g key={`h${holiday.start}-${holiday.title}`}>
                  <rect
                    x={x(Math.max(holiday.start, start))}
                    y={HEADER_HEIGHT}
                    width={(Math.min(holiday.end, end) - Math.max(holiday.start, start) + 1) * px}
                    height={height - HEADER_HEIGHT}
                    className="pointer-events-none fill-warning/10"
                  />
                  <rect
                    x={x(Math.max(holiday.start, start))}
                    y={HEADER_HEIGHT}
                    width={(Math.min(holiday.end, end) - Math.max(holiday.start, start) + 1) * px}
                    height={3}
                    className="fill-warning/50"
                  >
                    <title>{holiday.title}</title>
                  </rect>
                </g>
              ))}

            {/* Zeitachse */}
            {axis.top.map((cell) => (
              <g key={`t${cell.start}`}>
                <line
                  x1={x(cell.start)}
                  x2={x(cell.start)}
                  y1={0}
                  y2={22}
                  className="stroke-border"
                />
                <text
                  x={x(cell.start) + 6}
                  y={15}
                  className="fill-foreground text-[11px] font-medium"
                >
                  {(cell.end - cell.start) * px > 40 ? cell.label : ""}
                </text>
              </g>
            ))}
            {axis.bottom.map((cell) => (
              <g key={`b${cell.start}`}>
                <line
                  x1={x(cell.start)}
                  x2={x(cell.start)}
                  y1={22}
                  y2={height}
                  className="stroke-border/50"
                />
                <text x={x(cell.start) + 4} y={37} className="fill-muted-foreground text-[10px]">
                  {(cell.end - cell.start) * px > 24 ? cell.label : ""}
                </text>
              </g>
            ))}
            <line x1={0} x2={width} y1={22} y2={22} className="stroke-border/60" />
            <line
              x1={0}
              x2={width}
              y1={HEADER_HEIGHT}
              y2={HEADER_HEIGHT}
              className="stroke-border"
            />
            <line x1={0} x2={width} y1={TOP} y2={TOP} className="stroke-border" />

            {/* Band: Proben je Woche, Endprobenwoche */}
            {[...density.entries()].map(([monday, count]) => {
              const barHeight = Math.max(3, (count / maxDensity) * (BAND_HEIGHT - 8));
              return (
                <rect
                  key={`p${monday}`}
                  x={x(monday) + 1}
                  y={TOP - 4 - barHeight}
                  width={Math.max(2, 7 * px - 2)}
                  height={barHeight}
                  rx={1.5}
                  className="fill-info/60"
                >
                  <title>{`${count} ${count === 1 ? "Probe" : "Proben"} ab ${SHORT_DAY_FORMAT.format(fromDay(monday))}`}</title>
                </rect>
              );
            })}
            {finalStart !== null && finalEnd !== null ? (
              <rect
                x={x(finalStart)}
                y={HEADER_HEIGHT}
                width={Math.max(px, (finalEnd - finalStart + 1) * px)}
                height={height - HEADER_HEIGHT}
                className="pointer-events-none fill-info/15"
              >
                <title>Endprobenwoche</title>
              </rect>
            ) : null}

            {/* Sammelbalken der Gruppen */}
            {layout.map(({ row, mid }) =>
              row.type === "group" && row.span ? (
                <rect
                  key={`s${row.key}`}
                  x={x(row.span.start)}
                  y={mid - 3}
                  width={Math.max(4, (row.span.end - row.span.start + 1) * px)}
                  height={6}
                  rx={3}
                  className="pointer-events-none fill-foreground/30"
                />
              ) : null,
            )}

            {/* Abhängigkeiten */}
            {layout.flatMap(({ row, mid }) => {
              if (row.type !== "milestone") return [];
              const milestone = byId.get(row.id) as PlanMilestone;
              return milestone.predecessors.flatMap((dep) => {
                const from = midById.get(dep.fromId);
                const fromMilestone = byId.get(dep.fromId);
                if (!from || from.row.type !== "milestone" || !fromMilestone) return [];
                const a = spanOf(dep.fromId, from.row);
                const b = spanOf(row.id, row);
                const active = selectedId === row.id || selectedId === dep.fromId;
                const critical = showCritical && isRed(fromMilestone) && isRed(milestone);
                const fromX = fromMilestone.durationDays ? x(a.end + 1) : x(a.end) + px / 2 + 7;
                const toX = milestone.durationDays ? x(b.start) : x(b.end) + px / 2 - 7;
                return [
                  <path
                    key={`${dep.fromId}-${row.id}`}
                    d={dependencyPath(
                      { x: fromX, y: from.mid },
                      { x: toX, y: mid },
                      ROW_HEIGHT.milestone,
                    )}
                    fill="none"
                    strokeWidth={active || critical ? 1.75 : 1.25}
                    className={cn(
                      "pointer-events-none",
                      critical
                        ? "stroke-destructive"
                        : active
                          ? "stroke-primary"
                          : "stroke-muted-foreground/35",
                    )}
                    markerEnd={
                      critical
                        ? "url(#gantt-arrow-critical)"
                        : active
                          ? "url(#gantt-arrow-active)"
                          : "url(#gantt-arrow)"
                    }
                  />,
                ];
              });
            })}

            {/* Heute und Premiere */}
            <line
              x1={x(today) + px / 2}
              x2={x(today) + px / 2}
              y1={HEADER_HEIGHT}
              y2={height}
              strokeDasharray="4 3"
              className="pointer-events-none stroke-primary"
            />
            <text
              x={x(today) + px / 2 + 4}
              y={height - 6}
              className="fill-primary text-[10px] font-semibold"
            >
              heute
            </text>
            {premiere !== null ? (
              <g className="pointer-events-none">
                <line
                  x1={x(premiere) + px / 2}
                  x2={x(premiere) + px / 2}
                  y1={HEADER_HEIGHT}
                  y2={height}
                  strokeWidth={2}
                  className="stroke-foreground/70"
                />
                <text
                  x={x(premiere) + px / 2 - 4}
                  y={height - 6}
                  textAnchor="end"
                  className="fill-foreground text-[10px] font-semibold"
                >
                  ★ Premiere {SHORT_DAY_FORMAT.format(fromDay(premiere))}
                </text>
              </g>
            ) : null}

            {/* Karten als Punkte */}
            {layout.map(({ row, mid }) =>
              row.type === "task" && row.day !== null ? (
                <circle
                  key={`c${row.key}`}
                  cx={x(row.day) + px / 2}
                  cy={mid}
                  r={4}
                  className={row.done ? "fill-success" : "fill-muted-foreground/60"}
                >
                  <title>{row.title}</title>
                </circle>
              ) : null,
            )}

            {/* Balken und Rauten */}
            {layout.map(({ row, mid }) => {
              if (row.type !== "milestone") return null;
              const milestone = byId.get(row.id) as PlanMilestone;
              const span = spanOf(row.id, row);
              const selected = milestone.id === selectedId;
              const dragging =
                drag && "id" in drag && drag.id === milestone.id && drag.kind !== "link";
              const shifted =
                preview && preview.get(milestone.id)?.toISOString() !== milestone.dueAt;
              const isPoint = span.end === span.start;
              const left = x(span.start);
              const barWidth = (span.end - span.start + 1) * px;
              const progress = milestone.doneAt
                ? 1
                : milestone.tasksTotal
                  ? milestone.tasksDone / milestone.tasksTotal
                  : 0;
              const labelWidth = milestone.title.length * 6.4 + 12;
              const labelInside = !isPoint && labelWidth < barWidth;
              const centerX = x(span.end) + px / 2;
              const rightEdge = isPoint ? centerX + 8 : left + barWidth;
              const deltaLabel =
                dragging && drag && "delta" in drag && drag.delta
                  ? ` (${drag.delta > 0 ? "+" : ""}${drag.delta} T)`
                  : "";
              return (
                <g
                  key={row.key}
                  data-milestone-id={milestone.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${milestone.title}, ${
                    isPoint ? "" : `${DAY_FORMAT.format(fromDay(span.start))} bis `
                  }${DAY_FORMAT.format(fromDay(span.end))}`}
                  onKeyDown={(event) => handleBarKey(event, milestone.id)}
                  onClick={editable ? undefined : () => onSelect(milestone.id)}
                  className="group outline-none focus-visible:[&_.gantt-shape]:stroke-ring"
                >
                  {isPoint ? (
                    <rect
                      x={centerX - 7}
                      y={mid - 7}
                      width={14}
                      height={14}
                      rx={2}
                      transform={`rotate(45 ${centerX} ${mid})`}
                      strokeWidth={2}
                      className={cn(
                        "gantt-shape",
                        HEALTH_FILL[milestone.health],
                        selected || shifted ? "stroke-primary" : "stroke-transparent",
                        editable
                          ? dragging
                            ? "cursor-grabbing"
                            : "cursor-grab"
                          : "cursor-pointer",
                      )}
                      onPointerDown={(event) => startBarDrag(event, milestone.id, "move")}
                    />
                  ) : (
                    <>
                      <rect
                        x={left}
                        y={mid - BAR_HEIGHT / 2}
                        width={barWidth}
                        height={BAR_HEIGHT}
                        rx={4}
                        strokeWidth={selected || shifted ? 2 : 0}
                        strokeDasharray={shifted ? "3 2" : undefined}
                        className={cn(
                          "gantt-shape stroke-primary",
                          BAR_BG[milestone.health],
                          editable
                            ? dragging
                              ? "cursor-grabbing"
                              : "cursor-grab"
                            : "cursor-pointer",
                        )}
                        onPointerDown={(event) => startBarDrag(event, milestone.id, "move")}
                      />
                      {progress > 0 ? (
                        <rect
                          x={left}
                          y={mid - BAR_HEIGHT / 2}
                          width={barWidth * progress}
                          height={BAR_HEIGHT}
                          rx={4}
                          className={cn("pointer-events-none", HEALTH_FILL[milestone.health])}
                        />
                      ) : null}
                      <rect
                        x={left}
                        y={mid - BAR_HEIGHT / 2}
                        width={4}
                        height={BAR_HEIGHT}
                        rx={2}
                        className={cn("pointer-events-none", HEALTH_FILL[milestone.health])}
                      />
                    </>
                  )}
                  {editable ? (
                    <>
                      {/* Kanten: Dauer ändern */}
                      <rect
                        x={(isPoint ? centerX - 8 : left) - 4}
                        y={mid - BAR_HEIGHT / 2}
                        width={8}
                        height={BAR_HEIGHT}
                        className="cursor-ew-resize fill-transparent"
                        onPointerDown={(event) => startBarDrag(event, milestone.id, "start")}
                      >
                        <title>Beginn ziehen</title>
                      </rect>
                      {!isPoint ? (
                        <rect
                          x={rightEdge - 4}
                          y={mid - BAR_HEIGHT / 2}
                          width={8}
                          height={BAR_HEIGHT}
                          className="cursor-ew-resize fill-transparent"
                          onPointerDown={(event) => startBarDrag(event, milestone.id, "end")}
                        >
                          <title>Frist ziehen</title>
                        </rect>
                      ) : null}
                      {onLink ? (
                        <circle
                          cx={rightEdge + 8}
                          cy={mid}
                          r={5}
                          strokeWidth={1.5}
                          className={cn(
                            "cursor-crosshair fill-card stroke-primary transition-opacity",
                            selected
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                          )}
                          onPointerDown={(event) => startLink(event, milestone.id)}
                        >
                          <title>Auf einen anderen Balken ziehen: Abhängigkeit</title>
                        </circle>
                      ) : null}
                    </>
                  ) : null}
                  <text
                    x={labelInside ? left + 8 : rightEdge + (editable ? 18 : 8)}
                    y={mid + 4}
                    className={cn(
                      "pointer-events-none text-[12px]",
                      milestone.doneAt ? "fill-muted-foreground" : "fill-foreground",
                    )}
                  >
                    {milestone.title}
                    {deltaLabel}
                  </text>
                  <title>{milestone.title}</title>
                </g>
              );
            })}

            {/* Vorschau: Verknüpfen und Aufziehen */}
            {drag?.kind === "link" && linkFrom && linkFromMilestone ? (
              <line
                x1={x(
                  spanOf(
                    drag.id,
                    linkFrom.row.type === "milestone" ? linkFrom.row : { start: 0, end: 0 },
                  ).end + 1,
                )}
                y1={linkFrom.mid}
                x2={drag.x}
                y2={drag.y}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                className="pointer-events-none stroke-primary"
              />
            ) : null}
            {drag?.kind === "create"
              ? (() => {
                  const entry = layout.find(
                    (item) =>
                      (item.row.type === "group" && item.row.group.id === drag.groupId) ||
                      (item.row.type === "milestone" && item.row.groupId === drag.groupId),
                  );
                  const from = Math.min(drag.startDay, drag.day);
                  const to = Math.max(drag.startDay, drag.day);
                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={x(from)}
                        y={(entry?.mid ?? TOP) - BAR_HEIGHT / 2}
                        width={(to - from + 1) * px}
                        height={BAR_HEIGHT}
                        rx={4}
                        strokeDasharray="4 3"
                        className="fill-primary/15 stroke-primary"
                      />
                      <text
                        x={x(to + 1) + 6}
                        y={(entry?.mid ?? TOP) + 4}
                        className="fill-primary text-[11px]"
                      >
                        {`${SHORT_DAY_FORMAT.format(fromDay(from))}–${SHORT_DAY_FORMAT.format(fromDay(to))}`}
                      </text>
                    </g>
                  );
                })()
              : null}
          </svg>
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Keine Einträge für diese Auswahl.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
