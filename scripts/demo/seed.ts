// Demo-Daten für demo.sommertheater-altrossthal.de (docs/demo.md).
//
//   DATABASE_URL=… DEMO_MODE=true pnpm demo:seed     # Datenbank leeren und neu befüllen
//
// Im Cluster läuft das gebündelte scripts/demo/dist/seed.mjs (pnpm demo:bundle, im CI-Build)
// nachts und bei jedem Deploy. Ablauf: Schema löschen → Migrationen → Stammdaten aus
// data/stammdaten.json.gz (export-stammdaten.mjs) → erfundenes Ensemble mit Produktion,
// Proben, Sperrliste, Gewerken, Finanzen, Lager und Rezepten. Alle Termine liegen relativ
// zu heute, damit die Demo jeden Tag „läuft“. Feste IDs für Personen und Produktionen
// halten Sitzungen und das Produktions-Cookie über den Reset hinweg gültig.
//
// Löscht die komplette Datenbank: läuft nur mit DEMO_MODE=true oder gegen localhost.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { Prisma, type MeasurementType } from "@prisma/client";
import pg from "pg";

import { loadAudienceContext, saveEventAudience } from "@/lib/calendar/audience-server";
import { saveEventBlocks, saveEventSchedule } from "@/lib/calendar/scene-schedule-server";
import { formatIsoDateInTimeZone, parseDateTimeInTimeZone } from "@/lib/date-time";
import { DEMO_EMAIL_DOMAIN, DEMO_PERSONAS } from "@/lib/demo-mode";
import { ensureBoardColumns } from "@/lib/departments/board";
import { ensureProductionDepartments } from "@/lib/departments/templates";
import { commentRecipe, createRecipe, rateRecipe } from "@/lib/food/recipes/service";
import { ensurePermissionDefinitions } from "@/lib/permissions";
import { recalculateShowPlan } from "@/lib/planning/plan-service";
import { prisma } from "@/lib/prisma";

import { applyAusstattungDefaults, seedDemoAusstattung } from "./ausstattung";
import { seedDemoLager } from "./lager";

const SHOW_ID = "demo-show-sommernachtstraum";
const PAST_SHOW_ID = "demo-show-zerbrochner-krug";

// ---------------------------------------------------------------------------
// Hilfen

