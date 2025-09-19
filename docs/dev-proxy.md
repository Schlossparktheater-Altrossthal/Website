# Entwicklung hinter Traefik oder anderen Proxies

Wenn der Entwicklungsstack über einen Reverse Proxy wie Traefik erreichbar gemacht wird (z. B. `https://theater.local`),
werden Anmelde-Weiterleitungen standardmäßig auf `http://localhost:3000` gesetzt. Der Grund: `NEXTAUTH_URL` ist in der
Dev-Compose-Datei auf `http://localhost:3000` voreingestellt und NextAuth verwendet diesen Wert für Callback-URLs.

Damit Weiterleitungen auf die externe Domain zeigen, setze vor dem Start von `docker compose` den gewünschten Host:

```bash
export NEXTAUTH_URL="https://theater.local"
# optional: .env Datei mit NEXTAUTH_URL=...
```

Durch die Änderung in `docker-compose.yml` wird dieser Wert jetzt durchgereicht. Der Realtime-Server übernimmt denselben
Origin für CORS. Ohne gesetzte Variable bleibt das Standardverhalten (`http://localhost:3000`) für lokale Entwicklung
bestehen.
