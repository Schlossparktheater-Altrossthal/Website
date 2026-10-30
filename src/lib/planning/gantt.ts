import { fromDay } from "@/lib/planning/schedule";

/**
 * Reine Berechnungen der Gantt-Ansicht im Produktionsplan (docs/Plan/zeitleiste-gantt-plan.md):
 * Zeilen, Zeitspannen, Zeitachse und Abhängigkeitslinien. Tage sind UTC-Tageszahlen (`toDay`).
 */

export type GanttZoom = "week" | "month" | "quarter";

export const GANTT_PX_PER_DAY: Record<GanttZoom, number> = { week: 26, month: 6, quarter: 2.2 };

export type GanttMilestoneInput = {
  id: string;
  title: string;
  dueDay: number | null;
  durationDays: number;
  done: boolean;
  departmentId: string | null;
  tasks: { id: string; title: string; dueDay: number | null; done: boolean }[];
};

export type GanttGroup = { id: string; name: string; color: string | null };

export type GanttRow =
  | {
      type: "group";
      key: string;
      group: GanttGroup;
      count: number;
      collapsed: boolean;
      span: { start: number; end: number } | null;
    }
  | { type: "milestone"; key: string; id: string; groupId: string; start: number; end: number }
  | {
      type: "task";
      key: string;
      id: string;
      milestoneId: string;
      title: string;
      day: number | null;
      done: boolean;
    };

/** Gruppen-ID für Meilensteine ohne Gewerk. */
export const NO_DEPARTMENT = "__none";

/** Balken von Beginn (Frist − Dauer) bis Frist, beide Tage eingeschlossen. */
export function milestoneSpan(dueDay: number, durationDays: number) {
  return { start: dueDay - Math.max(0, durationDays), end: dueDay };
}

/**
 * Eine Zeile je Meilenstein, gruppiert nach Gewerk (Reihenfolge der Gewerke, „Produktion“ zuletzt).
 * Eingeklappte Gruppen zeigen nur ihren Sammelbalken; aufgeklappte Meilensteine ihre Karten.
 */
export function buildGanttRows(
  milestones: GanttMilestoneInput[],
  groups: GanttGroup[],
  options: {
    collapsed: ReadonlySet<string>;
    expanded: ReadonlySet<string>;
    onlyOpen?: boolean;
    groupFilter?: string | null;
  },
): GanttRow[] {
  const visible = milestones.filter(
    (milestone) =>
      milestone.dueDay !== null &&
      (!options.onlyOpen || !milestone.done) &&
      (!options.groupFilter || (milestone.departmentId ?? NO_DEPARTMENT) === options.groupFilter),
  );
  const ordered = [...groups, { id: NO_DEPARTMENT, name: "Produktion", color: null }];
  const rows: GanttRow[] = [];
  for (const group of ordered) {
    const members = visible
      .filter((milestone) => (milestone.departmentId ?? NO_DEPARTMENT) === group.id)
      .map((milestone) => ({
        milestone,
        ...milestoneSpan(milestone.dueDay as number, milestone.durationDays),
      }))
      .sort((a, b) => a.end - b.end || a.start - b.start);
    if (!members.length) continue;
    const collapsed = options.collapsed.has(group.id);
    rows.push({
      type: "group",
      key: `g:${group.id}`,
      group,
      count: members.length,
      collapsed,
      span: {
        start: Math.min(...members.map((entry) => entry.start)),
        end: Math.max(...members.map((entry) => entry.end)),
      },
    });
    if (collapsed) continue;
    for (const { milestone, start, end } of members) {
      rows.push({
        type: "milestone",
        key: `m:${milestone.id}`,
        id: milestone.id,
        groupId: group.id,
        start,
        end,
      });
      if (!options.expanded.has(milestone.id)) continue;
      for (const task of milestone.tasks) {
        rows.push({
          type: "task",
          key: `t:${task.id}`,
          id: task.id,
          milestoneId: milestone.id,
          title: task.title,
          day: task.dueDay,
          done: task.done,
        });
      }
    }
  }
  return rows;
}

const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export type AxisCell = { start: number; end: number; label: string };

/** ISO-Kalenderwoche eines UTC-Tages. */
export function isoWeek(day: number): number {
  const date = fromDay(day);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** Montag der Woche des Tages. */
export function mondayOf(day: number): number {
  return day - ((fromDay(day).getUTCDay() + 6) % 7);
}

function monthCells(start: number, end: number, format: (date: Date) => string): AxisCell[] {
  const cells: AxisCell[] = [];
  const cursor = fromDay(start);
  cursor.setUTCDate(1);
  while (Math.round(cursor.getTime() / 86_400_000) <= end) {
    const from = Math.round(cursor.getTime() / 86_400_000);
    const label = format(cursor);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    const to = Math.round(cursor.getTime() / 86_400_000);
    cells.push({ start: Math.max(from, start), end: Math.min(to, end + 1), label });
  }
  return cells;
}

function yearCells(start: number, end: number): AxisCell[] {
  const cells: AxisCell[] = [];
  for (let year = fromDay(start).getUTCFullYear(); ; year += 1) {
    const from = Math.round(Date.UTC(year, 0, 1) / 86_400_000);
    if (from > end) break;
    const to = Math.round(Date.UTC(year + 1, 0, 1) / 86_400_000);
    cells.push({ start: Math.max(from, start), end: Math.min(to, end + 1), label: String(year) });
  }
  return cells;
}

/** Zweistufige Zeitachse: oben Jahr bzw. Monat, unten Monat bzw. Kalenderwoche. */
export function buildAxis(start: number, end: number, zoom: GanttZoom) {
  if (zoom === "week") {
    const bottom: AxisCell[] = [];
    for (let day = mondayOf(start); day <= end; day += 7) {
      bottom.push({
        start: Math.max(day, start),
        end: Math.min(day + 7, end + 1),
        label: `KW ${isoWeek(day)}`,
      });
    }
    return { top: monthCells(start, end, (date) => MONTH_LONG.format(date)), bottom };
  }
  return {
    top: yearCells(start, end),
    bottom: monthCells(start, end, (date) =>
      zoom === "quarter" ? MONTH.format(date).slice(0, 3) : MONTH.format(date),
    ),
  };
}

/** Proben je Woche (Montag → Anzahl) für das Dichte-Band unter der Achse. */
export function weeklyDensity(days: number[]): Map<number, number> {
  const weeks = new Map<number, number>();
  for (const day of days) {
    const monday = mondayOf(day);
    weeks.set(monday, (weeks.get(monday) ?? 0) + 1);
  }
  return weeks;
}

/**
 * Rechtwinklige Abhängigkeitslinie vom Ende des Vorgängers zum Beginn des Nachfolgers. Liegt
 * der Beginn links vom Ende, läuft die Linie in der Zeilenfuge zurück.
 */
export function dependencyPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rowHeight: number,
): string {
  const gap = 8;
  const exitX = from.x + gap;
  if (to.x - gap >= exitX) {
    return `M${from.x},${from.y} H${exitX} V${to.y} H${to.x}`;
  }
  const midY = to.y > from.y ? from.y + rowHeight / 2 : from.y - rowHeight / 2;
  return `M${from.x},${from.y} H${exitX} V${midY} H${to.x - gap} V${to.y} H${to.x}`;
}
