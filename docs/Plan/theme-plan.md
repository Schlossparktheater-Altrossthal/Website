# Plan: Theme-Einstellungen neu und persönliche Darstellung

Stand: 2026-10-23. Phase 1–5 umgesetzt und auf Staging, offen Abnahme und Release. Checkliste am Ende wird gepflegt.

## Ziel

1. Die Theme-Seite (`/mitglieder/website`) wird übersichtlich, kompakt und mobil wie am Desktop
   gut bedienbar.
2. Der Import nimmt alle tweakcn-Themes an: Vorlagen, Community-Themes, eigene Themes,
   Editor-Links, JSON und CSS.
3. Mitglieder wählen im Profil System/Hell/Dunkel und optional ein freigegebenes Theme.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                      | Stelle                                                            |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| B1  | Über 70 Variablenfelder untereinander, mobil rund 12.800 px Seitenlänge                                     | `src/app/(members)/mitglieder/website/theme-settings-manager.tsx` |
| B2  | Sieben gleichrangige Aktionsknöpfe, „Löschen“ rot auch bei geschützten Themes                               | ebd.                                                              |
| B3  | Theme-Auswahl nur als Dropdown, keine Vorschau                                                              | ebd.                                                              |
| B4  | Import hängt an jede tweakcn-Adresse `.json` an – Community-/eigene Themes (IDs) und Editor-Links scheitern | `src/lib/theme/tweakcn.ts` (`toTweakcnRegistryUrl`)               |
| B5  | Farbmodus und Theme gelten nur seitenweit                                                                   | `WebsiteSettings.colorMode`                                       |

## Zielbild

### Datenmodell

- `WebsiteTheme.memberSelectable` (Bool, Standard `false`): Theme ist im Profil wählbar.
- `User.colorModePreference` (`light`/`dark`/`system`, `null` = Seitenvorgabe).
- `User.themePreferenceId` → `WebsiteTheme` (`onDelete: SetNull`); nur wirksam, solange das
  Theme freigegeben ist. Beim Entzug der Freigabe wird die Wahl zurückgesetzt.

### Rechte

- Theme-Verwaltung unverändert `PRIVATE.SETTINGS.THEME.MANAGE`.
- Persönliche Darstellung darf jedes angemeldete Mitglied für sich selbst ändern.

### Oberflächen (mobil zuerst)

- **Galerie:** Karten mit Farbstreifen und Mini-Vorschau (hell/dunkel), Abzeichen „Aktiv“ und
  „Für Mitglieder“. Seltene Aktionen im „⋯“-Menü je Karte. Mobil zwei Spalten.
- **Import-Dialog:** ein Feld für Link/JSON/CSS, Vorschau vor dem Speichern.
- **Editor:** Live-Vorschau (Desktop daneben, mobil oben), aufklappbare Gruppen, „Wichtigste
  Farben“ zuerst, Rest unter „Erweitert“, große Farbfelder, feste Speichern-Leiste.
- **Profil → Darstellung:** Segmentschalter System/Hell/Dunkel, Theme-Karten der freigegebenen
  Themes plus „Wie die Seite“.

## Integration

- Root-Layout (`src/app/layout.tsx`) wendet die persönliche Wahl beim Rendern an (kein
  Flackern); gilt nur im Mitgliederbereich, die Drupal-Website bleibt einheitlich.

## Phasen

1. **Import-Fix:** Registry-URL ohne `.json`, Editor-/www-Links, verständliche Fehlermeldung.
2. **Persönliche Darstellung:** Migration, Lib, API, Profilbereich „Darstellung“, Layout.
3. **Galerie + Import-Dialog + Freigabe** auf der Theme-Seite.
4. **Editor kompakt** mit Live-Vorschau.
5. **Prüfung:** Tests, Screenshots (alle Viewports, hell/dunkel), E2E für Profil-Darstellung.

## Entscheidungen (2026-10-23)

- E1: Mitglieder dürfen auch ein Theme wählen, aber nur aus freigegebenen Themes.
- E2: Die persönliche Wahl gilt nur im Mitgliederbereich.
- E3: Reihenfolge: Import-Fix und persönliche Darstellung zuerst, dann Galerie und Editor.

## Checkliste

- [x] Phase 1 Import-Fix
- [x] Phase 2 Persönliche Darstellung
- [x] Phase 3 Galerie, Import-Dialog, Freigabe
- [x] Phase 4 Editor kompakt
- [x] Phase 5 Prüfung (Screenshots, E2E `e2e/darstellung.spec.ts` grün auf Staging); offen: Abnahme, Release
