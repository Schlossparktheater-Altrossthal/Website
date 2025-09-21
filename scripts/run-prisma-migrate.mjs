#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function shouldSkip() {
  const flag = process.env.SKIP_PRISMA_MIGRATE;
  if (!flag) return false;
  const normalized = flag.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

async function announceOwnerSetupLink() {
  const prisma = new PrismaClient();
  try {
    const ownerCount = await prisma.user.count({
      where: {
        OR: [{ role: "owner" }, { roles: { some: { role: "owner" } } }],
      },
    });

    const ownerAlreadyExists = ownerCount > 0;
    const removed = await prisma.ownerSetupToken.deleteMany({ where: { consumedAt: null } });
    if (removed.count > 0) {
      console.log(
        `[owner-setup] Removed ${removed.count} unused owner setup token(s) before generating a fresh link.`,
      );
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await prisma.ownerSetupToken.create({ data: { tokenHash } });

    const configuredBase =
      (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) ||
      (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.trim()) ||
      "";
    const normalizedBase = configuredBase.replace(/\/$/, "");
    const port = process.env.PORT || process.env.APP_PORT || "3000";
    const fallbackBase = `http://localhost:${port}`;
    const baseUrl = normalizedBase || fallbackBase;
    const link = `${baseUrl}/setup/owner/${rawToken}`;

    if (ownerAlreadyExists) {
      console.log(
        "[owner-setup] Hinweis: Es existiert bereits mindestens ein Owner-Konto. Mit dem folgenden Link kannst du einen weiteren Owner hinzufügen oder Zugangsdaten erneuern.",
      );
    } else {
      console.log(
        "[owner-setup] Kein Owner-Account gefunden. Bitte richte über den folgenden Link einen Owner ein:",
      );
    }
    console.log(`[owner-setup]   ${link}`);
    if (!normalizedBase) {
      console.log(
        `[owner-setup] Hinweis: Passe den Host an, falls der Server nicht unter ${fallbackBase} erreichbar ist.`,
      );
    }
    console.log("[owner-setup] Der Link ist einmalig gültig und wird ungültig, sobald er verwendet wurde.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[owner-setup] Konnte Owner-Setup-Link nicht erzeugen: ${message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (shouldSkip()) {
    console.log("[prisma-migrate] Skipping Prisma migrations because SKIP_PRISMA_MIGRATE is set.");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[prisma-migrate] DATABASE_URL is not set; skipping Prisma migrations.");
    return;
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
    return;
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

  await announceOwnerSetupLink();
}

main().catch((error) => {
  console.error("[prisma-migrate] Unexpected error", error);
  process.exit(1);
});
