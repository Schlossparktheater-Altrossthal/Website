export const TECH_CATEGORY_VALUES = [
  "light",
  "sound",
  "network",
  "video",
  "instruments",
  "cables",
  "cases",
  "accessories",
] as const;

export const TECH_INVENTORY_CATEGORIES = [
  {
    value: TECH_CATEGORY_VALUES[0],
    label: "Licht",
    prefix: "L",
    description:
      "Scheinwerfer, Dimmer, Lichtpulte und Zubehör für die Ausleuchtung der Bühne.",
  },
  {
    value: TECH_CATEGORY_VALUES[1],
    label: "Ton",
    prefix: "T",
    description:
      "Mikrofone, Lautsprecher, Mischpulte und Outboard-Equipment für den perfekten Klang.",
  },
  {
    value: TECH_CATEGORY_VALUES[2],
    label: "Netzwerk",
    prefix: "N",
    description:
      "Switches, Router, Access Points und alles für stabile Verbindungen im Haus.",
  },
  {
    value: TECH_CATEGORY_VALUES[3],
    label: "Video",
    prefix: "V",
    description:
      "Kameras, Projektoren, Bildmischer und Playback-Systeme für visuelle Effekte.",
  },
  {
    value: TECH_CATEGORY_VALUES[4],
    label: "Instrumente",
    prefix: "I",
    description:
      "Instrumente, Verstärker und Zubehör für Orchestergraben und Bandproben.",
  },
  {
    value: TECH_CATEGORY_VALUES[5],
    label: "Kabel",
    prefix: "K",
    description:
      "Strom-, Audio-, Daten- und Spezialkabel inklusive Adapter und Verbindungen.",
  },
  {
    value: TECH_CATEGORY_VALUES[6],
    label: "Cases",
    prefix: "C",
    description:
      "Flightcases, Taschen und Transportlösungen für sicheres Equipment-Handling.",
  },
  {
    value: TECH_CATEGORY_VALUES[7],
    label: "Zubehör",
    prefix: "Z",
    description:
      "Werkzeuge, Verbrauchsmaterial, Ersatzteile und sonstige Helferlein.",
  },
] as const;

export type TechnikInventoryCategory =
  (typeof TECH_INVENTORY_CATEGORIES)[number]["value"];

export const TECH_CATEGORY_PREFIX: Record<TechnikInventoryCategory, string> =
  TECH_INVENTORY_CATEGORIES.reduce(
    (acc, entry) => ({ ...acc, [entry.value]: entry.prefix }),
    {} as Record<TechnikInventoryCategory, string>,
  );

export const TECH_CATEGORY_LABEL: Record<TechnikInventoryCategory, string> =
  TECH_INVENTORY_CATEGORIES.reduce(
    (acc, entry) => ({ ...acc, [entry.value]: entry.label }),
    {} as Record<TechnikInventoryCategory, string>,
  );
