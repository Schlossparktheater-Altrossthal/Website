/** Bausteine einer Blaupause: das Portal eines Gewerks zeigt genau diese Bereiche (Phase 10). */
export const DEPARTMENT_MODULES = [
  { key: "board", label: "Board", description: "Aufgaben als Karten in Spalten.", ready: true },
  {
    key: "events",
    label: "Termine",
    description: "Gewerk-Termine mit Zu- und Absagen.",
    ready: true,
  },
  { key: "files", label: "Dateien", description: "Dokumente und Bilder des Gewerks.", ready: true },
  {
    key: "measurements",
    label: "Körpermaße",
    description: "Maße und Größen des Ensembles (z. B. für Kostüm).",
    ready: true,
  },
  {
    key: "requirements",
    label: "Szenenbedarf",
    description: "Anforderungen aus den Szenen landen im Eingang des Boards.",
    ready: false,
  },
  {
    key: "budget",
    label: "Budget",
    description: "Ausgaben gegen das Gewerksbudget.",
    ready: false,
  },
] as const;

export type DepartmentModuleKey = (typeof DEPARTMENT_MODULES)[number]["key"];

export const DEFAULT_DEPARTMENT_MODULES: DepartmentModuleKey[] = ["board", "events", "files"];

const MODULE_KEYS = new Set<string>(DEPARTMENT_MODULES.map((module) => module.key));

export function isDepartmentModuleKey(value: string): value is DepartmentModuleKey {
  return MODULE_KEYS.has(value);
}

/** Bekannte Bausteine in fester Reihenfolge, Unbekanntes fällt weg. */
export function normalizeModules(values: ReadonlyArray<string>): DepartmentModuleKey[] {
  const set = new Set(values);
  return DEPARTMENT_MODULES.map((module) => module.key).filter((key) => set.has(key));
}
