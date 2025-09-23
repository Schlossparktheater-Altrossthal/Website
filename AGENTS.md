# AGENTS.md

## Stack & Einstieg
- Der Webauftritt läuft auf Next.js 15 (App Router) mit React 19, TypeScript und Tailwind CSS 4. Node.js 24 LTS ist die Referenzversion (siehe Dockerfiles); aktiviere `corepack enable` und arbeite ausschließlich mit `pnpm`.
- App-Code liegt im `src`-Ordner. Wichtige Bereiche: `src/app` (Routing & Server Components), `src/components` (UI-Bausteine inkl. shadcn/ui), `src/lib` (Domänenlogik & Hilfsfunktionen), `prisma` (Schema & Seeds) sowie `realtime-server` (Socket.io-Dienst).
- Globale Provider für Session, React Query, Frontend-Editing und Realtime kommen aus `src/app/providers.tsx`. Ergänzende Kontexte bitte dort integrieren, nicht lokal verschachteln.
- Legacy-Endpunkte unter `src/pages/api` existieren nur für die Socket-Bridge. Neue APIs gehören in `src/app/api` oder als dedizierte Server Actions.

## Tooling & lokale Entwicklung
- Installiere Abhängigkeiten mit `pnpm install --frozen-lockfile`. Für neue Pakete gilt `pnpm add <pkg>` (bzw. `pnpm add -D <pkg>` für Dev-Deps).
- `pnpm dev` startet den Turbopack-Devserver, führt Prisma-Migrationen über `scripts/run-prisma-migrate.mjs` aus und synchronisiert Seeds bei Bedarf.
- Weitere zentrale Skripte:
  - `pnpm lint`, `pnpm test` (Vitest) und `pnpm build` müssen vor jedem Commit sauber durchlaufen.
  - `pnpm prisma:generate`, `pnpm db:migrate`, `pnpm db:seed` für Datenbankarbeiten.
  - `pnpm start:combined` bzw. `pnpm start:proxy` spiegeln das Docker-Setup ohne Container.
  - Design-Token-Workflows: `pnpm swatches:gen` und `pnpm design-system:tokens`.
- Docker-Compose-Stacks (siehe `README.md`) stellen Postgres & Mailpit bereit. Bei lokalen Datenbankänderungen immer auch `.env.example` aktualisieren.

## Architektur- & Code-Richtlinien
- Standardmäßig React Server Components verwenden. `"use client"` nur bei zwingenden interaktiven Szenarien (Formulare, Drag & Drop, React Query etc.) setzen.
- Server Actions liegen direkt neben den konsumierenden Komponenten (`actions.ts`). Bevorzugt Actions + React Server Components statt API-Mutationen, sofern Sessions oder Revalidierung (`revalidatePath`, `revalidateTag`) nicht entgegenstehen.
- Datenbankzugriffe ausschließlich über den Proxy aus `@/lib/prisma`. Wiederverwendbare Queries in `@/lib/prisma-helpers` oder modularen Services kapseln.
- Validierungen & Parsing mit `zod`. Für HTTP-Handler immer typed Schemas und eindeutige Fehlerantworten nutzen.
- Verwende den Pfad-Alias `@/*` statt relativer Importketten. Helpers wie `cn` aus `@/lib/utils` für Klassenketten einsetzen.
- Nutze Flat-Config-ESLint (`eslint.config.mjs`) und Prettier 3. Vor PRs `pnpm lint --fix` und ggf. `pnpm dlx prettier --check .` verwenden, um Formatierungsfehler früh zu erkennen.

## Daten, Backend & Realtime
- Schemaänderungen in `prisma/schema.prisma` stets mit Migration (`pnpm db:migrate`) begleiten, danach `pnpm prisma:generate` ausführen. Neue Tabellen/Felder im Seed (`prisma/seed.mjs`) und in Tests berücksichtigen.
- Relevante ENV-Variablen (`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_REALTIME_URL`, `REALTIME_AUTH_TOKEN`, `REALTIME_HANDSHAKE_SECRET` usw.) konsequent dokumentieren und in `.env.example` sowie README ergänzen.
- Route Handler unter `src/app/api/**/route.ts` folgen der `NextRequest`/`NextResponse`-API. Gemeinsame Logik in `@/lib` auslagern, Fehler zentral über Hilfsfunktionen serialisieren.
- Realtime-Ereignisse laufen über `@/hooks/useRealtime` und den Socket.io-Server (`realtime-server/src`). Neue Events gleichzeitig im Frontend (`@/lib/realtime`, Hooks oder Stores) und Backend pflegen, inklusive Auth-/Room-Validierung.

## UI, UX & Content
- Tailwind CSS und shadcn/ui bilden die Basis. Baue auf Komponenten aus `src/components/ui` auf und erweitere sie konsistent mit `tailwind-variants` bzw. `class-variance-authority`.
- Designentscheidungen, Farbpaletten und Typografie folgen den Vorgaben in `docs/design-system.md` sowie den generierten Swatches (`docs/swatches`). Bei Änderungen Token neu generieren.
- Barrierefreiheit hat Priorität: semantische HTML-Strukturen, beschreibende `aria`-Attribute, sichtbare Fokuszustände und ausreichende Kontraste gemäß bestehendem Layout (`src/app/layout.tsx`).
- Toaster/Feedback-Komponenten laufen über `sonner`. Bei neuen Interaktionen sparsame, zugängliche Rückmeldungen implementieren.

## Tests, Qualitätssicherung & Reviews
- Vor jedem Commit `pnpm lint`, `pnpm test` und `pnpm build` ausführen; Fehler müssen behoben werden.
- Vitest-Tests (`*.test.ts`, `__tests__`) liegen nahe am Quellcode. Für React-Komponenten `@testing-library/react` + Vitest verwenden, für Logik reine Unit-Tests.
- Realtime-Änderungen zusätzlich durch `node realtime-server/src/server.js` bzw. bestehende npm-Skripte prüfen und Konsolen-Logs beobachten.
- Nutze Preview-Deployments oder lokale Storybook-artige Seiten (sofern vorhanden), um UI-Änderungen visuell abzusichern.

## Dokumentation & Kommunikation
- README, `docs/**` und `.env.example` bei relevanten Änderungen aktualisieren. Architektur- oder Designentscheidungen bitte im passenden Dokument notieren.
- Tickets oder PR-Beschreibungen sollten Kontext, Entscheidungspunkte und QA-Schritte enthalten. Verweise auf Monitoring/Analytics ergänzen, falls betroffen.
- Diese `AGENTS.md` bei Bedarf fortschreiben, wenn bessere Kollaborationsmuster oder neue Tooling-Standards entstehen. Änderungen nachvollziehbar begründen.

## Ausnahmen & Sonderfälle
- Reine Dokumentations-, Kommunikations- oder Organisationsänderungen (z. B. Updates an Markdown-Dateien) dürfen ohne `pnpm lint/test/build` abgeschlossen werden – im Abschlussbericht explizit darauf hinweisen.
- Arbeiten ausschließlich am Socket.io-Dienst im Ordner `realtime-server` erfordern nur die dort relevanten Checks. Frontend-Builds können entfallen.
- Wenn lokale Rahmenbedingungen (fehlende Binärabhängigkeiten, Rechteprobleme etc.) das Ausführen von Checks verhindern, Blockade dokumentieren und – wenn möglich – manuelle Tests oder statische Analysen beilegen.
