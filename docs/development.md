# Development Environment

## Quick Start

```bash
# Mit Docker (empfohlen) — startet DB, Mailpit und den App-Container:
pnpm dev:start

# Ohne Docker — setzt eine lokal laufende Postgres-Instanz voraus:
pnpm dev:start:local
```

Beide Befehle starten automatisch:

- PostgreSQL Datenbank (Port 5432, Docker-Modus)
- Mailpit E-Mail Interface (Port 8025, Docker-Modus)
- Next.js Development Server mit Realtime Support (Port 3000)

## Script Optionen

```bash
pnpm dev:setup            # Nur Setup (ohne App zu starten), Docker-Modus
pnpm dev:setup:local      # Nur Setup, lokaler Modus (kein Docker)
pnpm dev:start            # Setup + App starten, Docker-Modus
pnpm dev:start:local      # Setup + Next.js starten, lokaler Modus
pnpm dev:start:prod       # Production-Build via Docker hochfahren
pnpm dev:reset            # Vollständiger Reset (Container, Volumes, node_modules)
pnpm dev:clean            # Tiefe Bereinigung (Container, Images, Volumes, node_modules)
```

## Was macht das Script?

1. **Requirements Check**: Überprüft Docker (außer `--local`), Node.js, pnpm
2. **Environment Setup**: Erstellt `.env` mit sicheren Zufallswerten
3. **Dependencies**: Installiert Node.js Abhängigkeiten (für Prisma Client)
4. **Services** (Docker-Modus): Startet PostgreSQL und Mailpit via Docker Compose
5. **Application**: Startet App-Container (Docker) bzw. `next dev` (lokal)

## URLs nach dem Start

- **Hauptanwendung**: http://localhost:3000
- **E-Mail Interface**: http://localhost:8025 (Docker-Modus)
- **Datenbank**: localhost:5432

## Nützliche Befehle

```bash
# Services stoppen
docker compose down

# Logs anzeigen
docker compose logs -f app          # App-Container
docker compose logs -f db           # Datenbank
docker compose logs -f              # Alle Services

# Datenbank zurücksetzen
docker compose down -v && pnpm dev:start

# Container Status
docker compose ps

# In Container connecten
docker compose exec app sh                                    # App Shell
docker compose exec db psql -U postgres -d theater_dev        # Datenbank
docker compose exec app pnpm prisma studio                    # Prisma Studio

# Einzelne Services verwalten
docker compose restart app          # App neu starten
docker compose up -d db            # Nur DB starten

# Sichere projekt-spezifische Bereinigung
docker compose down --volumes                    # Container + Volumes stoppen/löschen
docker compose rm -f                            # Container-Definitionen entfernen
docker image ls | grep theater-website          # Projekt-Images anzeigen
docker volume ls | grep theater-website         # Projekt-Volumes anzeigen
```

## Dependencies und Advisories

Einziges Lockfile ist `pnpm-lock.yaml`, jede Installation läuft über `pnpm` (`pnpm install --frozen-lockfile` in CI). `package-lock.json` ist in `.gitignore` und darf nicht committet werden – sonst scannt Dependabot zwei Manifeste und meldet jedes Advisory doppelt.

Gibt es für ein verwundbares transitives Paket kein Parent-Update, wird es über `pnpm.overrides` in `package.json` gepinnt. Jede Override-Zeile braucht eine Begründung im Commit; Major-Sprünge nur, wenn der tatsächliche API-Aufruf des Parents geprüft ist (Beispiel: `uuid` 8.3.2 → 11.1.1, weil `exceljs` ausschließlich `const {v4: uuidv4}` destrukturiert und uuid 11.1.1 weiterhin ein CJS-Build mit benanntem `v4`-Export liefert).

Stand 2026-09-26: `pnpm audit --prod` meldet nur noch `quill` (low, GHSA-v3m3-f69x-jf25/CVE-2025-15056). Es gibt keinen Patch – die Advisory nennt keine „patched version", `quill@2.0.3` ist die neueste Veröffentlichung und wird von `react-quill-new@3.8.3` als `~2.0.3` gepinnt. Der zugehörige Dependabot-Alert ist deshalb bewusst als `tolerable_risk` geschlossen: Der betroffene Export `Quill#getSemanticHTML` speist ausschließlich den Rich-Text-Editor der Probenplanung (`src/components/ui/rich-text-editor.tsx` → `rehearsal-editor.tsx`), und dessen HTML-Output wird beim Speichern (`src/lib/probenplanung/actions-helpers.ts`) wie beim Rendern (`src/app/(members)/mitglieder/proben/[rehearsalId]/page.tsx`) durch `sanitize-html` bereinigt. XSS ist damit nicht ausführbar. Wird der Editor ersetzt, diese Notiz mitpflegen und den Alert neu bewerten.

