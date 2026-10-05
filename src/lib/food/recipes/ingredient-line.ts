/**
 * Zerlegt eine Zutatenzeile („200 g Mehl (Type 405)“, „1 ½ EL Öl“, „Salz, nach Belieben“) in
 * Menge, Einheit, Name und Notiz (docs/Plan/rezepte-plan.md). Die Originalzeile bleibt immer
 * erhalten; die Zerlegung ist ein Vorschlag.
 */

export type ParsedIngredientLine = {
  rawText: string;
  amount: number | null;
  /** Bei Bereichen („2–3 Eier“) die Obergrenze. */
  amountMax: number | null;
  unit: IngredientUnit | null;
  name: string;
  note: string | null;
  optional: boolean;
};

export const INGREDIENT_UNITS = {
  g: { label: "g", grams: 1 },
  kg: { label: "kg", grams: 1000 },
  mg: { label: "mg", grams: 0.001 },
  ml: { label: "ml", millilitres: 1 },
  cl: { label: "cl", millilitres: 10 },
  dl: { label: "dl", millilitres: 100 },
  l: { label: "l", millilitres: 1000 },
  tl: { label: "TL", millilitres: 5 },
  el: { label: "EL", millilitres: 15 },
  tasse: { label: "Tasse", millilitres: 200 },
  prise: { label: "Prise", grams: 0.5 },
  msp: { label: "Msp.", grams: 0.5 },
  stueck: { label: "Stück" },
  zehe: { label: "Zehe" },
  scheibe: { label: "Scheibe" },
  bund: { label: "Bund" },
  dose: { label: "Dose" },
  packung: { label: "Packung" },
  becher: { label: "Becher" },
  glas: { label: "Glas" },
  handvoll: { label: "Handvoll" },
  zweig: { label: "Zweig" },
  blatt: { label: "Blatt" },
} as const satisfies Record<string, { label: string; grams?: number; millilitres?: number }>;

export type IngredientUnit = keyof typeof INGREDIENT_UNITS;

/** Schreibweisen → Einheit (klein, ohne Punkt). */
const UNIT_ALIASES: Readonly<Record<string, IngredientUnit>> = {
  g: "g",
  gr: "g",
  gramm: "g",
  kg: "kg",
  kilo: "kg",
  kilogramm: "kg",
  mg: "mg",
  ml: "ml",
  milliliter: "ml",
  cl: "cl",
  dl: "dl",
  l: "l",
  liter: "l",
  tl: "tl",
  teelöffel: "tl",
  teeloeffel: "tl",
  tsp: "tl",
  el: "el",
  esslöffel: "el",
  essloeffel: "el",
  tbsp: "el",
  tasse: "tasse",
  tassen: "tasse",
  cup: "tasse",
  cups: "tasse",
  prise: "prise",
  prisen: "prise",
  msp: "msp",
  messerspitze: "msp",
  stück: "stueck",
  stk: "stueck",
  st: "stueck",
  zehe: "zehe",
  zehen: "zehe",
  scheibe: "scheibe",
  scheiben: "scheibe",
  bund: "bund",
  dose: "dose",
  dosen: "dose",
  packung: "packung",
  packungen: "packung",
  pck: "packung",
  pkg: "packung",
  päckchen: "packung",
  becher: "becher",
  glas: "glas",
  gläser: "glas",
  handvoll: "handvoll",
  zweig: "zweig",
  zweige: "zweig",
  blatt: "blatt",
  blätter: "blatt",
};

const FRACTIONS: Readonly<Record<string, number>> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
};

const OPTIONAL_PATTERN =
  /\b(?:optional|nach belieben|nach geschmack|n\.\s?b\.|evtl\.?|eventuell)\b/i;

/** Ungefähre Mengen ohne Zahl („etwas Salz“) – gehören nicht zum Namen. */
const VAGUE_AMOUNT_PATTERN = /^(?:etwas|einige|ein paar|wenig|viel|reichlich|ca\.?|circa|etwa)\s+/i;

