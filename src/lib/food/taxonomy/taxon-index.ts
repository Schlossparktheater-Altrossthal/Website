import { foodTextVariants, normalizeFoodText } from "@/lib/food/normalize";
import { TAXON_IMPLIES } from "@/lib/food/taxonomy/custom";
import type { TaxonRecord, TriState } from "@/lib/food/taxonomy/types";

export type TaxonIndexEntry = Pick<
  TaxonRecord,
  | "code"
  | "kind"
  | "nameDe"
  | "nameEn"
  | "synonymsDe"
  | "synonymsEn"
  | "parentCodes"
  | "allergenCodes"
  | "impliesCodes"
  | "vegan"
  | "vegetarian"
  | "lmiv"
>;

export type TaxonMatch = {
  code: string;
  /** exact: Name/Synonym/Alias; compound: Teil eines Wortes oder einer Wortfolge. */
  confidence: "exact" | "compound";
  matchedText: string;
};

/**
 * Codes, deren Bezeichnung einen Auslöser ausdrücklich ausschließt („laktosefrei“). Sie heben
 * geerbte Auslöser wieder auf.
 */
const NEGATING_PATTERNS: readonly { pattern: RegExp; removes: string[] }[] = [
  { pattern: /lactose-free|without-lactose|laktosefrei/, removes: ["en:lactose"] },
  { pattern: /gluten-free|glutenfrei/, removes: ["en:gluten"] },
];

const MIN_COMPOUND_LENGTH = 4;

/**
 * Lebensmittel-Taxonomie im Speicher: Vorfahren-Hülle, Auslöser, Ernährungsform-Eigenschaften und
 * Textzuordnung. Wird aus der DB (`loadTaxonIndex`) oder in Tests aus Datensätzen gebaut.
 */
export class TaxonIndex {
  private readonly entries = new Map<string, TaxonIndexEntry>();
  private readonly byText = new Map<string, string>();
  private readonly closureCache = new Map<string, ReadonlySet<string>>();
  private readonly longestTerm: number;

  constructor(entries: Iterable<TaxonIndexEntry>, aliases: Iterable<[string, string]> = []) {
    for (const entry of entries) this.entries.set(entry.code, entry);

    // Reihenfolge = Vorrang. Hauptnamen: Allergene vor Zutaten („Fisch“ ist das Allergen).
    // Synonyme: Zutaten vor Allergenen – die OFF-Allergenliste führt Einzelzutaten wie
    // „Haselnüsse“ oder „Pistazie“ als Synonym von „Schalenfrüchte“, die genauere Zutat gewinnt.
    // Aliase zuletzt (überschreiben alles, weil von Menschen bestätigt).
    const byKind = (rank: (kind: TaxonIndexEntry["kind"]) => number) =>
      [...this.entries.values()].sort(
        (a, b) => rank(a.kind) - rank(b.kind) || a.code.localeCompare(b.code),
      );
    for (const entry of byKind(kindRank)) {
      this.addTexts(entry.code, [entry.nameDe, entry.nameEn]);
    }
    for (const entry of byKind((kind) => 2 - kindRank(kind))) {
      this.addTexts(entry.code, [...entry.synonymsDe, ...entry.synonymsEn]);
    }
    for (const [text, code] of aliases) {
      const key = normalizeFoodText(text);
      if (key && this.entries.has(code)) this.byText.set(key, code);
    }
    let longest = 0;
    for (const key of this.byText.keys()) longest = Math.max(longest, key.split(" ").length);
    this.longestTerm = longest;
  }

