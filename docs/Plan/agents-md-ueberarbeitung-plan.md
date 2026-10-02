# Plan: AGENTS.md überarbeiten

Stand: 2026-10-02. Umgesetzt am 2026-10-02. Checkliste am Ende wird gepflegt.

## Ziel

1. `AGENTS.md` auf die Regeln reduzieren, die beim Arbeiten im Code wirklich gebraucht werden.
2. Veraltete Angaben korrigieren, Dubletten zusammenführen, Hintergrundwissen in die Fach-Doku
   verweisen.
3. Keine echte Projektregel geht verloren.

## Ist-Stand (Befunde)

| #   | Befund                                                                                           | Stelle (alte Fassung) |
| --- | ------------------------------------------------------------------------------------------------ | --------------------- |
| 1   | `src/pages/api` existiert nicht mehr (Socket-Bridge-Regel ohne Gegenstand)                       | Z. 9                  |
| 2   | `@/lib/prisma-helpers` existiert nicht; Queries liegen in Domänen-Libs `src/lib/<domäne>`        | Z. 36                 |
| 3   | `docs/review-prompt.md` (DeepSeek-Review-Prompt) existiert nicht                                 | Z. 308                |
| 4   | „Preview-Deployments“ gibt es nicht, geprüft wird auf Staging                                    | Z. 91                 |
| 5   | Toast-Dauern nirgends zentral umgesetzt und nicht relevant                                       | Z. 242                |
| 6   | Milestone-Schema v0.1/v0.2/v1.0 passt nicht zu den echten Releases (v1.11 in Prod)               | Z. 263–267, 332–337   |
| 7   | Design-Tokens, Responsive, Screenshot-Pflicht, Commit-Checks, Permissions, Issue-Regeln mehrfach | verteilt              |
| 8   | Overflow-Test-Absatz (~250 Wörter) dupliziert `docs/e2e-tests.md`                                | Z. 81                 |
| 9   | Allgemeinwissen (Conventional-Commits-Typen, Benennung), leere Einführung am Dateiende           | Z. 99–115, 145–157    |
| 10  | „Vollprüfung vor jedem Commit“ kollidiert mit Phasen-Serien; Screenshot-Pflicht ohne Abstufung   | Z. 85–86, 96          |

## Entscheidungen (2026-10-02)

- E1: Toast-Dauern werden gestrichen, nicht umgesetzt.
- E2: Das feste Milestone-Schema entfällt. Milestones benennen, wenn überhaupt, ein echtes
  geplantes Release (`v1.12.0` …); Pflicht-Milestone für Issues entfällt.
- E3: Prüfpflichten werden abgestuft (Doku / kleiner Fix / UI-Umbau / Phasen-Serie).
- E4: Der von `next dev` erzeugte Next.js-Block am Dateiende bleibt unverändert.

## Phasen

1. **Neufassung `AGENTS.md`:** neu gegliedert, Befunde 1–10 behoben, Details per Verweis auf
   `docs/design-system.md`, `docs/e2e-tests.md`, `docs/development.md`.

## Checkliste

- [x] Phase 1 Neufassung `AGENTS.md`
