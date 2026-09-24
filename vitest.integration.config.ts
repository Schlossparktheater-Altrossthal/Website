import { defineConfig, mergeConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";

import baseConfig from "./vitest.config";

const baseUrl = process.env.IT_PG_URL ?? "postgresql://postgres:pw@127.0.0.1:15432";
const dbName = process.env.IT_DB_NAME ?? "mb_it";

// Dateien laufen nach Namen (01-migration zuerst: prüft den unberührten Stand nach der Migration).
class ByNameSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

// Integrationstests gegen echten Postgres mit Prod-Dump: `npm run test:integration`.
const merged = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["tests/integration/**/*.it.test.ts"],
      globalSetup: ["tests/integration/global-setup.ts"],
      setupFiles: ["tests/integration/setup.ts"],
      fileParallelism: false,
      sequence: { sequencer: ByNameSequencer },
      testTimeout: 30_000,
      hookTimeout: 300_000,
      env: { DATABASE_URL: `${baseUrl}/${dbName}`, MAIL_DISABLED: "" },
    },
  }),
);

// mergeConfig hängt Listen an – die Unit-Konfiguration schließt tests/integration aus.
merged.test!.exclude = ["**/node_modules/**"];

export default merged;
