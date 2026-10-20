# Regie-Zugang einrichten (Anleitung für Admins)

Stand 2026-10-17 · Plan: `docs/Plan/regie-plan.md` (Phase 2)

Die Regie bekommt ein eigenes Theater-Konto ohne Passwort. Sie meldet sich mit einem
**Passkey** an (Fingerabdruck/Gesicht); mehrere Passkeys (Handy + Laptop) sind möglich.

## 1. Profil anlegen

1. Mitgliederverwaltung → neues Mitglied. Name darf ein Anzeigename sein. Als E-Mail eine
   Theater-Adresse verwenden (Mailu-Weiterleitung, z. B. `regie-2027@…`), keine private.
2. In der Person (Karte „Rollen & Berechtigungen“) oder in der Liste über „Rollen & Daten
   bearbeiten“ den Schalter **„Nur Regie-Ansicht“** einschalten.
3. In der Person, Karte **Produktionen → Bearbeiten**: Produktion einschalten und das Gewerk
   **Regie** (oder **Regieassistenz & Orga**) antippen. Fehlt das Gewerk, erst in der Produktion
   anlegen. Ohne Zuordnung bleibt das Dashboard leer.

## 2. Ersten Passkey einrichten

Mitgliederverwaltung → Person → Karte **Anmeldung** → **Anmeldelink (Passkey)**. Der Link gilt
**30 Minuten** und nur einmal; erst erzeugen, wenn die Person bereit ist.

- **Vor Ort:** Die Person scannt den QR-Code mit dem eigenen Handy und bestätigt den Passkey.
- **Aus der Ferne:** „Teilen“ bzw. „Kopieren“ und per Messenger schicken.

Danach ist sie angemeldet und landet im Mitgliederbereich. Beim nächsten Mal: Login-Seite →
„Mit Passkey anmelden“. Mit „angemeldet bleiben“ hält die Sitzung 30 Tage.

## 3. Weiteres Gerät oder Passkey verloren

- Weiteres Gerät: einfach einen neuen Anmeldelink erzeugen und auf dem Gerät öffnen.
- Verloren: in der Karte **Anmeldung** den alten Passkey entfernen, neuen Link erzeugen.

## Technik

- Der Link ist ein Authentik-Recovery-Link (`POST /core/users/<pk>/recovery/`). Der
  Mitgliederbereich setzt vorher am Konto `attributes.mitgliederbereich.loginLink = true`; die
  Policy `theater-recovery-login-link` im Blueprint (Config-LimitlessGreen,
  `applications/authentik/theater-blueprint.yaml`) überspringt dann „Neues Passwort“ und zeigt
  die Passkey-Einrichtung.
- „Mail Passwort festlegen“ entfernt die Markierung wieder (dann fragt der Link nach Passwort).
- Wer den Link hat, kommt ins Konto: nur an die Person selbst geben.
- Staging hat keinen API-Token → Knopf funktioniert nur in Prod.
- Zusammenarbeit beendet: Person deaktivieren (Authentik-Konto wird mit deaktiviert).
