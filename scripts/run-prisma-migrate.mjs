#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function shouldSkip() {
  const flag = process.env.SKIP_PRISMA_MIGRATE;
  if (!flag) return false;
  const normalized = flag.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

if (shouldSkip()) {
  console.log("[prisma-migrate] Skipping Prisma migrations because SKIP_PRISMA_MIGRATE is set.");
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn("[prisma-migrate] DATABASE_URL is not set; skipping Prisma migrations.");
  process.exit(0);
}

const prismaExecutable = join(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

if (!existsSync(prismaExecutable)) {
  console.warn(
    `[prisma-migrate] Prisma CLI executable not found at ${prismaExecutable}. Have you installed dependencies yet?`,
  );
  process.exit(0);
}

try {
  console.log("[prisma-migrate] Ensuring database schema is up to date (prisma migrate deploy)...");
  execFileSync(prismaExecutable, ["migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
  console.log("[prisma-migrate] Prisma migrations applied successfully.");
} catch (error) {
  console.error("[prisma-migrate] Failed to apply Prisma migrations.");
  if (error instanceof Error && error.message) {
    console.error(error.message);
  }
  process.exit(typeof error?.status === "number" ? error.status : 1);
}
