# Onboarding-Statistik – Review & Änderungsplan (2026-10-05)

Betrifft `/mitglieder/onboarding` (Recht `PRIVATE.ADMIN.ONBOARDING.ANALYTICS`), Komponenten unter
`src/app/dashboard/onboarding/[onboardingId]/_components/`, Daten aus
`src/lib/onboarding/dashboard-service.ts` (1347 Zeilen), PDF über `.../statistics/route.ts`.

## 1. Befund: was rechnerisch falsch oder irreführend ist

| Stelle                                        | Problem                                                                             | Folge                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Prozess-Schritt „Präferenzen“                 | `rolePreferences.length / Personen` – zählt **Einträge**, nicht Personen            | Werte > 100 % möglich, Dropout negativ gekappt         |
| Prozess-Schritt „Registrierung“               | immer 100 % (Zähler = Nenner)                                                       | Trichter ohne Aussage                                  |
| Prozess-Schritt „Casting“                     | zählt `ProductionMembership`, nicht Besetzung                                       | „Casting“ heißt nur „Mitglied der Produktion“          |
| Prozess-Schritt „Dokumente“                   | nur hochgeladene Dateien; digitale Unterschrift (`signatureCapturedAt`) zählt nicht | Quote zu niedrig                                       |
| Dokumente „ausstehend“                        | nur „kein Datensatz“, `status = pending` fehlt                                      | unterschätzt offene Fälle                              |
| Geschlecht                                    | fehlende Angabe wird als **„divers“** gezählt                                       | verfälscht Verteilung, inhaltlich heikel               |
| Alter / Medianalter                           | Alter **heute**, nicht zum Produktionsstart                                         | alte Produktionen „altern“ mit; Historie wertlos       |
| Profildaten (Ernährung, Geschlecht, Schule)   | aus dem **aktuellen** Profil statt `ProductionOnboarding.profileSnapshot`           | vergangene Produktionen zeigen heutige Daten           |
| Interessen                                    | alle `UserInterest` der Person, ohne Produktionsbezug                               | Historie/Vergleich unmöglich                           |
| KPI-Trends („neue in 7 T / 30 T“, Pfeil hoch) | Heuristik `newLastWeek > newLastMonth/4`; nach Onboarding-Ende immer 0              | Rauschen                                               |
| Fotoeinverständnis                            | nur `approved` vs. Rest, `level` (Stufen) ignoriert                                 | Kernfrage „wen dürfen wir wofür zeigen?“ unbeantwortet |
| Allergien                                     | gruppiert nach Freitext `allergen`, `kind`/`taxonCode`/`tracesOk` ignoriert         | Dubletten („Nuss“, „Nüsse“), Intoleranz = Allergie     |
| Historie                                      | `take: 5` beliebige andere Shows, auch **zukünftige**; Kennzahl „Anteil both“       | kein sinnvoller Vergleich                              |

## 2. Was statistisch keinen Sinn macht → entfernen

