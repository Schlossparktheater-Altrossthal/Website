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

### Node.js/pnpm Probleme

```bash
# Cache leeren
pnpm store prune

# node_modules neu installieren
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

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
