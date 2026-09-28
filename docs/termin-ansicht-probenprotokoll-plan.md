# Plan: Terminansicht, „Meine Termine“ und Probenprotokoll

Stand: 2026-09-28 – Konzept, noch nicht umgesetzt. Baut auf `docs/terminplanung-plan.md` (Phase 6) auf.

## Ziel

1. Wer einen Termin **nicht bearbeiten** darf, sieht trotzdem eine gute Detail- und Ablaufansicht
   (wie ist die Probe geplant, wann bin ich dran, wer kommt).
2. **Meine Termine** wird neu gedacht: kompakt, nach Tagen gegliedert, mobil zuerst.
3. Neu: ein **Probenmodus** für die laufende Probe – Anwesenheit, tatsächliche Zeiten, geprobte
   Szenen, Notizen, Entscheidungen, Aufgaben – der danach als **Protokoll** lesbar ist.

## Ist-Stand (Befunde)

**Detailseite `/mitglieder/proben/[id]`**

- Existiert und ist für `PRIVATE.REHEARSAL.OWN.VIEW` offen, aber nur aus „Meine Termine“ erreichbar.
  Aus der Terminplanung führt jeder Klick in den Editor; wer dort nicht planen darf, bekommt
  „Kein Zugriff“ statt der Ansicht.
- Vier gestapelte Karten (Überblick, Ablauf, Beschreibung, Eingeladene) – viel Scrollen, wenig Info.
- „Wann“ zeigt nur den Beginn, kein Ende; der Formatter hat **keine `timeZone`** → auf dem Server
  (UTC) werden Zeiten um 1–2 h falsch angezeigt. „Ort:“ erscheint auch leer.
- Ablauf ist eine flache Liste: parallele Programmpunkte/Räume nicht erkennbar, eigene Punkte nicht
  hervorgehoben, keine „jetzt“-Markierung.
- Teilnehmerliste: große Karte pro Person mit E-Mail-Adresse, ohne Rolle/Figur, ohne Gruppierung.
- Eigener Status und „Absagen“ fehlen auf der Detailseite (nur in der Liste).
- Gewerk-Termine und allgemeine Termine („Für alle“) haben keine Detailseite.

**Meine Termine `/mitglieder/meine-proben`**

- 2/3-Liste + 1/3 statische Hinweiskarte, die jedes Mal Platz frisst.
- Flache Liste ohne Tagesgruppen, jeder Eintrag ein grauer Kasten mit bis zu 5 Zeilen.
- Keine Hervorhebung des nächsten Termins, keine vergangenen Termine, max. 30 Einträge.
- Absage-Knopf direkt in jeder Karte → unruhig.

**Nachbereitung (`rehearsal-review.tsx`)**

- Nur im Planer-Editor ganz unten, erst ab Probenbeginn, nur „Szene geschafft/teilweise/nicht“ und
  Anwesenheit ja/nein. Ohne Speichern-Klick geht alles verloren.
- Fehlt: verspätet/früher gegangen, spontan Dazugekommene, tatsächliche Zeiten, Notizen,
  Entscheidungen, Aufgaben, geänderter Ablauf. Mitglieder sehen nichts davon.

## Zielbild

### 1. Eine Terminseite für alle: `/mitglieder/termine/[id]`

Ersetzt `/mitglieder/proben/[id]` (alte URL leitet um). Planer sehen oben „Bearbeiten“, alle
anderen dieselbe Seite nur lesend. Klick in der Terminplanung öffnet für Nicht-Planer diese Seite.

Kopf (immer sichtbar, kompakt):

```
← Meine Termine
Probe · Akt 2                                    [Bearbeiten]  (nur Planer)
Sa 04.10. · 14:00–18:00 · Probebühne
● Du: 15:30–17:00 (Sz. 5, 7)   ✓ zugesagt   [Absagen]
```

Darunter drei Reiter (mobil als Segmented Control, Desktop zweispaltig: Ablauf links, Leute rechts):