- **Shannon-/Gini-Diversität der Interessen-Tags** inkl. Ampel: bei 20–60 Personen und Freitext-Tags reine Zahlenkosmetik, niemand trifft damit Entscheidungen.
- **Interessen-Cluster per Regex** (`/schauspiel|theater|rolle/` …): willkürlich, Rest „allgemein“.
- ~~Wordcloud~~ → **bleibt** (Wunsch Nutzer 2026-10-05); optisch überarbeiten: Theme-Farben statt PuBuGn, Kleinst-Nennungen kontrastreicher, „Top-Interessen“-Balkenliste daneben kürzen (Top 5) statt doppelt.
- **Co-Occurrence-Liste** der Interessen: bei kleinen n Zufall.
- **Heatmap Acting × Crew** (Produkt normierter Anteile): nicht interpretierbar. Ersatz: einfache Zahl „X Personen wollen spielen **und** in ein Gewerk“ + Liste.
- **„Coverage“-Badges** bei Rollen/Gewerken (Englisch, unklare Definition).
- **Tab „Zuteilung“ (Allocation-Optimizer, Fairness-Buckets, Konflikte)**: algorithmische Besetzung mit „Fairness-Penalty“ wird so nicht genutzt; Besetzung läuft über `Character`/`CharacterCasting` und Gewerke-Mitgliedschaften. ~1100 Zeilen (`allocation-optimizer.ts`, `allocation-tab.tsx`, Teile des Service) entfallen.
- **Tab „Mitgliederübersicht“** mit Adresse/E-Mail/Schule: Dublette zur Mitgliederverwaltung und datenschutzseitig unnötig breit. Ersetzen durch „Offene Punkte“-Liste (s. u.) mit Link aufs Profil.
- **Gender-KPI mit ♀︎/♂︎-Symbolen** und doppelte Fotoquote (KPI-Karte + eigene Karte).
- **Offline-Demo-Fixture** (`dashboard-dev-fixture.ts`, `dev-onboarding-analytics-fixture.ts`, 665+ Zeilen) im Produktivpfad: lieber Leerzustand/Fehler zeigen.
- `collectOnboardingAnalytics()` wird nur aufgerufen, um „offline“ zu erkennen → teure Doppelabfrage, weg.

## 3. Bessere / neuere Datenquellen nutzen

| Thema                       | heute                               | künftig                                                                                                                          |
| --------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Profil zur Produktion       | `MemberOnboardingProfile` (aktuell) | `ProductionOnboarding.profileSnapshot`, Rückfall aktuelles Profil                                                                |
| Abschluss                   | –                                   | `ProductionOnboarding.completedAt` (begonnen vs. abgeschlossen)                                                                  |
| Neu vs. Rückkehrer          | –                                   | `ProductionOnboarding.isReturning`                                                                                               |
| Einladungstrichter          | –                                   | `MemberInvite` / `MemberInviteRedemption` (Link geöffnet → eingelöst → abgeschlossen)                                            |
| Fotoerlaubnis               | `status`                            | `level` (alle / Werbung nach Rückfrage / intern / keine / unbekannt) + Status + Unterschrift                                     |
| Allergien                   | Freitext                            | `taxonCode` (Lebensmittel-Taxonomie), `kind`, `level`, `tracesOk` – dieselbe Logik wie Verpflegung/Endprobenwoche                |
| Rollenwünsche               | `MemberRolePreference` + Altbestand | nur `showId = Produktion`; Altbestand nur als „ohne Wunsch für diese Produktion“ zählen                                          |
| Gewerkswünsche vs. Bedarf   | –                                   | Gewerke der Produktion (`Department`, Blaupausen `tpl:`-Codes) → Wunsch-Anzahl je Gewerk vs. tatsächliche `DepartmentMembership` |
| Rollenwünsche vs. Besetzung | Optimizer                           | `Character` / `CharacterCasting`: Rollen besetzt / offen, Wunsch erfüllt?                                                        |
| WhatsApp-Gruppe             | –                                   | `whatsappLinkVisitedAt` (Hinweis „noch nicht beigetreten“)                                                                       |
| Körpermaße                  | –                                   | `MemberMeasurement`/`MemberSize` vorhanden? (für Kostüm relevant, nur Vollständigkeit)                                           |
| Verfügbarkeit               | –                                   | Sperrliste ausgefüllt ja/nein (`BlockedDay`/`AvailabilityDay` für den Produktionszeitraum)                                       |

## 4. Was hinzukommen sollte (entscheidungsrelevant)

Leitfrage: _Wer fehlt noch was, und reicht die Besetzung?_ – nicht Demografie-Spielerei.

1. **Vollständigkeits-Trichter pro Person** (echte Personenquoten, gleicher Nenner):
   eingeladen → Onboarding begonnen → abgeschlossen → Fotoerlaubnis erteilt → Ernährung/Allergien bestätigt → Sperrliste gepflegt → Körpermaße (nur Cast) → WhatsApp.
