import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Baut für jeden Lauf eine frische Datenbank wie beim Prod-Release:
 * Prod-Dump laden → zweite Produktion „???“ (2027) wie in Prod → Stand vor der Migration
 * festhalten → `prisma migrate deploy`.
 *
 * Konfiguration (Defaults passen zum lokalen Container `mb-test-pg`):
 *   IT_PG_CONTAINER   Docker-Container mit Postgres     (mb-test-pg)
 *   IT_PG_URL         Basis-URL ohne Datenbank          (postgresql://postgres:pw@127.0.0.1:15432)
 *   IT_DB_NAME        Name der Testdatenbank            (mb_it)
 *   IT_DUMP           Pfad zum Prod-Dump (Plain-SQL)    (~/theater_prod_dump.sql)
 */
export const SNAPSHOT_FILE = path.resolve(__dirname, ".pre-migration.json");

const container = process.env.IT_PG_CONTAINER ?? "mb-test-pg";
const baseUrl = process.env.IT_PG_URL ?? "postgresql://postgres:pw@127.0.0.1:15432";
const dbName = process.env.IT_DB_NAME ?? "mb_it";
const dump = process.env.IT_DUMP ?? path.join(process.env.HOME ?? "", "theater_prod_dump.sql");

function psql(sql: string, db = dbName): string {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-Atq"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

export default function setup() {
  if (!existsSync(dump)) {
    throw new Error(`Prod-Dump nicht gefunden: ${dump} (IT_DUMP setzen)`);
  }

  psql(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE); CREATE DATABASE ${dbName};`, "postgres");
  execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", dbName, "-q", "-o", "/dev/null"],
    {
      input: readFileSync(dump),
      maxBuffer: 1024 * 1024 * 1024,
      stdio: ["pipe", "ignore", "ignore"],
    },
  );

  // Prod hat zusätzlich den Teaser „???“ (2027) – genau das brach die ersten Backfills.
  // Ältere Dumps (Juni) kennen ihn noch nicht.
  psql(`INSERT INTO "Show" (id, year, title, dates)
    SELECT 'show2027', 2027, '???', 'null'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM "Show" WHERE title = '???');`);

  const snapshot = {
    consents: Number(psql(`SELECT count(*) FROM "PhotoConsent"`)),
    // Mitgliedschaften, die es in „???“ schon vor der Migration gab (z. B. der Owner, der sie anlegte).
    teaserMembers: psql(`SELECT pm."userId" FROM "ProductionMembership" pm
      JOIN "Show" s ON s.id = pm."showId" WHERE s.title = '???' ORDER BY 1`)
      .split("\n")
      .filter(Boolean),
    consentStatus: JSON.parse(
      psql(`SELECT coalesce(json_object_agg("userId", status), '{}') FROM "PhotoConsent"`),
    ) as Record<string, string>,
    activeUsers: psql(`SELECT id FROM "User" WHERE "deactivatedAt" IS NULL ORDER BY id`)
      .split("\n")
      .filter(Boolean),
    roles: JSON.parse(
      psql(`SELECT coalesce(json_object_agg(id, roles), '{}') FROM (
        SELECT u.id, array(SELECT DISTINCT r FROM (
          SELECT u.role::text AS r UNION SELECT ur.role::text FROM "UserRole" ur WHERE ur."userId" = u.id
        ) s ORDER BY r) AS roles FROM "User" u) t`),
    ) as Record<string, string[]>,
  };
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot));

  const databaseUrl = `${baseUrl}/${dbName}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ["ignore", "ignore", "inherit"],
  });
}
