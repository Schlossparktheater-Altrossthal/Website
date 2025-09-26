export type BackgroundMatcherGroup = readonly string[];

export interface BackgroundTag {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly requiresClass: boolean;
  readonly matchers: readonly BackgroundMatcherGroup[];
  readonly classLabel?: string;
  readonly classHelper?: string;
  readonly classPlaceholder?: string;
  readonly classRequiredError?: string;
  readonly getClassSuggestions?: () => readonly string[];
}

export function normalizeBackgroundLabel(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function createBszClassSuggestions() {
  const now = new Date();
  const relevantYears = [-1, 0, 1]
    .map((offset) => now.getFullYear() + offset)
    .filter((year) => year >= 2000 && year <= 2100)
    .map((year) => String(year % 100).padStart(2, "0"));

  const suggestions: string[] = [];
  const pushUnique = (value: string) => {
    if (!suggestions.includes(value)) {
      suggestions.push(value);
    }
  };

  for (const year of relevantYears) {
    for (const suffix of ["A", "B", "C"]) {
      pushUnique(`BFS ${year}${suffix}`);
    }
    pushUnique(`FO ${year}`);
    pushUnique(`BG ${year}`);
  }

  ["BG 11", "BG 12", "BG 13", "FO 11", "FO 12", "BVJ", "BVJ+", "Berufsvorbereitung"].forEach(pushUnique);

  return suggestions;
}

export const BACKGROUND_TAGS: readonly BackgroundTag[] = [
  {
    id: "bsz-altrossthal",
    label: "BSZ Altroßthal / Canaletto",
    value: "BSZ Altroßthal – Berufsschule",
    requiresClass: true,
    matchers: [
      ["bsz"],
      ["altrossthal", "altrothal", "canaletto"],
    ],
    classLabel: "Welche Klasse besuchst du am BSZ Altroßthal/Canaletto?",
    classHelper: "Damit können wir dich deinem Jahrgang zuordnen.",
    classPlaceholder: "z.B. BFS 23A",
    classRequiredError: "Bitte gib deine Klasse am BSZ Altroßthal an.",
    getClassSuggestions: createBszClassSuggestions,
  },
  {
    id: "bsz-agrar",
    label: "BSZ für Agrarwirtschaft & Ernährung",
    value: "BSZ für Agrarwirtschaft und Ernährung Dresden",
    requiresClass: true,
    matchers: [
      ["bsz"],
      ["agrarwirtschaft", "agrar", "ernaehrung", "ernahrung"],
    ],
    classLabel: "Welche Klasse besuchst du am BSZ für Agrarwirtschaft und Ernährung?",
    classHelper: "Hilft uns bei der Zuordnung zu Jahrgängen und Ausbildungszweigen.",
    classPlaceholder: "z.B. BG 12",
    classRequiredError: "Bitte trag deine Klasse am BSZ für Agrarwirtschaft ein.",
  },
];

export function findMatchingBackgroundTag(value: string) {
  if (!value) return null;
  const normalized = normalizeBackgroundLabel(value);
  if (!normalized) return null;
  for (const tag of BACKGROUND_TAGS) {
    const matches = tag.matchers.every((group) =>
      group.some((keyword) => normalized.includes(keyword)),
    );
    if (matches) {
      return tag;
    }
  }
  return null;
}