2. **„Offene Punkte“-Liste**: Personen mit fehlenden Schritten, filterbar nach Schritt, mit Direktlink zum Profil (ersetzt Mitgliederübersicht).
3. **Fotoerlaubnis nach Stufen** (gestapelter Balken) + Liste „keine/unklar“ für Fotograf:innen.
4. **Verpflegung kompakt**: Ernährungsformen + Allergien nach Taxon und Schwere, Hinweis „lebensbedrohlich: N Personen“ – Link zur Verpflegungsseite statt Doppelpflege.
5. **Wünsche vs. Bedarf**: je Gewerk „Wünsche (1./2. Wahl)“ vs. „aktuell zugeordnet“; je Rolle Anzahl Interessierte, besetzt ja/nein.
6. **Zusammensetzung (schlicht)**: Teilnehmende, neu/Rückkehrer, Fokus Spiel/Technik/beides, Altersgruppen **zum Produktionsstart**, Geschlecht mit „keine Angabe“.
7. **Produktionsvergleich** (Historie neu): nur vergangene Produktionen, Kennzahlen Teilnehmende, Rückkehrerquote, Abschlussquote, Medianalter zum Start. Kleine Tabelle/Linie, keine Pfeil-Trends.
8. Kleine-Zahlen-Regel: Prozentangaben immer mit absoluter Zahl („12 von 31“), keine Prozente bei n < 5.

## 5. UI: auf das aktuelle Designsystem umstellen

Altes System: eigene `MetricCard` mit Uppercase-Tracking, Intent-Farbklassen, framer-motion-Animationen je Tab/Balken, d3-Wordcloud/-Farbskalen, Filterleiste nur für einen Tab, Seite rendert eine Komponente aus `/app/dashboard/...` (Altpfad außerhalb des Members-Shells).

Ziel (Vorbilder: Dashboard, Sperrliste-BottomSheet, `server-analytics` / `StatTile`, siehe Memory „MB UI-Vorbilder“):

- `PageHeader` + Produktionsauswahl als Select oben; Export-PDF und Aktualisieren ins Header-Menü.
- KPI-Reihe mit `StatTile` (wie Statistik-Seite), max. 4: Teilnehmende · Abgeschlossen · Fotoerlaubnis ok · offene Punkte.
- Tabs reduziert auf **Übersicht · Offene Punkte · Wünsche & Besetzung · Vergleich**.
- Diagramme mit `recharts` + Theme-Tokens (`var(--chart-n)`), wie in `statistics-overview.tsx`; d3-scale-chromatic und framer-motion entfernen; d3-cloud für die Wordcloud behalten.
- Mobil: Karten einspaltig, Personenlisten als Liste mit BottomSheet-Detail (Muster Sperrliste), keine breiten Tabellen.
- Talent-Detail (`talente/[userId]`) → durch Link auf vorhandene Profil-/Portalseite ersetzen.
- Komponenten nach `src/app/(members)/mitglieder/onboarding/_components/` verschieben, `src/app/dashboard/onboarding/**` und `/api/dashboard/onboarding` löschen (Server Component + Revalidierung statt 60-s-Polling; Realtime-Event optional behalten).
- PDF-Export (`lib/pdf/templates/onboarding-statistics.ts`) an die neuen Abschnitte anpassen oder vorerst entfernen (Rückfrage).

## 6. Phasen

1. **Rechenfehler beheben** (klein, sofort Prod-tauglich): Präferenzen pro Person, Geschlecht „keine Angabe“, Alter zum Start, Dokumente inkl. Unterschrift/pending, Historie nur vergangene Shows. Unit-Tests für die Aggregation.
2. **Datenquellen**: Snapshot, `completedAt`, `isReturning`, Einladungen, Fotostufen, Allergie-Taxon. Service in kleine Module splitten (`composition`, `funnel`, `consent`, `nutrition`, `wishes`).
3. **Entfernen**: Zuteilung/Optimizer, Diversität/Cluster/Heatmap (Wordcloud bleibt), Mitgliederübersicht, Demo-Fixtures, Altpfad `/dashboard/onboarding`.
4. **Neue Abschnitte**: Trichter, Offene Punkte, Wünsche vs. Bedarf/Besetzung, Vergleich.
5. **UI-Umbau** auf StatTile/recharts/PageHeader, mobil; Screenshots Staging mobil+Desktop prüfen.
6. PDF-Export, E2E, Release.

