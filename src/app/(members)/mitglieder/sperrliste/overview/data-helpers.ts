/**
 * Data-Helfer für Sperrlistenübersicht
 * Bucket- und Holiday-Span-Logik für alle Views
 */

import type { DayColumn, HolidayIndicator, OverviewPerson, OverviewPersonDay } from "./types";

// ============================================================================
// Types
// ============================================================================

export type DayBucketEntry = {
  person: OverviewPerson;
  cell: OverviewPersonDay;
};

export type DayBucket = {
  column: DayColumn;
  available: DayBucketEntry[];
  limited: DayBucketEntry[];
  blocked: DayBucketEntry[];
  holiday: HolidayIndicator | null;
  holidayLabel?: string;
  holidayType?: "holiday" | "vacation";
  isPublicHoliday: boolean;
};

export type HolidaySpan = {
  start: number;
  end: number;
  label?: string;
  hasPublicHoliday: boolean;
};

// ============================================================================
// selectDayBuckets - Personen nach Tagen gruppieren
// ============================================================================

/**
 * Gruppiert Personen nach Tagen und kategorisiert sie nach Verfügbarkeit
 *
 * @param people - Liste der Personen mit ihren Tagesangaben
 * @param dayCols - Spalten-Definitionen der Tage
 * @param holidays - Ferien- und Feiertags-Indikatoren
 * @returns Array von DayBuckets mit gruppierten Personen
 */
export function selectDayBuckets(
  people: OverviewPerson[],
  dayCols: DayColumn[],
  holidays: HolidayIndicator[],
): DayBucket[] {
  return dayCols.map((column, index) => {
    // Alle Personen mit ihren Zellen für diesen Tag
    const entries: DayBucketEntry[] = people.map((person) => ({
      person,
      cell: person.days[index],
    }));

    // Verfügbare Personen (bevorzugt oder frei)
    // Sortiert: Bevorzugt zuerst, dann alphabetisch
    const available = entries
      .filter((e) => e.cell.type === "preferred" || e.cell.type === "free")
      .sort((a, b) => {
        if (a.cell.type === b.cell.type) {
          return a.person.name.localeCompare(b.person.name);
        }
        return a.cell.type === "preferred" ? -1 : 1;
      });

    // Eingeschränkt verfügbare Personen
    const limited = entries
      .filter((e) => e.cell.type === "limited")
      .sort((a, b) => a.person.name.localeCompare(b.person.name));

    // Gesperrte Personen
    const blocked = entries
      .filter((e) => e.cell.type === "block")
      .sort((a, b) => a.person.name.localeCompare(b.person.name));

    // Holiday-Info für diesen Tag
    const holidayInfo = holidays.find((h) => h.dayIndex === index);

    return {
      column,
      available,
      limited,
      blocked,
      holiday: holidayInfo ?? null,
      holidayLabel: holidayInfo?.label,
      holidayType: holidayInfo?.type,
      isPublicHoliday: holidayInfo?.isPublicHoliday ?? false,
    };
  });
}

// ============================================================================
// getHolidaySpans - Zusammenhängende Ferien-Zeiträume finden
// ============================================================================

/**
 * Findet zusammenhängende Ferien-Zeiträume für colSpan-Berechnung
 *
 * @param dayCols - Spalten-Definitionen der Tage
 * @param buckets - Day-Buckets mit Holiday-Informationen
 * @returns Array von HolidaySpans mit Start/End-Indizes
 */
export function getHolidaySpans(dayCols: DayColumn[], buckets: DayBucket[]): HolidaySpan[] {
  const spans: HolidaySpan[] = [];
  let currentSpan: HolidaySpan | null = null;

  buckets.forEach((bucket, idx) => {
    // Nur Ferien (vacation), keine einzelnen Feiertage
    if (bucket.holiday && bucket.holidayType === "vacation") {
      if (!currentSpan) {
        // Neuen Span beginnen
        currentSpan = {
          start: idx,
          end: idx,
          label: bucket.holidayLabel,
          hasPublicHoliday: bucket.isPublicHoliday,
        };
      } else {
        // Bestehenden Span erweitern
        currentSpan.end = idx;
        if (bucket.isPublicHoliday) {
          currentSpan.hasPublicHoliday = true;
        }
      }
    } else {
      // Span beenden wenn vorhanden
      if (currentSpan) {
        spans.push(currentSpan);
        currentSpan = null;
      }
    }
  });

  // Letzten Span hinzufügen falls vorhanden
  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}

// ============================================================================
// calculateAvailability - Verfügbarkeits-Prozentsatz berechnen
// ============================================================================

/**
 * Berechnet den Verfügbarkeits-Prozentsatz für einen Tag
 *
 * @param bucket - Day-Bucket mit gruppierten Personen
 * @returns Prozentsatz der verfügbaren Personen (0-100)
 */
export function calculateAvailability(bucket: DayBucket): number {
  const totalCount = bucket.available.length + bucket.limited.length + bucket.blocked.length;
  if (totalCount === 0) return 0;
  return Math.round((bucket.available.length / totalCount) * 100);
}

// ============================================================================
// Gruppen-Helfer
// ============================================================================

/**
 * Gruppiert Personen nach ihrer Gruppe (actors/crew/both/other)
 */
export function groupPeopleByType(people: OverviewPerson[]) {
  return {
    actors: people.filter((p) => p.group === "actors"),
    crew: people.filter((p) => p.group === "crew"),
    both: people.filter((p) => p.group === "both"),
    other: people.filter((p) => p.group === "other"),
  };
}

/**
 * Zählt Personen pro Gruppe
 */
export function countByGroup(people: OverviewPerson[]) {
  return people.reduce(
    (acc, person) => {
      acc.total += 1;
      if (person.group === "actors") acc.actors += 1;
      else if (person.group === "crew") acc.crew += 1;
      else if (person.group === "both") acc.both += 1;
      else acc.other += 1;
      return acc;
    },
    { total: 0, actors: 0, crew: 0, both: 0, other: 0 },
  );
}
