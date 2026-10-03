# Plan: Fotoerlaubnis als Stufen – Profil, Onboarding, Verwaltung, Unterschrift

Stand: 2026-10-03. Entschieden (E1–E6), nichts umgesetzt. Löst die frei pflegbaren Zwecke aus
`docs/Plan/fotoerlaubnis-plan.md` ab. Checkliste am Ende wird gepflegt.

## Ziel

1. Die Fotoerlaubnis ist wieder **eine Entscheidung**, wie auf den alten Papierformularen: genau eine
   **Stufe** pro Person und Produktion, dazu ein optionales **Hinweisfeld**.
2. Die Erlaubnis bleibt **produktionsgebunden** und muss für jede Produktion neu abgegeben werden. Bei
   Volljährigen hilft „wie bei [Vorproduktion]“ beim Vorausfüllen, eine neue Unterschrift ist trotzdem nötig.
   Minderjährige brauchen immer eine neue Eltern-Unterschrift, ohne Vorausfüllen.
3. Profil, Onboarding (neu und Rückkehrer) und Verwaltung nutzen **dieselbe Komponente** und dieselbe Logik.
4. Die Verwaltung ist **kompakt**: Liste statt Karten-Raster, offene Fälle zuerst, Sammelfreigabe.
5. Die Fotografen-Liste zeigt **eine** Ampel-Spalte statt je einer Spalte pro Zweck.
6. Digitale Unterschriften werden **nur vektoriell** gespeichert (keine PNG-Umwandlung mehr), Anzeige als SVG,
   und die vorhandene Wiedergabe (Replay) wird in der Prüfansicht wieder nutzbar.

## Ist-Stand (Befunde)

Screenshots Staging 2026-10-03, Admin, mobil und Desktop.

