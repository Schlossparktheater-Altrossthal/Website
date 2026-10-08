// Demo-Lager für lokales Testen und Screenshots (docs/Plan/lager-typen-projekte-plan.md).
//
//   DATABASE_URL=… pnpm demo:lager          # anlegen bzw. neu anlegen
//   DATABASE_URL=… pnpm demo:lager --remove # wieder entfernen
//
// Inhalt siehe scripts/demo/lager.ts. Nur für lokale/Test-DBs.

import { prisma } from "@/lib/prisma";

import { removeDemoLager, seedDemoLager } from "./demo/lager";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|mb-test-pg/.test(url)) {
    throw new Error("Nur gegen lokale Datenbanken (DATABASE_URL mit localhost).");
  }
  const removed = await removeDemoLager();
  if (process.argv.includes("--remove")) {
    console.log(`${removed} Demo-Artikeltypen entfernt.`);
    return;
  }
  await seedDemoLager();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
