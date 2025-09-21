# AGENTS.md

## Überblick
- Dieses Projekt basiert auf Next.js 15 mit App Router, TypeScript und React 19; der App-Code liegt unter `src/app` und nutzt den globalen Provider-Wrapper aus `src/app/providers.tsx`. 
- Zusätzlich existiert im Ordner `realtime-server` ein eigenständiger Socket.io-Dienst, der mit dem Web-Frontend interagiert.

## Tooling & lokale Entwicklung
- Verwende konsequent `pnpm` (Lockfile vorhanden). Neue Abhängigkeiten installierst du mit `pnpm add <pkg>`.
- Wichtige Skripte:
  - `pnpm dev` startet die App und sorgt automatisch dafür, dass Prisma-Migrationen ausgeführt werden (per `scripts/run-prisma-migrate.mjs`).
  - `pnpm lint`, `pnpm test` und `pnpm build` müssen vor jedem Commit fehlerfrei laufen.
  - Für Datenbankarbeiten stehen `pnpm prisma:generate`, `pnpm db:migrate` und `pnpm db:seed` bereit.
- Wenn du Prisma-Schemas änderst, führe `pnpm prisma:generate` aus und dokumentiere neue ENV-Variablen.

## Architektur- und Code-Konventionen
- Standardmäßig Server Components nutzen; `use client` nur setzen, wenn zwingend nötig (z. B. Hooks wie React Query, NextAuth oder Realtime).
- Gemeinsame Wrapper wie Session-, Query- und Realtime-Kontext kommen über `Providers` (`src/app/providers.tsx`).
- Pfad-Alias `@/*` verwenden statt relativer Importketten.
- Für Datenbankzugriffe ausschließlich den in `@/lib/prisma` bereitgestellten Proxy nutzen und keine eigenen `PrismaClient`-Instanzen anlegen.
- Realtime-Funktionalität greift über `@/hooks/useRealtime` auf Socket.io zu; halte dich an die bestehende Handshake-/Room-Logik und pflege neue Events sowohl im Frontend als auch im Server (`realtime-server/src/server.js`). Beachte die ENV-Variablen (`NEXT_PUBLIC_REALTIME_URL`, `REALTIME_AUTH_TOKEN`, `REALTIME_HANDSHAKE_SECRET` usw.).

## UI- und UX-Richtlinien
- Tailwind CSS und shadcn/ui sind die Basis. Nutze bestehende Komponenten aus `src/components/ui` und erweitere sie nur, wenn nötig.
- Klassenketten mit dem `cn`-Helper aus `@/lib/utils` zusammenführen, statt manuell Strings zu konkatinieren.
- Farben, Typografie und Interaktionsmuster richten sich nach den Dokumenten in `docs/design-system.md` und den generierten Swatches in `docs/swatches`.
- Achte auf Barrierefreiheit (Skip-Link, Fokuszustände, Kontraste) im Sinne des bestehenden Layouts (`src/app/layout.tsx`).
- Wenn du Screenshots aus dem Mitgliederbereich benötigst, melde dich vorher im Mitgliederbereich an; Screenshots dürfen nicht nur die Login-Seite zeigen.

## Tests & Qualitätssicherung
- Vor Abgabe immer `pnpm lint`, `pnpm test` und `pnpm build` ausführen; Fehler müssen behoben werden.
- Änderungen am Realtime-Server lokal über `npm start` (oder `node src/server.js`) überprüfen; halte die Server-Logs im Blick.

### Ausnahmen vom Standardprozedere
- Reine Dokumentations- oder Organisationsänderungen (z. B. Updates an `README.md`, Dateien in `docs/`, `AGENTS.md` oder ähnlichen Markdown-Notizen) dürfen ohne `pnpm lint`, `pnpm test` und `pnpm build` abgeschlossen werden. Weise im Abschlussbericht ausdrücklich darauf hin, dass nur redaktionelle Inhalte angepasst wurden.
- Für Aufgaben, die ausschließlich Assets unter `docs/swatches` oder anderen statischen Download-Ressourcen betreffen, sind ebenfalls keine Build- oder Testläufe nötig.
- Wenn die Arbeit ausschließlich den eigenständigen Socket.io-Dienst im Ordner `realtime-server` betrifft und keinerlei Code im Next.js-Frontend geändert wurde, musst du lediglich die für diesen Dienst relevanten Checks ausführen (z. B. vorhandene npm-Skripte); die Next.js-Pipeline kann entfallen.
- Sollten lokale Gegebenheiten (fehlende Binärabhängigkeiten, Zugriffsrechte o. Ä.) das Ausführen der genannten Tools unmöglich machen, dokumentiere die Blockade im finalen Bericht und liefere – sofern möglich – alternative Nachweise (z. B. statische Analyse, manuelle Tests).

## Dokumentation & Kommunikation
- Aktualisiere bei relevanten Änderungen README, Docs oder ENV-Beispiele.
- Notiere Design- oder Architekturentscheidungen im passenden Dokument im `docs/`-Ordner.
