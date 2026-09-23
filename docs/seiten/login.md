# Login & Theater-Konto (Authentik)

## Zweck

Anmeldung am Mitgliederbereich. Seit der SSO-Umstellung läuft die Anmeldung über das
Theater-Konto in Authentik (`auth.sommertheater-altrossthal.de`). Dasselbe Konto soll später
auch für weitere Dienste (z. B. Nextcloud) gelten. Der Mitgliederbereich bleibt Quelle der
Wahrheit für Mitglieder und Rechte; Authentik übernimmt nur die Anmeldung (Passwort, Passkey,
Passwort-Reset).

## Routen

- `/login` – Login-Seite (Button „Mit Theater-Konto anmelden“, „Passwort vergessen“, altes
  Passwortformular während der Übergangsphase, Test-Logins nur außerhalb von Produktion)
- `/api/auth/callback/authentik` – OIDC-Callback (Auth.js)
- `POST /api/auth/password-email` – „Passwort vergessen“: legt das Konto bei Bedarf in Authentik
  an und verschickt dort die Mail „Passwort festlegen“ (max. 3 pro Adresse und 10 pro IP und
  Stunde)
- `POST /api/auth/onboarding-token` – merkt sich den Onboarding-Token vor dem Sprung zu
  Authentik (httpOnly-Cookie, 15 Minuten), damit deaktivierte Rückkehrer reaktiviert werden

## Ablauf

1. „Mit Theater-Konto anmelden“ leitet zu Authentik (Flow `theater-authentication`).
2. Nach dem Login ordnet `src/auth.ts` das Konto zu: zuerst über die gespeicherte Verknüpfung
   (`Account` mit `provider = "authentik"`, `providerAccountId` = OIDC-`sub` = Authentik-UID),
   sonst über die E-Mail. Neue Profile entstehen nie über Authentik; unbekannte Konten landen mit
   `?error=AccessDenied&reason=not-a-member` wieder auf `/login`.
3. Deaktivierte Profile werden abgewiesen, außer die Anmeldung kommt aus dem Rückkehrer-Link.

## Übergangsphase (befristet)

- Bis zum Stichtag `AUTHENTIK_LEGACY_LOGIN_UNTIL` funktioniert das alte Passwortformular. Nach
  erfolgreichem Login wird das Passwort in Authentik gesetzt, das Konto verknüpft und der lokale
  Hash (`User.passwordHash`) gelöscht (`src/lib/authentik/migration.ts`). Ein weiterer Versuch
  über das alte Formular zeigt dann den Hinweis auf den Theater-Konto-Button.
- Passwörter, die der Mitgliederbereich an anderer Stelle setzt (Profil, Onboarding,
  Mitglied anlegen/bearbeiten, Owner-Setup), gehen auf demselben Weg direkt nach Authentik.
- Nach dem Stichtag ist nur noch Authentik aktiv. Mitglieder ohne migriertes Passwort nutzen
  „Passwort vergessen“. Danach können Credentials-Login, `migration.ts` und `User.passwordHash`
  entfernt werden (Kommentare mit „ÜBERGANGSPHASE“ im Code markieren alle Stellen).
- Ohne Authentik-Konfiguration (lokale Entwicklung) bleibt der Passwort-Login unbefristet.

## Authentik-Konten

- Der Mitgliederbereich legt Konten unter dem Pfad `mitgliederbereich` an (Benutzername = E-Mail,
  Attribut `mitgliederbereich.userId`) und verändert nur Konten unter diesem Pfad. Konten mit
  gleicher E-Mail außerhalb des Pfads (z. B. Infrastruktur-Admins) werden beim Login per E-Mail
  verknüpft, ihr Passwort wird aber nie überschrieben.
- Die Mitgliederliste zeigt das Badge „Authentik“, sobald ein Mitglied verknüpft ist (Login über
  Authentik oder Passwort-Übernahme erfolgreich).
- OIDC-Client, Service-Account und Rechte stehen im Blueprint
  `Config-LimitlessGreen/applications/authentik/theater-blueprint.yaml` (`mitgliederbereich.yaml`).

## Konfiguration

| Variable                         | Bedeutung                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `AUTHENTIK_ISSUER`               | `https://auth.sommertheater-altrossthal.de/application/o/mitgliederbereich/` |
| `AUTHENTIK_CLIENT_ID`            | `mitgliederbereich`                                                          |
| `AUTHENTIK_CLIENT_SECRET`        | Client-Secret (Vault)                                                        |
| `AUTHENTIK_API_TOKEN`            | Token des Service-Accounts `mitgliederbereich-api` (Vault)                   |
| `AUTHENTIK_URL`                  | optional, Standard: Origin des Issuers                                       |
| `AUTHENTIK_RECOVERY_EMAIL_STAGE` | optional, Standard: `theater-recovery-email`                                 |
| `AUTHENTIK_LEGACY_LOGIN_UNTIL`   | Stichtag (ISO-Datum) für das alte Passwortformular                           |

SSO ist nur aktiv, wenn Issuer, Client-ID/-Secret und API-Token gesetzt sind.

## Bekannte Baustellen

- Abmelden beendet nur die Sitzung im Mitgliederbereich, nicht die Authentik-Sitzung
  (Single Logout folgt).
- E-Mail-Änderungen und Deaktivierungen im Mitgliederbereich werden noch nicht nach Authentik
  synchronisiert; Dienst-Rechte (`SSO.*`) und Gruppen-Sync folgen.
- Die Tabelle `VerificationToken` wird seit dem Wegfall des Magic-Links nicht mehr genutzt.
