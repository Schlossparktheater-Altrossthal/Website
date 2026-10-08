# Plan: Planungshilfen in der Terminplanung (probbare Szenen, Belastung, Übersichten)

Stand: 2026-10-08 – Konzept, Umsetzung beginnt direkt

## Ziel

Wer Proben plant, soll ohne Suchen sehen, **was an einem Tag sinnvoll geprobt werden kann** und **wen
er wie stark beansprucht**. Niemand soll ein ganzes Wochenende opfern, wenn ein Tag gereicht hätte.
Alles dient dem bestehenden Ablauf (Kalender → Tag → Probe → Ablauf/Teilnehmer), mobil wie am
Desktop.

## Ist-Stand (Befunde 2026-10-08, Demo als Regie)

- `docs/Plan/terminplanung-plan.md` ist bis auf Phase 5b (E2E/Release) umgesetzt. Offen aus
  „Planungswerkzeuge“: pro Szene sehen, **ob die Besetzung am gewählten Tag da ist** – die
  Szenenauswahl im Ablauf (`src/components/calendar/event-agenda-editor.tsx`) zeigt nur
  „3× geprobt · zuletzt …“. Konfliktprüfung kennt nur Personen, keine unvollständigen Szenen.
- Tagesfeld der Terminplanung (`page-client.tsx`) zeigt Termine und „Wer kann?“, aber keine Szenen.
- Desktop-Kalender: Titel abgeschnitten („Szenen…“), Punkte mit Zahlen, Seitenleiste schmal,
  „Szenen-Stand“ zugeklappt unter dem Kalender.
- Belastung einzelner Personen (Proben pro Woche) ist nirgends sichtbar.
- Daten für alles liegen schon vor: Besetzung (`castings`, Typ primary/alternate/cover/cameo),
  Szenen mit Rollen (`AudienceContext.scenes`), Sperrliste pro Tag, Eingeladene je Termin.

## Zielbild

### Probbare Szenen (pro Tag)

Reine Funktion `src/lib/calendar/scene-readiness.ts`: Szenen + Besetzung + Sperrliste (+ Absagen,
parallele Termine) → je Szene einer von vier Zuständen:

| Zustand            | Bedeutung                                                         |
| ------------------ | ----------------------------------------------------------------- |
| vollständig        | jede Rolle hat eine Hauptbesetzung, die kann                      |
| mit Zweitbesetzung | mindestens eine Rolle nur über Zweitbesetzung/Cover spielbar      |
| eingeschränkt      | jemand Nötiges ist nur „eingeschränkt“ verfügbar                  |
| fehlt jemand       | mindestens eine Rolle ohne verfügbare Besetzung (mit Namen/Grund) |

Rollen ohne Besetzung zählen nicht als fehlend (sonst wäre jede Szene rot), werden aber genannt.

- **Ablauf im Editor**: Zeile „Am Do 8.10. probbar: 6 vollständig · 2 mit Zweitbesetzung · 2 fehlt
  jemand“, aufklappbar mit allen Szenen und Knopf „+“ zum Hinzufügen. Szenen im Menü
  „+ Programmpunkt“ und im Ablauf tragen dasselbe farbige Kennzeichen; fehlende Rolle als Hinweis
  („Titania fehlt – Katharina: Urlaub“).
- **Tagesfeld der Terminplanung**: Abschnitt „Probbar“ mit denselben Gruppen, darunter „Probe mit
  diesen Szenen anlegen“ (legt Entwurf an, Szenen vorausgewählt).

### Belastung pro Person

- Funktion `src/lib/calendar/week-load.ts`: je Person Anzahl und Stunden angesetzter/vorgemerkter
  Termine, zu denen sie eingeladen ist (ohne Absagen), in der Kalenderwoche (Mo–So) des Termins.
- **Teilnehmerliste im Editor**: kleines Kennzeichen „diese Woche 2× · 5 h“ (ab 3 Terminen
  hervorgehoben) und „auch Sa eingeladen“, wenn die Person am Vor- oder Folgetag schon eingeladen
  ist.
