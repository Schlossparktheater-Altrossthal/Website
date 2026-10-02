# AGENTS.md

Projektstandards für den Mitgliederbereich und die Website des Sommertheaters Altrossthal. Details
stehen in den Leitfäden unter `docs/` (`design-system.md`, `development.md`, `datenmodell.md`,
`e2e-tests.md`); bei Konflikten hat diese Datei Vorrang.

## Stack & Befehle

- Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4, Prisma/Postgres, Node.js 24 LTS.
  Nur `pnpm` (`corepack enable`); einziges Lockfile ist `pnpm-lock.yaml` – keine
  `package-lock.json` committen (Dependabot meldet sonst alles doppelt).
- Struktur: `src/app` (Routing), `src/components` (UI), `src/lib` (Logik), `prisma` (Schema),
  `realtime-server` (Socket.io). Globale Provider nur in `src/app/providers.tsx`.
- `pnpm dev` (führt `prisma generate` und Migrationen aus), `pnpm lint`, `pnpm format:check`,
  `pnpm test`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm swatches:gen`. Docker-Compose
  stellt Postgres und Mailpit bereit.
- `turbopack: { root: process.cwd() }` in `next.config.mjs` nie entfernen (sonst falscher
  Workspace-Root). Nach jeder Änderung an `next.config.mjs` Dev-Server stoppen und `rm -rf .next`.
- Sicherheits-Pins für transitive Pakete über `pnpm.overrides`, mit Begründung im Commit, nie
  stillschweigend auf eine neue Major-Version. CI prüft `pnpm audit --prod --audit-level=high`.
- Prettier ist verbindlich (`pnpm format`).

## Architektur & Code

- Standardmäßig Server Components; `"use client"` nur, wenn Interaktion es erzwingt.
- Neue APIs in `src/app/api` oder als Server Actions. API-Fehler immer als `{ error: string }` mit
  passendem Statuscode.
- DB-Zugriff nur über `@/lib/prisma`; Queries gehören in die Domänen-Libs `src/lib/<domäne>/`,
  nicht in Seiten oder Komponenten.
- `zod` für Validierung, Alias `@/*` statt relativer Imports, `cn` aus `@/lib/utils`.
- Verboten: `as any`, `as never`, `as unknown as …`; leere `catch`-Blöcke; `console.log` außerhalb
  von `src/lib/logger` (sonst `console.error`/`console.warn`, serverseitig `createLogger`).
- Keine Binärdateien neu ins Repo (Bilder, Videos, Schriften); vorhandene Assets in `public/`
  bleiben.
- Vor neuen Helfern mit `rg` nach bestehenden suchen. Keine zwei Exporte mit gleichem Namen.
- Vor dem Löschen eines Moduls direkte, Barrel- (`index.ts`) und dynamische Imports prüfen.
- **Server Actions:** `actions.ts` je Domäne, höchstens ~400 Zeilen. `"use server"` nur in echten
  Actions-Dateien. Gemeinsame Helfer liegen ohne `"use server"` **außerhalb von `app/`** in
  `src/lib/<domäne>/` – Turbopack verlangt sonst auch dort nur async-Exporte.
- Zeitangaben: `Intl.DateTimeFormat` immer mit `timeZone: DEFAULT_TIME_ZONE` aus
  `src/lib/date-time.ts` (Server läuft in UTC → Hydration-Fehler).

## Daten, Rechte & Realtime

- Schemaänderung immer mit Migration, danach `pnpm prisma:generate`. ENV-Variablen in
  `.env.example` und README dokumentieren.
- Gepushte Migrationen sind **unveränderlich** – Korrekturen in eine neue Migration (Prüfsumme,
  sonst `Init:CrashLoopBackOff` auf Staging). Recovery nach P3009 (Teil-DDL) in
  `docs/development.md`.
- Permission-Keys nach Schema `VISIBILITY.PAGE.CONTEXT.ACTION` (`PRIVATE` = Mitgliederbereich),
  vor der ersten Verwendung in `DEFAULT_PERMISSION_DEFINITIONS` (`src/lib/permissions.ts`)
  registrieren. Umbenennung nur mit Migration, die die Keys in der DB umschreibt.
- Pflichtrollen sind nur `member`, `admin`, `owner` (`src/lib/roles.ts`); alle anderen Rollen sind
  löschbar, `ensureSystemRoles` legt nur die Pflichtrollen nach.
- Realtime: `@/hooks/useRealtime` und `realtime-server/src` immer gemeinsam ändern. Geteilte Module
  (`src/lib/realtime/shared/*`, `src/lib/server-analytics-*`) bleiben `.js` + `.d.ts` (der Server
  hat keinen Build), `.d.ts` synchron halten; `core.js` mit `node --check` und
  `src/lib/realtime/__tests__` absichern.

## UI-Regeln

- **Farben nur über semantische Tokens** (`bg-card`, `text-foreground`, `border-border`,
  `text-destructive` …), nie Tailwind-Farben oder Hex-Werte; Light und Dark Mode müssen
  funktionieren. Tokens kommen aus dem tweakcn-Theme (`src/lib/theme/`); neue Variablen in
  `src/lib/theme/tweakcn.ts` mit Standardwert, nicht in `globals.css`. Kategorie-/Identitätsfarben
  nur in `src/config/category-colors.ts`.
- **Flächen:** `bg-background` = Seitenbasis (nie in Cards), `bg-card` = Cards/Sections, `bg-muted`
  = Flächen innerhalb einer Card, `bg-popover` = nur Overlays. Rahmen `border-border`;
  `border-primary` nur für interaktive/ausgewählte Zustände.
- **Layout:** `MembersAppShell` liefert Container und Padding, Seiten beginnen mit
  `<div className="space-y-6">` (kein eigenes `mx-auto`/`px-*`/`<main>`); Sonderfälle über
  `MembersContentLayout`.
- **Seitenaufbau** der Hauptbereiche: `PageHeader` (`src/components/members/page-header.tsx`,
  einzeilig, Breadcrumbs nur mit echtem Elternteil) → Bereichs-Navigation → Werkzeugzeile (Suche
  links, primäre Aktion rechts, `flex flex-wrap items-center gap-2`) → Cards. Details in
  `docs/design-system.md` („Seiten-Muster“).
- **Komponenten:**
  - `Button`-Varianten: `primary` Haupt-, `outline` Sekundär-, `ghost` Tertiär-, `destructive`
    Löschaktion (mit `TrashIcon`; Bearbeiten mit `EditIcon`).
  - Ladezustand: `AsyncButton`, nie `Button` + `Loader2`.
  - Destruktive Bestätigung: `ConfirmDialog`; `window.confirm`/`prompt` verboten.
  - Create/Edit-Dialoge: `ModalFormDialog`. Props geteilter Patterns: `src/lib/ui-standards.ts`.
  - Personenbilder nur über `UserAvatar` (Felder via `toAvatarFields`), keine eigenen
    Initialen-Kreise.
  - Badges über `Badge` mit Status-Tokens: success aktiv, warning ausstehend, destructive
    Fehler/gesperrt, muted neutral.
  - Feedback über `sonner`: `toast.success`/`error`/`info` mit kurzem Titel, optional
    `description`.
  - Hinweisboxen: `bg-muted border border-border rounded-lg p-4`; Warnung/Fehler mit
    `warning`-/`destructive`-Token (`bg-…/10 border-…`).
  - Laden: `Skeleton` und `loading.tsx`, kein `animate-pulse` direkt.
  - Leerzustand: `py-12 text-center text-sm text-muted-foreground`, Icon optional.
  - `StatTile` mit fehlendem Wert zeigt `–` plus Hinweis (`tone="neutral"`) statt zu verschwinden;
    Link auf die Pflegeseite nur bei geprüftem Recht.
  - Inline-Skripte (Anti-Flash) nur über `InlineScript`.
- **Icons:** Standard-Icons aus `src/components/ui/action-icons.tsx`, neue projektweite Icons dort
  ergänzen; nur seitenspezifische Deko direkt aus `lucide-react`. Seiten-Icons ausschließlich in
  `src/config/members-navigation.ts`, abgerufen über `membersNavIcon(href)`.
- Typografie-Skala aus `docs/design-system.md`; für neue Stellen `Heading`/`Text` aus
  `@/components/ui/typography`.
- Barrierefreiheit: semantisches HTML, `aria`-Attribute, sichtbarer Fokus.

## Responsive

Referenz: `docs/design-system.md` („Breakpoints & Responsive“), Status je Seite in
`docs/responsiveness-matrix.md`.

- Mobile-first. Drei Klassen: Handy (<640px), Tablet (768–1023px), Desktop (≥1024px); nur die
  Tailwind-Breakpoints plus `2xl` = 1920px. Touch-Targets mindestens 44px (`min-h-11`).
- **Nichts wird breiter als sein Container:** Werkzeugzeilen umbrechen (`flex-wrap`), lange Werte
  `min-w-0` + `break-words`, Raster mit expliziter Basis (`grid grid-cols-1 … lg:grid-cols-2`),
  breite Tabellen/Kalender in innerem `overflow-x-auto`. Eine einzige zu breite Box lässt
  iOS-Safari die ganze Seite verkleinern (`docs/Analysen/handy-ueberlauf-webkit-befunde.md`).
- **Bereichs-Navigation:** `SectionNav` für URL-Zustand (ab vier Einträgen mobil `Select`),
  `SegmentedControl` für Client-State (auch innerhalb von Cards), `ViewSwitcher` für Portale,
  Bereichsliste mit `?bereich=`-Drill-down bei vielen Unterbereichen (Beispiel: Profil). Kein
  horizontales Scrollen auf Umschaltern, keine orange gefüllten `TabsList`-Pills für neue
  Bereichs-Navigation.
- Tages-Details mobil als Bottom-`Sheet`, am Desktop daneben. Header-Navigation unter `md` als
  `Sheet`; Sidebar bis 1023px als `Sheet` (`SIDEBAR_MOBILE_BREAKPOINT`).

## Tests & Prüfung

- Vitest-Tests nahe am Code, Komponenten mit `@testing-library/react`. Beim Umbau Tests und
  `vi.mock`-Mocks mitziehen.
- `pnpm lint` ohne Errors; Fehler beheben statt `eslint-disable` (Ausnahme nur mit Begründung).
  Warnings `react-hooks/set-state-in-effect` und `react-hooks/refs` sind erlaubt
  (`eslint.config.mjs`).
- **E2E:** erster Klick auf einen Client-Button nach vollem Seitenaufruf über `clickUntil`
  (`e2e/helpers.ts`); „kommende“ Testtermine immer in die Zukunft datieren (Anzeige in
  `Europe/Berlin`, Runner in UTC). Overflow-Test `e2e/responsive-overflow.spec.ts` und Projekte:
  `docs/e2e-tests.md`.
- **Prüfstufen:**

  | Änderung                   | Pflicht                                                                                                                                                                   |
  | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Nur Doku                   | keine Checks                                                                                                                                                              |
  | Code ohne sichtbare UI     | `lint`, `format:check`, `test`, `build`                                                                                                                                   |
  | Kleiner UI-Fix             | wie oben + Screenshot der betroffenen Ansicht                                                                                                                             |
  | Neue/umgebaute UI          | wie oben + `pnpm e2e:screenshots --viewport all` (Handy/Tablet/Desktop, hell+dunkel, relevante Datenzustände) ansehen und im Review beilegen; Abläufe mit `pnpm ui:check` |
  | Serie mehrerer Plan-Phasen | je Phase `lint` + betroffene Tests; `build`, volle Tests und Screenshots am Ende der Serie                                                                                |
  | Nur `realtime-server`      | die dort relevanten Checks                                                                                                                                                |

  Nicht ausführbare Checks als Blockade dokumentieren. Abnahme erfolgt auf Staging.

## Commits

- Nach jeder abgeschlossenen Aufgabe bzw. Phase atomar committen, ohne extra Aufforderung; keine
  Themen mischen.
- Conventional Commits `type(scope): description`, Beschreibung englisch im Imperativ und mit
  Aussage (was und warum). Typen: `feat fix docs style refactor perf test build ci chore revert`;
  Breaking Change mit `!`. Keine Secrets in Messages.

## Doku & Pläne

- README, `docs/**` und `.env.example` bei relevanten Änderungen mitpflegen; bei Änderungen an
  Seiten (Route, Rechte, Komponenten) die Datei in `docs/seiten/`.
- Texte und Kommentare mit generischem Maskulinum, keine Genderschreibweisen.
- **Pläne** liegen ausschließlich in `docs/Plan/` (Ausnahme `docs/redesign-plan/`), entstehen
  sofort als Datei, werden im selben Commit in `docs/Plan/README.md` eingetragen und nie gelöscht –
  umgesetzte Pläne bekommen eine neue `Stand:`-Zeile und abgehakte Checkliste, kein `…-v2.md`.
  Aufbau und Vorlage: `docs/Plan/README.md`. Phasenzahl nach Umfang; jede Phase einzeln
  committbar und auf Staging prüfbar.
- Studien, Analysen und Prüfberichte nach `docs/Analysen/`. Verweise immer mit vollem Pfad.
- Neue Standards hier ergänzen – kurz, an der passenden Stelle, Hintergrund in die Fach-Doku.

## GitHub

- Board: https://github.com/orgs/Schlossparktheater-Altrossthal/projects/2 (Backlog → Ready → In
  Progress → In Review → Done). Neue Issues starten im Backlog.
- Labels Pflicht: `priority:*` (critical/high/low) + `type:*` (security, architecture, bug, dx,
  testing, ops, docs) + `effort:*` (S/M/L); Feature-Wünsche zusätzlich `Feature`.
- Milestones benennen, falls gesetzt, ein echtes geplantes Release (z. B. `v1.12.0`).
  Sicherheitsprobleme kommen ins nächste Release.
- Issue = ein Fix. Deutsch, natürlicher Ton, kein Emoji, kein Formular-Stil. Body: **Was ist
  aufgefallen** (konkret, mit Datei/Zeile) → **Was zu tun ist** → **Commit-Vorschlag**.
- CodeQL-Findings: `gh api repos/<owner>/<repo>/code-quality/findings?state=open` (nicht die
  `code-scanning`-API). Mechanische Findings direkt als `fix(...)`-Commit beheben, Issues nur bei
  Entscheidungsbedarf.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