| #   | Befund                                                                                                                                                                                                                       | Stelle                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Die Zwecke sind Checkboxen: „Gar nicht“ lässt sich zusammen mit „Werbung“ ankreuzen. Fachlich ist es eine Stufenwahl.                                                                                                        | `src/components/members/photo-consent-card.tsx`                               |
| 2   | Im Profil folgen drei Knöpfe für den Nachweis aufeinander („Hochladen“, „Digital unterschreiben“, „Datei wählen“), außerdem gibt es eine verschachtelte Karte mit „Einklappen“ und eine Bestätigungs-Checkbox vor „Abgeben“. | `photo-consent-card.tsx`, Profil `?bereich=freigaben`                         |
| 3   | In der Verwaltung zeigt jede Person eine eigene Karte mit 4–6 Badges. Mobil ist die Seite rund 13.700 px lang, erledigte Einträge haben dasselbe Gewicht wie offene.                                                         | `src/components/members/photo-consent-admin-panel.tsx`                        |
| 4   | Fast alle freigegebenen Einträge zeigen „Keine Auswahl erfasst“ (es gibt nur ein Dokument). In der Fotoliste steht dann „Darf fotografiert werden“, obwohl in jeder Zweck-Spalte „–“ steht.                                  | `src/components/members/photo-consent-photographer-view.tsx`                  |
| 5   | Im Onboarding gibt es nur eine einzelne Checkbox „Ich bin einverstanden …“. Danach setzt `seedDefaultPhotoConsentChoices` **alle** Zwecke auf angekreuzt, eine echte Wahl findet also nicht statt.                           | `onboarding-wizard.tsx` (Schritt „Fotos“), `lib/photo-consent-submission.ts`  |
| 6   | Rückkehrer-Wizard: Die Unterschrift wird per `toDataURL` in eine **PNG** umgewandelt und als Dokument hochgeladen, der Vektor geht dabei verloren.                                                                           | `src/components/onboarding/returnee-update-wizard.tsx` (~Z. 300–330)          |
| 7   | Neues Onboarding: Der Vektor (`signaturePayload`, Format `velocity.v1`) wird gespeichert, **zusätzlich** ist aber ein PNG-Dokument Pflicht (`signaturePayload && !documentBuffer` → 400).                                    | `src/app/api/onboarding/complete/route.ts` (~Z. 298)                          |
| 8   | `SignatureVisualizer` kann die Modi `outline`, `velocity` und `replay`, die Verwaltung nutzt aber nur `outline` und auch das nur, wenn kein Dokument-Bild vorliegt (wegen #6/#7 also praktisch nie).                         | `src/components/signature/signature-visualizer.tsx`, `admin-panel.tsx` Z. 200 |
| 9   | Mobil drängen sich oben in der Verwaltung sechs Aktionen (CSV, PDF, Elternformular, Aktualisieren, Produktion, Suche).                                                                                                       | `photo-consent-admin-panel.tsx`                                               |

## Zielbild

### Stufen

| Stufe            | Bedeutung                                                 | Volljährig | Minderjährig | Farbe |
| ---------------- | --------------------------------------------------------- | ---------- | ------------ | ----- |
| `all`            | intern + Programmheft/Flyer + Werbung (Instagram, Schule) | ✓          | ✓            | grün  |
| `promoOnRequest` | intern, Werbung nur nach Rückfrage im Einzelfall          | ✓          | –            | gelb  |
| `internal`       | nur intern (Verwendung innerhalb der Gruppe)              | ✓          | ✓            | blau  |
| `none`           | gar nicht                                                 | ✓          | ✓            | rot   |

Die Texte entsprechen den Papierformularen. Die Stufen sind fest im Code hinterlegt (kein Pflege-UI mehr),
die Beschreibungstexte stehen zentral in `src/lib/photo-consent-levels.ts`.

### Datenmodell

- `PhotoConsent.level PhotoConsentLevel?`: neues Enum. `null` steht für einen Altbestand ohne Angabe.
- `PhotoConsent.note String? @db.Text`: das Hinweisfeld, ersetzt `exclusionNote` (wird umbenannt bzw. migriert).
- `PhotoConsentVersion.level` + `note` für die Historie, `purposesSnapshot` bleibt für Altversionen lesbar.
- `status` bleibt (`pending/approved/rejected`). `noPhotos` wird zu `level = none` mit `status = approved`,
  weil es sofort wirksam ist und keine Freigabe braucht.
- **Migration:** `PhotoConsentChoice` → Stufe (Refusal angekreuzt → `none`; promo angekreuzt → `all`;
  promo_on_request → `promoOnRequest`; nur internal → `internal`; nichts erfasst → `null`). `PhotoConsentPurpose`
  und `PhotoConsentChoice` bleiben in Phase 1 noch stehen (nur lesend) und werden in einer späteren Phase entfernt.
- **Unterschrift:** `signaturePayload` (Punkte mit x, y, Zeit; `velocity.v1`) ist schon vektoriell und bleibt das
  einzige Speicherformat für digitale Unterschriften. Für digital unterschriebene Erlaubnisse wird **kein**
  `documentData`-PNG mehr erzeugt. Die Darstellung (Verwaltung, PDF-Export) rendert daraus serverseitig ein **SVG**
  (Pfade aus den Strokes). Das ist scharf in jeder Größe, klein und lässt sich direkt in die PDF-Liste einbetten.
  Optional später ein `velocity.v2` mit Druck/Stiftbreite, falls das Gerät es liefert (`pointerEvent.pressure`).

### Oberflächen (mobil zuerst)

**Gemeinsame Komponente `PhotoConsentForm`** (Profil, Onboarding, Rückkehrer):

1. **Stufe wählen:** große Radio-Kacheln mit Farbpunkt, Titel und einer Zeile Erklärung. Minderjährige sehen nur
   drei Stufen, und der Text heißt „Von meinem Kind …“.
2. **Nachweis:** ein Umschalter `Unterschreiben | Foto/PDF hochladen`.
   - Volljährig: standardmäßig „Unterschreiben“ (Pad direkt sichtbar).
   - Minderjährig: Hinweis „Ein Elternteil muss unterschreiben“ und Eltern-Formular (PDF, mit vorausgefüllter
     Stufe) zum Herunterladen. Die Eltern können am Handy direkt unterschreiben **oder** man lädt ein Foto des
     Papierformulars hoch. Bei `none` ist kein Nachweis nötig.
3. **Hinweis (optional):** eingeklappt als „+ Hinweis hinzufügen“, z. B. „keine Nahaufnahmen“.
4. Ein Knopf „Fotoerlaubnis abgeben“, die Bestätigungs-Checkbox entfällt, der Rechtstext steht über dem Knopf.

Bei Volljährigen mit einer Erlaubnis aus der Vorproduktion steht oben: „Wie bei _In 80 Tagen …_ (🟢 Alles)?
Übernehmen“. Das füllt Stufe und Hinweis vor, die Unterschrift bleibt Pflicht.

**Profil (`?bereich=freigaben`):** keine äußere Karte und kein „Einklappen“ mehr. Ist schon etwas abgegeben,
zeigt der Bereich nur eine Statuszeile (`🟢 Alles · freigegeben 12.09. · Hinweis …`) mit „Ändern“, das öffnet
das Formular. Fehlt das Geburtsdatum, erscheint **statt** des Formulars ein Hinweis mit Knopf.

**Verwaltung „Einwilligungen“:**

- Oben Zähler-Chips, die gleichzeitig filtern: _Zu prüfen · Ohne Nachweis · Nicht abgegeben · Stufe unbekannt ·
  Erledigt_. Voreingestellt sind alle offenen Einträge.
- Liste mit einer Zeile pro Person: Name, Minderjährig-Badge, Stufen-Punkt, Status, Symbol für den Nachweis.
  Desktop als Tabelle, mobil als zweizeilige Zeilen.
- Ein Tipp öffnet ein BottomSheet (Muster Sperrliste): Stufe, Hinweis, Nachweis (Dokument-Vorschau bzw.
  Unterschrift als SVG mit **Wiedergabe-Knopf**, der Modus `replay` existiert schon), Versionen, „Freigeben /
  Ablehnen“. Bei Altbeständen ohne Stufe lässt sich die Stufe hier setzen, abgelesen vom Papier.
- Mehrfachauswahl mit „Ausgewählte freigeben“ (nur Einträge mit Nachweis).
- „Nicht abgegeben“ listet das Ensemble ohne Einreichung, mit „Erinnern“ (vorhandene Erinnerungs-Logik).
- CSV, PDF und Elternformular wandern in ein „⋯“-Menü, der Knopf „Aktualisieren“ entfällt.
- Der Reiter **„Zwecke“ entfällt.**

**Fotografen-Liste:** Spalten Name · Stufe (Ampel + Kurztext) · Hinweis. Sortierung: Gar nicht → Nur intern →
Nachfragen → Alles → Stufe unbekannt (grau, „⚠ beim Team nachfragen“). Mobil als Liste. Später optional mit
Profilfoto, damit man Gesichter zuordnen kann.

## Integration

- **Onboarding (neu):** Der Schritt „Fotos“ nutzt `PhotoConsentForm`, die Checkbox „Ich bin einverstanden“
  entfällt. „Später nachreichen“ bleibt bei Minderjährigen erhalten (Status `pending` ohne Nachweis, erscheint dann
  unter „Ohne Nachweis“). `seedDefaultPhotoConsentChoices` entfällt. `/api/onboarding/complete` akzeptiert
  `level`, `note` und `signature` ohne PNG-Pflicht.
- **Rückkehrer-Wizard:** dieselbe Komponente, keine PNG-Umwandlung mehr, Vorausfüllen nur für Volljährige.
- **Onboarding-Auswertung/PDF** (`lib/onboarding-analytics.ts`, `pdf/templates/onboarding-statistics.ts`): Zählung
  nach Stufen statt Ja/Nein.
- **Datenportal** (`lib/datenportal/fields.ts`): Feld „Fotoerlaubnis-Stufe“ statt Zwecke.
- **Erinnerungen** (`lib/notifications/photo-consent-reminders.ts`): unverändert, Texte prüfen.
- **Aufbewahrung** (`retention.ts`): Versionen mit Unterschrift weiter nach Produktionsende behandeln wie bisher.
- **Profil-Vollständigkeit** (`profile-completion*.ts`): „fehlt“, solange keine Stufe gesetzt ist.

## Phasen

1. **Datenmodell + Migration:** Enum, Felder `level`/`note` und die Daten-Migration aus den Choices. Die Logik
   liegt in `lib/photo-consent-levels.ts`, mit Unit-Tests für das Mapping.
2. **API:** `/api/photo-consents` (Mitglied), `/admin`, `/overview`, `/export` auf Stufen umstellen. Digitale
   Unterschrift ohne Dokument zulassen, SVG-Renderer `lib/signature-svg.ts`.
3. **`PhotoConsentForm` + Profil:** neue Komponente, `photo-consent-card.tsx` ablösen.
4. **Onboarding + Rückkehrer:** auf `PhotoConsentForm` umstellen, PNG-Umwandlung entfernen, `onboarding/complete`
   anpassen, Auswertungen nach Stufen.
5. **Verwaltung:** Liste, Filter-Chips, BottomSheet mit Unterschrift-Wiedergabe, Sammelfreigabe,
   „Nicht abgegeben“, Reiter „Zwecke“ entfernen.
6. **Fotografen-Liste + PDF/CSV-Export:** Ampel-Spalte, Unterschrift als SVG im PDF.
7. **Aufräumen:** `PhotoConsentPurpose`/`Choice` und den Zweck-Code entfernen (eigene Migration, nach Prod-Release
   und Kontrolle der migrierten Daten).
8. **E2E + Screenshots + Release:** Profil, Onboarding (volljährig/minderjährig), Verwaltung, jeweils mobil und
   Desktop.

## Entscheidungen (2026-10-03)

- E1: Stufen statt frei pflegbarer Zwecke, dazu ein freies Hinweisfeld.
- E2: Die Fotoerlaubnis bleibt produktionsgebunden. Minderjährige geben jede Produktion neu ab (Eltern-Unterschrift),
  Volljährige können vorausfüllen, unterschreiben aber neu.
- E3: Digitale Unterschriften nur vektoriell (`signaturePayload`), Anzeige als SVG, Replay in der Prüfansicht.
- E4: Auch Volljährige unterschreiben je Produktion neu, auch bei unveränderter Stufe.
- E5: Altbestand ohne Auswahl bekommt `level = null` („Stufe unbekannt“), nachgetragen wird in der Verwaltung vom Papier.
- E6: Die Fotografen-Liste bleibt ein Reiter unter Fotoerlaubnisse.

## Abweichungen bei der Umsetzung (2026-10-03)

- Die Spalte `exclusionNote` bleibt bestehen und dient als Hinweisfeld (kein Umbenennen, weniger
  Migration); in der Oberfläche heißt sie „Hinweis".
- „Gar nicht" behält den Status `noPhotos` (statt `approved`), alle Status-Abfragen bleiben gültig.
- Das Elternformular bleibt das hochgeladene PDF (ohne vorausgefüllte Stufe).
- Die Fotoliste-PDF enthält keine Unterschriften; sie ist eine Arbeitsliste für Fotografen. Der
  SVG-Renderer (`src/lib/signature-svg.ts`) liefert dafür bei Bedarf `signatureToSvgString`.
- Der Bereich „Einwilligungen" heißt jetzt „Prüfen", „Fotografen" heißt „Fotoliste".
- Ohne Geburtsdatum zeigt das Profil statt des Formulars einen Hinweis plus „Keine Aufnahmen
  erlauben" (die anderen Stufen brauchen das Alter).
- Die E2E-Testnutzer haben kein Geburtsdatum; der Profil-Test überspringt sich dann. Das Formular
  wurde per abgefangener API-Antwort (volljährig/minderjährig) auf Staging fotografiert.

## Checkliste

- [x] Phase 1 Datenmodell + Migration
- [x] Phase 2 API + SVG-Renderer
- [x] Phase 3 PhotoConsentForm + Profil
- [x] Phase 4 Onboarding + Rückkehrer
- [x] Phase 5 Verwaltung
- [x] Phase 6 Fotografen-Liste + Export
- [ ] Phase 7 Aufräumen Zwecke
- [ ] Phase 8 E2E, Screenshots, Release
