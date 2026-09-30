# Plan: Seiten-Icons – eine Symbolsprache für alle Bereiche

Stand: 2026-09-30. Entwurf. Befunde und Symbolplan stehen, die Entscheidungen E1–E4 sind offen. Checkliste am Ende wird gepflegt.

## Ziel

1. **Eine Seite, ein Symbol.** Dasselbe Ziel hat in Sidebar, mobilem Sheet, Dashboard-Schnellzugriff, Seitensteuerung und Benachrichtigungen überall dasselbe Icon – egal über welche Oberfläche der Nutzer die Seite erreicht.
2. **Keine Symbol-Doppelungen.** Zwei verschiedene Seiten tragen nie dasselbe Icon.
3. **Ein Icon-System.** Alle projektweiten Icons stammen aus `src/components/ui/action-icons.tsx` (lucide-react). Die eigens gezeichneten Inline-SVGs in der Navigations-Konfiguration entfallen.
4. **Passende Symbole.** Jedes Icon beschreibt, was die Seite leistet – nicht, wo sie technisch hängt.
5. **Nachvollziehbar.** Die Zuordnung Seite → Icon steht als Tabelle in der Doku; neue Seiten bekommen ihr Icon aus derselben Quelle.

Nicht Teil dieses Plans: Beschriftungen und Gruppennamen der Navigation, Icon-Farben, In-Page-Tabs ohne Seitenbezug (Server-Analytics-Kennzahlen, Profil-Abschnitte).

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                                                                                                                                                                       | Stelle                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| B1  | **Zwei getrennte Icon-Systeme.** Die Navigation zeichnet 20 Symbole als eigene Inline-SVG-Pfade (`createMembersNavIcon`), Dashboard und Benachrichtigungen importieren dagegen lucide-Wrapper aus `action-icons`. Zwei Quellen, die auseinanderlaufen können – und schon auseinandergelaufen sind.                                                           | `src/config/members-navigation.tsx` vs. `src/components/ui/action-icons.tsx` |
| B2  | **Dieselbe Seite, zwei Symbole:** „Meine Teams“ trägt in der Sidebar ein Dokument-mit-Haken, im Dashboard-Schnellzugriff einen Hammer.                                                                                                                                                                                                                       | `members-navigation.tsx` Z. 293 vs. `members-dashboard.tsx` Z. 117           |
| B3  | **Der Schnellzugriff widerspricht der Sidebar bei allen sechs Einträgen:** Meine Termine (`CalendarCheck` vs. eigenes Proben-SVG), Profil (`UserRound` vs. Personen-SVG), Meine Teams (s. B2), Terminplanung (`CalendarCog` vs. eigenes Kalender-SVG), Mitglieder (`UsersRound` vs. Personen-mit-Haken-SVG), Rollen & Rechte (`ShieldCheck` vs. Schild-SVG). | `members-dashboard.tsx` Z. 101–138                                           |
| B4  | **Symbol-Doppelungen in der Navigation selbst:** „Teams & Zuweisung“ und „Meine Teams“ teilen sich ein Icon; „Website & Theme“ und „Seitensteuerung“ teilen sich ein Icon; „Dashboard“ und „Onboarding-Statistik“ teilen sich ein Icon.                                                                                                                      | `members-navigation.tsx` Z. 226/365, 287/293, 311/317                        |
| B5  | **Unpassende Paarungen:** „Meine Teams“ (Gewerk-Portale der Nutzer) trägt das Symbol der Zuweisungsliste; „Körpermaße“ zeigt eine Karte mit Punkten und Beinen, die wie ein Ausweis wirkt.                                                                                                                                                                   | `members-navigation.tsx` Z. 293, 299                                         |
| B6  | **Regelverstoß gegen `AGENTS.md`:** Projektweite Icons müssen zentral in `action-icons.tsx` liegen. Die Nav-SVGs umgehen das; die Datei ist nur wegen dieser SVGs eine `.tsx`.                                                                                                                                                                               | `AGENTS.md` (Abschnitt „Icons“) / `members-navigation.tsx`                   |
| B7  | **Dritte Zuordnung im Benachrichtigungsbereich:** Kategorien nutzen eigene Symbole (gewerke = Hammer, produktion = Clapperboard, proben = Drama) und Treffer wie `DEPARTMENT_REQUEST` ein `Users`-Icon, ohne Bezug zur Seiten-Navigation.                                                                                                                    | `src/components/notifications/notification-row.tsx` Z. 45–63                 |
| B8  | **Fallback ohne Aussage:** Fehlt einem Eintrag das Icon, greift `defaultMembersNavIcon` – ein nackter Kreis, der wie ein Listenpunkt wirkt.                                                                                                                                                                                                                  | `members-navigation.tsx` Z. 213                                              |

