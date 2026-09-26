#!/usr/bin/env node
// Interaktiver UI-Check: Seiten öffnen, Schritte ausführen, Überlauf messen, Screenshots und
// Report schreiben (docs/e2e-tests.md).
//
// Warum headless: Playwright prüft vor jedem Klick, ob das Ziel über zwei Animation-Frames
// stabil liegt. Im versteckten Tab des integrierten Editor-Browsers feuert
// requestAnimationFrame gar nicht → Klicks laufen in den Timeout und Screenshots werden
// falsch skaliert. Headless läuft rAF normal, deshalb funktionieren hier normale Klicks.
//
//   pnpm ui:check /mitglieder/datenportal --steps-file test-results/szenario.json --viewport all
//   pnpm ui:check /mitglieder/proben --viewport mobile --scheme dark
//
// Schritte (Array von Objekten):
//   { "action": "goto|click|dblclick|fill|press|select|check|uncheck|hover|wait|waitFor|read|count|screenshot",
//     "target": "<Playwright-Selektor>", "value": "<Text/Option/Taste>", "name": "<Ausgabename>", "ms": 500 }
// `read` legt den Textinhalt (mit "attribute" stattdessen das Attribut), `count` die Trefferzahl
// unter `name` im Report ab.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const USAGE = `pnpm ui:check [/route ...] [Optionen]

  --steps '<json>'        Schritte direkt als JSON
  --steps-file <datei>    Schritte aus Datei (Array oder { "steps": [...] })
  --viewport <liste>      mobile,tablet-portrait,tablet-small,tablet-landscape,desktop oder all
  --scheme <light|dark|all>   Farbschema (Standard: all)
  --role <rolle>          Testrolle (Standard: admin)
  --base-url <url>        Ziel (Standard: E2E_BASE_URL oder http://localhost:3000)
  --out <ordner>          Ausgabeordner (Standard: test-results/ui-check/<Zeitstempel>)
  --timeout <ms>          Timeout je Aktion (Standard: 10000)
  --no-auth               ohne Test-Login (öffentliche Seiten)
  --no-shots              keine Screenshots je Schritt
  --allow-findings        Exit-Code 0 trotz Befunden
  --headed                Browserfenster zeigen
  --slow-mo <ms>          Aktionen verlangsamen (mit --headed)`;

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();

let parsedArgs;
try {
  parsedArgs = parseArgs({
    args,
    allowPositionals: true,
    options: {
      role: { type: "string", default: "admin" },
      out: { type: "string" },
      "base-url": { type: "string" },
      viewport: { type: "string" },
      scheme: { type: "string", default: "all" },
      steps: { type: "string" },
      "steps-file": { type: "string" },
      "no-shots": { type: "boolean", default: false },
      "no-auth": { type: "boolean", default: false },
      "allow-findings": { type: "boolean", default: false },
      headed: { type: "boolean", default: false },
      "slow-mo": { type: "string", default: "0" },
      timeout: { type: "string", default: "10000" },
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(USAGE);
  process.exit(2);
}
const { values, positionals } = parsedArgs;

const OBJECT_ACTIONS = new Set([
  "goto",
  "click",
  "dblclick",
  "fill",
  "press",
  "select",
  "check",
  "uncheck",
  "hover",
  "waitFor",
  "read",
  "count",
  "screenshot",
]);
const TARGET_ACTIONS = new Set([
  "click",
  "dblclick",
  "fill",
  "press",
  "select",
  "check",
  "uncheck",
  "hover",
  "waitFor",
  "read",
  "count",
]);
const VALUE_ACTIONS = new Set(["fill", "press", "select"]);

function parseSteps() {
  const inline = values.steps;
  const file = values["steps-file"];
  if (inline && file) throw new Error("--steps und --steps-file nicht gleichzeitig verwenden");
  if (!inline && !file) return [];

  const source = file ?? "--steps";
  let raw = inline;
  if (file) {
    try {
      raw = readFileSync(path.resolve(file), "utf8");
    } catch (error) {
      throw new Error(`Schrittdatei nicht lesbar (${file}): ${error.message}`);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Schritte aus ${source} sind kein gültiges JSON: ${error.message}`);
  }
  const list = Array.isArray(parsed) ? parsed : parsed.steps;
  if (!Array.isArray(list)) {
    throw new Error(`${source}: erwartet ein Array von Schritten oder { "steps": [...] }`);
  }

  return list.map((step, index) => {
    const where = `${source}, Schritt ${index + 1}`;
    if (typeof step !== "object" || step === null) throw new Error(`${where}: kein Objekt`);
    const action = step.action;
    if (typeof action !== "string") throw new Error(`${where}: "action" fehlt`);
    if (action === "wait") return step;
    if (!OBJECT_ACTIONS.has(action)) {
      throw new Error(`${where}: unbekannte Aktion "${action}"`);
    }
    if (TARGET_ACTIONS.has(action) && typeof step.target !== "string") {
      throw new Error(`${where}: "target" fehlt`);
    }
    if (action === "goto" && typeof step.target !== "string" && typeof step.value !== "string") {
      throw new Error(`${where}: "target" oder "value" (URL) fehlt`);
    }
    if (VALUE_ACTIONS.has(action) && typeof step.value !== "string") {
      throw new Error(`${where}: "value" fehlt`);
    }
    return step;
  });
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