## Offene Entscheidungen

- Zuteilungs-Tab wirklich ersatzlos streichen (wird er von jemandem genutzt)?
- PDF-Export behalten? Wenn ja, wofür (Vorstand, Förderanträge → dann Demografie wichtiger)?
- Geschlecht überhaupt anzeigen, oder nur bei Bedarf (z. B. Förderberichte)?
- Sperrliste/Körpermaße in den Trichter aufnehmen oder separat lassen?

## 7. Optischer Befund (Staging-Screenshots 2026-10-05, Admin, 1440 px + Mobil 390 px)

Desktop ~4200 px hoch, mobil **~15 000 px** (≈ 18 Bildschirme) – niemand scrollt das durch.

- **Kopf**: Karte mit Status-Badge, Select, „Statistik exportieren“, „Teilen“ (orange, primär) und „Neu laden“ (gelb umrandet) – drei Buttonstile nebeneinander; mobil vier volle Zeilen Buttons, bevor Inhalt kommt. Ziel: `PageHeader`, Produktion als Select, Rest im ⋯-Menü.
- **Tabs**: Desktop Pill-Tabs im Altstil, mobil ein Select „Global“ – andere Seiten nutzen Unterreiter/Segment.
- **Dreifachungen**: Fokus erscheint als Balken-Karte _und_ KPI „Fokus acting/tech“; Fotoerlaubnis als KPI (78,6 %) _und_ eigene Karte (79 %) mit unterschiedlicher Rundung; Geschlecht als KPI (53,6 % ♀) _und_ Verteilung.
- **Sprache/Labels**: englische Rohwerte `both/tech/acting`, „Coverage“, „Co-Occurrences“, „Wordcloud“; Ernährung zeigt Rohcodes nebeneinander („vegetarian“ + „Vegetarisch“, „omnivore“ + „Allesesser“) → Mapping fehlt, Dubletten in der Torte.
- **Unverständliche Zahlen**: Rollenpräferenzen „Statistenrolle 65 %“ bei „Beteiligung 14 %“ – zwei Prozente pro Zeile, das große ist das bedeutungslose; Heatmap zeigt `0.46 / 46 %`; Diversität „Shannon 3.55 · Gini 0.19 · sehr vielfältig“; Cluster „ALLGEMEIN 34“ belegt, dass die Regex-Cluster nicht greifen.
- **KPI-Karten**: Uppercase-Letterspacing-Badges („TREND STEIGEND 100.0 % MONAT“, „STABIL 3.6 % WOCHE“), farbige Intent-Hintergründe (gelb „BEOBACHTEN“) – nicht wie `StatTile`.
- **Diagramme**: Torte mit Label „100%“ in der Mitte, Wordcloud (bleibt) mit verwaschenen Grautönen → Theme-Farben, Interessen-Cluster als knallbunte Verlaufsbalken – passt zu keinem Theme-Token.
- **Mobil**: Heatmap scrollt horizontal (Spalten abgeschnitten), Allergie-Liste mit je 1 Meldung als lange Balkenliste, Kopf + KPI-Karten füllen die ersten 3 Bildschirme, bevor eine Auswertung kommt.
- **Layout Desktop**: Rollenkarte halb leer neben langer Gewerkekarte, Heatmap nur 2/3 breit mit Lücke rechts.

Konsequenz für den Umbau: Übersicht mobil auf ≤ 3 Bildschirme (4 StatTiles, Trichter, Fotostufen, Hinweis Verpflegung), Details in eigene Reiter/BottomSheets; alle Labels deutsch und über ein Mapping; je Kennzahl genau eine Darstellung.

