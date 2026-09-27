# Plan: „Meine Termine" neu — Optik, Bedienbarkeit und der Notfall-Weg

Stand: 2026-09-27. Phase 0 (lokales Fixture) ist umgesetzt, der Umbau selbst steht noch aus.
Checkliste am Ende wird gepflegt.

## Ziel

1. Die Seite wird auf Handy, Tablet und Desktop angenehm lesbar und bedienbar:
   Kalenderblatt-Karten statt einer Textwand aus vier Zeilen pro Termin.
2. Filter, Suche und Ansicht bleiben in der URL erhalten (Zurück-Taste, Deep-Links, Reload).
3. Ein Monatsüberblick zeigt, was ansteht; die Liste bleibt die Standardansicht.
4. „Dein nächster Termin" und Sperr-Konflikte sind auf einen Blick sichtbar.
5. Absagen folgt der Planungsrealität: weit im Voraus eine normale Sperre, kurzfristig ein
   Notfall mit Pflicht-Grund — in beiden Fällen erscheint die Abwesenheit in der Sperrliste.
6. „Für alle"-Termine sind genauso absagbar wie persönliche Einladungen.

## Nicht in diesem Plan

- Benachrichtigungen, Push und Erinnerungen (laufen im `docs/benachrichtigungen-plan.md`).
- Änderungen am Verhalten der Sperrliste: Einträge lassen sich wie bisher jederzeit entfernen,
  auch innerhalb der Frist. Neu ist nur der Zustand „Notfall".
- Kalender-Abo auf dieser Seite (der Abo-Dialog bleibt in der Sperrliste).
- Anwesenheit/Nachbereitung an der Terminkarte (bewusst: keine Status-Badges).
- Einzel-Termin-Download für den Kalender (das Abo deckt den Bedarf).

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                         | Stelle                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1   | Nur eine flache Liste, keine Gruppierung nach Tag/Woche; 30+ Termine sind eine unübersichtliche Wand                           | `meine-proben/my-events-list.tsx:60`                       |
| 2   | Feste Obergrenze `TAKE = 30` je Query, stilles Abschneiden ohne „Mehr laden"                                                   | `lib/calendar/my-events.ts:32`                             |
| 3   | Kein Monatsüberblick, obwohl `MonthGrid` und `MonthSwitcher` fertig vorliegen                                                  | `components/ui/month-grid.tsx:80`, `month-switcher.tsx:15` |
| 4   | Filter ist reiner Client-State und springt beim Zurückkommen zurück                                                            | `meine-proben/my-events-list.tsx:41`                       |
| 5   | Keine Suche                                                                                                                    | –                                                          |
| 6   | Vergangenes ist hart ausgefiltert (`start: { gte: now }`), keine Historie                                                      | `lib/calendar/my-events.ts:41,68,95`                       |
| 7   | Rechte Spalte ist statischer Text ohne Datenbezug                                                                              | `meine-proben/page.tsx:52-77`                              |
| 8   | Kein Sperr-Konflikt-Hinweis; `BlockedDay` wird auf der Seite nicht gelesen                                                     | `lib/calendar/my-events.ts` (nur 3 Queries)                |
| 9   | Kalender-Abo nur von der Sperrliste aus erreichbar — bleibt bewusst so, der Abo-Dialog wird hier nicht eingebunden             | `sperrliste/calendar-feed-dialog.tsx:342`                  |
| 10  | Absage kennt keinen Notfall: schreibt immer `nextStatus: "no"`                                                                 | `meine-proben/actions.ts:56-68`                            |
| 11  | Absage erzeugt keinen Sperrlisten-Eintrag — die Planung sieht die Abwesenheit nur im Benachrichtigungsstrom, nicht im Kalender | `meine-proben/actions.ts:60-74`                            |
| 12  | Eine echte Notfall-Absage (`emergency`, Pflicht-Grund) gibt es nur im Glocken-Endpunkt                                         | `api/notifications/respond/route.ts:32,67`                 |
| 13  | „Für alle"-Termine sind nicht absagbar und nicht verlinkt                                                                      | `lib/calendar/my-events.ts:178`                            |
| 14  | Zeitangaben nutzen hart `timeZone: "Europe/Berlin"` statt `DEFAULT_TIME_ZONE` (AGENTS.md)                                      | `meine-proben/my-events-list.tsx:22,26`                    |
| 15  | Kein `loading.tsx`, kein Skeleton                                                                                              | `meine-proben/`                                            |
| 16  | Keine Unit-Tests; nur der Overflow-E2E und die Screenshot-Route                                                                | `e2e/responsive-overflow.spec.ts:10`                       |
| 17  | Ort „Noch offen" wird zu `null` verrechnet und verschwindet lautlos                                                            | `lib/calendar/my-events.ts:138`                            |

