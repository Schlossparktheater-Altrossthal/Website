# AGENTS.md

## Stack & Einstieg

Webauftritt läuft auf Next.js 16 (App Router) mit React 19, TypeScript 6 und Tailwind CSS 4. Node.js 24 LTS ist die Referenzversion; aktiviere `corepack enable` und arbeite ausschließlich mit `pnpm`.

- App-Code liegt im `src`-Ordner: `src/app` (Routing), `src/components` (UI), `src/lib` (Logik), `prisma` (Schema), `realtime-server` (Socket.io).
- Globale Provider kommen aus `src/app/providers.tsx`. Neue Kontexte dort integrieren, nicht lokal verschachteln.
- Legacy-Endpunkte unter `src/pages/api` nur für Socket-Bridge. Neue APIs in `src/app/api` oder als Server Actions.

## Design-System & Layout-System

- **Design-Tokens statt hard-coded Farben:** Nur semantische Tokens verwenden (`bg-card`, `text-foreground`, `border-border`, `bg-muted` etc.), keine Tailwind-Farben (`bg-white`, `text-slate-*`, `bg-gray-*`). Alle Komponenten müssen in Light & Dark Mode funktionieren.
- `src/app/design-tokens.css` wird von `scripts/build-design-tokens.mjs` generiert und muss im Root-Layout (`src/app/layout.tsx`) per JS-Import geladen werden – **nicht** per CSS-`@import` in `globals.css`. Relative CSS-`@import`-Pfade werden vom Bundler nicht zuverlässig relativ zur Datei aufgelöst (`Can't resolve './design-tokens.css'`).
- **Mitgliederbereich-Layout:** `MembersAppShell` übernimmt Container und Padding. Seiten nur `<div className="space-y-6">` — keine eigenen `mx-auto`, `px-*`, `py-*` oder `<main>`-Wrapper.
- **Custom-Layouts:** Nur bei Bedarf `<MembersContentLayout width="..." padding="..." />` verwenden.
- **Legacy-Code:** Bestehende Komponenten mit hard-coded Farben nutzen CSS-Override-Strategie. Neue Komponenten immer mit Design-Tokens bauen.
- **Dokumentation:** Details zu Tokens, Typografie, Spacing in `docs/design-system.md`.

## Tooling & lokale Entwicklung

- Abhängigkeiten mit `pnpm install --frozen-lockfile`. Neue Pakete: `pnpm add <pkg>`.
- `pnpm dev` startet Turbopack-Devserver und führt Prisma-Migrationen aus. `turbopack.root` ist in `next.config.ts` auf `process.cwd()` gesetzt und darf nicht entfernt werden – sonst inferiert Turbopack den Workspace-Root falsch (z. B. über eine fremde `package-lock.json` im Home-Verzeichnis), was zu fehlerhaften Compile-Fehlern führt. Nach **jeder** Änderung an `next.config.ts` (insbesondere `turbopack.root`) den Dev-Server stoppen und `.next` löschen (`rm -rf .next`) – sonst bleibt der alte Cache inkonsistent und es kommt zum Fehler `Could not find the module … in the React Client Manifest`.
- Zentrale Skripte: `pnpm lint`, `pnpm test`, `pnpm build` und `pnpm format:check` müssen vor jedem Commit sauber durchlaufen.
- Formatierung: Prettier ist der verbindliche Formatter (Konfiguration in `.prettierrc`). `pnpm format` formatiert das gesamte Repo, `pnpm format:check` prüft in CI. Keine manuellen Stil-Anpassungen gegen Prettier.
- DB-Skripte: `pnpm prisma:generate`, `pnpm db:migrate`, `pnpm db:seed`.
- Token-Workflows: `pnpm swatches:gen` und `pnpm design-system:tokens`.
- Docker-Compose stellt Postgres & Mailpit bereit. Bei DB-Änderungen `.env.example` aktualisieren.

## Architektur- & Code-Richtlinien