## 8. Weitere Reiter (Screenshots 2026-10-05)

### Mitgliederübersicht

- Desktop: Tabelle breiter als die Karte, Spalte „Gewerke“ abgeschnitten; **zwei Suchfelder** (Filterleiste oben + „Person suchen“ in der Karte); Hinweistext „Andere Tabs bleiben unverändert“ ist Entwicklerprosa.
- Auf diesem Reiter verschwindet der Kopf → **Produktion nicht mehr wechselbar**.
- Mobil: reine Namensliste ohne Status – keine Information, die die Mitgliederverwaltung nicht hat.
- Fotofilter kennt nur Status, nicht die Stufen.
  → wie geplant durch „Offene Punkte“ ersetzen (Status-Chips je Person, BottomSheet-Detail).

### Ranking

- **Zählfehler**: „Alle Rollen · 35 Profile“ bei 28 Teilnehmenden (Personen mehrfach je Rollengröße gezählt).
- Spinnennetz mit 4 Achsen (Rollengrößen): Beschriftungen abgeschnitten („e Rolle“, „Mittle“), 0 %/35 %/70 % überlappen – ein Balken wäre klarer.
- Präferenz-Chips: Text und Prozent überlagern sich („Statisten100%“), Rangziffern 11/13/14 ohne Erklärung, Gewerkenamen brechen pro Wort um.
- „Score 1,20“, „100 % Sicherheit“, „6 Jahre Erfahrung“ (aus `memberSinceYear`) – pseudo-präzise.
- Mobil: Seite **~44 000 px**, Breite 796 px > Viewport (horizontaler Überlauf), Acting/Crew-Umschalter erscheint als **leeres Select**.
- Inhaltlich sinnvoll ist nur: _wer wünscht sich welche Rollengröße / welches Gewerk_ → in „Wünsche & Besetzung“ als kompakte Liste je Rolle/Gewerk mit Namen + Wunschrang, Personendetail im BottomSheet.

### Zuteilung

- **Fehler**: dieselbe Person (Tobias Schneider) belegt Slot 1 **und** Slot 2 derselben Rolle.
- „Fairness-Ampeln“ verwenden den Geschlechter-Fehler („Divers 14,3 %“), Ziele wie „Ziel 50“/„Ziel 3“ ohne Einheit.
- Fast alle Kapazitätsbalken rot, weil Standard-Kapazität geraten ist; Schieberegler-Wand „Kapazitäten anpassen“ wird nicht gespeichert-erklärt.
- Slots „Noch unbesetzt“ listen trotzdem Alternativen mit Score 0,98.
  → Bestätigt: Reiter streichen; Besetzung über `CharacterCasting`/Gewerke.

### Historie

- Eine einzige Vergleichsproduktion, Spalte „FOKUS BOTH“ englisch, je ein Balkendiagramm mit genau einem Wert.
  → erst anzeigen, wenn ≥ 2 vergangene Produktionen; Tabelle genügt.

### Talent-Detail (`talente/[userId]`)

- Im Ranking kein direkter Link gefunden (nur über Unterseite erreichbar) – bestätigt: durch Profil-/BottomSheet ersetzen.

## 9. Grundprinzip für Wünsche: stufenloser Regler → Wortstufen auswerten

**Hintergrund (User 2026-10-05):** Die seltsamen Kennzahlen (normierte Anteile, Heatmap-Produkte, Score/Konfidenz, Fairness) waren ein Versuch, aus den fast stufenlosen Präferenz-Angaben Sinn zu ziehen.

**Ursache der Verzerrung:** Eingabe ist ein Regler 0–100 je Rolle/Gewerk, **jeder Bereich einzeln bewertet, kein Budget** (`role-preference-utils.ts`). Das Dashboard teilt aber `weight / Summe aller Gewichte der Person` – also so, als hätte jede Person 100 % zu verteilen. Folge: wer viel ankreuzt, wirkt bei allem lauwarm; wer nur eine Sache „Vielleicht“ will, bekommt 100 %. Daraus entstehen „Statistenrolle 65 %“, „100 % Präferenz“, Ranking-Scores und die Heatmap.