### Sperrfrist heute (verifiziert)

- Sperrfrist = `freezeDays` (Standard 7, `lib/sperrliste-settings.ts:12`).
- **Setzen** innerhalb der Frist wird serverseitig abgelehnt (`api/block-days/route.ts:121-145`,
  `api/block-days/bulk/route.ts:42-47`) und in der UI ausgegraut (`sperrliste/my-calendar.tsx:363,397`).
- **Löschen** wird nicht geprüft (`api/block-days/[id]/route.ts:96`) → bleibt unverändert.

## Entscheidungen

- **Optik:** Kalenderblatt-Karte — links Datumsblock (Wochentag + Tag), rechts Titel, Badges,
  Zeit/Ort, „Dabei als" und die Aktion. Mobil klappt der Datumsblock neben den Text.
- **Gruppierung:** „Heute & Morgen" · „Diese Woche" · „Später", je mit Anzahl. Danach folgt
  „Vergangen" (nur wenn eingeschaltet).
- **Ansicht:** Liste ist Standard, Kalender ist die Zweitsicht. Umschalter über `SectionNav`-Optik,
  Zustand in der URL (`?ansicht=kalender|liste`).
- **Werkzeugzeile:** links der Umschalter `[Liste | Kalender]`, daneben die Filter-Pills, rechts die
  Suche (`?q=`, einzeilig). Kein Kalender-Abo-Knopf — der Feed bleibt in der Sperrliste.
- **Filter:** Chips als `SectionNav`-Links in der URL (`?gruppe=`) statt Client-State.
- **Mehr als 30:** „Mehr laden" (`?mehr=`) statt stillem Abschneiden.
- **Vergangenheit:** Umschalter „Vergangene Termine zeigen" (`?vergangen=1`), vergangene Karten gedämpft.
- **Rechte Spalte:** Widget „Dein nächster Termin" mit Countdown; darunter die Hinweise als
  kompakter Callout mit **neu geschriebenem Text**: früh in die Sperrliste eintragen, kurzfristig
  nur als Notfall mit Grund absagen, Einträge lassen sich in der Sperrliste jederzeit entfernen.
- **Status:** Keine Status-Badges an der Karte. Der bestehende Absage-Zustand („abgesagt", Grund,
  „Doch dabei") bleibt wie heute.
- **Absage-Flow (Kern):**
  - Termin **außerhalb** der Sperrfrist → normale Absage, Grund **optional**; in der Sperrliste
    entsteht ein Eintrag „Gesperrt".
  - Termin **innerhalb** der Sperrfrist → **Notfall-Absage**, Grund **Pflicht**; in der Sperrliste
    entsteht der Eintrag „Notfall".
  - Beide Wege legen den Eintrag am **Starttag** des Termins (Europe/Berlin) an.
  - „Doch dabei" nimmt die Absage zurück **und** entfernt den von ihr erzeugten Eintrag.
  - **Mehrere Absagen am selben Tag:** Der Eintrag ist pro Tag. Die erste Absage legt ihn an,
    „Doch dabei" entfernt ihn nur, wenn am Tag keine weitere Absage mehr besteht (automatische
    Regel, kein Nutzeraufwand).
  - Der Notfall-Weg dient nicht dem Entfernen von Sperren.
- **„Für alle"-Termine:** werden absagbar; die Absage erzeugt denselben Sperrlisten-Eintrag. Die
  Aktion prüft **serverseitig**, dass der Termin für die Person sichtbar ist (gleiche Bedingung wie
  die Übersicht) — sonst ließe sich ein fremder Termin absagen.
- **Sperrliste:** neuer Zustand „Notfall" als eigener `BlockedDayKind.EMERGENCY`, verknüpft mit dem
  Termin. Er steht in der Legende und im Tagesdetail, ist aber **nicht** über die Statusauswahl
  setzbar — Notfälle entstehen ausschließlich über eine Absage. Ansonsten verhält er sich wie eine
  normale Sperre: jederzeit entfernbar, im Feed wie gesperrt, keine Extra-Zähler.