## Troubleshooting

### Port bereits belegt

```bash
# Finde Prozess auf Port 3000
lsof -i :3000

# Stoppe alle Docker Container
docker compose down

# Andere Ports prüfen
netstat -tulpn | grep :5432
netstat -tulpn | grep :8025
```

### Datenbank Probleme

```bash
# Container neu starten
docker compose restart db

# Datenbank vollständig zurücksetzen
pnpm dev:reset
```

### Prisma-Client veraltet (`Unknown argument ...`)

Symptom: Der Dev-Server startet normal, aber jeder Datenbankzugriff, der ein Feld nutzt, das erst
kürzlich ins Schema kam, scheitert mit `PrismaClientValidationError: Unknown argument 'status'` —
die Seite antwortet mit 500.

`pnpm dev` und `pnpm build` rufen über ihre `pre`-Skripte `prisma generate` und `prisma migrate
deploy` auf, ein frischer Start ist deshalb unkritisch. Der Fehler tritt nur auf, wenn der Client
**während** eines laufenden Prozesses veraltet: nach einem `git pull` mit Schemaänderung bei
laufendem Dev-Server, nach einem mit `SKIP_PRISMA_POSTINSTALL` abgebrochenen Install oder bei einem
pnpm-Store-Treffer, der den `postinstall`-Hook überspringt.

```bash
pnpm prisma:generate

# Der neue Client greift erst nach einem Neustart: Turbopack cached node_modules.
pkill -f "next dev"
rm -rf .next
pnpm dev
```

Seit Prisma 7 liegt der Client unter
`node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client`. Der alte Pfad
`node_modules/.prisma/client` existiert nicht mehr — ein `ls` darauf ist deshalb kein Beleg für
einen fehlenden Client.

### Node.js/pnpm Probleme

```bash
# Cache leeren
pnpm store prune

# node_modules neu installieren
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Lokaler Login mit eigenem Konto

Ohne `AUTHENTIK_*`-Variablen (Standard in `.env`) läuft lokal nur der Passwort-Login.

- **Passwort-Login** funktioniert nur für Konten mit gesetztem `passwordHash`. Nach einem
  Datenimport aus Staging betrifft das die übernommenen Altkonten; Owner- und
  Admin-Konten haben keinen Hash.
- **Owner-Setup-Link**: jeder `pnpm dev`-Start gibt einen frischen, einmalig gültigen Link
  `http://localhost:3000/setup/owner/<token>` aus. Damit lässt sich ein eigenes Konto
  anlegen oder das Passwort erneuern.
- **„Passwort vergessen“** auf der Login-Seite verschickt eine Mail, die in Mailpit
  (`http://localhost:8025`) landet – der Reset lässt sich also lokal abschließen.
- **Test-Login** (`/api/dev/screenshot-session`, siehe `docs/e2e-tests.md`) ist für die
  festen Testnutzer gedacht. Ein beliebiges `?email=` funktioniert, aber Vorsicht:
  `ensureDevTestUser` macht ein `upsert` und überschreibt dabei `firstName`, `lastName`,
  `name` und `role` eines bereits existierenden Kontos. Für echte Konten daher
  Owner-Setup-Link oder Passwort-Reset nutzen.

## Aktuellen Datenstand lokal laden

Der Server mit Cluster-Zugang steht in `~/.ssh/config`; ein lokaler kubeconfig ist nicht
nötig. Staging wird täglich um 02:00 aus der Produktion synchronisiert
(`k8s-infrastructure/applications/website-staging/db-sync.yaml`), hat also denselben
Datenstand wie Prod – nur bis zu einen Tag älter.

```bash
# 1. Dump auf dem Server erzeugen
ssh theater@<server> 'kubectl -n theater-website-staging exec postgresql-0 -- \
  pg_dump --no-owner --no-acl -U theater -d theater_staging > /tmp/staging.sql'

# 2. Komprimiert herunterladen und auf dem Server aufräumen
ssh theater@<server> 'gzip -6 -f /tmp/staging.sql'
scp theater@<server>:/tmp/staging.sql.gz /tmp/
ssh theater@<server> 'rm -f /tmp/staging.sql.gz'

# 3. Lokale Datenbank ersetzen
pkill -f "next dev"
docker exec website-db-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS theater_dev WITH (FORCE);" -c "CREATE DATABASE theater_dev;"
gzcat /tmp/staging.sql.gz | docker exec -i website-db-1 psql -U postgres -d theater_dev \
  -v ON_ERROR_STOP=1 -q -o /dev/null

# 4. Starten – `predev` wendet fehlende Migrationen an
pnpm dev
```

