"use client";

import * as React from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlanMilestone, ProductionPlan } from "@/lib/planning/plan-service";
import { computeDueDates, fromDay, toDay } from "@/lib/planning/schedule";
import { cn } from "@/lib/utils";

import { HEALTH_FILL } from "@/components/production/deadline-health";
import { MONTH_FORMAT, SHORT_DAY_FORMAT } from "./format";

type Zoom = "month" | "week";

const PX_PER_DAY: Record<Zoom, number> = { month: 4, week: 18 };
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 28;
const LABEL_WIDTH = 132;

type Row = { id: string; label: string; color: string | null };

export type TimelineMove = { id: string; deltaDays: number };

/**
 * Zeitleiste des Plans (docs/Plan/projektplanung-plan.md, „Desktop/Tablet – Zeitleiste“):
 * Zeilen = Gewerke mit Meilensteinen plus „Proben“, Punkte in Ampelfarbe, Pfeile für
 * Abhängigkeiten (kritische Kette rot), Linie „heute“. Eigene SVG-Umsetzung, keine Gantt-Bibliothek.
 */
export function PlanTimeline({
  plan,
  selectedId,
  onSelect,
  onMove,
}: {
  plan: ProductionPlan;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Ziehen eines Punktes – nur mit Planrecht. */
  onMove?: (move: TimelineMove) => void;
}) {
  const [zoom, setZoom] = React.useState<Zoom>("month");
  const [drag, setDrag] = React.useState<{ id: string; startX: number; delta: number } | null>(
    null,
  );
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const px = PX_PER_DAY[zoom];

  const today = toDay(new Date(plan.today));
  const premiere = plan.premiereAt ? toDay(new Date(plan.premiereAt)) : null;
  const scheduled = plan.milestones.filter((milestone) => milestone.dueAt);
  const days = scheduled.map((milestone) => toDay(new Date(milestone.dueAt as string)));
  const rehearsalDays = plan.rehearsals.map((event) => toDay(new Date(event.start)));
  const start = Math.min(today, ...days, ...(premiere !== null ? [premiere - 30] : [])) - 14;
  // Rechts Platz für die Beschriftung des letzten Punktes lassen.
  const end =
    Math.max(today + 30, ...days, ...(premiere !== null ? [premiere] : [])) +
    Math.ceil(170 / PX_PER_DAY[zoom]);
  const width = (end - start) * px;
  const x = (day: number) => (day - start) * px;

  // Vorschau beim Ziehen: Folgeverschiebungen über Anker-Ketten.
  const preview = React.useMemo(() => {
    if (!drag || drag.delta === 0) return null;
    const moved = plan.milestones.map((milestone) =>
      milestone.id === drag.id
        ? milestone.anchorType === "fixed" && milestone.fixedDate
          ? {
              ...milestone,
              fixedDate: fromDay(toDay(new Date(milestone.fixedDate)) + drag.delta).toISOString(),
            }
          : { ...milestone, offsetDays: milestone.offsetDays + drag.delta }
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
      console.error("PlanTimeline preview", error);
      return null;
    }
  }, [drag, plan]);

  const rows: Row[] = [{ id: "__proben", label: "Proben", color: null }];
  const seen = new Set<string>();
  for (const department of plan.departments) {
    if (scheduled.some((milestone) => milestone.department?.id === department.id)) {
      rows.push({ id: department.id, label: department.name, color: department.color });
      seen.add(department.id);
    }
  }
  if (scheduled.some((milestone) => !milestone.department)) {
    rows.push({ id: "__none", label: "Produktion", color: null });
  }
  const rowIndex = (milestone: PlanMilestone) =>
    rows.findIndex((row) => row.id === (milestone.department?.id ?? "__none"));
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT;

  const position = (milestone: PlanMilestone) => {
    const previewDate = preview?.get(milestone.id);
    const day = previewDate ? toDay(previewDate) : toDay(new Date(milestone.dueAt as string));
    return {
      cx: x(day),
      cy: HEADER_HEIGHT + rowIndex(milestone) * ROW_HEIGHT + ROW_HEIGHT / 2,
      day,
    };
  };
  const byId = new Map(scheduled.map((milestone) => [milestone.id, milestone]));

  // Beschriftungen je Zeile: rechts vom Punkt, bei Platzmangel darüber/darunter, sonst nur Tooltip.
  const labelPlacement = new Map<string, "right" | "above" | "below" | "hidden">();
  {
    const byRow = new Map<number, { id: string; cx: number; width: number }[]>();
    for (const milestone of scheduled) {
      const row = rowIndex(milestone);
      byRow.set(row, [
        ...(byRow.get(row) ?? []),
        {
          id: milestone.id,
          cx: x(toDay(new Date(milestone.dueAt as string))),
          width: milestone.title.length * 6.6 + 14,
        },
      ]);
    }
    for (const points of byRow.values()) {
      points.sort((a, b) => a.cx - b.cx);
      let above = -Infinity;
      let below = -Infinity;
      let lastRight = -Infinity;
      points.forEach((point, index) => {
        const next = points[index + 1];
        const fitsRight =
          point.cx - 9 > lastRight && (!next || next.cx - 10 > point.cx + point.width);
        if (fitsRight) {
          labelPlacement.set(point.id, "right");
          lastRight = point.cx + point.width;
          return;
        }
        // Kleinere Schrift darüber/darunter, mittig zum Punkt.
        const half = (point.width * 0.8) / 2;
        if (point.cx - half > above && point.cx - half > lastRight) {
          labelPlacement.set(point.id, "above");
          above = point.cx + half;
        } else if (point.cx - half > below) {
          labelPlacement.set(point.id, "below");
          below = point.cx + half;
        } else {
          labelPlacement.set(point.id, "hidden");
        }
      });
    }
  }
  const isRed = (milestone: PlanMilestone) =>
    milestone.health === "critical" || milestone.health === "overdue";

  // Monatsanfänge als Raster.
  const months: number[] = [];
  const cursor = fromDay(start);
  cursor.setUTCDate(1);
  while (toDay(cursor) <= end) {
    if (toDay(cursor) >= start) months.push(toDay(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const weeks: number[] = [];
  if (zoom === "week") {
    const firstMonday = start + ((8 - (((fromDay(start).getUTCDay() + 6) % 7) + 1)) % 7);
    for (let day = firstMonday; day <= end; day += 7) weeks.push(day);
  }

  // Beim ersten Anzeigen und beim Zoomen auf „heute“ scrollen.
  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (today - start) * px - element.clientWidth / 3);
  }, [px, start, today]);

  const handlePointerDown = (event: React.PointerEvent, id: string) => {
    if (!onMove) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDrag({ id, startX: event.clientX, delta: 0 });
  };
  const handlePointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const delta = Math.round((event.clientX - drag.startX) / px);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  };
  const handlePointerUp = () => {
    if (!drag) return;
    const { id, delta } = drag;
    setDrag(null);
    if (delta === 0) onSelect(id);
    else onMove?.({ id, deltaDays: delta });
  };

  const finalStart = plan.finalRehearsalStart ? toDay(new Date(plan.finalRehearsalStart)) : null;
  const finalEnd = plan.finalRehearsalEnd ? toDay(new Date(plan.finalRehearsalEnd)) : finalStart;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-muted-foreground">
          {onMove
            ? "Punkt antippen für Details, ziehen zum Verschieben."
            : "Punkt antippen für Details."}
        </p>
        <SegmentedControl
          size="sm"
          value={zoom}
          onValueChange={setZoom}
          options={[
            { value: "month", label: "Monat" },
            { value: "week", label: "Woche" },
          ]}
          aria-label="Zoom"
        />
      </div>
      <div className="flex overflow-hidden rounded-lg border border-border bg-card">
        <div className="shrink-0 border-r border-border" style={{ width: LABEL_WIDTH }}>
          <div style={{ height: HEADER_HEIGHT }} className="border-b border-border" />
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2 border-b border-border/60 px-3 text-sm last:border-b-0"
              style={{ height: ROW_HEIGHT }}
            >
              {row.color ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
              ) : null}
              <span className={cn("truncate", row.id === "__proben" && "text-muted-foreground")}>
                {row.label}
              </span>
            </div>
          ))}
        </div>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Zeitleiste des Produktionsplans"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDrag(null)}
            className="select-none"
          >
            <defs>
              <marker
                id="plan-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground/60" />
              </marker>
              <marker
                id="plan-arrow-critical"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" className="fill-destructive" />
              </marker>
            </defs>

            {rows.map((row, index) => (
              <line
                key={row.id}
                x1={0}
                x2={width}
                y1={HEADER_HEIGHT + (index + 1) * ROW_HEIGHT}
                y2={HEADER_HEIGHT + (index + 1) * ROW_HEIGHT}
                className="stroke-border/60"
              />
            ))}
            {weeks.map((day) => (
              <g key={`w${day}`}>
                <line
                  x1={x(day)}
                  x2={x(day)}
                  y1={HEADER_HEIGHT}
                  y2={height}
                  className="stroke-border/40"
                />
                <text x={x(day) + 3} y={11} className="fill-muted-foreground text-[10px]">
                  {SHORT_DAY_FORMAT.format(fromDay(day))}
                </text>
              </g>
            ))}
            {months.map((day) => (
              <g key={`m${day}`}>
                <line x1={x(day)} x2={x(day)} y1={0} y2={height} className="stroke-border" />
                {zoom === "month" ? (
                  <text x={x(day) + 4} y={11} className="fill-muted-foreground text-[11px]">
                    {MONTH_FORMAT.format(fromDay(day))}
                  </text>
                ) : null}
              </g>
            ))}
            <line
              x1={0}
              x2={width}
              y1={HEADER_HEIGHT}
              y2={HEADER_HEIGHT}
              className="stroke-border"
            />

            {/* Proben als Striche, Endprobenwoche als Balken. */}
            {finalStart !== null && finalEnd !== null ? (
              <rect
                x={x(finalStart)}
                y={HEADER_HEIGHT + 12}
                width={Math.max(px, (finalEnd - finalStart + 1) * px)}
                height={ROW_HEIGHT - 24}
                rx={4}
                className="fill-info/40"
              >
                <title>Endprobenwoche</title>
              </rect>
            ) : null}
            {rehearsalDays.map((day, index) => (
              <rect
                key={plan.rehearsals[index].id}
                x={x(day)}
                y={HEADER_HEIGHT + 14}
                width={Math.max(2, px - 1)}
                height={ROW_HEIGHT - 28}
                className="fill-info/70"
              >
                <title>{plan.rehearsals[index].title}</title>
              </rect>
            ))}

            {/* Abhängigkeiten */}
            {scheduled.flatMap((milestone) =>
              milestone.predecessors.map((dep) => {
                const from = byId.get(dep.fromId);
                if (!from) return null;
                const a = position(from);
                const b = position(milestone);
                const critical = isRed(from) && isRed(milestone);
                const mid = (a.cx + b.cx) / 2;
                return (
                  <path
                    key={`${dep.fromId}-${milestone.id}`}
                    d={`M${a.cx + 8},${a.cy} C${mid},${a.cy} ${mid},${b.cy} ${b.cx - 9},${b.cy}`}
                    fill="none"
                    strokeWidth={critical ? 2 : 1.5}
                    className={critical ? "stroke-destructive" : "stroke-muted-foreground/50"}
                    markerEnd={critical ? "url(#plan-arrow-critical)" : "url(#plan-arrow)"}
                  />
                );
              }),
            )}

            {/* Heute und Premiere */}
            <line
              x1={x(today)}
              x2={x(today)}
              y1={0}
              y2={height}
              strokeDasharray="4 3"
              className="stroke-primary"
            />
            <text
              x={x(today) + 4}
              y={HEADER_HEIGHT - 4}
              className="fill-primary text-[10px] font-semibold"
            >
              heute
            </text>
            {premiere !== null ? (
              <g>
                <line
                  x1={x(premiere)}
                  x2={x(premiere)}
                  y1={0}
                  y2={height}
                  strokeWidth={2}
                  className="stroke-foreground/70"
                />
                <text
                  x={x(premiere) - 4}
                  y={HEADER_HEIGHT - 4}
                  textAnchor="end"
                  className="fill-foreground text-[10px] font-semibold"
                >
                  ★ Premiere
                </text>
              </g>
            ) : null}

            {scheduled.map((milestone) => {
              const { cx, cy } = position(milestone);
              const selected = milestone.id === selectedId;
              const dragging = drag?.id === milestone.id;
              const shifted =
                preview && preview.get(milestone.id)?.toISOString() !== milestone.dueAt;
              const shape =
                milestone.kind === "review" ? (
                  <rect
                    x={cx - 7}
                    y={cy - 7}
                    width={14}
                    height={14}
                    transform={`rotate(45 ${cx} ${cy})`}
                    className={HEALTH_FILL[milestone.health]}
                  />
                ) : milestone.kind === "handover" ? (
                  <rect
                    x={cx - 6.5}
                    y={cy - 6.5}
                    width={13}
                    height={13}
                    rx={2}
                    className={HEALTH_FILL[milestone.health]}
                  />
                ) : (
                  <circle cx={cx} cy={cy} r={7} className={HEALTH_FILL[milestone.health]} />
                );
              return (
                <g
                  key={milestone.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${milestone.title}, ${milestone.dueAt ? SHORT_DAY_FORMAT.format(new Date(milestone.dueAt)) : ""}`}
                  onPointerDown={(event) => handlePointerDown(event, milestone.id)}
                  onClick={onMove ? undefined : () => onSelect(milestone.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(milestone.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer outline-none focus-visible:[&>circle]:stroke-ring",
                    onMove && "cursor-grab",
                    dragging && "cursor-grabbing",
                  )}
                >
                  {selected || shifted ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={12}
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray={shifted ? "3 2" : undefined}
                      className="stroke-primary"
                    />
                  ) : null}
                  {shape}
                  <title>{milestone.title}</title>
                  <text
                    {...labelProps(labelPlacement.get(milestone.id) ?? "right", cx, cy, dragging)}
                    className={cn(
                      "text-[12px]",
                      milestone.doneAt ? "fill-muted-foreground" : "fill-foreground",
                    )}
                  >
                    {milestone.title}
                    {dragging && drag.delta ? ` (${drag.delta > 0 ? "+" : ""}${drag.delta} T)` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

function labelProps(
  placement: "right" | "above" | "below" | "hidden",
  cx: number,
  cy: number,
  dragging: boolean,
) {
  // Beim Ziehen immer rechts zeigen, damit die Verschiebung lesbar ist.
  if (dragging || placement === "right") return { x: cx + 12, y: cy + 4 };
  if (placement === "hidden") return { x: cx + 12, y: cy + 4, display: "none" };
  return {
    x: cx,
    y: placement === "above" ? cy - 11 : cy + 19,
    textAnchor: "middle" as const,
    fontSize: 10,
  };
}
