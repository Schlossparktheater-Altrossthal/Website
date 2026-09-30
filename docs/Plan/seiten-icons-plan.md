# Plan: Seiten-Icons – eine Symbolsprache für alle Bereiche

Stand: 2026-09-30. Umgesetzt (Phase 1–6). Checkliste am Ende wird gepflegt.

## Ziel

1. **Eine Seite, ein Symbol.** Dasselbe Ziel trägt in Sidebar, mobilem Sheet, Dashboard-Schnellzugriff, Seitensteuerung und Benachrichtigungen überall dasselbe Icon – egal über welche Oberfläche der Nutzer die Seite erreicht.
2. **Keine Symbol-Doppelungen.** Zwei verschiedene Seiten tragen nie dasselbe Icon.
3. **Ein Icon-System.** Alle projektweiten Icons stammen aus `src/components/ui/action-icons.tsx` (lucide-react). Die eigens gezeichneten Inline-SVGs in der Navigations-Konfiguration entfallen.
4. **Passende Symbole.** Jedes Icon beschreibt die Seite nach ihrem Namen und ihrer Aufgabe – nicht, wo sie technisch hängt.
5. **Nachvollziehbar.** Die Zuordnung Seite → Icon steht als Tabelle in der Doku; neue Seiten bekommen ihr Icon aus derselben Quelle.

