# Doco CD Deployment

Dieses Repository stellt zwei getrennte Deployments für Doco bereit:

- **Entwicklungs-Stack** (`theaterdev.beegreenx.de`): basiert auf dem Entwicklungs-
  `docker-compose.yml` und wird um Traefik-spezifische Einstellungen ergänzt.
- **Produktiv-Stack** (`theaterprod.beegreenx.de`): baut das Production-Image und
  versieht es ebenfalls mit Traefik-Routing.

Die zusätzlichen Konfigurationen liegen in separaten Compose-Dateien, so dass die
Standardentwicklung lokal weiterhin ohne Traefik funktioniert:

| Umgebung | Basis-Datei | Traefik-Overlay |
| --- | --- | --- |
| Entwicklung | `docker-compose.yml` | `docker-compose.dev.traefik.yml` |
| Produktion | `docker-compose.prod.yml` | `docker-compose.prod.traefik.yml` |

## Vorbereitung

1. **Traefik-Netzwerk**: Die Overlays erwarten ein externes Docker-Netzwerk mit dem
   Namen `proxy` (`docker network create proxy`).
2. **Secrets**: Hinterlege in Doco die erforderlichen Umgebungsvariablen (z. B.
   `AUTH_SECRET`, E-Mail-Zugangsdaten oder Production-Datenbank-URL). Für das Dev-
   Deployment genügen die Standardwerte, für Produktion müssen echte Secrets
   gesetzt werden.
3. **Realtime-Endpunkt**: Beide Overlays exposen den Socket.io-Server unter dem
   Pfad `/realtime`. Der Client nutzt `NEXT_PUBLIC_REALTIME_URL`, um denselben
   Host zu verwenden – zusätzliche Subdomains sind nicht nötig.

## Deployment-Befehle

### Entwicklung (`theaterdev.beegreenx.de`)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.traefik.yml up -d
```

Traefik leitet anschließend `https://theaterdev.beegreenx.de` auf den Next.js Dev-
Server weiter und stellt die Realtime-API unter `https://theaterdev.beegreenx.de/realtime`
bereit.

### Produktion (`theaterprod.beegreenx.de`)

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.prod.traefik.yml up -d
```

Dieses Setup baut das Production-Image (Dockerfile.prod) und aktiviert ebenfalls
TLS-Routing via Traefik. Stelle sicher, dass alle produktiven Variablen gesetzt
sind (`AUTH_SECRET`, `REALTIME_AUTH_TOKEN`, etc.).

## Lokale Entwicklung

Für lokale Tests ohne Traefik genügt weiterhin:

```bash
docker compose up
```

Die zusätzlichen Dateien greifen nur, wenn sie explizit in den Compose-Befehl
aufgenommen werden.