  private addTexts(code: string, texts: (string | null)[]): void {
    for (const text of texts) {
      if (!text) continue;
      const key = normalizeFoodText(text);
      if (key && !this.byText.has(key)) this.byText.set(key, code);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(code: string): TaxonIndexEntry | undefined {
    return this.entries.get(code);
  }

  has(code: string): boolean {
    return this.entries.has(code);
  }

  private childrenMap: Map<string, string[]> | null = null;

  /** Alle Nachfahren eines Codes (ohne den Code selbst), höchstens `limit`. */
  descendants(code: string, limit = 200): string[] {
    if (!this.childrenMap) {
      const map = new Map<string, string[]>();
      for (const entry of this.entries.values()) {
        for (const parent of entry.parentCodes)
          map.set(parent, [...(map.get(parent) ?? []), entry.code]);
      }
      this.childrenMap = map;
    }
    const result: string[] = [];
    const seen = new Set([code]);
    const queue = [...(this.childrenMap.get(code) ?? [])];
    while (queue.length > 0 && result.length < limit) {
      const next = queue.shift();
      if (next === undefined || seen.has(next)) continue;
      seen.add(next);
      result.push(next);
      queue.push(...(this.childrenMap.get(next) ?? []));
    }
    return result;
  }

  /** Alle Vorfahren eines Codes (ohne den Code selbst). */
  ancestors(code: string): Set<string> {
    const result = new Set<string>();
    const stack = [...(this.entries.get(code)?.parentCodes ?? [])];
    while (stack.length > 0) {
      const next = stack.pop();
      if (next === undefined || result.has(next)) continue;
      result.add(next);
      stack.push(...(this.entries.get(next)?.parentCodes ?? []));
    }
    return result;
  }

  /**
   * Alles, was ein Code auslöst: er selbst, seine Vorfahren, deren Allergene und Ergänzungen
   * (`impliesCodes` aus der DB und `TAXON_IMPLIES`) – rekursiv. Ausdrücklich „-frei“ benannte
   * Codes heben den jeweiligen Auslöser wieder auf.
   */
  closure(code: string): ReadonlySet<string> {
    const cached = this.closureCache.get(code);
    if (cached) return cached;

    const result = new Set<string>();
    const queue = [code];
    while (queue.length > 0) {
      const next = queue.pop();
      if (next === undefined || result.has(next)) continue;
      result.add(next);
      const entry = this.entries.get(next);
      queue.push(...(entry?.parentCodes ?? []));
      queue.push(...(entry?.allergenCodes ?? []));
      queue.push(...(entry?.impliesCodes ?? []));
      queue.push(...(TAXON_IMPLIES[next] ?? []));
    }

    for (const removed of this.negatedBy([code])) result.delete(removed);

    this.closureCache.set(code, result);
    return result;
  }

  /**
   * Vereinigung der Hüllen mehrerer Codes. Ist einer der Codes ausdrücklich „-frei“
   * (z. B. laktosefreie Milchprodukte), gilt das für das ganze Lebensmittel.
   */
  closureOf(codes: Iterable<string>): Set<string> {
    const list = [...codes];
    const result = new Set<string>();
    for (const code of list) for (const item of this.closure(code)) result.add(item);
    for (const removed of this.negatedBy(list)) result.delete(removed);
    return result;
  }

  private negatedBy(codes: string[]): Set<string> {
    const removed = new Set<string>();
    for (const code of codes) {
      const chain = [code, ...this.ancestors(code)];
      for (const { pattern, removes } of NEGATING_PATTERNS) {
        const negated = chain.some(
          (item) =>
            pattern.test(item) ||
            pattern.test(normalizeFoodText(this.entries.get(item)?.nameDe ?? "")),
        );
        if (negated) removes.forEach((item) => removed.add(item));
      }
    }
    return removed;
  }

  /**
   * Geerbte Eigenschaft vegan/vegetarian: der nächste Eintrag in Richtung Wurzel mit Wert.
   * Mehrere Elternpfade: „no“ schlägt „maybe“ schlägt „yes“.
   */
  dietProperty(code: string, property: "vegan" | "vegetarian"): TriState | null {
    const seen = new Set<string>();
    const resolve = (current: string): TriState | null => {
      if (seen.has(current)) return null;
      seen.add(current);
      const entry = this.entries.get(current);
      if (!entry) return null;
      if (entry[property]) return entry[property];
      return worst(entry.parentCodes.map(resolve));
    };
    return resolve(code);
  }

  /** Genaue Zuordnung eines Textes (Name, Synonym, Alias, einfache Pluralformen). */
  matchExact(text: string): TaxonMatch | null {
    for (const variant of foodTextVariants(text)) {
      const code = this.byText.get(variant);
      if (code) return { code, confidence: "exact", matchedText: variant };
    }
    return null;
  }

  /**
   * Zuordnung eines freien Textes: erst genau, dann die längste bekannte Wortfolge, zuletzt
   * Wortanfänge/-enden zusammengesetzter Wörter („Haselnusskrokant“ → Haselnuss,
   * „Vollmilchschokolade“ → Schokolade). Mehrere Treffer sind möglich („Rind und Schwein“).
   */
  matchText(text: string): TaxonMatch[] {
    const exact = this.matchExact(text);
    if (exact) return [exact];

    const words = normalizeFoodText(text).split(" ").filter(Boolean);
    const matches: TaxonMatch[] = [];
    const covered = new Array<boolean>(words.length).fill(false);

    for (let length = Math.min(this.longestTerm, words.length); length >= 1; length -= 1) {
      for (let start = 0; start + length <= words.length; start += 1) {
        if (covered.slice(start, start + length).some(Boolean)) continue;
        const phrase = words.slice(start, start + length).join(" ");
        const hit = this.matchExact(phrase);
        if (hit) {
          matches.push({ ...hit, confidence: "compound" });
          for (let index = start; index < start + length; index += 1) covered[index] = true;
        }
      }
    }

    words.forEach((word, index) => {
      if (covered[index]) return;
      matches.push(...this.matchCompound(word));
    });

    const unique = new Map(matches.map((match) => [match.code, match]));
    return [...unique.values()];
  }

  /**
   * Längster bekannter Wortanfang und längstes bekanntes Wortende eines zusammengesetzten Wortes
   * („Käsebrot“ → Käse + Brot), ohne Überlappung.
   */
  private matchCompound(word: string): TaxonMatch[] {
    let head: TaxonMatch | null = null;
    for (let cut = word.length - 1; cut >= MIN_COMPOUND_LENGTH && !head; cut -= 1) {
      const hit = this.matchExact(word.slice(0, cut));
      if (hit) head = { ...hit, confidence: "compound", matchedText: word.slice(0, cut) };
    }
    const rest = word.length - (head?.matchedText.length ?? 0);
    let tail: TaxonMatch | null = null;
    for (
      let length = Math.min(rest, word.length - 1);
      length >= MIN_COMPOUND_LENGTH && !tail;
      length -= 1
    ) {
      const part = word.slice(word.length - length);
      const hit = this.matchExact(part);
      if (hit) tail = { ...hit, confidence: "compound", matchedText: part };
    }
    return [head, tail].filter((match): match is TaxonMatch => match !== null);
  }

  /** Suche für Eingabefelder (Präfix vor Teilwort, Allergene zuerst). */
  search(query: string, limit = 10): TaxonIndexEntry[] {
    const needle = normalizeFoodText(query);
    if (!needle) return [];
    const scored = new Map<string, number>();
    for (const [text, code] of this.byText) {
      const score =
        text === needle ? 0 : text.startsWith(needle) ? 1 : text.includes(needle) ? 2 : -1;
      if (score < 0) continue;
      const entry = this.entries.get(code);
      if (!entry) continue;
      // Passt der deutsche Name selbst, geht der Eintrag einem Synonym-Treffer vor („Hasel“ →
      // Haselnuss vor Schalenfrüchte, das „Haselnüsse“ nur als Synonym führt).
      const ownName = entry.nameDe ? normalizeFoodText(entry.nameDe) : "";
      const nameBonus = ownName === needle ? -6 : ownName.startsWith(needle) ? -4 : 0;
      const total = score * 10 + kindRank(entry.kind) + (entry.nameDe ? 0 : 5) + nameBonus;
      scored.set(code, Math.min(scored.get(code) ?? Infinity, total));
    }
    return [...scored.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .flatMap(([code]) => {
        const entry = this.entries.get(code);
        return entry ? [entry] : [];
      });
  }
}

function kindRank(kind: TaxonIndexEntry["kind"]): number {
  return kind === "ALLERGEN" ? 0 : kind === "SENSITIVITY" ? 1 : 2;
}

function worst(values: (TriState | null)[]): TriState | null {
  if (values.includes("no")) return "no";
  if (values.includes("maybe")) return "maybe";
  if (values.includes("yes")) return "yes";
  return null;
}