## Zielbild

### Eine Quelle

`src/config/members-navigation.tsx` bleibt die einzige Registry der Mitgliederbereichs-Seiten: Route, Label, Permission, Icon. Alle Symbole stammen aus `@/components/ui/action-icons`.

- `MembersNavIcon` bleibt als Typ erhalten, wird aber auf `IconComponent` abgebildet (`ComponentType<{ className?: string }>` ist dazu kompatibel).
- Die Datei enthält kein JSX mehr und wird zu `members-navigation.ts` (Importpfad `@/config/members-navigation` bleibt gleich, der Alias verdeckt die Endung).
- Neue Helper `membersNavIcon(href)` – dünn um das vorhandene `findMembersNavigationItem` gelegt – liefert das Symbol zu einer Route. Damit beziehen Dashboard, Benachrichtigungen und Seitensteuerung dasselbe Icon, ohne eine zweite Liste zu pflegen.
- Neue projektweite Symbole werden ausschließlich in `action-icons.tsx` ergänzt (fehlend u. a. `PaletteIcon`).

### Symbolplan

Vorschlag, in Phase 2 zur Freigabe umzusetzen. Spalte „heute“ dokumentiert den Ausgangsstand.

| Seite (Route)                                       | heute in der Sidebar                 | heute im Schnellzugriff | Vorschlag                                      |
| --------------------------------------------------- | ------------------------------------ | ----------------------- | ---------------------------------------------- |
| Dashboard `/mitglieder`                             | eigenes Raster-SVG                   | –                       | `LayoutGridIcon`                               |
| Profil `/mitglieder/profil`                         | eigenes Personen-SVG                 | `UserRoundIcon`         | `UserRoundIcon`                                |
| Sperrliste `/mitglieder/sperrliste`                 | eigenes Verbots-SVG                  | –                       | `CircleXIcon`                                  |
| Meine Termine `/mitglieder/meine-proben`            | eigenes Proben-SVG                   | `CalendarCheckIcon`     | `CalendarCheckIcon`                            |
| Überblick `/mitglieder/produktionen`                | eigenes Bühnen-SVG                   | –                       | `ClapperboardIcon`                             |
| Terminplanung `/mitglieder/terminplanung`           | eigenes Kalender-SVG                 | `CalendarCogIcon`       | `CalendarCogIcon`                              |
| Stück `/mitglieder/produktionen/stueck`             | eigenes Szenen-SVG                   | –                       | `BookOpenTextIcon`                             |
| Rückmeldungen & Auswertung                          | eigenes Feedback-SVG                 | –                       | `ListChecksIcon`                               |
| Teams & Zuweisung                                   | Dokument-mit-Haken (wie Meine Teams) | –                       | `ClipboardListIcon`                            |
| Meine Teams `/mitglieder/meine-gewerke`             | Dokument-mit-Haken                   | `HammerIcon`            | `HammerIcon` (Gewerk = Werkzeug)               |
| Körpermaße `/mitglieder/koerpermasse`               | Karten-SVG (Ausweis-Optik)           | –                       | `RulerIcon`                                    |
| Website & Theme `/mitglieder/website`               | Glühbirnen-SVG (wie Seitensteuerung) | –                       | `PaletteIcon` (neu in `action-icons` ergänzen) |
| Seitensteuerung `/mitglieder/pages/seitensteuerung` | Glühbirnen-SVG                       | –                       | `LayersIcon`                                   |
| Mitglieder `/mitglieder/mitgliederverwaltung`       | Personen-mit-Haken-SVG               | `UsersRoundIcon`        | `UsersIcon`                                    |
| Rollen & Rechte `/mitglieder/rechte`                | Schild-SVG                           | `ShieldCheckIcon`       | `ShieldCheckIcon`                              |
| Fotoerlaubnisse `/mitglieder/fotoerlaubnisse`       | Kamera-SVG                           | –                       | `CameraIcon`                                   |
| Datenportal `/mitglieder/datenportal`               | Balken-SVG                           | –                       | `BarChart3Icon`                                |
| E-Mail Server                                       | eigenes Server-SVG                   | –                       | `MailIcon`                                     |
| Server-Statistiken                                  | eigenes Linien-SVG                   | –                       | `ActivityIcon`                                 |
| Onboarding-Statistik                                | Raster-SVG (wie Dashboard)           | –                       | `SparklesIcon`                                 |