- **Genau eine Meldung:** Meldet die Absage die Planung schon selbst
  (`notifyPlannersOfDecline`, greift nur bei persönlicher Einladung mit Stufe „benötigt"), meldet
  der Sperrlisten-Eintrag **nicht** zusätzlich. Sonst übernimmt der Eintrag die Meldung
  (`notifyPlannersOfNewBlocks`) — nie doppelt, aber immer mindestens einmal.
- **Bestehender Eintrag am Tag:** existiert schon einer, wird kein zweiter angelegt; der
  Absage-Grund wird dann nicht in die Sperrliste übernommen.
- **Ort „Noch offen":** wird als gedämpfter Text angezeigt statt lautlos zu verschwinden.
- **Kalender-Abo:** bleibt ausschließlich in der Sperrliste.
- **Bewusst verworfen:** Einzel-Termin-ICS, Anwesenheits-Auswertung, Push-Erinnerungen,
  Sperrfrist beim Austragen.

## Datenmodell

```prisma
enum BlockedDayKind {
  BLOCKED
  LIMITED
  PREFERRED
  EMERGENCY   // neu: nur über eine Notfall-Absage, nicht in der Sperrlisten-Auswahl wählbar
}

model BlockedDay {
  // bestehend: id, userId, date, kind, reason
  eventId String?              // neu: welcher Termin den Eintrag erzeugt hat
  event   CalendarEvent? @relation(fields: [eventId], references: [id], onDelete: SetNull)

  @@index([eventId])
}

model CalendarEvent {
  // bestehend …
  blockedDays BlockedDay[]     // Gegenrelation
}
```

**Migration in zwei Schritten** (Postgres erlaubt `ALTER TYPE … ADD VALUE` nicht im selben
Transaktionsblock, in dem der Wert benutzt wird → Fehler `55P04`):

1. `2026xxxx_add_blocked_day_emergency`: nur `ALTER TYPE "public"."BlockedDayKind" ADD VALUE 'EMERGENCY';`
2. `2026xxxx_blocked_day_event_link`: Spalte `eventId` + Index + Fremdschlüssel.

Beide Migrationen sind nach dem Push unveränderlich (Checksummen, siehe `AGENTS.md`).

## UI-Konzept

```
┌ Meine Termine ───────────────────── [Liste|Kalender]       [Suche] ┐
│ [Alle] [Muss ich hin] [Optional] [Für alle]                          │
│                                                                      │
│ HEUTE & MORGEN (1)                                                   │
│ ┌──────┬───────────────────────────────────────────────────────────┐ │
│ │  Mi  │ Neue Probe              Probe                            │ │
│ │  30  │ 19:00–21:00 · Proberaum                                  │ │
│ │ Sep  │ Deine Zeit 19:30–21:00 · Dabei als: Ganze Produktion      │ │
│ │      │ ⚠ Du bist an diesem Tag gesperrt       [Absagen]         │ │
│ └──────┴───────────────────────────────────────────────────────────┘ │
│ DIESE WOCHE (2) …                                                    │
│ SPÄTER (4) …                                                         │
│ [Vergangene Termine zeigen]              [Mehr laden]                │
└──────────────────────────────────────────────────────────────────────┘

Rechte Spalte:
┌ Dein nächster Termin ─────────────┐
│ Neue Probe                        │
│ Mi, 30.09. · 19:00–21:00          │
│ in 3 Tagen   ·   Dabei als: …     │
└───────────────────────────────────┘
┌ Tipps ────────────────────────────┐
│ • Abwesenheiten früh in die       │
│   Sperrliste eintragen            │
│ • Kurzfristig nur als Notfall     │
│   absagen – mit Grund             │
│ • Einträge lassen sich in der     │
│   Sperrliste jederzeit entfernen  │
└───────────────────────────────────┘
```

**Kalenderansicht:** `MonthGrid` (Marker „event"/„rehearsal") + `MonthSwitcher`; am Desktop
Tagesdetail rechts daneben, mobil als Bottom-`Sheet` (Muster aus der Terminplanung).

**Absage-Dialog:** Titel wechselt je Frist — „Absagen" (Grund optional) bzw. „Notfall-Absage"
(Grund Pflicht, Warnhinweis „Die Planung wird sofort informiert"). Bei Absage-Ergebnis erscheint
in der Sperrliste der Tageszustand „Notfall" (destructive-Ton) bzw. „Gesperrt".

## Phasen

### Phase 0 – Lokales Termin-Fixture (Voraussetzung für die Sichtprüfung)

- [x] `scripts/dev-fixture-termine.ts` plus Skript `pnpm dev:termine [--remove]`: legt für
      `admin@example.com` neun kommende bzw. vergangene Termine an — zwei Proben am selben Tag, eine
      gestaffelte Probe mit persönlicher Zeit (Optional), einen abgesagten Termin (Grund
      „Schichtdienst"), eine Wanderung und ein Treffen als „Für alle", einen Gewerk-Termin, eine
      vorgemerkte Probe und einen vergangenen Termin. Einer der „Für alle"-Termine liegt innerhalb
      der Sperrfrist, ein Termin trägt „Noch offen" als Ort (Testfall für Phase 4).
- [x] Läuft nur gegen lokale/Test-Datenbanken und verweigert den Lauf sonst; `--remove` räumt alle
      Fixture-Termine wieder ab.
- [x] Verifiziert: Die Seite zeigt danach alle Zustände in Handy, Tablet und Desktop, hell und
      dunkel. Ohne das Fixture ist die Pflichtprüfung „gefüllt" unmöglich — die lokale Datenbank hatte
      **null kommende Termine** und der Seed legt nur eine Probe ohne Einladungen an.

### Phase 1 – Fundament: Absage-Logik und Sperrlisten-Verknüpfung

- Migrationen 1 + 2 (siehe oben), danach `pnpm prisma:generate`.
- `lib/calendar/my-events.ts`: pro Termin zusätzlich Tageskeys, `freezeDays` aufgelöst,
  `withinFreeze`, `conflict` (Sperr-Zustand am Tag), `past`, `linkable`.
- `lib/calendar/block-list-link.ts` (neu): `createBlockForDecline(...)` und
  `removeBlockForDecline(...)` — eine Stelle für Anlegen/Entfernen, inkl. „es existiert schon ein
  Eintrag" und „mehrere Absagen am selben Tag".
- `meine-proben/actions.ts`: `declineRehearsalAction` unterscheidet Frist (Notfall = Pflicht-Grund,
  sonst optional), legt den Eintrag an und stellt die Meldung an die Planung genau einmal sicher;
  `withdrawDeclineAction` entfernt den verknüpften Eintrag.
- „Für alle"-Termine absagbar: Einladungs-Logik so erweitern, dass `loadOwnRehearsal` sie akzeptiert.
- Revalidierung um `/mitglieder/sperrliste` ergänzen.
- Tests: Frist-Entscheidung, Pflicht-Grund nur im Notfall, Eintrag wird erzeugt/entfernt,
  kein Doppel-Eintrag, keine Doppel-Benachrichtigung.

### Phase 2 – Liste und Optik

- `my-events-list.tsx` zerlegen: `MyEventsList` (Container), `MyEventGroup` (Abschnitt),
  `MyEventCard` (Kalenderblatt), `MyEventFilter` (Chips als Links).
- Gruppierung „Heute & Morgen / Diese Woche / Später" + „Vergangen".
- Zähler je Abschnitt, Empty-State mit Icon (`py-12 text-center`), Hinweiszeile bei fehlendem Ort.
- `formatWhen` auf `DEFAULT_TIME_ZONE` aus `@/lib/date-time` umstellen.
- `loading.tsx` mit `Skeleton`.

### Phase 3 – Werkzeugzeile, URL-Zustand, Kalenderansicht

- `my-events/page.tsx` liest `searchParams` (`ansicht`, `gruppe`, `q`, `vergangen`, `mehr`).
- Suche (Titel/Ort/„Dabei als"), Filter-Chips als `SectionNav`, „Mehr laden".
- Kalender-Umschalter (`SectionNav`-Optik), Kalenderansicht mit `MonthGrid` + `MonthSwitcher`,
  Tagesdetails mobil als Bottom-`Sheet`, Desktop daneben.
- Server-Limitierung: `readMyUpcomingEvents` bekommt Suche/Zeitraum/Limit als Parameter statt
  festem `TAKE`.

### Phase 4 – Rechte Spalte und Konflikt-Hinweis

- Widget „Dein nächster Termin" (Countdown in Tagen/Stunden, Ort, „Dabei als").
- Tipps als kompakter Callout (`bg-muted border border-border rounded-lg p-4`) mit neuem Text.
- Konflikt-Hinweis an der Karte, wenn am Termintag „Gesperrt"/„Eingeschränkt" eingetragen ist und
  der Termin nicht abgesagt ist (`readDayAvailability`).

### Phase 5 – Sperrliste: Zustand „Notfall"

- `sperrliste/types.ts` (`KIND_TO_STATUS`, `STATUS_TO_KIND`), `availability-status.ts`,
  `my-calendar.tsx` (Tagesdetail, Chips, Farben), Team-Ansicht, `day-parts.tsx`.
- `EMERGENCY` steht in der Legende und im Tagesdetail, erscheint aber **nicht** in der
  Statusauswahl; der Eintrag bleibt wie gewohnt entfernbar.
- Kalender-Feed und Export: `EMERGENCY` zählt wie `BLOCKED`.
- `docs/sperrliste*.md` und `docs/datenmodell.md` nachziehen.

### Phase 6 – Doku, Tests, Freigabe

- Neues `docs/seiten/meine-termine.md`; `docs/seiten/proben.md:14` aktualisieren.
- `docs/responsiveness-matrix.md` (Zeile `/mitglieder/meine-proben`) auf „gemessen" heben.
- E2E: Gruppierung, Filter in der URL, Kalender-Umschalter, Absage mit/ohne Frist,
  „Doch dabei" räumt auf, Sperrlisten-Eintrag sichtbar.
- Visuelle Prüfung Handy/Tablet/Desktop in hell und dunkel
  (`pnpm e2e:screenshots --viewport all`, `pnpm ui:check <route> --steps-file …`).
- `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`.

## Weitere Festlegungen

- **Mehrere Absagen am selben Tag:** automatische Regel — die erste Absage legt den Eintrag an,
  „Doch dabei" entfernt ihn nur, wenn am Tag keine weitere Absage mehr besteht.
- **Ort „Noch offen":** wird als gedämpfter Text angezeigt.
- **Notfall in der Sperrliste:** eigener Legenden-Punkt und eigener Zustand im Tagesdetail, nicht
  über die Statusauswahl setzbar; keine zusätzlichen Zähler in der Team-Ansicht.
- **Sperrliste bleibt sonst unverändert:** Einträge lassen sich wie bisher jederzeit entfernen,
  auch innerhalb der Frist.

## Risiken

- **Postgres-Enum:** `ADD VALUE` darf nicht im selben Transaktionsblock benutzt werden (Fehler
  `55P04`) → zwei Migrationen; nach dem Push unveränderlich.
- **Doppel-Benachrichtigung:** Der Sperrlisten-Eintrag darf nur melden, wenn die Absage es nicht
  getan hat. Die Regel „nie doppelt, immer mindestens einmal" gehört an genau eine Stelle im Code,
  nicht in beide Aufrufer.
- **Mehrere Absagen am selben Tag:** gelöst über die automatische Regel; der Fall „zwei Absagen,
  eine zurückgenommen" muss explizit getestet werden, sonst bleibt ein falscher Eintrag stehen.
- **Missbrauch bei „Für alle":** Die Absage muss serverseitig dieselbe Sichtbarkeitsbedingung
  prüfen wie die Übersicht (`GENERAL_EVENT_WHERE` plus Produktionssichtbarkeit), sonst ließe sich
  über eine fremde Termin-ID eine Absage auslösen.
- **Alle `BlockedDayKind`-Stellen:** `KIND_TO_STATUS`, Statusauswahl, Team-Ansicht, Feed, Export und
  der Mitglieder-Usage-Zähler müssen `EMERGENCY` kennen — sonst stiller Fehler.
- **Überlauf:** Die Kalenderblatt-Karte muss bei 390px ohne horizontales Scrollen passen.

## Checkliste

- [x] Phase 0 – Lokales Termin-Fixture für die Sichtprüfung (`pnpm dev:termine`)
- [ ] Phase 1 – Migrationen, Absage-Logik mit Frist, Sperrlisten-Verknüpfung, „Für alle" absagbar
- [ ] Phase 2 – Kalenderblatt-Karten, Gruppierung, Zähler, Suche, Vergangenheit, Zeitformat, Skeleton
- [ ] Phase 3 – Werkzeugzeile, URL-Zustand, Kalenderansicht, „Mehr laden"
- [ ] Phase 4 – „Nächster Termin", Konflikt-Hinweis, Tipps-Callout
- [ ] Phase 5 – Zustand „Notfall" in der Sperrliste (Typen, UI, Feed, Export)
- [ ] Phase 6 – Doku, Tests, Screenshots, Checks, Freigabe
