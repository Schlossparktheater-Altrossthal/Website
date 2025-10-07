# Development Environment

## Quick Start

```bash
./start-dev.sh
```

Das Script startet automatisch:
- PostgreSQL Datenbank (Port 5432)
- Mailpit E-Mail Interface (Port 8025)
- Next.js Development Server mit Realtime Support (Port 3000)

## Script Optionen

```bash
./start-dev.sh --help     # Hilfe anzeigen
./start-dev.sh --reset    # Vollständiger Reset (Container, Volumes, node_modules)
./start-dev.sh --clean    # Projekt-spezifische Bereinigung (Container, Images, Volumes)
```

## Was macht das Script?

1. **Requirements Check**: Überprüft Docker, Node.js, pnpm
2. **Environment Setup**: Erstellt `.env` mit sicheren Zufallswerten
3. **Dependencies**: Installiert Node.js Abhängigkeiten (für Prisma Client)
4. **Services**: Startet PostgreSQL und Mailpit via Docker Compose
5. **Application**: Startet App-Container (inkl. DB-Setup, Migrations, Seeding)
6. **Logs**: Zeigt Live-Logs der Anwendung

## URLs nach dem Start

- **Hauptanwendung**: http://localhost:3000
- **E-Mail Interface**: http://localhost:8025
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
docker compose down -v && ./start-dev.sh

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
docker compose down -v
./start-dev.sh --reset
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