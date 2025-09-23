# Entwicklung hinter Traefik oder anderen Proxies

Wenn der Entwicklungsstack über einen Reverse Proxy wie Traefik erreichbar gemacht wird (z. B. `https://theater.local`),
werden Anmelde-Weiterleitungen standardmäßig auf `http://localhost:3000` gesetzt. Der Grund: `NEXTAUTH_URL` ist in der
Dev-Compose-Datei auf `http://localhost:3000` voreingestellt und NextAuth verwendet diesen Wert für Callback-URLs.

Damit Weiterleitungen und Links auf die externe Domain zeigen, setze vor dem Start von `docker compose` die relevanten
Hosts (ohne abschließenden Slash):

```bash
export NEXTAUTH_URL="https://theater.local"
export NEXT_PUBLIC_BASE_URL="https://theater.local"
export NEXT_PUBLIC_REALTIME_URL="https://theater.local/realtime" # optional, z. B. bei anderem Pfad
# alternativ: .env-Datei mit den gleichen Variablen pflegen
```

Durch die Änderung in `docker-compose.yml` werden diese Werte durchgereicht. Der Realtime-Server übernimmt denselben
Origin für CORS und generierte Links. Ohne gesetzte Variablen bleibt das Standardverhalten (`http://localhost:3000`) für
lokale Entwicklung bestehen.