let seed = 20270611;
function random() {
  // mulberry32: gleiche Demo bei jedem Reset
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => random() < p;
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

const DAY = 86_400_000;
const NOW = Date.now();
/** Datum (YYYY-MM-DD, Europe/Berlin) in `offset` Tagen. */
const dayKey = (offset: number) =>
  formatIsoDateInTimeZone(new Date(NOW + offset * DAY).toISOString());
const at = (offset: number, time: string) => parseDateTimeInTimeZone(dayKey(offset), time);
/** Kalendertag ohne Uhrzeit (wie Sperrliste und Endprobenwoche speichern). */
const dateOnly = (offset: number) => new Date(`${dayKey(offset)}T00:00:00.000Z`);
const weekday = (offset: number) => dateOnly(offset).getUTCDay();

function log(message: string) {
  process.stdout.write(`[demo] ${message}\n`);
}

// ---------------------------------------------------------------------------
// 1. Datenbank zurücksetzen und Stammdaten laden

async function resetDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /localhost|127\.0\.0\.1|mb-test-pg/.test(url);
  if (process.env.DEMO_MODE !== "true" && !local) {
    throw new Error("Löscht die ganze Datenbank: nur mit DEMO_MODE=true oder gegen localhost.");
  }
  const client = new pg.Client({ connectionString: url.split("?")[0] });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  log("Schema geleert, Migrationen laufen …");
  const migrate = spawnSync(process.execPath, ["scripts/run-prisma-migrate.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) throw new Error("Migration fehlgeschlagen.");
}

async function importStammdaten() {
  // Relativ zum Arbeitsverzeichnis (Repo bzw. /app im Image): das Bundle liegt woanders.
  const path = join(process.cwd(), "scripts/demo/data/stammdaten.json.gz");
  const { tables } = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as {
    tables: Record<string, Record<string, unknown>[]>;
  };
  const client = new pg.Client({
    connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
  });
  await client.connect();
  try {
    // Migrationen legen manche Stammdaten schon an; der Export ersetzt sie vollständig.
    const names = Object.keys(tables)
      .map((table) => `"${table}"`)
      .join(", ");
    await client.query(`TRUNCATE ${names} CASCADE`);
    for (const [table, rows] of Object.entries(tables)) {
      if (!rows.length) continue;
      // Nur Spalten, die es im aktuellen Schema gibt; neue Spalten bekommen ihren Default.
      const { rows: columnRows } = await client.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [table],
      );
      const existing = new Set(columnRows.map((row) => row.column_name));
      const columns = Object.keys(rows[0]).filter((column) => existing.has(column));
      const list = columns.map((column) => `"${column}"`).join(", ");
      for (let index = 0; index < rows.length; index += 1000) {
        const chunk = rows.slice(index, index + 1000);
        await client.query(
          `INSERT INTO "${table}" (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
          [JSON.stringify(chunk)],
        );
      }
    }
  } finally {
    await client.end();
  }
  log(`Stammdaten geladen (${Object.keys(tables).length} Tabellen).`);
}

// ---------------------------------------------------------------------------
// 2. Personen

type Person = {
  key: string;
  firstName: string;
  lastName: string;
  gender: "w" | "m";
  age: number;
  focus: "acting" | "tech" | "both";
  roles?: ("board" | "finance" | "admin" | "owner")[];
  appRoles?: string[];
  sinceYear: number;
};

const PEOPLE: Person[] = [
  // Demo-Personen (Login-Buttons, src/lib/demo-mode.ts)
  {
    key: "lena",
    firstName: "Lena",
    lastName: "Hoffmann",
    gender: "w",
    age: 24,
    focus: "acting",
    sinceYear: 2019,
  },
  {
    key: "jonas",
    firstName: "Jonas",
    lastName: "Weber",
    gender: "m",
    age: 38,
    focus: "tech",
    sinceYear: 2015,
  },
  {
    key: "miriam",
    firstName: "Miriam",
    lastName: "Schubert",
    gender: "w",
    age: 45,
    focus: "both",
    appRoles: ["regie"],
    sinceYear: 2008,
  },
  {
    key: "thomas",
    firstName: "Thomas",
    lastName: "Richter",
    gender: "m",
    age: 57,
    focus: "both",
    roles: ["board", "finance"],
    sinceYear: 2003,
  },
  {
    key: "admin",
    firstName: "Demo",
    lastName: "Admin",
    gender: "w",
    age: 33,
    focus: "tech",
    roles: ["admin", "owner"],
    sinceYear: 2012,
  },
  // Ensemble
  {
    key: "peter",
    firstName: "Peter",
    lastName: "Krause",
    gender: "m",
    age: 52,
    focus: "acting",
    sinceYear: 2006,
  },
  {
    key: "sabine",
    firstName: "Sabine",
    lastName: "Lehmann",
    gender: "w",
    age: 48,
    focus: "acting",
    sinceYear: 2010,
  },
  {
    key: "wolfgang",
    firstName: "Wolfgang",
    lastName: "Fischer",
    gender: "m",
    age: 66,
    focus: "acting",
    sinceYear: 2001,
  },
  {
    key: "felix",
    firstName: "Felix",
    lastName: "Wagner",
    gender: "m",
    age: 26,
    focus: "acting",
    sinceYear: 2018,
  },
  {
    key: "paul",
    firstName: "Paul",
    lastName: "Schmitt",
    gender: "m",
    age: 22,
    focus: "acting",
    sinceYear: 2021,
  },
  {
    key: "clara",
    firstName: "Clara",
    lastName: "Neumann",
    gender: "w",
    age: 23,
    focus: "acting",
    sinceYear: 2020,
  },
  {
    key: "andreas",
    firstName: "Andreas",
    lastName: "König",
    gender: "m",
    age: 44,
    focus: "acting",
    sinceYear: 2009,
  },
  {
    key: "katharina",
    firstName: "Katharina",
    lastName: "Wolf",
    gender: "w",
    age: 41,
    focus: "acting",
    sinceYear: 2011,
  },
  {
    key: "mia",
    firstName: "Mia",
    lastName: "Schäfer",
    gender: "w",
    age: 17,
    focus: "acting",
    sinceYear: 2022,
  },
  {
    key: "bernd",
    firstName: "Bernd",
    lastName: "Zimmermann",
    gender: "m",
    age: 59,
    focus: "acting",
    sinceYear: 2004,
  },
  {
    key: "ute",
    firstName: "Ute",
    lastName: "Krüger",
    gender: "w",
    age: 61,
    focus: "both",
    sinceYear: 2002,
  },
  {
    key: "tim",
    firstName: "Tim",
    lastName: "Hartmann",
    gender: "m",
    age: 19,
    focus: "acting",
    sinceYear: 2023,
  },
  {
    key: "lukas",
    firstName: "Lukas",
    lastName: "Lange",
    gender: "m",
    age: 34,
    focus: "both",
    sinceYear: 2016,
  },
  {
    key: "noah",
    firstName: "Noah",
    lastName: "Werner",
    gender: "m",
    age: 16,
    focus: "acting",
    sinceYear: 2024,
  },
  {
    key: "emma",
    firstName: "Emma",
    lastName: "Braun",
    gender: "w",
    age: 21,
    focus: "acting",
    sinceYear: 2022,
  },
  {
    key: "hanna",
    firstName: "Hanna",
    lastName: "Peters",
    gender: "w",
    age: 12,
    focus: "acting",
    sinceYear: 2025,
  },
  {
    key: "sophie",
    firstName: "Sophie",
    lastName: "Möller",
    gender: "w",
    age: 11,
    focus: "acting",
    sinceYear: 2025,
  },
  {
    key: "ida",
    firstName: "Ida",
    lastName: "Schulz",
    gender: "w",
    age: 13,
    focus: "acting",
    sinceYear: 2024,
  },
  // Gewerke
  {
    key: "stefan",
    firstName: "Stefan",
    lastName: "Becker",
    gender: "m",
    age: 47,
    focus: "tech",
    sinceYear: 2007,
  },
  {
    key: "julia",
    firstName: "Julia",
    lastName: "Koch",
    gender: "w",
    age: 39,
    focus: "tech",
    sinceYear: 2013,
  },
  {
    key: "anna",
    firstName: "Anna",
    lastName: "Vogel",
    gender: "w",
    age: 29,
    focus: "tech",
    sinceYear: 2019,
  },
  {
    key: "marco",
    firstName: "Marco",
    lastName: "Jung",
    gender: "m",
    age: 31,
    focus: "tech",
    sinceYear: 2017,
  },
  {
    key: "sandra",
    firstName: "Sandra",
    lastName: "Keller",
    gender: "w",
    age: 50,
    focus: "tech",
    sinceYear: 2009,
  },
  {
    key: "ralf",
    firstName: "Ralf",
    lastName: "Frank",
    gender: "m",
    age: 63,
    focus: "tech",
    sinceYear: 2005,
  },
  {
    key: "nina",
    firstName: "Nina",
    lastName: "Berger",
    gender: "w",
    age: 27,
    focus: "tech",
    sinceYear: 2020,
  },
  {
    key: "max",
    firstName: "Max",
    lastName: "Roth",
    gender: "m",
    age: 35,
    focus: "both",
    sinceYear: 2014,
  },
  {
    key: "greta",
    firstName: "Greta",
    lastName: "Baumann",
    gender: "w",
    age: 55,
    focus: "tech",
    sinceYear: 2012,
  },
  {
    key: "ole",
    firstName: "Ole",
    lastName: "Schröder",
    gender: "m",
    age: 18,
    focus: "tech",
    sinceYear: 2024,
  },
];

const ids = new Map<string, string>();
const uid = (key: string) => {
  const id = ids.get(key);
  if (!id) throw new Error(`Unbekannte Demo-Person ${key}`);
  return id;
};

function emailFor(person: Person) {
  const persona = DEMO_PERSONAS.find((entry) => entry.id === `demo-user-${person.key}`);
  if (persona) return persona.email;
  const local = `${person.firstName}.${person.lastName}`
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  return `${local}@${DEMO_EMAIL_DOMAIN}`;
}

async function seedPeople() {
  const appRoles = await prisma.appRole.findMany({ select: { id: true, name: true } });
  const roleId = (name: string) => appRoles.find((role) => role.name === name)?.id;
  const thisYear = new Date().getUTCFullYear();

  for (const person of PEOPLE) {
    const id = `demo-user-${person.key}`;
    ids.set(person.key, id);
    const systemRoles = person.roles ?? [];
    const topRole = systemRoles.includes("owner")
      ? "owner"
      : systemRoles.includes("admin")
        ? "admin"
        : systemRoles.includes("board")
          ? "board"
          : "member";
    await prisma.user.create({
      data: {
        id,
        email: emailFor(person),
        firstName: person.firstName,
        lastName: person.lastName,
        name: `${person.firstName} ${person.lastName}`,
        role: topRole,
        createdAt: new Date(Date.UTC(person.sinceYear, 4, 1)),
        dateOfBirth: new Date(Date.UTC(thisYear - person.age, between(0, 11), between(1, 28))),
        onboardingCompletedAt: new Date(NOW - between(20, 60) * DAY),
        avatarSource: "INITIALS",
        roles: {
          create: [{ role: "member" as const }, ...systemRoles.map((role) => ({ role }))],
        },
      },
    });
    for (const name of ["member", ...(person.appRoles ?? []), ...systemRoles]) {
      const id2 = roleId(name);
      if (id2) await prisma.userAppRole.create({ data: { userId: id, roleId: id2 } });
    }
  }
  log(`${PEOPLE.length} Personen angelegt.`);
}

// ---------------------------------------------------------------------------
// 3. Produktionen, Rollen, Szenen

const CHARACTERS = [
  {
    key: "theseus",
    name: "Theseus",
    description: "Herzog von Athen",
    code: "acting_medium",
    cast: ["peter"],
  },
  {
    key: "hippolyta",
    name: "Hippolyta",
    description: "Königin der Amazonen, Theseus' Verlobte",
    code: "acting_medium",
    cast: ["sabine"],
  },
  {
    key: "egeus",
    name: "Egeus",
    description: "Hermias Vater",
    code: "acting_small",
    cast: ["wolfgang"],
  },
  {
    key: "hermia",
    name: "Hermia",
    description: "liebt Lysander, soll Demetrius heiraten",
    code: "acting_lead",
    cast: ["lena"],
  },
  {
    key: "lysander",
    name: "Lysander",
    description: "liebt Hermia",
    code: "acting_lead",
    cast: ["felix"],
  },
  {
    key: "demetrius",
    name: "Demetrius",
    description: "will Hermia heiraten",
    code: "acting_lead",
    cast: ["paul"],
  },
  {
    key: "helena",
    name: "Helena",
    description: "liebt Demetrius",
    code: "acting_lead",
    cast: ["clara"],
    alternate: ["emma"],
  },
  {
    key: "oberon",
    name: "Oberon",
    description: "König der Elfen",
    code: "acting_lead",
    cast: ["andreas"],
  },
  {
    key: "titania",
    name: "Titania",
    description: "Königin der Elfen",
    code: "acting_lead",
    cast: ["katharina"],
  },
  {
    key: "puck",
    name: "Puck",
    description: "Kobold in Oberons Diensten",
    code: "acting_lead",
    cast: ["mia"],
  },
  {
    key: "zettel",
    name: "Zettel",
    description: "Weber, spielt den Pyramus",
    code: "acting_medium",
    cast: ["bernd"],
  },
  {
    key: "squenz",
    name: "Peter Squenz",
    description: "Zimmermann, leitet die Handwerkertruppe",
    code: "acting_medium",
    cast: ["ute"],
  },
  {
    key: "flaut",
    name: "Flaut",
    description: "Blasebalgflicker, spielt die Thisbe",
    code: "acting_small",
    cast: ["tim"],
  },
  {
    key: "schnauz",
    name: "Schnauz",
    description: "Kesselflicker, spielt die Wand",
    code: "acting_small",
    cast: ["lukas"],
  },
  {
    key: "schlucker",
    name: "Schlucker",
    description: "Schreiner, spielt den Löwen",
    code: "acting_small",
    cast: ["noah"],
  },
  {
    key: "elfen",
    name: "Elfen",
    description: "Titanias Gefolge",
    code: "acting_statist",
    cast: ["emma", "hanna", "sophie", "ida"],
  },
] as const;

const SCENES = [
  {
    act: 1,
    title: "Am Hof des Theseus",
    location: "Palast in Athen",
    chars: ["theseus", "hippolyta", "egeus", "hermia", "lysander", "demetrius", "helena"],
    minutes: 12,
  },
  {
    act: 1,
    title: "Die Handwerker verteilen die Rollen",
    location: "Werkstatt des Squenz",
    chars: ["squenz", "zettel", "flaut", "schnauz", "schlucker"],
    minutes: 9,
  },
  {
    act: 1,
    title: "Oberon und Titania streiten",
    location: "Wald bei Athen",
    chars: ["oberon", "titania", "puck", "elfen"],
    minutes: 10,
  },
  {
    act: 2,
    title: "Der Zaubersaft",
    location: "Wald bei Athen",
    chars: ["oberon", "puck", "demetrius", "helena"],
    minutes: 8,
  },
  {
    act: 2,
    title: "Die Probe im Wald",
    location: "Lichtung",
    chars: ["squenz", "zettel", "flaut", "schnauz", "schlucker", "puck"],
    minutes: 11,
  },
  {
    act: 2,
    title: "Titania erwacht",
    location: "Titanias Laube",
    chars: ["titania", "zettel", "elfen"],
    minutes: 7,
  },
  {
    act: 2,
    title: "Verwirrung der Liebenden",
    location: "Wald bei Athen",
    chars: ["hermia", "lysander", "demetrius", "helena", "puck"],
    minutes: 14,
  },
  {
    act: 3,
    title: "Die Versöhnung",
    location: "Wald bei Athen",
    chars: ["oberon", "titania", "puck", "theseus", "hippolyta", "egeus"],
    minutes: 9,
  },
  {
    act: 3,
    title: "Pyramus und Thisbe",
    location: "Palast in Athen",
    chars: [
      "theseus",
      "hippolyta",
      "hermia",
      "lysander",
      "demetrius",
      "helena",
      "squenz",
      "zettel",
      "flaut",
      "schnauz",
      "schlucker",
    ],
    minutes: 16,
  },
  {
    act: 3,
    title: "Pucks Epilog",
    location: "Palast in Athen",
    chars: ["puck", "oberon", "titania", "elfen"],
    minutes: 4,
  },
] as const;

const CREW: Record<string, { lead: string; deputy?: string; members: string[] }> = {
  buehnenbau: { lead: "jonas", deputy: "ralf", members: ["ole", "lukas", "thomas"] },
  technik: { lead: "stefan", members: ["marco", "ole", "admin"] },
  kostueme: { lead: "julia", deputy: "anna", members: ["ute", "sabine"] },
  essensplanung: { lead: "sandra", members: ["greta", "wolfgang"] },
  "social-media-werbung": { lead: "nina", members: ["clara", "felix"] },
  "musik-sounddesign-atmosphare": { lead: "max", members: ["mia", "marco"] },
};

/** Premiere: Samstag in etwa acht Wochen. */
function premiereOffset() {
  let offset = 52;
  while (weekday(offset) !== 6) offset += 1;
  return offset;
}

async function seedProductions() {
  const premiere = premiereOffset();
  const finalStart = premiere - 7;
  const premiereAt = at(premiere, "19:30");
  const year = Number(dayKey(premiere).slice(0, 4));

  await prisma.show.create({
    data: {
      id: PAST_SHOW_ID,
      year: year - 1,
      title: "Der zerbrochne Krug",
      synopsis: "Lustspiel von Heinrich von Kleist",
      dates: `${year - 1}-06-12/${year - 1}-06-28`,
      status: "finished",
      statusChangedAt: new Date(NOW - 300 * DAY),
      premiereAt: new Date(Date.UTC(year - 1, 5, 13, 17, 30)),
      finalRehearsalWeekStart: new Date(Date.UTC(year - 1, 5, 6)),
      finalRehearsalWeekEnd: new Date(Date.UTC(year - 1, 5, 12)),
      revealedAt: new Date(NOW - 600 * DAY),
    },
  });
  await prisma.show.create({
    data: {
      id: SHOW_ID,
      year,
      title: "Ein Sommernachtstraum",
      synopsis:
        "Komödie von William Shakespeare – unter freiem Himmel im Schlosspark, mit Elfen, Liebeswirren und der wohl schlechtesten Theatertruppe Athens.",
      dates: `${dayKey(-70)}/${dayKey(premiere + 15)}`,
      status: "active",
      statusChangedAt: new Date(NOW - 70 * DAY),
      premiereAt,
      finalRehearsalWeekStart: dateOnly(finalStart),
      finalRehearsalWeekEnd: dateOnly(premiere - 1),
      revealedAt: new Date(NOW - 90 * DAY),
    },
  });

  // Mitgliedschaften: alle in der aktuellen Produktion, die meisten auch im Vorjahr.
  for (const person of PEOPLE) {
    const roles = (person.roles ?? []).filter((role) => role !== "admin" && role !== "owner");
    await prisma.productionMembership.create({
      data: {
        showId: SHOW_ID,
        userId: uid(person.key),
        joinedAt: new Date(NOW - between(50, 70) * DAY),
        roles,
        function: person.key === "miriam" ? "Regie" : null,
      },
    });
    if (person.sinceYear < year - 1 && chance(0.8)) {
      await prisma.productionMembership.create({
        data: {
          showId: PAST_SHOW_ID,
          userId: uid(person.key),
          joinedAt: new Date(NOW - 420 * DAY),
          leftAt: new Date(NOW - 300 * DAY),
          status: "left",
          roles,
        },
      });
    }
  }

  // Rollen und Besetzung
  const characterIds = new Map<string, string>();
  for (const [order, character] of CHARACTERS.entries()) {
    const created = await prisma.character.create({
      data: {
        showId: SHOW_ID,
        name: character.name,
        description: character.description,
        rolePreferenceCode: character.code,
        order,
      },
    });
    characterIds.set(character.key, created.id);
    for (const key of character.cast) {
      await prisma.characterCasting.create({
        data: { characterId: created.id, userId: uid(key), type: "primary" },
      });
    }
    for (const key of "alternate" in character ? character.alternate : []) {
      await prisma.characterCasting.create({
        data: {
          characterId: created.id,
          userId: uid(key),
          type: "alternate",
          notes: "Zweitbesetzung, spielt die Nachmittagsvorstellung",
        },
      });
    }
  }
  for (const [number, title] of ["Athen", "Der Wald", "Die Hochzeit"].entries()) {
    await prisma.showAct.create({ data: { showId: SHOW_ID, number: number + 1, title } });
  }
  const sceneIds: string[] = [];
  for (const [index, scene] of SCENES.entries()) {
    const created = await prisma.scene.create({
      data: {
        showId: SHOW_ID,
        sequence: index + 1,
        identifier: `${scene.act}.${index + 1}`,
        title: scene.title,
        slug: `szene-${index + 1}`,
        location: scene.location,
        durationMinutes: scene.minutes,
        act: scene.act,
        timeOfDay: scene.act === 2 ? "Nacht" : "Tag",
        characters: {
          create: scene.chars.map((key, order) => ({
            characterId: characterIds.get(key)!,
            order,
            isFeatured: order < 2,
          })),
        },
      },
    });
    sceneIds.push(created.id);
  }

  // Vorjahr: kleine Besetzung für Chronik und „Rückkehrer“
  for (const [order, [name, key]] of [
    ["Adam, Dorfrichter", "bernd"],
    ["Walter, Gerichtsrat", "peter"],
    ["Eve", "lena"],
    ["Ruprecht", "felix"],
    ["Frau Marthe Rull", "ute"],
  ].entries()) {
    await prisma.character.create({
      data: {
        showId: PAST_SHOW_ID,
        name,
        order,
        castings: { create: { userId: uid(key), type: "primary" } },
      },
    });
  }

  log(`Produktionen angelegt (Premiere ${dayKey(premiere)}).`);
  return { premiere, finalStart, characterIds, sceneIds };
}

// ---------------------------------------------------------------------------
// 4. Gewerke, Aufgaben, Meilensteine

const TASKS: Record<
  string,
  [string, string | null, "todo" | "doing" | "done", "low" | "normal" | "high", number | null][]
> = {
  buehnenbau: [
    ["Podeste für die Lichtung bauen", "4 Podeste 2×1 m, trittschallgedämmt", "doing", "high", 12],
    ["Holz bestellen", null, "done", "normal", -10],
    ["Bühnenboden ausbessern", "Bretter an der Rampe tauschen", "doing", "normal", 18],
    ["Sitzplan Tribüne prüfen", null, "todo", "normal", 35],
  ],
  technik: [
    ["Lichtplan Waldszenen", "Grün/Blau-Stimmungen, Gobos für Blätter", "doing", "high", 20],
    ["Funkstrecken testen", null, "todo", "normal", 28],
    ["Stromverteilung Schlosspark", "Absprache mit Gemeinde wegen Anschluss", "done", "high", -5],
    ["Nebelmaschine reparieren", null, "todo", "low", 40],
  ],
  kostueme: [
    ["Elfenflügel nähen", "4 Paar, Kinder-Größen – Maße im Portal", "doing", "high", 22],
    ["Anprobe Liebespaare", null, "todo", "normal", 15],
    ["Fundus nach Toga-Stoffen durchsuchen", null, "done", "normal", -12],
  ],
  essensplanung: [
    ["Speiseplan Endprobenwoche", "Allergien im Portal prüfen", "doing", "high", 30],
    ["Kaffeemaschine ausleihen", null, "todo", "low", 40],
    ["Großeinkauf planen", null, "todo", "normal", 44],
  ],
  "social-media-werbung": [
    ["Plakat finalisieren", "Druckerei braucht PDF/X bis zur Deadline", "doing", "high", 6],
    ["Probenfotos posten", null, "todo", "normal", 9],
    ["Pressetext an Amtsblatt", null, "done", "normal", -3],
  ],
  "musik-sounddesign-atmosphare": [
    ["Elfenlied arrangieren", null, "doing", "normal", 21],
    ["Waldgeräusche aufnehmen", "Morgens im Schlosspark, Zoom-Recorder", "todo", "low", 26],
  ],
};

async function seedDepartments(premiere: number, finalStart: number) {
  await ensureProductionDepartments(SHOW_ID);
  const departments = await prisma.department.findMany({ where: { showId: SHOW_ID } });
  const bySlug = new Map(departments.map((department) => [department.slug, department]));

  for (const [slug, crew] of Object.entries(CREW)) {
    const department = bySlug.get(slug);
    if (!department) continue;
    const memberships: [string, "lead" | "deputy" | "member"][] = [
      [crew.lead, "lead"],
      ...(crew.deputy ? [[crew.deputy, "deputy"] as [string, "deputy"]] : []),
      ...crew.members.map((key) => [key, "member"] as [string, "member"]),
    ];
    for (const [key, role] of memberships) {
      await prisma.departmentMembership.create({
        data: { departmentId: department.id, userId: uid(key), role, assignedById: uid("miriam") },
      });
    }
    await ensureBoardColumns(department.id);
    const columns = await prisma.departmentBoardColumn.findMany({
      where: { departmentId: department.id },
      orderBy: { position: "asc" },
    });
    for (const [position, [title, description, status, priority, due]] of (
      TASKS[slug] ?? []
    ).entries()) {
      const column = columns.find((entry) => entry.status === status) ?? null;
      const assignees = [crew.lead, ...crew.members].filter(() => chance(0.5)).slice(0, 2);
      await prisma.departmentTask.create({
        data: {
          departmentId: department.id,
          columnId: column?.id ?? null,
          position,
          title,
          description,
          status,
          priority,
          dueAt: due === null ? null : at(due, "20:00"),
          createdById: uid(crew.lead),
          assignments: {
            create: (assignees.length ? assignees : [crew.lead]).map((key) => ({
              userId: uid(key),
            })),
          },
          comments:
            status === "doing"
              ? { create: { authorId: uid(crew.lead), body: "Bin dran – Material ist da." } }
              : undefined,
        },
      });
    }
  }

  // Meilensteine (Zeitleiste der Produktion)
  const milestones: [
    string,
    "milestone" | "deadline" | "handover" | "review",
    "premiere" | "finalRehearsalStart",
    number,
    string | null,
  ][] = [
    ["Aufführungsrechte geklärt", "deadline", "premiere", -180, null],
    ["Genehmigung Schlosspark", "deadline", "premiere", -120, null],
    ["Plakat an Druckerei", "handover", "premiere", -50, "social-media-werbung"],
    ["Kostüm-Anprobe", "review", "finalRehearsalStart", -28, "kostueme"],
    ["Technik vor Bodenschluss", "deadline", "finalRehearsalStart", -24, "technik"],
    ["Bauabgabe Bühne", "handover", "finalRehearsalStart", -21, "buehnenbau"],
    ["Requisiten komplett", "handover", "finalRehearsalStart", -14, null],
    ["Bauprobe", "review", "finalRehearsalStart", -7, null],
    ["Beginn Endprobenwoche", "milestone", "finalRehearsalStart", 0, null],
    ["Premiere", "milestone", "premiere", 0, null],
  ];
  for (const [position, [title, kind, anchorType, offsetDays, slug]] of milestones.entries()) {
    const anchor = anchorType === "premiere" ? premiere : finalStart;
    const due = anchor + offsetDays;
    await prisma.showMilestone.create({
      data: {
        showId: SHOW_ID,
        title,
        kind,
        anchorType,
        offsetDays,
        position,
        departmentId: slug ? bySlug.get(slug)?.id : null,
        doneAt: due < 0 ? new Date(NOW + (due + 1) * DAY) : null,
        doneById: due < 0 ? uid("thomas") : null,
      },
    });
  }
  await recalculateShowPlan(SHOW_ID);
  log(`${departments.length} Gewerke mit Aufgaben und ${milestones.length} Meilensteine angelegt.`);
  return bySlug;
}

// ---------------------------------------------------------------------------
// 5. Sperrliste

const BLOCK_REASONS = [
  "Urlaub",
  "Arbeit",
  "Familienfeier",
  "Prüfung",
  "Hochzeit",
  "Dienstreise",
  null,
];

async function seedBlockedDays(premiere: number) {
  const blocked = new Map<string, Set<number>>();
  for (const person of PEOPLE) {
    const days = new Set<number>();
    const count = person.key === "lena" ? 4 : between(2, 7);
    // ein zusammenhängender Urlaub bei manchen
    if (chance(0.35)) {
      const startOffset = between(5, premiere - 14);
      for (let offset = startOffset; offset < startOffset + between(3, 7); offset += 1)
        days.add(offset);
    }
    while (days.size < count) days.add(between(-20, premiere + 10));
    for (const offset of days) {
      const kind = chance(0.8) ? "BLOCKED" : chance(0.5) ? "LIMITED" : "PREFERRED";
      await prisma.blockedDay.create({
        data: {
          userId: uid(person.key),
          date: dateOnly(offset),
          kind,
          reason:
            kind === "BLOCKED" ? pick(BLOCK_REASONS) : kind === "LIMITED" ? "erst ab 19 Uhr" : null,
        },
      });
    }
    blocked.set(person.key, days);
  }
  log("Sperrliste befüllt.");
  return blocked;
}

// ---------------------------------------------------------------------------
// 6. Termine: Proben, Bautage, Treffen, Vorstellungen

type EventPlan = {
  offset: number;
  title: string;
  kind: "REHEARSAL" | "PERFORMANCE" | "MEETING" | "WORK_DAY" | "SOCIAL";
  start: string;
  end: string;
  location: string;
  status?: "SCHEDULED" | "TENTATIVE";
  scenes?: number[];
  all?: boolean;
  department?: string;
  description?: string;
};

function buildEventPlan(premiere: number, finalStart: number): EventPlan[] {
  const plan: EventPlan[] = [];
  let sceneCursor = 0;
  for (let offset = -42; offset < finalStart; offset += 1) {
    const day = weekday(offset);
    if (day === 2 || day === 4) {
      const scenes = [sceneCursor % SCENES.length, (sceneCursor + 1) % SCENES.length];
      if (offset > -14 && day === 4) scenes.push((sceneCursor + 2) % SCENES.length);
      sceneCursor += 2;
      plan.push({
        offset,
        title: `Szenenprobe ${scenes.map((index) => `${SCENES[index].act}.${index + 1}`).join(", ")}`,
        kind: "REHEARSAL",
        start: "18:30",
        end: "21:30",
        location: "Probenraum Gemeindehaus",
        status: offset > 21 ? "TENTATIVE" : "SCHEDULED",
        scenes,
      });
    }
    if (day === 6 && offset % 14 === 0) {
      plan.push({
        offset,
        title: "Bautag Bühne",
        kind: "WORK_DAY",
        start: "09:00",
        end: "16:00",
        location: "Schlosspark, Bühne",
        department: "buehnenbau",
        description: "Mittagessen gibt's vom Grill. Arbeitshandschuhe mitbringen!",
      });
    }
    if (day === 0 && offset > 0 && offset % 21 < 7 && offset < finalStart - 3) {
      plan.push({
        offset,
        title: "Durchlaufprobe",
        kind: "REHEARSAL",
        start: "10:00",
        end: "15:00",
        location: "Schlosspark, Bühne",
        all: true,
        status: offset > 21 ? "TENTATIVE" : "SCHEDULED",
      });
    }
  }
  plan.push(
    {
      offset: -30,
      title: "Leseprobe",
      kind: "REHEARSAL",
      start: "18:00",
      end: "21:00",
      location: "Gemeindehaus, Saal",
      all: true,
    },
    {
      offset: -9,
      title: "Produktionstreffen",
      kind: "MEETING",
      start: "19:30",
      end: "21:00",
      location: "Gemeindehaus, Saal",
      all: true,
      description: "Stand der Gewerke, Plakat, Verpflegung Endprobenwoche.",
    },
    {
      offset: 10,
      title: "Kostümanprobe Liebespaare",
      kind: "MEETING",
      start: "17:00",
      end: "18:30",
      location: "Kostümfundus",
      scenes: [6],
    },
    {
      offset: 24,
      title: "Produktionstreffen",
      kind: "MEETING",
      start: "19:30",
      end: "21:00",
      location: "Gemeindehaus, Saal",
      all: true,
    },
  );
  for (let offset = finalStart; offset < premiere; offset += 1) {
    const last = offset === premiere - 1;
    plan.push({
      offset,
      title: last ? "Generalprobe" : offset === premiere - 2 ? "Hauptprobe" : "Endprobe",
      kind: "REHEARSAL",
      start: "17:00",
      end: "22:30",
      location: "Schlosspark, Bühne",
      all: true,
    });
  }
  for (const [index, offset] of [premiere, premiere + 1, premiere + 7, premiere + 8].entries()) {
    plan.push({
      offset,
      title: index === 0 ? "Premiere" : `${index + 1}. Vorstellung`,
      kind: "PERFORMANCE",
      start: index === 1 ? "15:00" : "19:30",
      end: index === 1 ? "17:30" : "22:00",
      location: "Schlosspark Altroßthal",
      all: true,
    });
  }
  plan.push({
    offset: premiere + 9,
    title: "Abbau & Sommerfest",
    kind: "SOCIAL",
    start: "14:00",
    end: "23:00",
    location: "Schlosspark Altroßthal",
    all: true,
    description: "Erst gemeinsam abbauen, dann feiern. Partner und Familie willkommen!",
  });
  return plan.sort((a, b) => a.offset - b.offset);
}

const PROTOCOL_NOTES = [
  ["NOTE", "Auftritt von links statt rechts – Weg über die Treppe ist zu lang."],
  ["DECISION", "Die Lieder im 2. Akt werden live gesungen, nicht vom Band."],
  ["TASK", "Text bis zur nächsten Probe sicher!"],
  ["NOTE", "Szene läuft schon gut, Tempo am Ende anziehen."],
  ["TASK", "Requisite: Laterne für Squenz fehlt noch."],
] as const;

async function seedEvents(
  premiere: number,
  finalStart: number,
  sceneIds: string[],
  departments: Map<string, { id: string }>,
  blocked: Map<string, Set<number>>,
) {
  const context = await loadAudienceContext(SHOW_ID);
  const keyById = new Map([...ids.entries()].map(([key, id]) => [id, key]));
  let count = 0;

  for (const entry of buildEventPlan(premiere, finalStart)) {
    const dateKey = dayKey(entry.offset);
    const start = at(entry.offset, entry.start);
    const department = entry.department ? departments.get(entry.department) : undefined;
    const event = await prisma.calendarEvent.create({
      data: {
        title: entry.title,
        kind: entry.kind,
        status: entry.status ?? "SCHEDULED",
        start,
        end: at(entry.offset, entry.end),
        location: entry.location,
        description: entry.description ?? null,
        showId: SHOW_ID,
        createdById: uid("miriam"),
        responseDeadline: entry.offset > 3 ? at(entry.offset - 3, "23:59") : null,
        scheduleMode: entry.scenes && entry.scenes.length > 2 ? "STAGGERED" : "TOGETHER",
      },
    });
    const scenes = (entry.scenes ?? []).map((index) => sceneIds[index]);

    await prisma.$transaction(async (tx) => {
      if (department) {
        await saveEventBlocks(tx, {
          eventId: event.id,
          dateKey,
          eventStart: start,
          blocks: [
            {
              id: crypto.randomUUID(),
              type: "DEPARTMENT",
              title: "Podeste und Laube bauen",
              departmentId: department.id,
              start: entry.start,
              end: entry.end,
              location: "",
              description: "",
              timesChanged: true,
            },
          ],
        });
      }
      const rules = entry.all
        ? [{ type: "PRODUCTION_ALL" as const, targetId: null, level: "REQUIRED" as const }]
        : scenes.map((sceneId) => ({
            type: "SCENE" as const,
            targetId: sceneId,
            level: "REQUIRED" as const,
          }));
      await saveEventAudience(tx, event.id, { rules, overrides: [] }, context);
      if (scenes.length) {
        const staggered = scenes.length > 2;
        await saveEventSchedule(tx, {
          eventId: event.id,
          sceneIds: scenes,
          schedule: {
            mode: staggered ? "STAGGERED" : "TOGETHER",
            times: staggered
              ? Object.fromEntries(
                  scenes.map((sceneId, index) => [
                    sceneId,
                    {
                      start: ["18:30", "19:30", "20:30"][index],
                      end: ["19:30", "20:30", "21:30"][index],
                    },
                  ]),
                )
              : {},
            rooms: {},
            blocks: [],
          },
          dateKey,
          eventStart: start,
          context,
        });
      }
    });

    // Rückmeldungen und Anwesenheit
    const participants = await prisma.eventParticipant.findMany({ where: { eventId: event.id } });
    const past = entry.offset < 0;
    for (const participant of participants) {
      const key = keyById.get(participant.userId) ?? "";
      const isBlocked = blocked.get(key)?.has(entry.offset) ?? false;
      let response: "yes" | "no" | "maybe" | null = null;
      if (past || entry.offset < 21 || chance(0.4)) {
        response = isBlocked ? "no" : chance(0.08) ? "maybe" : chance(0.9) ? "yes" : null;
      }
      if (key === "lena" && entry.offset >= 0 && entry.offset < 14)
        response = isBlocked ? "no" : null;
      await prisma.eventParticipant.update({
        where: { id: participant.id },
        data: {
          response,
          respondedAt: response ? new Date(NOW - between(1, 10) * DAY) : null,
          responseNote: response === "no" && chance(0.5) ? "Bin leider beruflich unterwegs." : null,
          attendance: past
            ? response === "no"
              ? "EXCUSED"
              : chance(0.1)
                ? "LATE"
                : chance(0.04)
                  ? "ABSENT"
                  : "PRESENT"
            : null,
        },
      });
    }

    // Probenprotokolle der vergangenen Proben
    if (past && entry.kind === "REHEARSAL") {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          actualStart: start,
          actualEnd: at(entry.offset, entry.end),
          protocolSummary: "Konzentrierte Probe, gute Stimmung. Nächstes Mal mit Requisiten.",
          protocolSentAt: at(entry.offset, "23:00"),
        },
      });
      await prisma.eventBlock.updateMany({
        where: { eventId: event.id, type: "SCENE" },
        data: { outcome: "DONE" },
      });
      for (const [type, text] of [pick(PROTOCOL_NOTES), pick(PROTOCOL_NOTES)]) {
        await prisma.eventNote.create({
          data: {
            eventId: event.id,
            type,
            text,
            authorId: uid("miriam"),
            assigneeUserId: type === "TASK" ? uid(pick(["bernd", "felix", "lena", "ute"])) : null,
            doneAt: type === "TASK" && chance(0.5) ? new Date(NOW - DAY) : null,
          },
        });
      }
    }
    count += 1;
  }
  log(`${count} Termine mit Teilnehmenden angelegt.`);
}

// ---------------------------------------------------------------------------
// 7. Endprobenwoche, Profile, Fotoerlaubnis, Finanzen, Sonstiges

async function seedFinalWeek(premiere: number, finalStart: number) {
  const duties: [string, string, number, number, string][] = [
    ["Mittagessen kochen", "Küche Gemeindehaus", 11 * 60, 13 * 60, "sandra"],
    ["Abendessen ausgeben", "Zelt hinter der Bühne", 17 * 60, 18 * 60, "greta"],
    ["Bühne fegen und Requisiten stellen", "Bühne", 16 * 60, 17 * 60, "ole"],
    ["Kasse und Einlass proben", "Eingang Schlosspark", 18 * 60, 19 * 60, "thomas"],
  ];
  for (let offset = finalStart; offset < premiere; offset += 1) {
    for (const [title, location, startTime, endTime, key] of duties) {
      if (title.startsWith("Kasse") && offset < premiere - 2) continue;
      await prisma.finalRehearsalDuty.create({
        data: {
          showId: SHOW_ID,
          date: dateOnly(offset),
          title,
          location,
          startTime,
          endTime,
          assigneeId: chance(0.75) ? uid(key) : null,
          createdById: uid("sandra"),
        },
      });
    }
  }
}

const INTERESTS = [
  "Schauspiel",
  "Gesang",
  "Tanz",
  "Bühnenbau",
  "Licht",
  "Ton",
  "Kostüm",
  "Maske",
  "Fotografie",
  "Social Media",
  "Kochen",
  "Requisite",
  "Musik",
  "Orga",
];

async function seedProfiles() {
  const interestIds = new Map<string, string>();
  for (const name of INTERESTS) {
    const created = await prisma.interest.create({ data: { name } });
    interestIds.set(name, created.id);
  }
  const taxa = new Set(
    (
      await prisma.foodTaxon.findMany({
        where: { code: { in: ["en:nuts", "en:gluten", "en:milk", "en:peanuts", "en:celery"] } },
        select: { code: true },
      })
    ).map((taxon) => taxon.code),
  );
  const allergies: [
    string,
    string,
    "ALLERGY" | "INTOLERANCE",
    "MILD" | "MODERATE" | "SEVERE" | "LETHAL",
  ][] = [
    ["Haselnüsse", "en:nuts", "ALLERGY", "SEVERE"],
    ["Gluten", "en:gluten", "INTOLERANCE", "MODERATE"],
    ["Laktose", "en:milk", "INTOLERANCE", "MILD"],
    ["Erdnüsse", "en:peanuts", "ALLERGY", "LETHAL"],
    ["Sellerie", "en:celery", "ALLERGY", "MILD"],
  ];

  for (const person of PEOPLE) {
    const userId = uid(person.key);
    const cast = person.focus !== "tech";
    const female = person.gender === "w";
    const height =
      person.age < 14 ? between(140, 160) : female ? between(158, 178) : between(170, 192);
    if (cast || chance(0.4)) {
      const measurements: [MeasurementType, number, "CM" | "EU"][] = [
        ["HEIGHT", height, "CM"],
        ["CHEST", female ? between(80, 104) : between(90, 112), "CM"],
        ["WAIST", female ? between(64, 90) : between(76, 100), "CM"],
        ["HIPS", female ? between(88, 110) : between(90, 106), "CM"],
        ["INSEAM", Math.round(height * 0.45), "CM"],
        ["HEAD", between(53, 59), "CM"],
        ["SHOE_SIZE", female ? between(36, 41) : between(41, 46), "EU"],
      ];
      for (const [type, value, unit] of measurements) {
        if (person.key !== "lena" && chance(0.1)) continue;
        await prisma.memberMeasurement.create({
          data: { userId, type, value, unit },
        });
      }
      await prisma.memberSize.create({
        data: {
          userId,
          category: "Oberteil",
          size: pick(female ? ["S", "M", "L"] : ["M", "L", "XL"]),
        },
      });
    }
    if (chance(0.22)) {
      const [allergen, code, kind, level] = pick(allergies);
      await prisma.dietaryRestriction.create({
        data: {
          userId,
          allergen,
          taxonCode: taxa.has(code) ? code : null,
          kind,
          level,
          symptoms: level === "LETHAL" || level === "SEVERE" ? "Atemnot, Schwellungen" : null,
          treatment: level === "LETHAL" ? "Notfallset (Adrenalin-Pen) in der Jackentasche" : null,
        },
      });
    }
    const dietary = pick(["omnivore", "omnivore", "omnivore", "vegetarian", "vegan"]);
    await prisma.memberOnboardingProfile.create({
      data: {
        userId,
        showId: SHOW_ID,
        focus: person.focus,
        gender: female ? "weiblich" : "männlich",
        memberSinceYear: person.sinceYear,
        dietaryPreference: dietary,
        educationCategory: person.age < 19 ? "school" : person.age < 27 ? "university" : "work",
        educationSchoolName: person.age < 19 ? "Gymnasium Altroßthal" : null,
        educationClassName: person.age < 19 ? `${Math.max(5, person.age - 6)}b` : null,
        educationUniversityName: person.age >= 19 && person.age < 27 ? "TU Dresden" : null,
      },
    });
    await prisma.productionOnboarding.create({
      data: {
        userId,
        showId: SHOW_ID,
        focus: person.focus,
        isReturning: person.sinceYear < new Date().getUTCFullYear() - 1,
        completedAt: new Date(NOW - between(40, 65) * DAY),
      },
    });
    for (const name of INTERESTS.filter(() => chance(0.2)).slice(0, 4)) {
      await prisma.userInterest.create({ data: { userId, interestId: interestIds.get(name)! } });
    }
    const preferences = cast
      ? [
          ["acting_lead", "acting", between(40, 100)],
          ["acting_medium", "acting", between(40, 100)],
        ]
      : [];
    if (person.focus !== "acting") {
      preferences.push([
        pick(["crew_stage", "crew_tech", "crew_costume", "crew_music", "crew_marketing"]),
        "crew",
        100,
      ]);
    }
    for (const [code, domain, weight] of preferences) {
      await prisma.memberRolePreference.create({
        data: {
          userId,
          showId: SHOW_ID,
          code: code as string,
          domain: domain as "acting" | "crew",
          weight: weight as number,
        },
      });
    }

    // Fotoerlaubnis: die meisten erteilt, ein paar offen (Minderjährige ohne Unterschrift)
    const minor = person.age < 18;
    const status = minor && chance(0.5) ? "pending" : chance(0.08) ? "noPhotos" : "approved";
    await prisma.photoConsent.create({
      data: {
        userId,
        showId: SHOW_ID,
        status,
        level:
          status === "approved"
            ? pick(["all", "all", "promoOnRequest", "internal"])
            : status === "noPhotos"
              ? "none"
              : null,
        approvedAt: status === "approved" ? new Date(NOW - between(5, 40) * DAY) : null,
        approvedById: status === "approved" ? uid("thomas") : null,
      },
    });
  }
  log("Profile, Maße, Ernährung, Fotoerlaubnisse angelegt.");
}

async function seedFinance() {
  const budgets: [string, number][] = [
    ["Bühnenbau", 2500],
    ["Kostüme & Maske", 1800],
    ["Technik", 1500],
    ["Werbung & Druck", 900],
    ["Verpflegung", 1200],
    ["Rechte & GEMA", 600],
  ];
  const budgetIds = new Map<string, string>();
  for (const [category, plannedAmount] of budgets) {
    const created = await prisma.financeBudget.create({
      data: { showId: SHOW_ID, category, plannedAmount },
    });
    budgetIds.set(category, created.id);
  }
  const entries: [
    string,
    "income" | "expense",
    "general" | "invoice" | "donation",
    number,
    string,
    number,
    "draft" | "pending" | "approved" | "paid",
    string | null,
    string | null,
  ][] = [
    [
      "Holz und Schrauben (Baumarkt)",
      "expense",
      "invoice",
      412.37,
      "Bühnenbau",
      -20,
      "paid",
      "Baumarkt Meißen",
      null,
    ],
    [
      "Stoffe für Elfenkostüme",
      "expense",
      "general",
      186.5,
      "Kostüme & Maske",
      -12,
      "approved",
      "Stoffhaus Dresden",
      "julia",
    ],
    [
      "Plakatdruck A1/A3",
      "expense",
      "invoice",
      329.0,
      "Werbung & Druck",
      -4,
      "pending",
      "Druckerei Wirth",
      null,
    ],
    [
      "Aufführungsrechte",
      "expense",
      "invoice",
      480.0,
      "Rechte & GEMA",
      -60,
      "paid",
      "Theaterverlag",
      null,
    ],
    [
      "LED-Scheinwerfer Miete",
      "expense",
      "invoice",
      640.0,
      "Technik",
      40,
      "draft",
      "Licht & Ton Vermietung",
      null,
    ],
    [
      "Schminke und Abschminktücher",
      "expense",
      "general",
      74.9,
      "Kostüme & Maske",
      -2,
      "pending",
      "Drogerie",
      "anna",
    ],
    ["Zuschuss Gemeinde", "income", "general", 1500, "", -45, "paid", "Gemeinde Altroßthal", null],
    ["Spende Bäckerei Sonnenschein", "income", "donation", 250, "", -18, "paid", null, null],
    ["Sponsoring Autohaus", "income", "general", 800, "", -25, "approved", null, null],
    ["Ticketvorverkauf (Stand heute)", "income", "general", 2340, "", 0, "pending", null, null],
  ];
  for (const [title, type, kind, amount, category, offset, status, vendor, paidBy] of entries) {
    await prisma.financeEntry.create({
      data: {
        showId: SHOW_ID,
        title,
        type,
        kind,
        amount,
        category: category || null,
        budgetId: category ? budgetIds.get(category) : null,
        bookingDate: new Date(NOW + offset * DAY),
        paidAt: status === "paid" ? new Date(NOW + offset * DAY) : null,
        status,
        vendor,
        memberPaidById: paidBy ? uid(paidBy) : null,
        donationSource: kind === "donation" ? "Bäckerei Sonnenschein" : null,
        createdById: uid("thomas"),
        approvedById: status === "approved" || status === "paid" ? uid("thomas") : null,
        approvedAt:
          status === "approved" || status === "paid" ? new Date(NOW + offset * DAY) : null,
      },
    });
  }
  log("Finanzen angelegt.");
}

async function seedMisc() {
  const issues: [
    string,
    string,
    "improvement" | "website_bug" | "support",
    "open" | "in_progress" | "resolved",
    string,
  ][] = [
    [
      "Kalender-Abo im iPhone zeigt alte Uhrzeit",
      "Nach Verschiebung der Probe am Donnerstag stand im Kalender noch 18 Uhr.",
      "website_bug",
      "in_progress",
      "katharina",
    ],
    [
      "Wunsch: Textbuch-Seiten pro Szene",
      "Wäre toll, bei jeder Szene die Seitenzahlen im Textbuch zu sehen.",
      "improvement",
      "open",
      "bernd",
    ],
    [
      "Passwort vergessen",
      "Hab mein Passwort vergessen – wer kann helfen?",
      "support",
      "resolved",
      "wolfgang",
    ],
  ];
  for (const [title, description, category, status, key] of issues) {
    await prisma.issue.create({
      data: {
        title,
        description,
        category,
        status,
        createdById: uid(key),
        resolvedAt: status === "resolved" ? new Date(NOW - 3 * DAY) : null,
        comments: {
          create: {
            authorId: uid("admin"),
            body:
              status === "resolved"
                ? "Erledigt, bitte nochmal probieren."
                : "Danke, schauen wir uns an!",
          },
        },
      },
    });
  }

  const notifications: [string, string, string, string][] = [
    [
      "Neue Probe angesetzt",
      "Miriam hat eine Probe für deine Szenen geplant. Bitte gib Rückmeldung.",
      "proben",
      "/mitglieder/meine-proben",
    ],
    [
      "Deine Fotoerlaubnis wurde bestätigt",
      "Danke! Für diese Produktion ist alles erledigt.",
      "produktion",
      "/mitglieder/fotoerlaubnisse",
    ],
    [
      "Neue Aufgabe im Bühnenbau",
      "Jonas hat dich der Aufgabe „Podeste für die Lichtung bauen“ zugeordnet.",
      "gewerke",
      "/mitglieder/meine-gewerke/buehnenbau",
    ],
  ];
  for (const [index, [title, body, category, actionUrl]] of notifications.entries()) {
    await prisma.notification.create({
      data: {
        title,
        body,
        category,
        actionUrl,
        showId: SHOW_ID,
        createdAt: new Date(NOW - (index + 1) * 5 * 3_600_000),
        recipients: {
          create: DEMO_PERSONAS.map((persona) => ({
            userId: persona.id,
            readAt: index > 0 ? new Date(NOW - 3_600_000) : null,
          })),
        },
      },
    });
  }

  // Demo zeigt alle Seiten, Rechte wie vorgesehen (Maße nur fürs Kostüm-Team).
  await prisma.websiteSettings.updateMany({ data: { pageVisibility: Prisma.DbNull } });
  const measurement = await prisma.permission.findUnique({
    where: { key: "PRIVATE.PROFILE.MEASUREMENTS.MANAGE" },
  });
  const member = await prisma.appRole.findUnique({ where: { name: "member" } });
  if (measurement && member) {
    await prisma.appRolePermission.deleteMany({
      where: { roleId: member.id, permissionId: measurement.id },
    });
  }
}

const RECIPES = [
  {
    title: "Linsen-Dal für die Endprobenwoche",
    description: "Vegan, sättigend, gut für große Mengen.",
    servings: 30,
    prepMinutes: 20,
    cookMinutes: 40,
    tags: ["Eintopf", "Großküche", "vegan"],
    steps: [
      "Zwiebeln und Knoblauch glasig dünsten.",
      "Linsen, Kurkuma und Kokosmilch dazu, 25 Minuten köcheln.",
      "Mit Salz und Zitrone abschmecken, Reis dazu.",
    ],
    ingredients: [
      "2 kg rote Linsen",
      "8 Zwiebeln",
      "1 Knolle Knoblauch",
      "200 ml Rapsöl",
      "4 l Kokosmilch",
      "4 EL Kurkuma",
      "4 Zitronen",
      "Salz",
    ],
  },
  {
    title: "Kartoffelgratin vom Blech",
    description: "Klassiker für die Generalprobe.",
    servings: 24,
    prepMinutes: 40,
    cookMinutes: 60,
    tags: ["Ofen", "vegetarisch"],
    steps: ["Kartoffeln in Scheiben schneiden.", "Mit Sahne und Käse schichten und backen."],
    ingredients: [
      "6 kg Kartoffeln",
      "2 l Sahne",
      "800 g Emmentaler",
      "3 Zehen Knoblauch",
      "Salz",
      "Muskat",
    ],
  },
  {
    title: "Elfen-Muffins",
    description: "Für die Kinder im Ensemble – nussfrei!",
    servings: 24,
    prepMinutes: 20,
    cookMinutes: 25,
    tags: ["Kuchen", "nussfrei"],
    steps: [
      "Alles verrühren, in Förmchen füllen.",
      "Bei 180 °C backen, mit Puderzucker bestäuben.",
    ],
    ingredients: [
      "400 g Weizenmehl",
      "250 g Zucker",
      "250 g Butter",
      "5 Eier",
      "1 Pck. Backpulver",
      "200 g Heidelbeeren",
    ],
  },
];

async function seedRecipes() {
  const author = uid("sandra");
  for (const recipe of RECIPES) {
    const created = await createRecipe(
      {
        sourceUrl: null,
        sourceName: null,
        ...recipe,
        ingredients: recipe.ingredients.map((rawText) => ({ rawText })),
      },
      author,
    );
    await rateRecipe(created.id, uid("greta"), between(4, 5));
    await rateRecipe(created.id, uid("lena"), between(3, 5));
  }
  const dal = await prisma.recipe.findFirst({ where: { title: RECIPES[0].title } });
  if (dal) await commentRecipe(dal.id, uid("greta"), "Mit frischem Koriander noch besser!");
  log("Rezepte angelegt.");
}

// ---------------------------------------------------------------------------

async function main() {
  await resetDatabase();
  await importStammdaten();
  await ensurePermissionDefinitions();
  await applyAusstattungDefaults();
  await seedPeople();
  const { premiere, finalStart, sceneIds, characterIds } = await seedProductions();
  const departments = await seedDepartments(premiere, finalStart);
  await seedDemoAusstattung(SHOW_ID, characterIds, sceneIds, uid);
  const blocked = await seedBlockedDays(premiere);
  await seedEvents(premiere, finalStart, sceneIds, departments, blocked);
  await seedFinalWeek(premiere, finalStart);
  await seedProfiles();
  await seedFinance();
  await seedMisc();
  await seedRecipes();
  await seedDemoLager();
  log("Fertig.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