**Neue Regel für alle Auswertungen:**

- Gewicht nie normieren, nie als Prozent zeigen. Es zählt als **Ordinalwert** über die bestehenden Wortstufen: Kein Interesse (0) · Vielleicht (1–29) · Gern (30–54) · Sehr gern (55–79) · Unbedingt (80–100) – dieselbe Funktion `getRolePreferenceWeightLabel` wie in der Eingabe, damit Planer:innen dieselben Wörter sehen wie Mitglieder.
- Pro Rolle/Gewerk: **gestapelter Balken mit Personenzahlen je Stufe** (Unbedingt/Sehr gern/Gern/Vielleicht), sortiert nach „Unbedingt + Sehr gern“.
- Pro Person (BottomSheet): ihre Wünsche als Wortstufen-Chips, sortiert – keine Scores, keine Konfidenz.
- Abgleich mit Bedarf: „Plätze im Gewerk / Rollen dieser Größe“ vs. „Personen mit mind. Gern“ → Hinweis „knapp“ / „genug“ (absolute Zahlen).
- Doppel-Interesse Spiel + Gewerk: Personen mit mind. „Gern“ in beiden Bereichen zählen und auflisten (statt Heatmap).
- Rohwert nur intern zum Sortieren innerhalb einer Stufe.

Damit entfallen ersatzlos: `normalizedShare`, `participantShare`-Doppelprozente, `roleHeatmap`, Ranking-`score`/`confidence`/„Sicherheit“, Allocation-Optimizer inkl. Fairness, „Coverage“.

### 9a. Statistisch sinnvolle Auswertungen der Reglerwerte (zusätzlich zu den Stufen)

Die Stufen sind die _Anzeige_; rechnen dürfen wir mit dem Rohwert, wenn die Methode zum Eingabemodell passt (unabhängige Einzelbewertungen, n ≈ 20–40, individuelle Antwortstile).

1. **Rang innerhalb der Person** (statt Summen-Normierung): 1. Wahl, 2. Wahl … je Bereich; Gleichstände = gleicher Rang. Robust gegen Antwortstil (jemand stellt alles auf 70). Kennzahl je Rolle/Gewerk: „N Personen haben es als 1. Wahl“.
2. **Relativ zum eigenen Maximum** (`weight / max_der_Person`): 1,0 = Lieblingsbereich. Trennt „mag alles ein bisschen“ von „will genau das“, ohne die Viel-Ankreuzer zu bestrafen.
3. **Verteilung statt Mittelwert**: je Rolle/Gewerk ein Punktdiagramm (jede Person ein Punkt auf 0–100, Stufengrenzen als Hintergrundbänder) + Median. Zeigt Konsens vs. Polarisierung (zwei Lager) – bei n < 40 ehrlicher als Boxplot/Prozent.
4. **Flexibilität je Person** = Anzahl Bereiche ≥ „Gern“: „Springer“ (≥ 4) vs. „Spezialist“ (1). Direkt nützlich für Besetzung und Ausfälle.
5. **Angebot/Bedarf mit Spanne**: Personen ≥ „Sehr gern“ (sicher) bis ≥ „Gern“ (möglich) gegen Plätze → „knapp / genug / Überhang“.
6. **Häufig gemeinsam gewünscht**: Paare von Gewerken/Rollen, die dieselben Personen ≥ „Gern“ setzen, nur ab ≥ 3 Personen (kleine n!). Ersetzt Heatmap und Interessen-Co-Occurrence.
7. **Wunscherfüllung nach Besetzung** (die eigentlich wertvolle Kennzahl): Anteil Personen, die eine Rolle/ein Gewerk bekommen haben, das sie ≥ „Sehr gern“ bzw. als 1./2. Wahl angegeben haben; Liste „bekam nichts aus ihren Top-2“. Quelle: `CharacterCasting` + `DepartmentMembership`. Über Produktionen vergleichbar.
8. **Rückkehrer-Verlauf**: Wünsche derselben Person über Produktionen (Wechsel Spiel→Technik, neue Gewerke) – jetzt möglich, weil Wünsche pro `showId` gespeichert sind.
9. **Datenqualitäts-Check** vor jeder Auswertung: Häufung auf Startwert/Rastern (0, 50, 100), Anteil „nichts angegeben“. Falls Regler v. a. an Extremen landen, ist die Stufen-Zählung ohnehin die richtige Sicht.