- **Ablauf** – Zeitleiste
  ```
  14:00 ┃ Einsingen                       alle
  14:30 ┃ Sz. 3  Der Brief                Anna, Ben, +2
  15:30 ┃ Sz. 5  Streit ●                  du
        ┃ ║ parallel: Technik – Licht einrichten (Saal)
  16:15 ┃ Pause
  16:30 ┃ Sz. 7  Versöhnung ●              du
  ── jetzt 16:42 ──
  ```
  Eigene Punkte markiert, Schalter „nur meine“, parallele Punkte mit Raum eingerückt
  (Desktop: nebeneinander), während der Probe Linie „jetzt“. Nach der Probe: Ergebnis-Häkchen je
  Punkt und tatsächliche Zeiten grau daneben.
- **Leute** – gruppiert: Zugesagt · Optional · Abgesagt (mit Grund nur für Planer); pro Person
  eine Zeile „Name · Figur/Gewerk“, Avatar, keine E-Mail.
- **Protokoll** – erscheint, sobald etwas erfasst ist (siehe 3). Mitglieder lesen, Protokollführung
  schreibt.

Beschreibung (Rich Text) steht einklappbar unter dem Kopf.

### 2. Meine Termine neu

Mobil (Hauptfall):

```
Meine Termine                    [Anstehend | Vergangen]
Alle · Muss hin · Optional · Für alle        (Chips, nur wenn sinnvoll)

┌ NÄCHSTER TERMIN · in 2 Tagen ───────────────┐
│ Probe · Akt 2          Sa 04.10.            │
│ Deine Zeit 15:30–17:00 · Probebühne         │
│ Sz. 5, 7                   ✓ zugesagt       │
└─────────────────────────────────────────────┘
DIENSTAG, 07.10.                     (sticky)
 19:00  ● Probe · Akt 3            ✓
 20:00  ● Technik: Licht           optional
SAMSTAG, 11.10.
 ganzt. ● Bühnenbau (Für alle)
 14:00  ● Durchlaufprobe           ✗ abgesagt
```

- Tagesgruppen mit Wochentag, eine Zeile pro Termin: Zeit (eigene Zeit, wenn gestaffelt) ·
  Farbpunkt je Art · Titel · Status-Symbol rechts.
- Tippen öffnet die Terminseite; Absagen passiert dort (oder per Wisch-/Menü-Aktion).
- „Vergangen“ zeigt die letzten Termine mit Anwesenheit und Link zum Protokoll.
- Die Hinweise zur Sperrliste wandern in den leeren Zustand bzw. ein kleines „?“ im Kopf.
- Desktop: Liste links (≈ 380 px), rechts die Terminseite als Vorschau (Master-Detail), URL
  `?termin=<id>`, damit Zurück funktioniert.
- Alle Arten (Probe, Gewerk, Für alle) bekommen einen Link auf die Terminseite.

### 3. Probenmodus / Protokoll: `/mitglieder/termine/[id]/probe`

Für das Handy/Tablet am Probentisch. Ab 1 h vor Beginn aufrufbar, speichert jede Eingabe sofort
(optimistisch, mit Offline-Warteschlange nur falls einfach umsetzbar). Aufbau:

```
Probe · Akt 2          16:42        [Probe beenden]
Begonnen 14:07 (geplant 14:00)

[ Ablauf ] [ Anwesenheit 11/13 ] [ Notizen 4 ]
```

**Ablauf** – die Zeitleiste von oben, aktueller Punkt groß:

```
▶ JETZT  Sz. 7 Versöhnung    geplant 16:30  begonnen 16:38
         [Fertig ✓]  [Teilweise]  [Abbrechen]   + Notiz
  als Nächstes: Sz. 8 (nicht geplant – spontan hinzugefügt)
```

- „Starten“/„Fertig“ stempeln tatsächliche Zeiten; Ergebnis Geschafft/Teilweise/Nicht.
- Reihenfolge per Ziehen ändern, Punkte überspringen, spontan Szene/Punkt hinzufügen →
  das ist der „geänderte Ablauf“ (Plan vs. Ist bleibt nachvollziehbar, nichts wird überschrieben).
- Notiz direkt am Punkt (z. B. „Auftritt links statt rechts“).

**Anwesenheit** – Raster mit Namens-Chips, ein Tipp = da, langer Tipp/Menü für Details:

