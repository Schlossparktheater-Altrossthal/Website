import type { FinancePeriod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Präfix der Buchungsnummern: „S27“ für eine Produktion 2027, „A26“ für Allgemein 2026. */
export function basePeriodCode(kind: "production" | "general", year: number): string {
  return `${kind === "production" ? "S" : "A"}${String(year % 100).padStart(2, "0")}`;
}

/** Freien Code wählen, falls es im Jahr mehrere Produktionen gibt: S27, S27b, S27c … */
export function nextFreePeriodCode(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 1; i < 26; i += 1) {
    const candidate = `${base}${String.fromCharCode(97 + i)}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Kein freier Finanz-Code für ${base}`);
}

/** Buchungsnummer zur Anzeige, z. B. „S27-041“. */
export function formatEntryNumber(code: string, number: number): string {
  return `${code}-${String(number).padStart(3, "0")}`;
}

async function takenCodes(db: Db, base: string) {
  const rows = await db.financePeriod.findMany({
    where: { code: { startsWith: base } },
    select: { code: true },
  });
  return new Set(rows.map((row) => row.code));
}

/** Zeitraum einer Produktion holen oder anlegen. */
export async function ensureShowPeriod(showId: string, db: Db = prisma): Promise<FinancePeriod> {
  const existing = await db.financePeriod.findUnique({ where: { showId } });
  if (existing) return existing;
  const show = await db.show.findUniqueOrThrow({
    where: { id: showId },
    select: { id: true, year: true, title: true },
  });
  const base = basePeriodCode("production", show.year);
  return db.financePeriod.create({
    data: {
      kind: "production",
      showId,
      year: show.year,
      name: show.title ?? `Produktion ${show.year}`,
      code: nextFreePeriodCode(base, await takenCodes(db, base)),
    },
  });
}

/** Zeitraum „Allgemein“ eines Jahres (laufende Vereinskosten ohne Produktion). */
export async function ensureGeneralPeriod(year: number, db: Db = prisma): Promise<FinancePeriod> {
  const existing = await db.financePeriod.findFirst({ where: { kind: "general", year } });
  if (existing) return existing;
  return db.financePeriod.create({
    data: {
      kind: "general",
      year,
      name: `Allgemein ${year}`,
      code: basePeriodCode("general", year),
    },
  });
}
