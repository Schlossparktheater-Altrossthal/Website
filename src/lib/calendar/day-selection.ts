import { addDays, format } from "date-fns";

/** Tage zwischen zwei Schlüsseln (yyyy-MM-dd), beide eingeschlossen, egal in welcher Reihenfolge. */
export function dayKeysBetween(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const keys: string[] = [];
  for (
    let date = new Date(`${from}T12:00:00`);
    format(date, "yyyy-MM-dd") <= to;
    date = addDays(date, 1)
  ) {
    keys.push(format(date, "yyyy-MM-dd"));
  }
  return keys;
}

/**
 * Zeitraum von `anchor` bis `key` auf eine Ausgangsauswahl anwenden – fortlaufend wie beim
 * Markieren von Text. `remove` wählt den Zeitraum ab (Ziehen begann auf einem gewählten Tag).
 */
export function applyDayRange(
  base: ReadonlySet<string>,
  anchor: string,
  key: string,
  mode: "add" | "remove",
  isSelectable: (key: string) => boolean = () => true,
): Set<string> {
  const next = new Set(base);
  for (const day of dayKeysBetween(anchor, key)) {
    if (!isSelectable(day)) continue;
    if (mode === "add") next.add(day);
    else next.delete(day);
  }
  return next;
}