- Status: da · verspätet (Uhrzeit) · früher gegangen (Uhrzeit) · fehlt · entschuldigt (hatte
  abgesagt, automatisch vorbelegt)
- „+ Person“: nicht Eingeladene, die dazukamen (Mitglieder-Suche oder freier Name für Gäste).
- Zähler oben, Sortierung: noch nicht erfasst zuerst.

**Notizen** – _ein_ Verlauf statt fünf Textfelder. Jeder Eintrag hat einen Typ-Chip:

- Notiz (Anmerkung zur Probe)
- Entscheidung (z. B. „Kostüm Sz. 3 wird rot“) – hervorgehoben im Protokoll
- Aufgabe – mit Person und optional Fälligkeit; erscheint bei der Person (Glocke + Dashboard)
  und ist abhakbar
- optional verknüpft mit Szene/Programmpunkt

„Was wurde geschafft“ und „geprobte Szenen“ ergeben sich aus dem Ablauf, „tatsächliche Zeiten“
aus den Stempeln – kein doppeltes Eintippen.

**Probe beenden** → kurze Zusammenfassung (Szenen, Anwesenheit, offene Aufgaben), optional
„Protokoll an Teilnehmende senden“ (Benachrichtigung/Mail). Danach ist es der Reiter „Protokoll“
auf der Terminseite; Nachbearbeiten bleibt möglich.

Die bisherige Nachbereitung im Editor entfällt bzw. verlinkt auf den Probenmodus.

## Datenmodell (Entwurf)

- `CalendarEvent.actualStart/actualEnd DateTime?`, `protocolSentAt DateTime?`
- `EventBlock`: `actualStart/actualEnd DateTime?`, `unplanned Boolean @default(false)`,
  `actualOrder Int?`; `outcome` und `note` bleiben.
- `EventParticipant`: `attended Boolean?` → `attendance AttendanceMark?`
  (`PRESENT | LATE | LEFT_EARLY | ABSENT | EXCUSED`), `arrivedAt/leftAt DateTime?`.
  Spontan Dazugekommene: Teilnehmer mit `invited=false` und gesetzter Anwesenheit;
  Gäste ohne Konto: `EventGuest { eventId, name }`.
- Neu `EventNote { id, eventId, blockId?, type NOTE|DECISION|TASK, text, assigneeId?, dueDate?,
doneAt?, authorId, createdAt }`.
- Migration: `attended=true → PRESENT`, `false → ABSENT` (Enum in eigener Migration).
- Szenenzähler (`loadSceneStats`) liest weiter `outcome`.

## Rechte

- Terminseite lesen: jede eingeladene Person + wer die Produktion sieht (Entscheidung offen).
- Probenmodus schreiben: Planung + neues Recht `PRIVATE.REHEARSAL.PROTOCOL.EDIT`
  (z. B. Regieassistenz/Inspizienz), produktionsbezogen wie PLANNING.
- Absagegründe und Notizen vom Typ „intern“? → bewusst weggelassen (Vereinfachung), Gründe
  sehen weiterhin nur Planer.

## Stand

- **Phase 1 erledigt (2026-09-28):** `/mitglieder/termine/[id]` für alle Arten (Probe, Termin,
  Gewerk), Sichtbarkeit Planung/Eingeladene/Produktion/Gewerk, Zeitleiste mit parallelen Punkten,
  „nur meine“, Jetzt-Linie, Leute gruppiert, Absagen im Kopf, Zeitzonen-Fix; alte URL
  `/mitglieder/proben/[id]` und Editor ohne Planungsrecht leiten dorthin; alle Links
  (Benachrichtigungen, Feed, Sperrliste, Meine Termine) zeigen auf die neue Seite.

## Phasen

1. **Terminseite** `/mitglieder/termine/[id]`: Lesezugriff aus Terminplanung für Nicht-Planer,
   neuer Kopf, Ablauf-Zeitleiste, Leute-Reiter, eigener Status + Absagen, Zeitzonen-Fix,
   Umleitung alter URL, Gewerk-/allgemeine Termine. Keine Migration.
2. **Meine Termine** neu: Tagesgruppen, nächster Termin, Anstehend/Vergangen, Master-Detail
   auf Desktop. Keine Migration.