Bewusst `DROP DATABASE` statt `pg_dump --clean`: `--clean` entfernt nur Objekte, die in der
Quelldatenbank existieren – lokal verbliebene Objekte überleben. Das ist die
`--clean`-Falle, die in `docs/produktionen-mitglieder-plan.md` erwähnt wird.

`kubectl exec … > datei` darf **nicht** über SSH gestreamt werden: bei rund 80 MB bricht der
Stream ab und die Datei ist stillschweigend unvollständig – ohne Fehler und mit Exit-Code 0.
Immer eine Datei auf dem Server erzeugen und die Prüfsumme vergleichen.

Die lokale Datenbank wird dabei vollständig ersetzt. Die Dev-Testnutzer für den Test-Login
legt `/api/dev/screenshot-session` bei Bedarf neu an.

## Environment Variablen

Das Script generiert automatisch eine `.env` Datei mit:

- Sichere Zufalls-Secrets für Auth und Realtime
- Lokale URLs (localhost:3000)
- Development-optimierte Einstellungen
- PWA und Dev-Login aktiviert

Bei Bedarf die `.env` manuell anpassen.

## Realtime-Architektur

- Der Next.js App-Server und der eigenständige Socket.io-Dienst greifen beide auf
  `createRealtimeCore` (`src/lib/realtime/shared`) zurück. Dieses Modul kapselt
  Verbindungs-Tracking, Presence-Events sowie sämtliche Broadcast-Helfer.
- Tests (Vitest + Node Test Runner) laufen gegen dieselbe Implementierung. Neue
  Events oder Raumregeln müssen daher nur noch an einer Stelle ergänzt werden.
- Für lokale Entwicklung bedeutet das: egal ob du `pnpm dev`, den
  Standalone-Server (`realtime-server/src`) oder `scripts/start-combined-server.mjs`
  nutzt – die Event-Verarbeitung verhält sich identisch.

## Offline Dashboard Fixture

Für UI-Screenshots und visuelle Regressionen lässt sich das Mitglieder-Dashboard ohne laufende Datenbank verwenden. Sobald im
Development/Preview keine `DATABASE_URL` gesetzt ist, liefert der Endpunkt [`GET /api/dashboard/overview`](../src/app/api/dashboard/overview/route.ts)
eine deterministische Demo-Antwort zurück (`offline: true`).

- Der Fallback deckt Kennzahlen, Aktivitäten, Endproben-Woche und die Profil-Checkliste ab.
- Im Frontend erscheint ein dezenter Hinweisbanner, damit Screenshots klar als Demo-Daten gekennzeichnet sind.

Für echte Daten einfach wieder eine gültige `DATABASE_URL` setzen oder den Dev-Stack über `pnpm dev:start` starten.

## Migrationen auf Staging/Prod

Der Staging-Pod führt beim Start einen Init-Container (`migrate`) aus, der
`node scripts/run-prisma-migrate.mjs` und damit `prisma migrate deploy` laufen
lässt. Schlägt dieser Lauf fehl, bleibt der Pod in `Init:CrashLoopBackOff` und
Argo CD meldet die App als `Degraded`.

- **Migrationen nie nachträglich ändern**, wenn sie schon gepusht oder irgendwo
  angewandt wurden. `migrate deploy` vergleicht die Prüfsumme der Datei mit
  `_prisma_migrations.checksum` – eine geänderte, bereits angewandte Migration
  blockiert den Deploy dauerhaft. Korrektur immer als neue Migration.
- **Prisma wendet Migrationen nicht transaktional an.** Ein Fehler (z. B.
  `P3009`) hinterlässt Teil-DDL: `ALTER TABLE … ADD COLUMN` bleibt stehen, der
  Eintrag in `_prisma_migrations` steht auf `failed`. `resolve --rolled-back`
  allein heilt das nicht, der erneute Lauf scheitert dann an „column already
  exists".

Recovery (per `kubectl -n theater-website-staging exec postgresql-0 -- psql -U
theater -d theater_staging`):

1. Teil-DDL zurückrollen: die in der fehlgeschlagenen Migration angelegten
   Spalten/Indizes/Constraints per `DROP … IF EXISTS` entfernen.
2. `DELETE FROM "_prisma_migrations" WHERE migration_name = '<name>';`
3. Pod neu starten (`kubectl delete pod …` oder `rollout restart deploy/website`).
   Der Init-Container wendet die Migration dann sauber von vorn an.
