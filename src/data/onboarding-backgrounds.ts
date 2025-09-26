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
}

export function normalizeBackgroundLabel(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

export const BACKGROUND_TAGS: readonly BackgroundTag[] = [
  {
    id: "bsz-altrossthal",
    label: "BSZ Altroßthal",
    value: "BSZ Altroßthal – Berufsschule",
    requiresClass: true,
    matchers: [
      ["bsz"],
      ["altrossthal", "altrothal"],
    ],
    classLabel: "Welche Klasse besuchst du am BSZ Altroßthal?",
    classHelper: "Damit können wir dich deinem Jahrgang zuordnen.",
    classPlaceholder: "z.B. BFS 23A",
    classRequiredError: "Bitte gib deine Klasse am BSZ Altroßthal an.",
  },
  {
    id: "bsz-canaletto",
    label: "BSZ Canaletto",
    value: "BSZ Canaletto – Berufliches Gymnasium",
    requiresClass: true,
    matchers: [
      ["bsz"],
      ["canaletto"],
    ],
    classLabel: "Welche Klasse besuchst du am BSZ Canaletto?",
    classHelper: "Damit können wir dich deinem Jahrgang zuordnen.",
    classPlaceholder: "z.B. BG 12",
    classRequiredError: "Bitte gib deine Klasse am BSZ Canaletto an.",
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
  const schoolKeywords = ["schule", "schul", "bsz"];
  if (schoolKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      id: "school-generic",
      label: "Schule",
      value,
      requiresClass: true,
      matchers: [] as readonly BackgroundMatcherGroup[],
      classLabel: "Welche Klasse besuchst du?",
      classHelper: "Bitte gib deine Klassenbezeichnung an, damit wir dich zuordnen können.",
      classPlaceholder: "z.B. 11/2",
      classRequiredError: "Bitte trag deine Klasse ein.",
    } satisfies BackgroundTag;
  }
  return null;
}
