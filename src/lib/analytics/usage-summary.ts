import { normalizePerformanceRoute, percentile } from "./performance-samples";

// Nutzungsauswertung aus den Seitenaufrufen (AnalyticsPageView + AnalyticsSession):
// aktive Mitglieder, Besuche, Verweildauer je Seite und Aktivität je Person.

export const USAGE_PERIODS = [7, 30, 90] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

/** Pause, ab der ein neuer Besuch beginnt (übliche Definition in Webanalyse-Tools). */
const VISIT_GAP_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type UsagePageViewRow = {
  path: string;
  createdAt: Date;
  timeOnPageMs: number | null;
  deviceHint: string | null;
  /** Person hinter dem Aufruf (über die Analytics-Sitzung), null bei Gästen */
  userId: string | null;
  /** Fallback-Schlüssel für Besuche ohne Person */
  sessionKey: string | null;
};

export type UsageKpi = { current: number; previous: number };

export type UsageMember = {
  userId: string;
  name: string;
  lastSeen: string;
  visits: number;
  pageViews: number;
  totalTimeMs: number;
  device: string | null;
  topPage: string | null;
};

export type UsagePage = {
  route: string;
  views: number;
  persons: number;
  medianTimeOnPageMs: number | null;
};

export type UsageSummary = {
  days: number;
  kpis: {
    activeMembers: UsageKpi;
    visits: UsageKpi;
    pageViews: UsageKpi;
    medianVisitMs: { current: number | null; previous: number | null };
    mobileShare: { current: number | null; previous: number | null };
  };
  daily: Array<{ date: string; activeMembers: number; pageViews: number }>;
  pages: UsagePage[];
  members: UsageMember[];
  devices: Array<{ device: string; pageViews: number; share: number }>;
};

type Visit = { start: number; end: number };

function visitsOf(rows: UsagePageViewRow[]): Visit[] {
  const byPerson = new Map<string, UsagePageViewRow[]>();
  for (const row of rows) {
    const key = row.userId ?? row.sessionKey;
    if (!key) continue;
    const list = byPerson.get(key);
    if (list) list.push(row);
    else byPerson.set(key, [row]);
  }
  const visits: Visit[] = [];
  for (const list of byPerson.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let current: Visit | null = null;
    for (const row of list) {
      const start = row.createdAt.getTime();
      const end = start + Math.min(row.timeOnPageMs ?? 0, VISIT_GAP_MS);
      if (current && start - current.end <= VISIT_GAP_MS) {
        current.end = Math.max(current.end, end);
      } else {
        current = { start, end };
        visits.push(current);
      }
    }
  }
  return visits;
}

function median(values: number[]): number | null {
  return percentile(
    [...values].sort((a, b) => a - b),
    50,
  );
}

function mobileShare(rows: UsagePageViewRow[]): number | null {
  const known = rows.filter((row) => row.deviceHint);
  if (known.length === 0) return null;
  return (
    known.filter((row) => row.deviceHint === "mobile" || row.deviceHint === "tablet").length /
    known.length
  );
}

function berlinDate(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

function deviceLabel(hint: string | null): string {
  if (hint === "mobile") return "Handy";
  if (hint === "tablet") return "Tablet";
  if (hint === "desktop") return "Desktop";
  return "Unbekannt";
}

function mostFrequent(values: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Erwartet Aufrufe aus dem doppelten Zeitraum (für den Vergleich mit dem Vorzeitraum).
 * Nur Seiten des Mitgliederbereichs werden ausgewertet.
 */
export function summarizeUsage(
  allRows: UsagePageViewRow[],
  days: number,
  now: Date,
  names: Map<string, string>,
): UsageSummary {
  const memberRows = allRows.filter((row) => row.path.startsWith("/mitglieder"));
  const cutoff = now.getTime() - days * DAY_MS;
  const previousCutoff = cutoff - days * DAY_MS;
  const current = memberRows.filter((row) => row.createdAt.getTime() >= cutoff);
  const previous = memberRows.filter((row) => {
    const time = row.createdAt.getTime();
    return time >= previousCutoff && time < cutoff;
  });

  const persons = (rows: UsagePageViewRow[]) =>
    new Set(rows.map((row) => row.userId).filter(Boolean)).size;
  const currentVisits = visitsOf(current);
  const previousVisits = visitsOf(previous);

  // Tagesverlauf mit lückenlosen Tagen
  const daily = new Map<string, { users: Set<string>; pageViews: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    daily.set(berlinDate(new Date(now.getTime() - offset * DAY_MS)), {
      users: new Set(),
      pageViews: 0,
    });
  }
  for (const row of current) {
    const bucket = daily.get(berlinDate(row.createdAt));
    if (!bucket) continue;
    bucket.pageViews += 1;
    if (row.userId) bucket.users.add(row.userId);
  }

  // Seiten
  const pages = new Map<string, UsagePageViewRow[]>();
  for (const row of current) {
    const route = normalizePerformanceRoute(row.path);
    const list = pages.get(route);
    if (list) list.push(row);
    else pages.set(route, [row]);
  }

  // Personen
  const byUser = new Map<string, UsagePageViewRow[]>();
  for (const row of current) {
    if (!row.userId) continue;
    const list = byUser.get(row.userId);
    if (list) list.push(row);
    else byUser.set(row.userId, [row]);
  }

  const deviceCounts = new Map<string, number>();
  for (const row of current) {
    const label = deviceLabel(row.deviceHint);
    deviceCounts.set(label, (deviceCounts.get(label) ?? 0) + 1);
  }

  return {
    days,
    kpis: {
      activeMembers: { current: persons(current), previous: persons(previous) },
      visits: { current: currentVisits.length, previous: previousVisits.length },
      pageViews: { current: current.length, previous: previous.length },
      medianVisitMs: {
        current: median(currentVisits.map((visit) => visit.end - visit.start)),
        previous: median(previousVisits.map((visit) => visit.end - visit.start)),
      },
      mobileShare: { current: mobileShare(current), previous: mobileShare(previous) },
    },
    daily: [...daily.entries()].map(([date, bucket]) => ({
      date,
      activeMembers: bucket.users.size,
      pageViews: bucket.pageViews,
    })),
    pages: [...pages.entries()]
      .map(([route, rows]) => ({
        route,
        views: rows.length,
        persons: persons(rows),
        medianTimeOnPageMs: median(
          rows.map((row) => row.timeOnPageMs).filter((v): v is number => typeof v === "number"),
        ),
      }))
      .sort((a, b) => b.views - a.views),
    members: [...byUser.entries()]
      .map(([userId, rows]) => {
        const visits = visitsOf(rows);
        const lastSeen = Math.max(
          ...rows.map((row) => row.createdAt.getTime() + (row.timeOnPageMs ?? 0)),
        );
        return {
          userId,
          name: names.get(userId) ?? "Unbekannt",
          lastSeen: new Date(lastSeen).toISOString(),
          visits: visits.length,
          pageViews: rows.length,
          totalTimeMs: visits.reduce((sum, visit) => sum + (visit.end - visit.start), 0),
          device: mostFrequent(rows.map((row) => deviceLabel(row.deviceHint))),
          topPage: mostFrequent(rows.map((row) => normalizePerformanceRoute(row.path))),
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    devices: [...deviceCounts.entries()]
      .map(([device, pageViews]) => ({
        device,
        pageViews,
        share: current.length ? pageViews / current.length : 0,
      }))
      .sort((a, b) => b.pageViews - a.pageViews),
  };
}
