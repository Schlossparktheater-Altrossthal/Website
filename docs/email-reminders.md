# E-Mail-Erinnerungen für Probenanmeldungen

## Übersicht

Das System sendet automatisch E-Mail-Erinnerungen an Mitglieder, die sich noch nicht für eine Probe an- oder abgemeldet haben. Die Erinnerungen werden eine Woche vor Anmeldeschluss verschickt.

## Konfiguration

1. Umgebungsvariablen in `.env` setzen:
   ```bash
   # E-Mail-Service (aktuell unterstützt: 'sendgrid')
   EMAIL_SERVICE=sendgrid
   SENDGRID_API_KEY=your_sendgrid_api_key
   EMAIL_FROM=theater@example.com
   
   # Basis-URL für Links in E-Mails
   NEXT_PUBLIC_BASE_URL=https://your-theater-website.com
   
   # Sicherheits-Token für Cron-Job
   CRON_SECRET=your_secret_here
   ```

2. Cron-Job einrichten:
   - Endpoint: `/api/cron/rehearsal-reminders`
   - Zeitplan: Täglich um 9:00 Uhr
   - HTTP-Header: `x-cron-secret: your_secret_here`

## Funktionsweise

1. Der Cron-Job wird täglich ausgeführt
2. System prüft alle Proben mit Anmeldeschluss in einer Woche
3. Für jede dieser Proben:
   - Identifiziert Mitglieder ohne Anmeldestatus
   - Sendet personalisierte E-Mail-Erinnerungen
   - E-Mail enthält direkten Link zur Anmeldung

## E-Mail-Template

Die E-Mails enthalten:
- Probentitel
- Datum und Uhrzeit
- Ort
- Anmeldefrist
- Direkter Link zur Anmeldung

## Fehlerbehandlung

Fehler beim E-Mail-Versand werden geloggt aber unterbrechen nicht den gesamten Prozess.
Fehlgeschlagene E-Mails werden beim nächsten Durchlauf erneut versucht.