// Dokumentbreite gegen Viewportbreite. Elementgeschachtelte Scroll-Container sind erlaubt
// (AGENTS.md: breite Tabellen/Kalender dürfen in ihrer Karte scrollen), deshalb werden
// Vorfahren mit overflow-x auto/scroll/hidden nicht als Verursacher gemeldet.
function measureOverflow(page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const inScrollContainer = (el) => {
      for (
        let parent = el.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") return true;
      }
      return false;
    };

    const offenders = [];
    if (documentWidth > width + 1) {
      for (const el of document.querySelectorAll("body *")) {
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) continue;
        if (box.right <= width + 1 && box.left >= -1) continue;
        if (inScrollContainer(el)) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className: String(el.className || "").slice(0, 120),
          text: (el.textContent || "").trim().slice(0, 60),
          right: Math.round(box.right),
          width: Math.round(box.width),
        });
      }
    }
    offenders.sort((a, b) => b.right - a.right);
    return {
      viewportWidth: width,
      documentWidth,
      overflows: documentWidth > width + 1,
      offenders: offenders.slice(0, 12),
    };
  });
}

const steps = parseSteps();
const routes = positionals.length ? positionals : ["/mitglieder"];
const schemes = values.scheme === "all" ? ["light", "dark"] : [values.scheme];
if (schemes.some((scheme) => scheme !== "light" && scheme !== "dark")) {
  throw new Error(`--scheme erwartet light, dark oder all (erhalten: ${values.scheme})`);
}
const timeout = Number(values.timeout);
const shotEach = !values["no-shots"];
const baseURL = resolveBaseURL(values["base-url"]);
const secret = process.env.E2E_LOGIN_SECRET ?? "";
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(
  values.out ?? path.join(SCRIPT_ROOT, "test-results", "ui-check", stamp),
);
mkdirSync(outDir, { recursive: true });

const findings = [];
const runs = [];
const addFinding = (run, message, kind = "error") => {
  findings.push({ kind, route: run.route, viewport: run.viewport, scheme: run.scheme, message });
  console.error(`  ✗ ${message}`);
};

const viewports = resolveViewports({ viewport: values.viewport });
const browser = await launchBrowser({ headed: values.headed, slowMo: Number(values["slow-mo"]) });