3. **Probenmodus** Ablauf + Anwesenheit inkl. Migration (Zeiten, Anwesenheitsstatus, Gäste),
   Auto-Save, alte Nachbereitung ersetzen.
4. **Notizen/Entscheidungen/Aufgaben** + Protokoll-Reiter + „Protokoll senden“ + Aufgaben in
   Glocke/Dashboard.
5. E2E (Playwright, Staging-Login), Screenshots mobil/desktop, Release zusammen mit
   Terminplanung Phase 6.

## Entscheidungen (2026-09-28)

- Terminseite sehen: alle der Produktion (plus Eingeladene bei Terminen ohne Produktion).
- Protokoll führen: eigenes Recht `PRIVATE.REHEARSAL.PROTOCOL.EDIT`, vergeben in der Rechteverwaltung.
- Mitglieder sehen erst einmal das ganze Protokoll.
- Offline-Fähigkeit im Probenmodus: ja.

## Protokoll-Form (Vorschlag)

Kein Fließtext, sondern ein strukturiertes Protokoll, das zu 80 % aus dem Probenmodus entsteht:

```
Probe · Akt 2 · Sa 04.10. · 14:07–18:12 (geplant 14:00–18:00)
Anwesend 11/13 · verspätet: Ben (14:25) · früh weg: Clara (17:00) · fehlt: Dora
                 dazugekommen: Emil (Gast)
Ablauf
  ✓ Sz. 3  14:10–15:05
  ◐ Sz. 5  15:10–16:20  „bis zum Auftritt Fogg“
  ↷ Sz. 7  verschoben
  + Sz. 8  16:30–17:10  spontan
Entscheidungen
  • Kostüm Sz. 3 wird rot
Aufgaben
  ☐ Requisite: Koffer besorgen – bis 11.10.
  ☐ Ben (Passepartout): Text Sz. 5 lernen
Notizen
  • Sz. 5: Auftritt links statt rechts
```

Freitext nur in den Notizen/Entscheidungen, der Rest wird automatisch zusammengesetzt.
Zusätzlich ein optionales Freitextfeld „Zusammenfassung“ oben (z. B. für die Regie).

## Aufgaben (Vorschlag)

Zuständig kann sein: **Person**, **Figur** (→ aktuelle Besetzung, auch Zweitbesetzung) oder
**Gewerk**. Umsetzung:

- Gewerk: legt eine Karte im bestehenden Gewerk-Board an (`DepartmentTask`, erste Spalte) mit
  Verweis auf den Termin – das Gewerk organisiert sich dort wie gewohnt.
- Person/Figur: neues schlankes `EventTask { eventId, noteId, title, dueAt, doneAt,
assigneeUserId?, characterId? }`; erscheint unter „Meine Aufgaben“ im Dashboard und auf der
  Terminseite, Glocke bei Anlage. Das alte ungenutzte Modell `Task` wird nicht wiederverwendet.

## Live-Kopplung (Entscheidung 2026-09-28)

Probenmodus und Terminseite hängen am bestehenden Realtime-Server (`src/lib/realtime`):
Änderungen eines Geräts (Anwesenheit, Punkt gestartet/fertig, neue Notiz) erscheinen sofort auf
allen anderen offenen Geräten – z. B. Regie am Tablet, Regieassistenz am Handy. Auch
Mitglieder sehen auf der Terminseite live, welcher Punkt gerade läuft. Offline-Einträge werden
nach dem Nachsenden ebenfalls verteilt.

## Offline (Vorschlag)

`src/lib/offline/` (IndexedDB/Dexie, Ereignis-Warteschlange, Sync-Client) existiert bereits für
Inventar/Tickets. Der Probenmodus lädt beim Öffnen einen Schnappschuss des Termins, jede Eingabe
wird als Ereignis (Anwesenheit gesetzt, Punkt gestartet, Notiz angelegt …) lokal gespeichert und
bei Netz nachgereicht; Anzeige „3 Änderungen noch nicht übertragen“. Konflikte: letzte Änderung
pro Feld gewinnt, Notizen werden nur ergänzt, nie überschrieben.