Bewusst **nicht**: Mittelwerte von Prozenten, Gini/Shannon, Korrelationsmatrizen oder Clusterverfahren – bei 20–40 Personen pro Produktion reines Rauschen; Optimierer mit „Fairness-Score“ – Besetzung bleibt menschliche Entscheidung, die Statistik liefert nur Angebot/Bedarf und hinterher die Wunscherfüllung.

### 9b. Datencheck Staging (Prod-Kopie, 2026-10-05, nur Aggregate)

196 Wunsch-Einträge, 43 Personen, 2 Produktionen (2026: 33 Onboardings, 2027: 28 – jeweils **alle** mit Wünschen).

- **98 % der Werte liegen auf 10er-Schritten** (100: 44×, 80: 35×, 70: 34×, 50: 24×). Faktisch eine 11-stufige Skala aus der alten Prozent-Regler-Zeit; stufenlose Werte (14, 16, 28, 37) gibt es erst vereinzelt.
- **Deckeneffekt**: 46 % der Einträge „Unbedingt“ (≥ 80), nur 3 Einträge „Kein Interesse“. Leute tragen nur ein, was sie wollen – _ob_ etwas gewählt wurde ist die Hauptinformation, die Stärke die zweite.
- **Antwortstil**: im Schnitt 3,2 Einträge je Person und Produktion; **24 von 62 (39 %) geben allen Einträgen denselben Wert**, 12 nur einen einzigen Eintrag. Für sie sind Rang- und Max-Normierung leer (alles „1. Wahl“).
- **Flexibilität** (Bereiche ≥ Gern): 1 → 15 Personen, 2 → 17, 3 → 15, 4–7 → 14. Gute Streuung, Kennzahl trägt.
- **Rückkehrer**: 18 Personen mit Wünschen in beiden Produktionen → Verlauf (9a.8) möglich.
- **Besetzungsdaten**: 32 Rollenbesetzungen, 50 Gewerke-Zuordnungen → Wunscherfüllung (9a.7) berechenbar.

**Konsequenzen für 9a:**

- Primärkennzahl je Rolle/Gewerk: **Anzahl Personen, die es gewählt haben**, darin Anteil „Unbedingt“. Fünf Stufen sind feiner als die Daten; Anzeige als zwei Gruppen „Unbedingt/Sehr gern“ vs. „Gern/Vielleicht“ reicht.
- Rang innerhalb Person (9a.1) nur als „einziger/klarer Favorit“ (genau ein höchster Wert und mind. 2 Einträge) ausweisen, nicht als Rangliste.
- Punktdiagramm (9a.3) entfällt – Werte kleben auf 70/80/100, zeigt nichts.
- „Präferenzen ausgefüllt“ als Trichter-Schritt entfällt (immer 100 %, Pflichtschritt).
- Häufig-gemeinsam (9a.6) nur produktionsübergreifend oder ab ≥ 3 Personen.
- Behalten: Flexibilität, Angebot/Bedarf, Wunscherfüllung, Rückkehrer-Verlauf.
- Hinweis an Eingabe-UI (separat entscheiden): Der stufenlose Regler liefert gegenüber 4 Stufen kaum Zusatzinformation; der Deckeneffekt spricht eher für eine Frage nach dem **Favoriten** („Was willst du am liebsten?“) zusätzlich zur Stufe.
