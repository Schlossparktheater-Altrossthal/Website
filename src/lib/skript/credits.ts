import { z } from "zod";

/**
 * Mitwirkende aus dem Vorspann eines Skripts (Autor, Bühnenfassung, Regie …) und ihre Ablage pro
 * Produktion (docs/Plan/skript-auswertungen-plan.md, Phase 1). Client-sicher: kein Prisma.
 */

export const SCRIPT_CREDIT_KINDS = [
  "basedOn",
  "author",
  "adaptation",
  "direction",
  "other",
] as const;
export type ScriptCreditKind = (typeof SCRIPT_CREDIT_KINDS)[number];

export const SCRIPT_CREDIT_KIND_LABELS: Record<ScriptCreditKind, string> = {
  basedOn: "Vorlage",
  author: "Autor",
  adaptation: "Bühnenfassung/Bearbeitung",
  direction: "Regie",
  other: "Weitere",
};

export const scriptCreditSchema = z.object({
  kind: z.enum(SCRIPT_CREDIT_KINDS),
  /** Bezeichnung wie im Skript („Bühnenfassung“, „nach dem Roman von“, „Regie“). */
  label: z.string().trim().min(1).max(60),
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
});
export type ScriptCredit = z.infer<typeof scriptCreditSchema>;

export const scriptCreditsSchema = z.array(scriptCreditSchema).max(20);