- Keine Binärdateien im Repository (PNG, JPG, Videos, Schriftarten). Stattdessen Inline-SVG oder Verweise auf bestehende Assets.
- Standardmäßig React Server Components. `"use client"` nur bei zwingenden interaktiven Szenarien.
- Datenbankzugriffe nur über `@/lib/prisma`. Queries in `@/lib/prisma-helpers` kapseln.
- Validierungen mit `zod`. Pfad-Alias `@/*` statt relativer Imports. `cn` aus `@/lib/utils` für Klassenketten.
- Type-Casts wie `as never`, `as any` oder `as unknown as ...` sind verboten. Korrekte Typen und Guards verwenden.
- Vor neuen Hilfsfunktionen mit `rg` suchen ob eine passende bereits existiert. Keine Duplikate anlegen.
- Vor dem Löschen von Modulen, Komponenten oder Exports immer die Verwendung prüfen: direkte Imports **und** Barrel-Exports (`index.ts`) und dynamische Imports. Ein Modul ist erst „tot“, wenn weder ein direkter noch ein Barrel-Import existiert – niemals nur auf Basis eines einzelnen Suchlaufs löschen.
- Keine zwei exportierten Symbole mit identischem Namen (`PageHeader` existierte doppelt in `design-system/patterns` und `components/members`). Namenskollisionen sofort auflösen: konsolidieren oder eindeutig benennen.
- Keine leeren catch-Blöcke. Fehler immer loggen oder explizit weitergeben.
- Fehler lokal mit `console.error`, Warnungen mit `console.warn` loggen – kein `console.log` außerhalb von `src/lib/logger`. Server-seitige strukturierte Log-Events über `createLogger` aus `@/lib/logger` (persistiert in der DB).
- Server-Actions-Dateien (`actions.ts`) nach Domäne aufteilen und schlank halten. Gemeinsame Helper in einer eigenen Datei **außerhalb des `app/`-Verzeichnisses** bündeln (z. B. `src/lib/<domäne>/actions-helpers.ts`). Eine Actions-Datei sollte nicht über ~400 Zeilen wachsen – neue Actions gehören in eine passende Domänen-Datei statt in eine bestehende Sammeldatei.
- Nur echte Server-Actions-Dateien tragen `"use server"`. Helper-Dateien dürfen **kein** `"use server"` haben und müssen **außerhalb des `app/`-Verzeichnisses** liegen (z. B. `src/lib/produktionen/`). Grund: `"use server"` erzwingt, dass alle Exporte async sind (`Server Actions must be async functions`); Turbopack wendet diese Regel fälschlich auch auf Helper-Dateien **innerhalb** des `app/`-Verzeichnisses an, die von einer `"use server"`-Datei importiert werden. Shared Helper für Server Actions gehören daher nach `src/lib/` und werden über den `@/`-Alias importiert.
- API-Routes geben Fehler immer als `{ error: string }` mit passendem HTTP-Statuscode zurück.

## Daten, Backend & Realtime

- Schemaänderungen in `prisma/schema.prisma` stets mit Migration begleiten, danach `pnpm prisma:generate`.
- ENV-Variablen in `.env.example` und README dokumentieren.
- Realtime-Ereignisse über `@/hooks/useRealtime` und `realtime-server/src`. Frontend und Backend gleichzeitig pflegen.
- Geteilte Module des Realtime-Servers (`src/lib/realtime/shared/*`, `src/lib/server-analytics-*`) bleiben handgepflegt als `.js` + `.d.ts`. Der Realtime-Server hat keine Build-Stufe und kann `.ts` nicht laden – keine TS-Migration. Bei Änderungen an der `.js` die zugehörige `.d.ts` synchron halten.
- Änderungen an `src/lib/realtime/shared/core.js` mit `node --check` und den Realtime-Tests (`src/lib/realtime/__tests__`) absichern, bevor sie committet werden.
- Neue Permission-Keys müssen in `DEFAULT_PERMISSION_DEFINITIONS` in `src/lib/permissions.ts` registriert werden, bevor sie verwendet werden.
- Neue Feature-Keys für öffentliche Seiten müssen in `FEATURE_DEFINITIONS` in `src/lib/frontend-editing.ts` eingetragen werden.
- Bei Umbenennung von Permission-Keys eine neue Prisma-Migration erstellen, die alte Keys in der DB umbenennt.