Nicht Teil dieses Plans: Beschriftungen und Gruppennamen der Navigation (außer dem Abgleich aus Phase 3), Icon-Farben, In-Page-Umschalter, die nur eine Ansicht derselben Seite wählen (Sperrliste „Mein Kalender"/„Team", Terminplanung „Kalender"/„Liste"), sowie Kennzahl- und Aktionssymbole ohne Seitenbezug (Server-Analytics-Metriken, Profil-Abschnitte, Tabellenmenüs).

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                                                                                                                                                                       | Stelle                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| B1  | **Zwei getrennte Icon-Systeme.** Die Navigation zeichnet 20 Symbole als eigene Inline-SVG-Pfade (`createMembersNavIcon`), Dashboard und Benachrichtigungen importieren dagegen lucide-Wrapper aus `action-icons`. Zwei Quellen, die auseinanderlaufen können – und schon auseinandergelaufen sind.                                                           | `src/config/members-navigation.tsx` vs. `src/components/ui/action-icons.tsx` |
| B2  | **Dieselbe Seite, zwei Symbole:** „Meine Teams" trägt in der Sidebar ein Dokument-mit-Haken, im Dashboard-Schnellzugriff einen Hammer.                                                                                                                                                                                                                       | `members-navigation.tsx` Z. 293 vs. `members-dashboard.tsx` Z. 117           |
| B3  | **Der Schnellzugriff widerspricht der Sidebar bei allen sechs Einträgen:** Meine Termine (`CalendarCheck` vs. eigenes Proben-SVG), Profil (`UserRound` vs. Personen-SVG), Meine Teams (s. B2), Terminplanung (`CalendarCog` vs. eigenes Kalender-SVG), Mitglieder (`UsersRound` vs. Personen-mit-Haken-SVG), Rollen & Rechte (`ShieldCheck` vs. Schild-SVG). | `members-dashboard.tsx` Z. 101–138                                           |
| B4  | **Symbol-Doppelungen in der Navigation selbst:** „Teams & Zuweisung" und „Meine Teams" teilen sich ein Icon; „Website & Theme" und „Seitensteuerung" teilen sich ein Icon; „Dashboard" und „Onboarding-Statistik" teilen sich ein Icon.                                                                                                                      | `members-navigation.tsx` Z. 226/365, 287/293, 311/317                        |
| B5  | **Unpassende Paarungen:** „Meine Teams" (Gewerk-Portale der Nutzer) trägt das Symbol der Zuweisungsliste; „Körpermaße" zeigt eine Karte mit Punkten und Beinen, die wie ein Ausweis wirkt.                                                                                                                                                                   | `members-navigation.tsx` Z. 293, 299                                         |
| B6  | **Regelverstoß gegen `AGENTS.md`:** Projektweite Icons müssen zentral in `action-icons.tsx` liegen. Die Nav-SVGs umgehen das; die Datei ist nur wegen dieser SVGs eine `.tsx`.                                                                                                                                                                               | `AGENTS.md` (Abschnitt „Icons") / `members-navigation.tsx`                   |
| B7  | **Dritte Zuordnung im Benachrichtigungsbereich:** Kategorien nutzen eigene Symbole (gewerke = Hammer, produktion = Clapperboard, proben = Drama) und Treffer wie `DEPARTMENT_REQUEST` ein `Users`-Icon, ohne Bezug zur Seiten-Navigation.                                                                                                                    | `src/components/notifications/notification-row.tsx` Z. 45–63                 |
| B8  | **Fallback ohne Aussage:** Fehlt einem Eintrag das Icon, greift `defaultMembersNavIcon` – ein nackter Kreis, der wie ein Listenpunkt wirkt.                                                                                                                                                                                                                  | `members-navigation.tsx` Z. 213                                              |

## Entscheidungen (2026-09-30)

- **E1 – Icon-Quelle:** Ein System. Alle Seiten-Symbole kommen aus `@/components/ui/action-icons` (lucide). Die handgezeichneten Inline-SVGs entfallen; weil damit kein JSX mehr in der Datei steht, wird `members-navigation.tsx` zu `members-navigation.ts` (der Import-Alias `@/config/members-navigation` bleibt unverändert).
- **E2 – Doppelung trennen:** Ja. „Meine Teams" bekommt ein eigenes Symbol; Hammer und die Zuweisungsliste passen dort nicht. „Meine Teams" → Team-Gruppe, „Teams & Zuweisung" → Zuteilungsliste. Damit „Mitglieder" davon unterscheidbar bleibt, bekommt die Mitgliederverwaltung ein Verwaltungs-Symbol statt eines reinen Personensymbols.
- **E3 – Umfang:** Alle Einträge werden neu bewertet, nicht nur die Doppelungen behoben. Ergebnis ist der Symbolplan unten.
- **E4 – Geltungsbereich:** Sidebar, mobiles Sheet, Seitensteuerung, Dashboard-Schnellzugriff und Benachrichtigungen. Zusätzlich gilt: Überall dort, wo heute schon ein Symbol neben einem Link auf eine Seite steht, steht künftig das Symbol dieser Seite. In-Page-Umschalter, die nur eine Ansicht derselben Seite wählen, beschreiben die Ansicht und bleiben unverändert.

## Zielbild

### Eine Quelle

`src/config/members-navigation.ts` bleibt die einzige Registry der Mitgliederbereichs-Seiten: Route, Label, Permission, Icon. Alle Symbole stammen aus `@/components/ui/action-icons`.

- `MembersNavIcon` bleibt als Typ erhalten und wird auf `IconComponent` abgebildet (`ComponentType<{ className?: string }>` ist dazu kompatibel).
- Neuer Helper `membersNavIcon(href)` – dünn um das vorhandene `findMembersNavigationItem` gelegt – liefert das Symbol zu einer Route. Dashboard und Benachrichtigungen beziehen es von dort, statt eine zweite Liste zu pflegen.
- Neue projektweite Symbole werden ausschließlich in `action-icons.tsx` ergänzt: `CalendarXIcon` (lucide `CalendarX`), `UserCogIcon` (lucide `UserCog`), `PaletteIcon` (lucide `Palette`).
- `defaultMembersNavIcon` bleibt als neutrale Absicherung, wird aber ein sauberes Symbol statt eines nackten Kreises.

### Symbolplan

| Seite (Route)                                       | heute in der Navigation    | neu                   | Begründung                              |
| --------------------------------------------------- | -------------------------- | --------------------- | --------------------------------------- |
| Dashboard `/mitglieder`                             | eigenes Raster-SVG         | `LayoutGridIcon`      | Kachelraster der Übersicht              |
| Profil `/mitglieder/profil`                         | eigenes Personen-SVG       | `UserRoundIcon`       | die eigene Person                       |
| Sperrliste `/mitglieder/sperrliste`                 | eigenes Verbots-SVG        | `CalendarXIcon` (neu) | Termine, an denen man nicht kann        |
| Meine Termine `/mitglieder/meine-proben`            | eigenes Proben-SVG         | `CalendarCheckIcon`   | eigene Termine samt Zusage              |
| Überblick `/mitglieder/produktionen`                | eigenes Bühnen-SVG         | `ClapperboardIcon`    | die laufende Inszenierung               |
| Terminplanung `/mitglieder/terminplanung`           | eigenes Kalender-SVG       | `CalendarCogIcon`     | der Kalender, den man stellt            |
| Stück `/mitglieder/produktionen/stueck`             | eigenes Szenen-SVG         | `BookOpenTextIcon`    | Ablauf, Rollen und Auftritte des Stücks |
| Rückmeldungen & Auswertung                          | eigenes Feedback-SVG       | `ListChecksIcon`      | Rückmeldungen sammeln und abhaken       |
| Teams & Zuweisung                                   | Dokument-mit-Haken         | `ClipboardListIcon`   | Zuteilungsliste der Gewerke             |
| Meine Teams `/mitglieder/meine-gewerke`             | Dokument-mit-Haken         | `UsersRoundIcon`      | die eigenen Teams als Gruppe            |
| Körpermaße `/mitglieder/koerpermasse`               | Karten-SVG (Ausweis-Optik) | `RulerIcon`           | Maßband                                 |
| Website & Theme `/mitglieder/website`               | Glühbirnen-SVG             | `PaletteIcon` (neu)   | Farben und Theme der Website            |
| Seitensteuerung `/mitglieder/pages/seitensteuerung` | Glühbirnen-SVG             | `LayersIcon`          | Ebenen der Website                      |
| Mitglieder `/mitglieder/mitgliederverwaltung`       | Personen-mit-Haken-SVG     | `UserCogIcon` (neu)   | Personen verwalten                      |
| Rollen & Rechte `/mitglieder/rechte`                | Schild-SVG                 | `ShieldCheckIcon`     | Rechte schützen                         |
| Fotoerlaubnisse `/mitglieder/fotoerlaubnisse`       | Kamera-SVG                 | `CameraIcon`          | Foto und Einwilligung                   |
| Datenportal `/mitglieder/datenportal`               | Balken-SVG                 | `BarChart3Icon`       | Auswertungen und Berichte               |
| E-Mail Server                                       | eigenes Server-SVG         | `MailIcon`            | E-Mail                                  |
| Server-Statistiken                                  | eigenes Linien-SVG         | `ActivityIcon`        | Verlaufskurve der Messwerte             |
| Onboarding-Statistik                                | Raster-SVG (wie Dashboard) | `SparklesIcon`        | Neuzugänge und ihre Entwicklung         |

Jedes Symbol kommt in der Navigation genau einmal vor. Damit ist „Meine Teams" (Team-Gruppe) von „Teams & Zuweisung" (Liste) und „Mitglieder" (Verwaltung) unterscheidbar, und die drei bisherigen Doppelungen sind aufgelöst.

### Benachrichtigungen

Kategorien und Einzeltreffer in `notification-row.tsx` zeigen das Symbol der Seite, die sie öffnen (Gewerke → `UsersRoundIcon`, Produktion → `ClapperboardIcon`). Kategorien ohne einzelnen Seitenbezug behalten ein eigenes Ereignis-Symbol (Proben → `DramaIcon`, System → `BellIcon`), ebenso Warn-, Foto- und Notfall-Treffer.

## Phasen

1. **Phase 1 – Ein Icon-System.** `members-navigation.tsx` auf Symbole aus `@/components/ui/action-icons` umstellen, `MembersNavIcon` an `IconComponent` anbinden, `CalendarXIcon`, `UserCogIcon` und `PaletteIcon` ergänzen, das eigene SVG-Zeichnen entfernen, Datei zu `members-navigation.ts` umbenennen. Sichtprüfung: Sidebar und mobiles Sheet sehen unverändert aus (Größe, Strichstärke, Ausrichtung).
2. **Phase 2 – Symbolplan umsetzen.** Zuordnung nach der Tabelle eintragen, Doppelungen B4 auflösen, unpassende Paare B5 ersetzen, `defaultMembersNavIcon` durch ein neutrales Symbol mit Aussage ersetzen (B8). Seitensteuerung übernimmt die Symbole automatisch, `src/lib/__tests__/members-navigation.test.ts` bleibt grün.
3. **Phase 3 – Alle Stellen mit Seiten-Link.** `QUICK_ACTION_LINKS` im Dashboard verliert die eigene Icon-Spalte und zieht das Symbol über `membersNavIcon(href)`; Beschriftungen derselben Seite werden dabei angeglichen („Mein Profil" → „Profil"). Anschließend Prüflauf durch `src` nach weiteren Listen, die eine Seite verlinken und ein eigenes Symbol tragen; Treffer werden umgestellt oder im Plan als bewusste Ausnahme notiert.
4. **Phase 4 – Benachrichtigungen angleichen.** Kategorien und Einzeltreffer in `notification-row.tsx` auf die Seiten-Symbole umstellen, wo ein Seitenbezug besteht; Ereignis-Symbole ohne Seitenbezug bleiben.
5. **Phase 5 – Doku & Regeln.** Neuer Abschnitt „Seiten-Icons" in `docs/design-system.md` mit der Tabelle; `AGENTS.md` ergänzt die Regel, dass Seiten-Icons nur aus `members-navigation.ts` kommen; Hinweis in `docs/seiten/README.md`.
6. **Phase 6 – Verifikation.** Screenshots (Handy, Tablet, Desktop; hell und dunkel) von Sidebar, mobilem Sheet, Dashboard und Seitensteuerung, dem Review beigelegt; `pnpm lint`, `pnpm test`, `pnpm build`; ein Commit je Phase.

## Umsetzungsnotizen (2026-09-30)

- **Phase 1 und 2 in einem Schritt:** Die Umstellung auf lucide und die neue Zuordnung liegen in
  einem Commit. Eine Zwischenstufe mit bedeutungsgleichen Ersatzsymbolen hätte nur erfundene
  Zwischenzustände erzeugt, die niemand prüfen wollte.
- **Neue Symbole** in `src/components/ui/action-icons.tsx`: `CalendarXIcon` (`CalendarX`),
  `UserCogIcon` (`UserCog`), `PaletteIcon` (`Palette`).
- **`defaultMembersNavIcon`** bleibt `CircleIcon` aus `action-icons`: Er greift nur, wenn ein Eintrag
  kein Symbol trägt – im Bestand kommt das nicht vor (B8 bleibt damit reine Absicherung).
- **Weiterer Fund bei Phase 3 (B9):** Die Kennzahl-Kachel „Proben diese Woche“ im Dashboard führt auf
  „Meine Termine“, trug aber ein generisches Kalender-Symbol; sie zeigt jetzt `CalendarCheckIcon`
  über `membersNavIcon`. Kacheln ohne Seitenziel (Endprobenwoche, Online-Zahl, Mitgliederzahl) und
  In-Page-Umschalter (Sperrliste, Terminplanung) behalten ihre eigenen Symbole.
- **Phase 4:** Gewerk-Benachrichtigungen (Kategorie `gewerke` und `DEPARTMENT_REQUEST`) zeigen
  `UsersRoundIcon` – das Symbol der Seite „Meine Teams“, die sie öffnen. Proben (`DramaIcon`),
  Termine (`CalendarIcon`), System (`BellIcon`) und Warnungen bleiben Ereignis-Symbole.

## Checkliste

- [x] Phase 1 – Icon-System vereinheitlicht
- [x] Phase 2 – Symbolplan umgesetzt
- [x] Phase 3 – Alle Stellen mit Seiten-Link abgeglichen
- [x] Phase 4 – Benachrichtigungen angeglichen
- [x] Phase 5 – Doku und `AGENTS.md` fortgeschrieben
- [x] Phase 6 – Verifikation und Commit