try {
  for (const viewport of viewports) {
    for (const colorScheme of schemes) {
      const context = await createAuthedContext(browser, {
        baseURL,
        role: values.role,
        secret,
        viewport,
        colorScheme,
        authenticate: !values["no-auth"],
      });
      const runDir = path.join(outDir, `${viewport.name}-${colorScheme}`);
      mkdirSync(runDir, { recursive: true });
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);

      // Fehler der Seite und der Konsole mitschneiden; sie gehören zum jeweiligen Lauf.
      let pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
      });

      for (const route of routes) {
        const run = {
          route,
          viewport: viewport.name,
          scheme: colorScheme,
          shots: [],
          reads: {},
          steps: [],
          overflow: [],
          errors: [],
        };
        runs.push(run);
        console.warn(`▶ ${route} · ${viewport.name}/${colorScheme}`);
        pageErrors = [];

        const shot = async (label, fullPage = true) => {
          const file = path.join(runDir, `${slug(route)}-${label}.png`);
          await page.screenshot({ path: file, fullPage });
          run.shots.push(path.relative(outDir, file));
        };

        try {
          await page.goto(route, { waitUntil: "networkidle" });
          await waitForPageReady(page, { route, timeout });
          const isLoginRoute = route.startsWith("/login");
          if (!isLoginRoute && page.url().includes("/login")) {
            addFinding(run, "Weiterleitung zum Login – Test-Login fehlt oder ist abgelaufen");
          }
          if (shotEach) await shot("00-start");
          const initialOverflow = await measureOverflow(page);
          run.overflow.push({ step: "start", ...initialOverflow });
          if (initialOverflow.overflows) {
            addFinding(
              run,
              `Horizontaler Überlauf beim Laden: Dokument ${initialOverflow.documentWidth}px > Viewport ${initialOverflow.viewportWidth}px`,
            );
          }

          for (const [index, step] of steps.entries()) {
            const label = `${String(index + 1).padStart(2, "0")}-${slug(step.name ?? step.action)}`;
            const result = {
              index: index + 1,
              action: step.action,
              target: step.target ?? null,
              value: step.value ?? null,
            };
            const started = Date.now();
            // count braucht alle Treffer, arbeitende Aktionen genau einen.
            const matches = step.target ? page.locator(step.target) : null;
            const locator = matches ? matches.first() : null;
            try {
              switch (step.action) {
                case "goto":
                  await page.goto(step.value ?? step.target, { waitUntil: "networkidle" });
                  break;
                case "click":
                  await locator.click();
                  break;
                case "dblclick":
                  await locator.dblclick();
                  break;
                case "fill":
                  await locator.fill(step.value);
                  break;
                case "press":
                  await locator.press(step.value);
                  break;
                case "select":
                  await locator.selectOption(step.value);
                  break;
                case "check":
                  await locator.check();
                  break;
                case "uncheck":
                  await locator.uncheck();
                  break;
                case "hover":
                  await locator.hover();
                  break;
                case "wait":
                  await page.waitForTimeout(step.ms ?? 500);
                  break;
                case "waitFor":
                  await locator.waitFor({
                    state: step.state ?? "visible",
                    timeout: step.ms ?? timeout,
                  });
                  break;
                case "read":
                  run.reads[step.name ?? `schritt-${index + 1}`] = step.attribute
                    ? await locator.getAttribute(step.attribute)
                    : (await locator.innerText()).trim();
                  break;
                case "count":
                  run.reads[step.name ?? `schritt-${index + 1}`] = await matches.count();
                  break;
                case "screenshot":
                  await shot(label);
                  break;
              }
              result.ok = true;
            } catch (error) {
              result.ok = false;
              result.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
              addFinding(
                run,
                `Schritt ${index + 1} (${step.action}${step.target ? ` ${step.target}` : ""}): ${result.error}`,
              );
            }
            result.ms = Date.now() - started;
            run.steps.push(result);

            // Klicks verändern die Seite – Zustand dokumentieren, solange er frisch ist.
            const mutating = [
              "click",
              "dblclick",
              "fill",
              "press",
              "select",
              "check",
              "uncheck",
            ].includes(step.action);
            if (mutating) {
              await waitForPageReady(page, { route, timeout });
              if (shotEach) await shot(label, step.fullPage !== false);
              const overflow = await measureOverflow(page);
              run.overflow.push({ step: label, ...overflow });
              if (overflow.overflows) {
                addFinding(
                  run,
                  `Horizontaler Überlauf nach Schritt ${index + 1}: Dokument ${overflow.documentWidth}px > Viewport ${overflow.viewportWidth}px`,
                );
              }
            }
          }

          run.errors = [...pageErrors];
          for (const error of run.errors) addFinding(run, error);
          run.steps.forEach((step) => {
            if (step.ok) console.warn(`  ✓ ${step.index}. ${step.action} (${step.ms} ms)`);
          });
        } catch (error) {
          addFinding(run, error instanceof Error ? error.message.split("\n")[0] : String(error));
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const report = { baseURL, role: values.role, routes, steps, runs, findings, outDir };
const reportFile = path.join(outDir, "report.json");
writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

console.warn("");
for (const run of runs) {
  const overflow = run.overflow.at(-1);
  console.warn(
    `${run.viewport}/${run.scheme} ${run.route}: ${run.steps.length} Schritte, ${run.shots.length} Screenshots, ` +
      `Überlauf ${overflow?.overflows ? `JA (${overflow.documentWidth}px > ${overflow.viewportWidth}px)` : "nein"}`,
  );
  if (Object.keys(run.reads).length) console.warn(`  gelesen: ${JSON.stringify(run.reads)}`);
}
console.warn(`Bericht: ${reportFile}`);
console.warn(`Befunde: ${findings.length}`);

const failed = findings.length > 0 && !values["allow-findings"];
process.exit(failed ? 1 : 0);
