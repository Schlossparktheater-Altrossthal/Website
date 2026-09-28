// Demo-Termine für „Meine Termine" — Phase 0 aus docs/Plan/meine-termine-plan.md.
//
//   pnpm dev:termine            # anlegen bzw. zeitlich neu legen
//   pnpm dev:termine --remove   # wieder entfernen
//
// Legt für admin@example.com (Dev-Test-Login) kommende Termine an, damit die Seite
// /mitglieder/meine-proben jeden Zustand zeigt: heute, morgen, diese Woche, später, vergangen,
// „Muss ich hin", Optional, Für alle, Gewerk-Termin, vorgemerkt, abgesagt und eine gestaffelte
// Probe mit persönlicher Zeit. Ein Termin trägt „Noch offen" als Ort — Testfall für den
// Ort-Hinweis aus Phase 4.
//
// Läuft ausschließlich gegen lokale/Test-Datenbanken. Nebeneffekt: admin@example.com wird
// Mitglied des ersten Gewerks der aktuellen Produktion, damit der Gewerk-Termin in der Übersicht
// auftaucht; `--remove` entfernt nur die Termine.
//
// Hinweis: Läuft `next dev` schon länger, kann dessen Prisma-Client veraltet sein (z. B.
// „Value 'TENTATIVE' not found in enum"). Dann den Dev-Server neu starten.

import { existsSync } from "node:fs";
import path from "node:path";

import type { AttendanceStatus, CalendarEventKind, EventStatus } from "@prisma/client";

import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "admin@example.com";
const ID_PREFIX = "dev-termine-";
const DAY_MS = 24 * 60 * 60 * 1000;

for (const name of [".env.local", ".env"]) {
  const envFile = path.join(process.cwd(), name);
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|mb-test-pg/.test(url)) {
    throw new Error("Nur gegen lokale Datenbanken (DATABASE_URL mit localhost).");
  }
}

/** Datum in `Europe/Berlin` für einen Tagesversatz ab heute. */
function dayKey(offsetDays: number) {
  return formatIsoDateInTimeZone(new Date(Date.now() + offsetDays * DAY_MS).toISOString());
}

/** Uhrzeit am Tag `offsetDays` in `Europe/Berlin`. */
function at(offsetDays: number, time: string) {
  return parseDateTimeInTimeZone(dayKey(offsetDays), time, DEFAULT_TIME_ZONE);
}

/**
 * Uhrzeit heute — liegt sie schon in der Vergangenheit (oder zu knapp davor), wird der Termin
 * hinter „jetzt" geschoben. Sonst fiele er aus der Übersicht, die nur Kommendes zeigt.
 */
function todayAt(time: string, minutesAhead: number) {
  const fixed = at(0, time);
  const fallback = new Date(Date.now() + minutesAhead * 60_000);
  return fixed.getTime() - fallback.getTime() > 30 * 60_000 ? fixed : fallback;
}

function plusHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

type Audience = {
  level: "REQUIRED" | "OPTIONAL";
  reasons: string[];
  personalStart?: Date;
  personalEnd?: Date;
  response?: AttendanceStatus;
  responseNote?: string;
};

type Seed = {
  slug: string;
  title: string;
  kind: CalendarEventKind;
  status?: EventStatus;
  start: Date;
  end: Date;
  location?: string | null;
  showId?: string | null;
  departmentId?: string | null;
  scheduleMode?: "TOGETHER" | "STAGGERED";
  /** `null` = Termin für alle ohne persönliche Einladung. */
  audience: Audience | null;
};

async function remove() {
  const { count } = await prisma.calendarEvent.deleteMany({
    where: { id: { startsWith: ID_PREFIX } },
  });
  return count;
}

