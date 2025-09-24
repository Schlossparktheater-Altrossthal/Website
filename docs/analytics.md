# Analytics, Caching & Realtime-Dashboard

Dieses Dokument beschreibt, wie die Server-Analytics aggregiert, gecacht und im Mitgliederbereich in Echtzeit aktualisiert werden.

## Architekturüberblick
- **Cronjobs (`scripts/cron/aggregate-*.ts`)** schreiben aggregierte Kennzahlen in die Postgres-Datenbank und lösen anschließend per `pg_notify('server_analytics_update', …)` einen Broadcast aus.
- **Realtime-Server (`realtime-server/src/analytics.js`)** lauscht über `LISTEN server_analytics_update` auf diese Benachrichtigungen, erstellt einen frischen Snapshot und sendet `server_analytics_update`-Events an alle verbundenen Clients.
- **Next.js Server-Komponente (`src/lib/server-analytics.ts`)** holt die Daten mittels `unstable_cache`, versieht sie mit Retry-/Fallback-Logik und reicht Metadaten (Quelle, Versuche, Stale-Zeitpunkt) an die UI weiter.
- **Dashboard (`/mitglieder/server-analytics`)** zeigt Kennzahlen, SLA-Informationen und Datenqualitäts-Badges an und reagiert auf Live-Updates.

## Cronjobs einrichten
1. Stelle sicher, dass eine Postgres-Instanz erreichbar ist (`DATABASE_URL` gesetzt) und die Analyticstables vorhanden sind (`pnpm db:migrate`).
2. Cronjobs können via `cron` oder einem Scheduler wie systemd/timer laufen. Beispiel-Crontab (alle 5 Minuten HTTP, alle 15 Minuten Seiten/Sessions):
   ```cron
   */5 * * * * cd /pfad/zum/repo && pnpm tsx scripts/cron/aggregate-http-metrics.ts >> logs/cron-http.log 2>&1
   */15 * * * * cd /pfad/zum/repo && pnpm tsx scripts/cron/aggregate-page-metrics.ts >> logs/cron-page.log 2>&1
   */15 * * * * cd /pfad/zum/repo && pnpm tsx scripts/cron/aggregate-session-metrics.ts >> logs/cron-session.log 2>&1
   ```
3. Jeder Job sendet nach erfolgreichem Lauf eine `server_analytics_update`-Notification. Der Realtime-Server muss deshalb parallel laufen (`pnpm start:proxy` oder `node realtime-server/src/server.js`).

## Wichtige Environment-Variablen
| Variable | Zweck |
| --- | --- |
| `DATABASE_URL` | Verbindung zu Postgres; notwendig für Aggregation, Caching und Notifications. |
| `ANALYTICS_HTTP_WINDOW_MINUTES` / `ANALYTICS_HTTP_BUCKET_MINUTES` | Zeitfenster & Bucket-Größe für HTTP-Aggregationen (optional). |
| `ANALYTICS_PAGE_WINDOW_DAYS` / `ANALYTICS_PAGE_RETENTION_DAYS` | Fenster und Aufbewahrung für Seitenkennzahlen. |
| `ANALYTICS_SESSION_WINDOW_DAYS` / `ANALYTICS_SESSION_RETENTION_DAYS` | Fenster für Sessions & Realtime-Events. |
| `NEXT_PUBLIC_REALTIME_URL` | Frontend-URL für Socket.io (Dev-Proxy z. B. `https://theater.local/realtime`). |
| `REALTIME_AUTH_TOKEN` / `REALTIME_HANDSHAKE_SECRET` | Authentifizierung des Realtime-Servers. |

> Ergänze neue Variablen stets in `.env.example` und dokumentiere Änderungen in den Deployment-Runbooks.

## Caching & Fallback
- `collectServerAnalytics` versucht bis zu drei Mal (`0ms`, `250ms`, `1000ms`) einen Live-Snapshot zu laden.
- Bei Erfolg wird der Snapshot via `unstable_cache` gespeichert und als Quelle `live` markiert.
- Schlägt die Aktualisierung fehl, liefert die Funktion die letzte erfolgreiche Messung (`source: "cached"`) inkl. `staleSince` und gesammelten Fehlergründen zurück.
- Ist kein Cache verfügbar, werden statische Kennzahlen samt Fallback-Gründen ausgespielt (`source: "fallback"`).

## Manuelle Tests & Dev-Proxy
1. Lokale Umgebung starten: `pnpm start:proxy` (Next.js + Realtime + Proxy) oder alternativ `pnpm dev` für Turbopack.
2. Im Browser `https://theater.local/mitglieder/server-analytics` aufrufen (Hostname via `/etc/hosts` oder Traefik konfigurieren).
3. Zur Qualitätssicherung:
   - Prüfen, ob das Dashboard beim Start einen Badge „Live“, „Cache“ oder „Fallback“ zeigt.
   - Ein Cronjob/`pnpm tsx scripts/cron/...` manuell ausführen und auf ein Realtime-Update achten (`server_analytics_update` in DevTools).
   - In Fallback-Szenarien sollten Tooltip & Badge klar auf den Grund hinweisen.
4. Vor Commits `pnpm lint`, `pnpm test` und `pnpm build` ausführen; das Dashboard zusätzlich einmal im Proxy-Modus aufrufen.

## Fehlersuche
- **Keine Live-Daten:** Prüfen, ob Cronjobs laufen, Tabellen Daten enthalten und Notifications ankommen (`SELECT * FROM pg_listening_channels();`).
- **Realtime-Updates kommen nicht an:** Überprüfen, ob `server_analytics_update` im Socket-Log erscheint und die Postgres-Verbindung im Realtime-Server steht (ENV & Netzwerk).
- **Fallback ohne Reason:** Cache leeren (`pnpm next:cache:clear`) und auf Konsolenlogs achten (`[server-analytics]`).

Weiterführende Informationen zu allgemeinen Proxy-/Entwicklungs-Setups siehe [`docs/dev-proxy.md`](./dev-proxy.md).
