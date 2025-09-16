# Sommertheater Altroßthal – Website & Mitgliederbereich

## Überblick
Diese Codebasis bündelt die öffentliche Website und den geschützten Mitgliederbereich des Sommertheater-Projekts im Schlosspark Altroßthal. Der Tech-Stack umfasst den Next.js App Router (SSR & RSC), TypeScript, Tailwind/Shadcn UI-Komponenten sowie Prisma als ORM für eine PostgreSQL-Datenbank. Authentifizierung und Rollenverwaltung laufen über NextAuth.

Die wichtigsten Domänenmodule aktuell im Code:
- **Landingpage** mit Hero-Rotator und redaktionellen Textbausteinen (`src/app/page.tsx`).
- **Mitgliederbereich** unter `src/app/(members)/mitglieder` mit Probenübersicht, Zusage-Workflows und Verfügbarkeitskalendern.
- **Mystery-/Chronik-Inhalte** via `Show`, `Clue` und `Guess` in `prisma/schema.prisma`.
- **Organisations-Bausteine** wie Aufgaben, Finanzen und Inventar (Modelle existieren bereits, UI folgt iterativ).

Weitere Kontextinformationen und Roadmaps finden sich im Dokument [`docs/entwurf-und-analyse.md`](docs/entwurf-und-analyse.md).

## Projektstruktur
```
src/
  app/                    # App-Router Routen (öffentlich & Mitglieder)
  components/             # UI-Bausteine, Navigations- und Formular-Komponenten
  lib/                    # Auth, RBAC, Prisma-Client, Hilfsfunktionen
  types/                  # TypeScript-Erweiterungen (z. B. für NextAuth)
prisma/
  schema.prisma           # Datenmodell
  seed.mjs                # Entwicklungs-Seed (Chronik, Demo-Logins, Proben)
docs/                     # Analyse-, Entwurfs- und Protokolldokumente
```

## Entwicklung starten
1. Abhängigkeiten installieren (pnpm empfohlen):
   ```bash
   pnpm install
   ```
2. Umgebungsvariablen hinterlegen (`.env`):
   ```dotenv
   DATABASE_URL="postgresql://user:password@localhost:5432/theater"
   AUTH_SECRET="dev-secret"
   EMAIL_SERVER=""        # optional – für Magic Links in Produktion
   EMAIL_FROM=""           # optional – Absenderadresse
   NEXTAUTH_URL="http://localhost:3000"
   # NEXT_PUBLIC_AUTH_DEV_NO_DB=1  # optional, falls ohne Datenbank entwickelt wird
   ```
3. Datenbank vorbereiten:
   ```bash
   pnpm prisma:migrate
   pnpm db:seed
   ```
4. Entwicklungsserver starten:
   ```bash
   pnpm dev
   ```
   Die App läuft anschließend unter [http://localhost:3000](http://localhost:3000).

## Authentifizierung & Rollen
- In der Entwicklung steht ein Credentials-Provider zur Verfügung. Erlaubte Logins: `member@example.com`, `cast@example.com`, `tech@example.com`, `board@example.com`, `finance@example.com`, `admin@example.com`.
- Jeder Login besitzt eine vordefinierte Rolle (`member`, `cast`, `tech`, `board`, `finance_admin`, `admin`), die sowohl für die Navigationssichtbarkeit als auch für API-RBAC verwendet wird (`src/lib/rbac.ts`).
- Magic-Link-Authentifizierung via E-Mail kann aktiviert werden, sobald SMTP-Credentials in `.env` hinterlegt sind.

## Nützliche Skripte
| Kommando              | Beschreibung |
| --------------------- | ------------ |
| `pnpm dev`            | Startet den Next.js Dev-Server mit Turbopack. |
| `pnpm build`          | Erzeugt ein Produktions-Build. |
| `pnpm start`          | Startet den Produktionsserver (benötigt vorheriges Build). |
| `pnpm lint`           | Führt ESLint über das Projekt aus. |
| `pnpm prisma:generate`| Generiert den Prisma-Client. |
| `pnpm prisma:migrate` | Wendet Migrationen an (Name in `package.json` auf `init` gesetzt). |
| `pnpm db:seed`        | Spielt Demodaten (Chronik, Proben, Verfügbarkeiten) ein. |

## Weitere Hinweise
- Die Seed-Daten erzeugen Beispielproben und Verfügbarkeiten für `member@example.com`, sodass Kalender und Zusageflows sofort getestet werden können.
- Für Analyse- und Konzeptarbeit existiert das Protokoll [`docs/entwurf-und-analyse.md`](docs/entwurf-und-analyse.md); neue Erkenntnisse und offene Fragen können dort fortgeschrieben werden.
- Docker-Artefakte (`Dockerfile`, `docker-compose.yml`) sind vorbereitet, benötigen aber valide `.env`-Werte und ggf. Anpassungen für produktive Deployments.
