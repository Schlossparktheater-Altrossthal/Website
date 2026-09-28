// Demo-Termin mit Bausteinen für lokales Testen (docs/e2e-tests.md, „Demo-Daten“).
//
//   DATABASE_URL=… pnpm demo:bausteine          # anlegen bzw. neu anlegen
//   DATABASE_URL=… pnpm demo:bausteine --remove # wieder entfernen
//
// Legt in der ersten Produktion mit Szenen und aktivem Gewerk eine vorgemerkte Probe
// „Demo: Stellprobe + Bautag“ an (in 11 Tagen, 18–22 Uhr): zwei Szenen mit Uhrzeit und Raum,
// ein Gewerk-Baustein und ein freier Baustein. admin@example.com wird Leitung des Gewerks,
// damit „Baustein organisieren“ im Gewerk-Dashboard erscheint. Nur für lokale/Test-DBs –
// nie gegen Produktion laufen lassen.
//
// Hinweis: Läuft `next dev` schon länger, kann dessen Prisma-Client veraltet sein (z. B.
// „Value 'TENTATIVE' not found in enum“). Dann den Dev-Server neu starten.

import { loadAudienceContext, saveEventAudience } from "@/lib/calendar/audience-server";
import { saveEventBlocks, saveEventSchedule } from "@/lib/calendar/scene-schedule-server";
import { formatIsoDateInTimeZone, parseDateTimeInTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const TITLE = "Demo: Stellprobe + Bautag";
const ADMIN_EMAIL = "admin@example.com";

async function remove() {
  const { count } = await prisma.calendarEvent.deleteMany({ where: { title: TITLE } });
  return count;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|mb-test-pg/.test(url)) {
    throw new Error("Nur gegen lokale Datenbanken (DATABASE_URL mit localhost).");
  }

  const removed = await remove();
  if (process.argv.includes("--remove")) {
    console.log(`${removed} Demo-Termin(e) entfernt.`);
    return;
  }

  const show = await prisma.show.findFirst({
    where: {
      scenes: { some: {} },
      departments: { some: { archivedAt: null, memberships: { some: { status: "active" } } } },
    },
    orderBy: { year: "desc" },
    select: { id: true, title: true },
  });
  if (!show) throw new Error("Keine Produktion mit Szenen und aktivem Gewerk gefunden.");
  const department = await prisma.department.findFirstOrThrow({
    where: { showId: show.id, archivedAt: null, memberships: { some: { status: "active" } } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true },
  });
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (admin) {
    await prisma.departmentMembership.upsert({
      where: { departmentId_userId: { departmentId: department.id, userId: admin.id } },
      update: { status: "active", role: "lead" },
      create: { departmentId: department.id, userId: admin.id, status: "active", role: "lead" },
    });
  }
  const scenes = await prisma.scene.findMany({
    where: { showId: show.id },
    orderBy: [{ act: "asc" }, { sequence: "asc" }],
    take: 2,
    select: { id: true },
  });

  const dateKey = formatIsoDateInTimeZone(new Date(Date.now() + 11 * 86_400_000).toISOString());
  const start = parseDateTimeInTimeZone(dateKey, "18:00");
  const event = await prisma.calendarEvent.create({
    data: {
      kind: "REHEARSAL",
      title: TITLE,
      location: "Theatersaal",
      start,
      end: parseDateTimeInTimeZone(dateKey, "22:00"),
      status: "TENTATIVE",
      showId: show.id,
      createdById: admin?.id,
    },
    select: { id: true },
  });

  const context = await loadAudienceContext(show.id);
  const [first, second] = scenes;
  await prisma.$transaction(async (tx) => {
    await saveEventBlocks(tx, {
      eventId: event.id,
      dateKey,
      eventStart: start,
      blocks: [
        {
          id: crypto.randomUUID(),
          type: "DEPARTMENT",
          title: "Podeste bauen",
          departmentId: department.id,
          start: "18:30",
          end: "21:00",
          location: "",
          description: "",
          timesChanged: true,
        },
        {
          id: crypto.randomUUID(),
          type: "CUSTOM",
          title: "Einsingen",
          departmentId: null,
          start: "18:00",
          end: "18:30",
          location: "Foyer",
          description: "",
          timesChanged: true,
        },
      ],
    });
    await saveEventAudience(
      tx,
      event.id,
      {
        rules: scenes.map((scene) => ({
          type: "SCENE" as const,
          targetId: scene.id,
          level: "REQUIRED" as const,
        })),
        overrides: [],
      },
      context,
    );
    await saveEventSchedule(tx, {
      eventId: event.id,
      sceneIds: scenes.map((scene) => scene.id),
      schedule: {
        mode: "STAGGERED",
        times: {
          ...(first ? { [first.id]: { start: "18:30", end: "19:30" } } : {}),
          ...(second ? { [second.id]: { start: "19:30", end: "20:30" } } : {}),
        },
        rooms: first ? { [first.id]: "Bühne" } : {},
        blocks: [],
      },
      dateKey,
      eventStart: start,
      context,
    });
  });

  const routes = [
    `/mitglieder/probenplanung/proben/${event.id}`,
    `/mitglieder/termine/${event.id}`,
    `/mitglieder/meine-gewerke/${department.slug}?ansicht=termine`,
  ];
  console.log(`Demo-Termin angelegt (${show.title}, Gewerk ${department.name}, ${dateKey}).`);
  console.log(routes.map((route) => `  ${route}`).join("\n"));
  console.log("\nScreenshots:");
  console.log(
    `  pnpm e2e:screenshots -- --role admin --viewport mobile,desktop ${routes.join(" ")}`,
  );
  console.log("Klickfolge „Baustein organisieren“:");
  console.log(
    `  pnpm ui:check ${routes[2]} --role admin --viewport mobile,desktop --steps-file e2e/scenarios/baustein-organisieren.json`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