## UI, UX & Content

- Tailwind CSS und shadcn/ui sind die Basis. Komponenten aus `src/components/ui` verwenden und konsistent erweitern.
- Barrierefreiheit hat Priorität: semantische HTML-Strukturen, `aria`-Attribute, sichtbare Fokuszustände.
- Feedback-Komponenten laufen über `sonner`.

## RESPONSIVE DESIGN PATTERNS

- Die zentrale Dokumentation für responsive Navigationsmuster liegt in `src/config/responsive.ts`. Neue projektweite Breakpoint-Entscheidungen dort typisiert ergänzen.
- Es gelten die Tailwind-Default-Breakpoints; es sind keine custom Breakpoints in `tailwind.config.js` definiert.
- Tabs verwenden das gemeinsame TabsList-Pattern: unter `sm` (640px) shadcn `Select`, ab `sm` Pill-Tabs. Horizontal scrolling auf Tab-Listen ist ausdrücklich verboten.
- Header-Navigation: unter `md` (768px) `Sheet`, ab `md` horizontale Navigation.
- Sidebar: bis 1023px `Sheet`, ab 1024px feste Sidebar.

## Tests, Qualitätssicherung & Reviews

- Vor jedem Commit `pnpm lint`, `pnpm format:check`, `pnpm test` und `pnpm build` ausführen. `pnpm lint` muss ohne Errors durchlaufen – gefundene Fehler werden behoben, nicht per `eslint-disable` unterdrückt (Ausnahmen nur mit Begründung im Code). Warnings der React-Compiler-Regeln (`react-hooks/set-state-in-effect`, `react-hooks/refs`) sind dokumentiert erlaubt, solange der React Compiler nicht aktiv ist (Begründung in `eslint.config.mjs`).
- Vitest-Tests liegen nahe am Quellcode. React-Komponenten mit `@testing-library/react` testen.
- Beim Umbau oder bei der Migration einer Komponente/eines Moduls die zugehörigen Tests und `vi.mock`-Mocks mitpflegen: neue interne Abhängigkeiten müssen auch im Mock bereitstehen, sonst brechen Tests zur Laufzeit.
- UI-Änderungen visuell mit Preview-Deployments absichern.

## Commits

- Nach jeder abgeschlossenen Aufgabe wird committet – nicht erst auf explizite Aufforderung. Jede Aufgabe als atomarer Commit.
- Commit-Messages folgen dem Conventional-Commits-Format: `type(scope): description`.
- Die Beschreibung ist immer auf Englisch, im Imperativ formuliert (`Fix …` statt `Fixed …` oder `Fixes …`) und ausdrucksstark: Sie sagt, was geändert wurde und warum. Nie nur `update`, `changes` oder `wip`.
- Feste Kategorien (`type`):
  - `feat` – neues Feature
  - `fix` – Fehlerbehebung
  - `docs` – reine Dokumentationsänderung
  - `style` – Formatierung, keine Logik (z. B. Prettier)
  - `refactor` – Umbau ohne Verhaltensänderung
  - `perf` – Performance-Verbesserung
  - `test` – Tests ergänzen oder anpassen
  - `build` – Build-System, Dependencies, Tooling
  - `ci` – CI/CD-Konfiguration
  - `chore` – sonstige Wartungsarbeiten
  - `revert` – Änderung rückgängig machen
- `scope` (optional) benennt den betroffenen Bereich, z. B. `feat(tickets)`, `fix(sync)`, `chore(deps)`.
- Breaking Changes mit `!` kennzeichnen: `feat(api)!: …`.
- Ein Commit = genau eine abgeschlossene, atomare Änderung. Keine Themen mischen.
- Keine Secrets oder API-Keys in Commit-Messages.
- Beispiele: `feat(tickets): add QR check-in for rehearsals`, `fix(profile): validate email format before saving`, `refactor(sync): extract generic buildDelta helper`.

## Dokumentation & Kommunikation