/** Größe und Zustand vor dem Namen („3 große Zwiebeln“, „frischer Basilikum“) → Notiz. */
const DESCRIPTOR_PATTERN =
  /^(?:sehr\s+)?(?:groß|klein|mittelgroß|mittel|frisch|reif|getrocknet|gehackt|gerieben|tiefgekühlt|tk|gekocht|weich|kalt|warm|lauwarm|zimmerwarm)(?:e|er|es|en|em)?\s+/i;

/** Zusätze am Ende („nach Bedarf“, „zum Servieren“) → Notiz. */
const TRAILING_NOTE_PATTERN =
  /\s+((?:nach bedarf|zum\s+\p{L}+|zur\s+\p{L}+|für\s+(?:die|den|das)\s+\p{L}+|aus der dose)\b.*)$/iu;

function stripDescriptors(text: string, notes: string[]): string {
  let rest = text;
  for (;;) {
    const match = DESCRIPTOR_PATTERN.exec(rest);
    if (!match) return rest;
    notes.push(match[0].trim());
    rest = rest.slice(match[0].length);
  }
}

function parseNumber(token: string): number | null {
  const trimmed = token.trim();
  if (trimmed in FRACTIONS) return FRACTIONS[trimmed];
  const mixedUnicode = /^(\d+)\s*([½⅓⅔¼¾⅛])$/.exec(trimmed);
  if (mixedUnicode) return Number(mixedUnicode[1]) + FRACTIONS[mixedUnicode[2]];
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = Number(trimmed.replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
}

const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\s*[½⅓⅔¼¾⅛]|\d+\/\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅛])`;
const AMOUNT_PATTERN = new RegExp(String.raw`^(${NUMBER})(?:\s*(?:-|–|bis)\s*(${NUMBER}))?\s*`);

export function parseIngredientLine(rawText: string): ParsedIngredientLine {
  let rest = rawText.replace(/\s+/g, " ").trim();
  const notes: string[] = [];
  const optional = OPTIONAL_PATTERN.test(rest);

  let amount: number | null = null;
  let amountMax: number | null = null;
  const amountMatch = AMOUNT_PATTERN.exec(rest);
  if (amountMatch) {
    amount = parseNumber(amountMatch[1]);
    amountMax = amountMatch[2] ? parseNumber(amountMatch[2]) : null;
    rest = rest.slice(amountMatch[0].length);
  } else {
    rest = rest.replace(VAGUE_AMOUNT_PATTERN, "");
  }
  rest = stripDescriptors(rest, notes);

  let unit: IngredientUnit | null = null;
  // Einheit direkt an der Zahl („200g“) oder als eigenes Wort, optional mit Punkt.
  const unitMatch = /^([\p{L}]+)\.?(?=\s|$)/u.exec(rest);
  if (unitMatch) {
    const candidate = UNIT_ALIASES[unitMatch[1].toLocaleLowerCase("de-DE")];
    if (candidate) {
      unit = candidate;
      rest = rest.slice(unitMatch[0].length).trim();
    }
  }
  rest = stripDescriptors(rest, notes);
  // Pluralendungen („Zwiebel(n)“, „Ei(er)“) fallen weg, andere Klammern werden zur Notiz.
  rest = rest.replace(/(?<=\p{L})\((?:n|en|e|er|s|nen)\)/gu, "");
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return " ";
  });
  const commaIndex = rest.indexOf(",");
  if (commaIndex >= 0) {
    const after = rest.slice(commaIndex + 1).trim();
    if (after) notes.push(after);
    rest = rest.slice(0, commaIndex);
  }
  rest = rest.replace(/\s+/g, " ").trim();
  const trailing = TRAILING_NOTE_PATTERN.exec(rest);
  if (trailing) {
    notes.push(trailing[1]);
    rest = rest.slice(0, trailing.index);
  }
  const name = rest
    .replace(OPTIONAL_PATTERN, " ")
    .replace(/^bio-?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/^(?:von|vom|der|die|das)\s+/i, "")
    .trim();

  return {
    rawText: rawText.trim(),
    amount,
    amountMax,
    unit,
    name: name || rawText.trim(),
    note: notes.length > 0 ? notes.join(", ") : null,
    optional,
  };
}
