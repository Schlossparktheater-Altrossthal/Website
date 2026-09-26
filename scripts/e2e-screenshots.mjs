#!/usr/bin/env node
// Screenshots angemeldeter Seiten, hell und dunkel (docs/e2e-tests.md).
//   pnpm e2e:screenshots [--role admin] [--viewport mobile,tablet-portrait,desktop] [--out dir] [/mitglieder/proben ...]
// Viewports: mobile (390x844), tablet-portrait (834x1112), tablet-small (768x1024),
// tablet-landscape (1024x768), desktop (1440x900) oder "all". --mobile ist ein Alias für mobile.
// Ziel: E2E_BASE_URL (Standard http://localhost:3000), auf Staging mit E2E_LOGIN_SECRET.
// Bilder landen außerhalb des Repos bzw. in ignorierten Ordnern (keine Binärdateien committen).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  SCRIPT_ROOT,
  createAuthedContext,
  launchBrowser,
  loadE2EEnv,
  resolveBaseURL,
  resolveViewports,
  waitForPageReady,
} from "./lib/e2e-session.mjs";

loadE2EEnv();

const root = SCRIPT_ROOT;

const DEFAULT_ROUTES = [
  "/mitglieder",
  "/mitglieder/meine-proben",
  "/mitglieder/proben",
  "/mitglieder/produktionen",
  "/mitglieder/profil",
  "/mitglieder/mitgliederverwaltung",
  "/mitglieder/sperrliste",
];

// `pnpm e2e:screenshots -- --role x` reicht das `--` durch; parseArgs würde danach alles
// als Route lesen.
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();

const { values, positionals } = parseArgs({
  args,
  allowPositionals: true,
  options: {
    role: { type: "string", default: "admin" },
    out: { type: "string" },
    "base-url": { type: "string" },
    mobile: { type: "boolean", default: false },
    viewport: { type: "string" },
  },
});

const baseURL = resolveBaseURL(values["base-url"]);
const secret = process.env.E2E_LOGIN_SECRET ?? "";
const routes = positionals.length ? positionals : DEFAULT_ROUTES;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(values.out ?? path.join(root, "test-results", "screenshots", stamp));
mkdirSync(outDir, { recursive: true });

const viewports = resolveViewports({ viewport: values.viewport, mobile: values.mobile });
const browser = await launchBrowser();
let failed = false;
try {
  for (const { viewport, colorScheme } of viewports.flatMap((viewport) =>
    ["light", "dark"].map((colorScheme) => ({ viewport, colorScheme })),
  )) {
    const viewportDir = path.join(outDir, viewport.name);
    mkdirSync(viewportDir, { recursive: true });
    const context = await createAuthedContext(browser, {
      baseURL,
      role: values.role,
      secret,
      viewport,
      colorScheme,
    });

    const page = await context.newPage();
    page.on("pageerror", (error) =>
      console.error(`[${viewport.name}/${colorScheme}] pageerror:`, error.message),
    );
    for (const route of routes) {
      const name = `${viewport.name}-${values.role}-${colorScheme}${route.replace(/[^a-z0-9]+/gi, "_")}.png`;
      try {
        await page.goto(route, { waitUntil: "networkidle" });
        // Client-Session (useSession) und Skeletons nachladen lassen, sonst halbfertige Seiten.
        await waitForPageReady(page, { route });
        if (page.url().includes("/login")) console.warn(`[${route}] Weiterleitung zum Login`);
        await page.screenshot({ path: path.join(viewportDir, name), fullPage: true });
        console.warn(`✓ ${name}`);
      } catch (error) {
        failed = true;
        console.error(`✗ ${route}:`, error instanceof Error ? error.message : error);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.warn(`Screenshots in ${outDir}`);
process.exit(failed ? 1 : 0);