- README, `docs/**` und `.env.example` bei relevanten Änderungen aktualisieren.
- Bei Änderungen an Seiten (Routen, Permissions, Komponenten) die zugehörige Datei in `docs/seiten/` aktualisieren.
- PR-Beschreibungen mit Kontext, Entscheidungspunkten und QA-Schritten versehen.
- In Texten und Kommentaren generische Maskulina verwenden, keine Genderschreibweisen.
- Diese `AGENTS.md` bei neuen Standards fortschreiben und Änderungen begründen.

## Ausnahmen & Sonderfälle

- Reine Dokumentationsänderungen dürfen ohne `pnpm lint/test/build` abgeschlossen werden.
- Arbeiten nur am `realtime-server` erfordern nur die dort relevanten Checks.
- Wenn Checks nicht ausführbar sind, Blockade dokumentieren und manuelle Tests beilegen.

## Einführung

Diese Datei definiert die Projektstandards für die Website des Sommertheaters Altrossthal. Jeder, der an diesem Code arbeitet, soll diese Regeln einhalten, damit der Code verständlich, konsistent und wartbar bleibt.

## Benennungskonventionen

- Permission-Keys folgen dem Schema `VISIBILITY.PAGE.CONTEXT.ACTION`.
  - `VISIBILITY` ist `PUBLIC` für öffentliche Seiten (Home, Mystery, Chronik, Über uns, Schulkatze).
  - `VISIBILITY` ist `PRIVATE` für den Mitgliederbereich.
- Feature-Keys folgen dem Schema `FEATURE.PAGE.CONTEXT`.
- TypeScript-Variablen verwenden `camelCase` mit beschreibenden englischen Namen.
- Konstanten verwenden `SCREAMING_SNAKE_CASE`.
- React-Komponenten verwenden `PascalCase`.
- Funktionen verwenden `camelCase` und beginnen mit einem Verb wie `get`, `resolve`, `read`, `save`, `handle`, `ensure`.
- Permission-Keys dürfen niemals als hardcodierte Strings verwendet werden, ohne dass sie in `DEFAULT_PERMISSION_DEFINITIONS` in `src/lib/permissions.ts` registriert sind.

## Icons

- Alle Standard-Icons sind in `src/components/ui/action-icons.tsx` definiert und müssen von dort importiert werden, nicht direkt aus `lucide-react`.
- Neue projektweit gebrauchte Icons zuerst in `src/components/ui/action-icons.tsx` ergänzen.
- Seitenspezifische dekorative Icons dürfen direkt aus `lucide-react` importiert werden.
- Diese Regel hat Vorrang vor `docs/design-system.md`, auch wenn dort direkte `lucide-react`-Imports referenziert werden.

## UI-Komponenten

- Buttons verwenden die `Button`-Komponente aus `src/components/ui/button.tsx` mit dem passenden Variant:
  - `primary` für Hauptaktionen
  - `destructive` für Löschaktionen
  - `outline` für Sekundäraktionen
  - `ghost` für Tertiäraktionen
- Löschaktionen verwenden immer `variant="destructive"` und das `TrashIcon`.
- Bearbeitungsaktionen verwenden immer das `EditIcon`.
- Dialoge für destruktive Aktionen müssen vor der Ausführung eine Bestätigung abfragen.
- Für alle Buttons mit Ladezustand AsyncButton aus `src/components/ui/async-button.tsx` verwenden. Nie Button manuell mit Loader2 kombinieren.
- Für alle destruktiven Bestätigungen ConfirmDialog aus `src/components/ui/confirm-dialog.tsx` verwenden. `window.confirm` ist verboten.
- Für alle Create/Edit-Dialoge ModalFormDialog aus `src/components/ui/modal-form-dialog.tsx` verwenden.
- `src/lib/ui-standards.ts` ist die Single Source of Truth für Props-Interfaces aller geteilten UI-Patterns.

## Design-Tokens

