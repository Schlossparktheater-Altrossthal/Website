import { dayKeyOf } from "@/lib/regie/data-format";

/**
 * Zeitraum der Regie-Verfügbarkeit (Ansicht + PDF): Kerntage, ganze Wochen oder nur Tage mit
 * eingetragenem Termin – jeweils für die nächsten `weeks` Kalenderwochen (inkl. der laufenden).
 */
export const AVAILABILITY_MODES = ["kerntage", "wochen", "termine"] as const;
export type AvailabilityMode = (typeof AVAILABILITY_MODES)[number];

export const AVAILABILITY_MODE_LABELS: Record<AvailabilityMode, string> = {
  kerntage: "Kerntage",
  wochen: "Ganze Wochen",
  termine: "Termintage",
};

export const AVAILABILITY_MODE_HINTS: Record<AvailabilityMode, string> = {
  kerntage: "Nur die üblichen Probentage (z. B. Wochenende) und die Endprobenwoche",
  wochen: "Jeder Tag, Montag bis Sonntag",
  termine: "Nur Tage, an denen ein Termin eingetragen ist",
};

export const AVAILABILITY_WEEK_OPTIONS = [1, 2, 4, 8] as const;
export const DEFAULT_AVAILABILITY_MODE: AvailabilityMode = "kerntage";
export const DEFAULT_AVAILABILITY_WEEKS = 2;

export type AvailabilityRange = { mode: AvailabilityMode; weeks: number };

/** `?ansicht=…&wochen=…` → gültiger Zeitraum (unbekannte Werte → Vorgabe). */
export function parseAvailabilityRange(
  mode: string | null | undefined,
  weeks: string | null | undefined,
): AvailabilityRange {
  const parsedWeeks = Number(weeks);
  return {
    mode: (AVAILABILITY_MODES as readonly string[]).includes(mode ?? "")
      ? (mode as AvailabilityMode)
      : DEFAULT_AVAILABILITY_MODE,
    weeks:
      Number.isInteger(parsedWeeks) && parsedWeeks >= 1 && parsedWeeks <= 12
        ? parsedWeeks
        : DEFAULT_AVAILABILITY_WEEKS,
  };
}

export const availabilityQuery = ({ mode, weeks }: AvailabilityRange) =>
  `ansicht=${mode}&wochen=${weeks}`;

export function describeAvailabilityRange({ mode, weeks }: AvailabilityRange) {
  const span = weeks === 1 ? "diese Woche" : `nächste ${weeks} Wochen`;
  return `${AVAILABILITY_MODE_LABELS[mode]}, ${span}`;
}

const noon = (key: string) => new Date(`${key}T12:00:00Z`);
const addDaysKey = (key: string, days: number) => {
  const date = noon(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const weekdayOfKey = (key: string) => noon(key).getUTCDay();

export type FinalWeek = { start: string; end: string | null } | null;

export function isFinalWeekKey(key: string, finalWeek: FinalWeek) {
  if (!finalWeek) return false;
  return key >= finalWeek.start && key <= (finalWeek.end ?? addDaysKey(finalWeek.start, 6));
}

/**
 * Tage des Zeitraums (yyyy-MM-dd, aufsteigend). Beginnt heute und endet am Sonntag der
 * `weeks`-ten Kalenderwoche – vergangene Tage der laufenden Woche fallen weg.
 */
export function availabilityDayKeys(
  { mode, weeks }: AvailabilityRange,
  context: {
    today?: Date;
    preferredWeekdays: readonly number[];
    finalWeek: FinalWeek;
    eventDayKeys: ReadonlySet<string>;
  },
) {
  const today = dayKeyOf(context.today ?? new Date());
  const toSunday = (7 - weekdayOfKey(today)) % 7;
  const last = addDaysKey(today, toSunday + (weeks - 1) * 7);
  const keys: string[] = [];
  for (let key = today; key <= last; key = addDaysKey(key, 1)) keys.push(key);

  const preferred = new Set(context.preferredWeekdays);
  if (mode === "kerntage") {
    return keys.filter(
      (key) => preferred.has(weekdayOfKey(key)) || isFinalWeekKey(key, context.finalWeek),
    );
  }
  if (mode === "termine") return keys.filter((key) => context.eventDayKeys.has(key));
  return keys;
}