- **Bündel-Hinweis**: Ist jemand an zwei aufeinanderfolgenden Tagen eingeladen und spielt am
  aktuellen Termin nur in wenigen Szenen, Hinweis „Ida probt hier nur Sz. 2.6 und ist So auch da –
  an einem Tag bündeln?“ (nur Hinweis, keine Automatik – passt zur Entscheidung „keine
  automatischen Vorschläge“).
- **Tagesfeld**: unter „Wer kann?“ „Diese Woche schon da“ mit Personen und Anzahl.

### Übersichten am Desktop

- **Szenen-Plan** (neue Ansicht „Szenen“ neben Kalender/Liste): Szenen als Zeilen, Wochen bis zur
  Premiere als Spalten; Zelle = geprobt (✓ Anzahl) / angesetzt / leer, Spalte „zuletzt“ und
  Warnung „seit 14 Tagen nicht“. Klick auf eine Zelle springt in den Kalender der Woche. Mobil: Liste
  pro Szene mit Mini-Zeitleiste. Ersetzt die zugeklappte Karte „Szenen-Stand“.
- **Personen-Woche** (Ansicht „Personen“): Personen als Zeilen, Tage einer Woche als Spalten;
  Zelle = Probe (eingeladen/abgesagt), Sperre, eingeschränkt, frei; Summe pro Person rechts. Mobil:
  Tag wählen, Liste der Personen.
- **Kalender**: in Tagesfeldern ab `lg` Uhrzeit + Kurztitel ausgeschrieben statt nur Punkt; Balken
  „wie viele können“ statt roter Zahl; Seitenleiste breiter.

## Phasen

1. **Probbare Szenen**: `scene-readiness.ts` + Tests; Ablauf im Editor (Zusammenfassung, Kennzeichen
   im Menü und in Zeilen); Tagesfeld der Terminplanung mit „Probbar“ und Anlegen mit Szenen.
2. **Belastung**: `week-load.ts` + Tests; Kennzeichen in der Teilnehmerliste (Editor), Bündel-Hinweis,
   „Diese Woche schon da“ im Tagesfeld.
3. **Szenen-Plan**: Ansicht „Szenen“ (Desktop-Matrix, mobile Liste), Szenen-Stand-Karte entfällt.
4. **Personen-Woche**: Ansicht „Personen“.
5. **Kalender am Desktop**: Tagesfelder mit Zeit/Titel, Verfügbarkeitsbalken, breitere Seitenleiste.
6. **Demo/E2E**: Demo-Seed so, dass alle Zustände vorkommen; Screenshots, E2E für Phase 1–2.

## Entscheidungen (2026-10-08)

- E1: Nur Hinweise und Hervorhebungen, keine automatische Szenen- oder Terminwahl.
- E2: Zweitbesetzung/Cover macht eine Szene „mit Zweitbesetzung“, nicht „vollständig“.
- E3: Woche = Kalenderwoche Mo–So (Europe/Berlin); gezählt werden angesetzte und vorgemerkte Termine.
- E4: Keine Migration nötig; alle Daten existieren.

## Checkliste

- [x] Phase 1 Probbare Szenen (2026-10-08): `scene-readiness.ts`, Ablauf im Editor, Tagesfeld „Was ist probbar?“ mit „Probe mit N Szenen anlegen“
- [x] Phase 2 Belastung (2026-10-08): `week-load.ts`, Kennzeichen + Bündel-Hinweis im Editor, „Diese Woche eingeladen“ im Tagesfeld
- [x] Phase 3 Szenen-Plan (2026-10-08): Ansicht `?ansicht=szenen`, `scene-plan.ts`, Karte Szenen-Stand entfernt
- [ ] Phase 4 Personen-Woche
- [ ] Phase 5 Kalender am Desktop
- [ ] Phase 6 Demo/E2E