- Farben immer über semantische CSS-Variablen aus `src/design-system/tokens.json` verwenden, z. B. `text-primary`, `text-destructive`, `bg-muted`.
- Hardcodierte Farbwerte sind nicht erlaubt.
- Kategorie- und Identitätsfarben (Rollen, Gewerke, Interessen) ausschließlich zentral in `src/config/category-colors.ts` pflegen – nie in Komponenten hardcoden.
- Die autoritative Token-Referenz ist `docs/design-system.md`. Bei Konflikten hat `AGENTS.md` Vorrang.

## Surface & Card Hierarchie

- `bg-background` ist die Seitenbasis. Innerhalb einer Card darf es nie verwendet werden.
- `bg-card` gilt für alle primären Cards und Section-Container.
- `bg-muted` gilt für verschachtelte/sekundäre Flächen innerhalb einer Card (Sub-Cards, innere Sektionen).
- `bg-popover` ist ausschließlich für Overlays, Dropdowns und Tooltips reserviert.
- Card-Rahmen verwenden `border-border`. `border-primary` (orange) ist auf strukturellen Containern verboten — orange Rahmen sind ausschließlich für interaktive/ausgewählte Zustände reserviert.
- Niemals hardcodierte Farben für Flächen verwenden. Immer semantische Tokens nutzen.

## Responsive Design

- Mobile-first: Basis-Styles immer zuerst für Mobile schreiben und mit `sm:`, `md:`, `lg:`, `xl:` und `2xl:` erweitern.
- Keine fixen Pixelbreiten verwenden. Nutze Tailwind-Responsive-Utilities und das Container-System aus `docs/design-system.md`.
- Touch-Targets auf Mobile mindestens 44px Höhe sicherstellen (z. B. `min-h-11` oder `size="lg"` bei Buttons).
- Layouts auf Mobile vertikal stapeln und erst mit `lg:flex-row` auf horizontal umstellen.

## Seiten-Patterns

- Seiten-Header verwenden das `PageHeader`-Pattern aus `src/components/members/page-header.tsx`.

## Typografie & Abstände

- Folge der Typografie-Skala aus `docs/design-system.md` (`text-h1`, `text-h2`, `text-body` usw.). Verwende `Heading`- und `Text`-Komponenten aus `@/components/ui/typography`.

## Badge & Status

- Badges verwenden die Badge-Komponente aus src/components/ui/badge.tsx.
- Status-Semantik: success-Token für positiv/aktiv, warning-Token für ausstehend/Hinweis, destructive-Token für Fehler/gesperrt, muted für neutral/inaktiv.
- Nie hardcodierte Farben für Statusbadges. Immer variant oder className mit semantischem Token.

## Empty States

- Leere Zustände immer mit zentriertem Text und muted-foreground Farbe darstellen.
- Struktur: umschließende div mit py-12 text-center, Icon optional in text-muted-foreground, darunter p mit text-muted-foreground.
- Kein window.confirm, kein gestrichelter Box-Eigenbau ohne diese Struktur.

## Skeleton & Ladezeichen

- Ladezeichen immer mit der Skeleton-Komponente aus src/components/ui/skeleton.tsx.
- animate-pulse direkt auf Elementen ist verboten. Immer Skeleton verwenden.
- Suspense-Fallbacks verwenden dedizierte loading.tsx Dateien mit Skeleton-Komponenten.

## Toast & Feedback

- toast.success für erfolgreich abgeschlossene Aktionen.
- toast.error für Fehler die eine Nutzeraktion erfordern.
- toast.info für neutrale Statusänderungen und Echtzeit-Events.
- Dauer: Erfolg 3000ms, Fehler 5000ms, Info 2000ms.
- Toasts haben immer einen kurzen Titel und optional eine description für Details.

## Callout & Hinweisboxen

- Hinweisboxen verwenden bg-muted border border-border rounded-lg p-4.
- Warnhinweise verwenden bg-warning/10 border border-warning text-warning-foreground rounded-lg p-4.
- Fehlerhinweise verwenden bg-destructive/10 border border-destructive text-destructive-foreground rounded-lg p-4.
- Nie eigene Farben oder hardcodierte Hintergründe für Hinweisboxen.