Jedes Symbol kommt in der Navigation genau einmal vor. Benachrichtigungs-Kategorien zeigen dieselben Symbole, wenn sie auf eine Seite verweisen (gewerke → Hammer wie „Meine Teams“, produktion → Clapperboard wie „Überblick“).

### Entscheidungen (2026-09-30)

- **E1 – Icon-Quelle:** (offen) Wird die Navigation auf lucide-Symbole aus `action-icons.tsx` umgestellt (Empfehlung) oder bleiben die handgezeichneten SVGs und nur die Doppelungen werden aufgelöst?
- **E2 – Doppelung trennen:** (offen) Bekommen „Teams & Zuweisung“ und „Meine Teams“ unterschiedliche Symbole (Empfehlung) oder bleibt bewusst eines für beide Gewerk-Einträge?
- **E3 – Umfang:** (offen) Werden alle Einträge neu bewertet (Empfehlung) oder nur die Doppelungen aus B2–B4 behoben?
- **E4 – Geltungsbereich:** (offen) Bleibt es bei Sidebar, Mobile-Sheet, Seitensteuerung, Schnellzugriff und Benachrichtigungen (Empfehlung) oder sollen auch In-Page-Bereichsnavigationen auf dieselben Symbole gezogen werden?

## Phasen

1. **Phase 1 – Ein Icon-System.** `members-navigation.tsx` auf Symbole aus `@/components/ui/action-icons` umstellen, `MembersNavIcon` an `IconComponent` anbinden, fehlendes `PaletteIcon` ergänzen, eigenes SVG-Zeichnen entfernen. Datei zu `members-navigation.ts` umbenennen (Import-Alias unverändert). Ergebnis: sichtbar identische Symbole in Sidebar und Sheet, Typen sauber.
2. **Phase 2 – Symbolplan umsetzen.** Zuordnung je Seite nach der Tabelle in `members-navigation.ts` eintragen, Doppelungen B4 auflösen, unpassende Paare B5 ersetzen, `defaultMembersNavIcon` durch ein neutrales Symbol mit Aussage ersetzen (B8). Seitensteuerung übernimmt die Symbole automatisch.
3. **Phase 3 – Schnellzugriff aus der Registry.** `QUICK_ACTION_LINKS` im Dashboard verliert die eigene Icon-Spalte und zieht das Symbol über `membersNavIcon(href)`; Fallback auf `defaultMembersNavIcon`. Beschriftungen dabei an die Navigation angleichen („Mein Profil“ → „Profil“).
4. **Phase 4 – Benachrichtigungen angleichen.** Kategorien und Einzel-Typen in `notification-row.tsx` auf die Seiten-Symbole umstellen, wo ein Seitenbezug besteht; eigene Ereignis-Symbole (Warnung, Foto, Notfall) bleiben.
5. **Phase 5 – Doku & Regeln.** Neuer Abschnitt „Seiten-Icons“ in `docs/design-system.md` mit der Tabelle; `AGENTS.md` ergänzt die Regel, dass Seiten-Icons nur aus der Navigations-Registry kommen; betroffene Seiten-Doku in `docs/seiten/` verweist darauf.
6. **Phase 6 – Verifikation.** Screenshots (Handy, Tablet, Desktop; hell und dunkel) von Sidebar/Sheet, Dashboard und Seitensteuerung; `pnpm lint`, `pnpm test`, `pnpm build`; ein Commit je Phase.

## Checkliste

- [ ] Phase 1 – Icon-System vereinheitlicht
- [ ] Phase 2 – Symbolplan umgesetzt
- [ ] Phase 3 – Schnellzugriff aus der Registry
- [ ] Phase 4 – Benachrichtigungen angeglichen
- [ ] Phase 5 – Doku und `AGENTS.md` fortgeschrieben
- [ ] Phase 6 – Verifikation und Commit