export function readScriptCredits(value: unknown): ScriptCredit[] {
  const parsed = scriptCreditsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

type Keyword = { re: RegExp; kind: ScriptCreditKind };

/** Stichwörter im Vorspann; längere Formen zuerst. Groß-/Kleinschreibung egal. */
const KEYWORDS: Keyword[] = [
  { re: /regieassistenz/iy, kind: "other" },
  { re: /(?:regie|inszenierung|spielleitung)/iy, kind: "direction" },
  {
    re: /(?:bühnenfassung|bühnenbearbeitung|textfassung|spielfassung|dramatisierung|bearbeitung|mitarbeit|fassung)(?:\s+von)?/iy,
    kind: "adaptation",
  },
  { re: /(?:autorin|autor|text|buch|stück)(?:\s+von)?/iy, kind: "author" },
  {
    re: /(?:dramaturgie|musik|choreographie|choreografie|kostüme|kostümbild|bühnenbild|ausstattung)/iy,
    kind: "other",
  },
];

/** „nach (dem Roman | Motiven des Romans …) von“ – höchstens fünf Wörter bis „von“. */
const BASED_ON = /nach(?:\s+(?!von\b)[\p{L}.]+){0,5}?\s+von|nach/iuy;

/** Wörter, an denen eine Namensliste endet (Ort, Stand, Seitenzahl …). */
const STOP = /\s*(?:[–—|·•]|\s-\s|\bstand\b|\bfassung vom\b|\bseite\b|©|\(|\d)/iu;

const PARTICLE = /^(?:von|van|vom|de|der|den|di|da|du|del|le|la|zu|zur|ten|ter|y|bin|al)$/u;

/** Plausibler Personenname: 2–5 Wörter, mindestens zwei großgeschrieben. */
export function isPersonName(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (!/^\p{Lu}/u.test(words[0])) return false;
  let capitalized = 0;
  for (const word of words) {
    if (/^\p{Lu}[\p{L}'’.-]*$/u.test(word)) capitalized++;
    else if (!PARTICLE.test(word)) return false;
  }
  return capitalized >= 2;
}

function splitNames(segment: string) {
  return segment
    .split(/\s*(?:,|;|&|\/|\bund\b|\bsowie\b)\s*/u)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Ist an Position `index` ein Stichwort (am Wortanfang)? */
function keywordAt(text: string, index: number): { kind: ScriptCreditKind; end: number } | null {
  if (index > 0 && /[\p{L}\p{N}]/u.test(text[index - 1])) return null;
  for (const keyword of [{ re: BASED_ON, kind: "basedOn" as const }, ...KEYWORDS]) {
    keyword.re.lastIndex = index;
    const match = keyword.re.exec(text);
    if (!match) continue;
    const end = index + match[0].length;
    // Nur ganze Wörter („Textbuch“, „Regisseur“ sind kein Stichwort).
    if (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) continue;
    return { kind: keyword.kind, end };
  }
  return null;
}

function addCredit(credits: ScriptCredit[], credit: ScriptCredit) {
  const same = credits.find((c) => c.kind === credit.kind && c.label === credit.label);
  if (same) {
    for (const name of credit.names) if (!same.names.includes(name)) same.names.push(name);
  } else credits.push(credit);
}

/**
 * Mitwirkende aus den Zeilen des Vorspanns lesen. Eine Zeile kann mehrere Angaben enthalten
 * („Bühnenfassung John von Düffel – Bearbeitung Hannes Sell und Elke Zeh“); eine Zeile, die mit
 * „von“ beginnt, nennt den Autor. Angaben ohne plausiblen Namen werden verworfen.
 */
export function extractCredits(lines: readonly string[]): ScriptCredit[] {
  const credits: ScriptCredit[] = [];
  for (const raw of lines) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const found: { kind: ScriptCreditKind; start: number; end: number }[] = [];
    for (let i = 0; i < text.length; i++) {
      const hit = keywordAt(text, i);
      if (hit) {
        found.push({ ...hit, start: i });
        i = hit.end - 1;
      }
    }
    if (!found.length && /^von\s/iu.test(text)) found.push({ kind: "author", start: 0, end: 3 });
    found.forEach((hit, index) => {
      const next = found[index + 1]?.start ?? text.length;
      let segment = text.slice(hit.end, next).replace(/^\s*[:–—-]?\s*/u, "");
      const stop = STOP.exec(segment);
      if (stop) segment = segment.slice(0, stop.index);
      const names = splitNames(segment).filter(isPersonName);
      if (!names.length) return;
      const label = text.slice(hit.start, hit.end).replace(/\s+/g, " ").trim();
      addCredit(credits, {
        kind: hit.kind,
        label: hit.kind === "author" && /^von$/iu.test(label) ? "von" : capitalize(label),
        names,
      });
    });
  }
  return credits;
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("de-DE") + value.slice(1);
}

const nameKey = (name: string) => name.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();

/** Namen, die im Skript stehen, aber in der gespeicherten Liste fehlen (für die Nachfrage). */
export function newCreditNames(saved: readonly ScriptCredit[], found: readonly ScriptCredit[]) {
  const known = new Set(saved.flatMap((credit) => credit.names.map(nameKey)));
  return found.flatMap((credit) => credit.names.filter((name) => !known.has(nameKey(name))));
}

/** Gespeicherte Liste um neue Angaben aus dem Skript ergänzen (nichts entfernen). */
export function mergeCredits(saved: readonly ScriptCredit[], found: readonly ScriptCredit[]) {
  const merged = saved.map((credit) => ({ ...credit, names: [...credit.names] }));
  const known = new Set(merged.flatMap((credit) => credit.names.map(nameKey)));
  for (const credit of found) {
    const names = credit.names.filter((name) => !known.has(nameKey(name)));
    if (names.length) addCredit(merged, { ...credit, names });
  }
  return merged;
}

/** Reihenfolge fürs Deckblatt: Vorlage, Autor, Fassung, Regie, Weitere. */
export function sortCredits(credits: readonly ScriptCredit[]) {
  return [...credits].sort(
    (a, b) => SCRIPT_CREDIT_KINDS.indexOf(a.kind) - SCRIPT_CREDIT_KINDS.indexOf(b.kind),
  );
}

/** „Hannes Sell und Elke Zeh“, „A, B und C“. */
export function joinNames(names: readonly string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
}
