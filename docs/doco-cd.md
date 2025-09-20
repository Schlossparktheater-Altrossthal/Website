# Doco CD Deployment

Die Docker-Umgebung wurde vereinheitlicht: Website und Realtime-Server laufen
jetzt immer gemeinsam im selben Container und exponieren die Socket.IO-Endpunkte
unter `/realtime`.

## Compose-Dateien

| Zweck | Datei | Beschreibung |
| --- | --- | --- |
| Lokale Entwicklung | `docker-compose.yml` | Baut das Dev-Image aus dem Quellcode, startet Postgres (`theater_dev`) und Mailpit. |
| Hosting via Registry | `docker-compose.hosting.yml` | Nutzt die aus GitHub Actions gepushten Images und veröffentlicht sie per Traefik unter `devtheater.beegreenx.de` und `prodtheater.beegreenx.de`. |

## Vorbereitung für Doco

1. **Traefik-Netzwerk**: Die Hosting-Compose erwartet ein externes Netzwerk
   `proxy` (`docker network create proxy`).
2. **Secrets**: Hinterlege für beide Instanzen die erforderlichen Variablen, z. B.
   `DEV_AUTH_SECRET`, `DEV_REALTIME_AUTH_TOKEN`, `PROD_AUTH_SECRET`, Mail-Setup
   usw. Die Platzhalter mit `:?set …` erzwingen, dass nichts vergessen wird.
3. **Datenbank**: Ein einzelner Postgres-Container genügt. Das Init-SQL unter
   `docker/initdb/001-create-databases.sql` erzeugt die Datenbanken
   `theater_dev` und `theater_prod`, die den jeweiligen Containern über
   `DATABASE_URL` zugewiesen werden.

## Deployment-Befehle

Der Hosting-Stack kann komplett gestartet werden:

```bash
docker compose -f docker-compose.hosting.yml up -d
```

Traefik routet anschließend automatisch:

- `https://devtheater.beegreenx.de` → Container `app-dev`
- `https://prodtheater.beegreenx.de` → Container `app-prod`

Über `DEV_IMAGE_TAG` bzw. `PROD_IMAGE_TAG` lassen sich bei Bedarf alternative
Tags (z. B. `sha`-basierte Builds) aus der Registry laden.

## GitHub Action

Die Workflow-Datei `.github/workflows/docker-publish.yml` baut jetzt nur noch
zwei Images (`Dockerfile.dev` → Tag `dev`, `Dockerfile.prod` → Tag `prod`) und
pusht sie nach `limitlessgreen/theater_website`. Damit können Doco und weitere
Umgebungen auf denselben Artefakten basieren.