async function main() {
  assertLocalDatabase();

  const removed = await remove();
  if (process.argv.includes("--remove")) {
    console.log(`${removed} Demo-Termin(e) entfernt.`);
    return;
  }

  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (!admin) {
    throw new Error(
      `Konto ${ADMIN_EMAIL} nicht gefunden — zuerst einmal über /login anmelden (Dev-Test-Login).`,
    );
  }

  const show = await prisma.show.findFirst({
    where: { status: { in: ["planning", "active"] } },
    orderBy: { year: "desc" },
    select: { id: true, title: true, year: true },
  });

  const department = show
    ? await prisma.department.findFirst({
        where: { showId: show.id, archivedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      })
    : null;

  if (department) {
    await prisma.departmentMembership.upsert({
      where: { departmentId_userId: { departmentId: department.id, userId: admin.id } },
      update: { status: "active" },
      create: { departmentId: department.id, userId: admin.id, role: "member" },
    });
  }

  // Zwei Proben am selben Tag: eine für die ganze Produktion, eine über das Gewerk.
  const heuteA = todayAt("19:00", 45);
  const heuteB = todayAt("20:30", 75);

  const seeds: Seed[] = [
    {
      slug: "probe-heute-a",
      title: "Neue Probe",
      kind: "REHEARSAL",
      start: heuteA,
      end: plusHours(heuteA, 2.5),
      location: "Proberaum",
      showId: show?.id ?? null,
      audience: { level: "REQUIRED", reasons: ["Ganze Produktion"] },
    },
    {
      slug: "probe-heute-b",
      title: "Neue Probe",
      kind: "REHEARSAL",
      start: heuteB,
      end: plusHours(heuteB, 2),
      location: "Schlosspark",
      showId: show?.id ?? null,
      audience: { level: "REQUIRED", reasons: ["Gewerk Technik"] },
    },
    {
      slug: "probe-gestaffelt",
      title: "Szenenprobe Akt 2",
      kind: "REHEARSAL",
      scheduleMode: "STAGGERED",
      start: at(1, "19:00"),
      end: at(1, "22:00"),
      location: "Proberaum",
      showId: show?.id ?? null,
      audience: {
        level: "OPTIONAL",
        reasons: ["Bastian (Sz. 3, 5)", "Mira (Sz. 4)"],
        personalStart: at(1, "19:30"),
        personalEnd: at(1, "21:00"),
      },
    },
    {
      slug: "probe-abgesagt",
      title: "Neue Probe",
      kind: "REHEARSAL",
      start: at(2, "19:00"),
      end: at(2, "21:00"),
      location: "Proberaum",
      showId: show?.id ?? null,
      audience: {
        level: "REQUIRED",
        reasons: ["Ganze Produktion"],
        response: "no",
        responseNote: "Schichtdienst",
      },
    },
    {
      // Für alle, ohne persönliche Einladung; liegt innerhalb der Sperrfrist (Standard 7 Tage),
      // ist also der Testfall für die spätere Notfall-Absage.
      slug: "wanderung",
      title: "Wanderung",
      kind: "SOCIAL",
      start: at(3, "11:00"),
      end: at(3, "16:00"),
      location: "Schlosspark",
      showId: null,
      audience: null,
    },
    {
      slug: "bautag",
      title: "Bautag Bühne",
      kind: "WORK_DAY",
      start: at(4, "10:00"),
      end: at(4, "16:00"),
      location: "Werkstatt",
      showId: show?.id ?? null,
      departmentId: department?.id ?? null,
      audience: null,
    },
    {
      slug: "treffen",
      title: "Treffen / Konzeptgespräch",
      kind: "MEETING",
      start: at(5, "19:00"),
      end: at(5, "21:00"),
      // Testfall für den Ort-Hinweis aus Phase 4.
      location: "Noch offen",
      showId: null,
      audience: null,
    },
    {
      slug: "probe-vorgemerkt",
      title: "Neue Probe",
      kind: "REHEARSAL",
      status: "TENTATIVE",
      start: at(9, "19:00"),
      end: at(9, "21:00"),
      location: "Proberaum",
      showId: show?.id ?? null,
      audience: { level: "REQUIRED", reasons: ["Ganze Produktion"] },
    },
    {
      slug: "probe-gestern",
      title: "Neue Probe",
      kind: "REHEARSAL",
      start: at(-1, "19:00"),
      end: at(-1, "21:00"),
      location: "Proberaum",
      showId: show?.id ?? null,
      audience: { level: "REQUIRED", reasons: ["Ganze Produktion"] },
    },
  ];

  for (const seed of seeds) {
    await prisma.calendarEvent.create({
      data: {
        id: `${ID_PREFIX}${seed.slug}`,
        title: seed.title,
        kind: seed.kind,
        status: seed.status ?? "SCHEDULED",
        scheduleMode: seed.scheduleMode ?? "TOGETHER",
        start: seed.start,
        end: seed.end,
        location: seed.location ?? null,
        showId: seed.showId ?? null,
        departmentId: seed.departmentId ?? null,
        createdById: admin.id,
        participants: seed.audience
          ? {
              create: {
                userId: admin.id,
                invited: true,
                level: seed.audience.level,
                reasons: seed.audience.reasons,
                personalStart: seed.audience.personalStart ?? null,
                personalEnd: seed.audience.personalEnd ?? null,
                response: seed.audience.response ?? null,
                responseNote: seed.audience.responseNote ?? null,
                respondedAt: seed.audience.response ? new Date() : null,
              },
            }
          : undefined,
      },
    });
  }

  console.log(`${seeds.length} Demo-Termin(e) für ${ADMIN_EMAIL} angelegt.`);
  console.log(
    show
      ? `Produktion: ${show.title ?? show.year}${department ? ` · Gewerk: ${department.name}` : ""}`
      : "Keine laufende Produktion gefunden — Proben ohne Produktionsbezug.",
  );
  console.log("Aufrufen: /mitglieder/meine-proben");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
