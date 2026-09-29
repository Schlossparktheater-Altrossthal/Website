# Pläne

Hier liegen alle Pläne des Projekts: Entwürfe, Umbau-, Migrations- und Testpläne. Die Regeln dazu
stehen in `AGENTS.md` (Abschnitt „Pläne, Studien & Analysen"); diese Datei ist Index und Vorlage.

- **Ein Plan wird nie gelöscht.** Ist er umgesetzt, bleibt er liegen: `Stand:`-Zeile auf den neuen
  Status setzen, Checkliste abhaken. Der Ordner ist damit auch Entscheidungs- und Ergebnisarchiv.
- **Ein neuer Plan** wird hier in die Tabelle eingetragen und nach der Vorlage unten aufgebaut.
- **Die Anzahl der Phasen** gibt der Umfang vor – `gewerke-plan.md` zeigt nur die Form, nicht die
  Menge. Zwischenphasen (`Phase 3b`) und Nachträge sind erlaubt.
- **Verweise** auf einen Plan immer mit vollem Pfad: `docs/Plan/<datei>.md`.

## Index

| Datei                                                                            | Titel                                                                 | Stand      | Status                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| [benachrichtigungen-plan.md](benachrichtigungen-plan.md)                         | Benachrichtigungen neu (Glocke, PWA, Web Push)                        | 2026-09-27 | Phase 1–6 umgesetzt, offen Phase 7 (Release)          |
| [datenportal-plan.md](datenportal-plan.md)                                       | Datenportal (Report-Builder)                                          | 2026-09-26 | Phase 1–2 umgesetzt, offen Phase 3                    |     | [ernaehrung-allergien-plan.md](ernaehrung-allergien-plan.md) | Ernährung & Allergien – Datenmodell, Eingabe und Darstellung | 2026-09-29 | Entwurf, keine Phase umgesetzt |     | [gewerke-plan.md](gewerke-plan.md) | Gewerke- & Rollenplanung | 2026-09-26 | Phase 1–6 umgesetzt, offen Phase 7 (E2E und Release) |
| [meine-termine-plan.md](meine-termine-plan.md)                                   | „Meine Termine" neu – Optik, Bedienbarkeit und der Notfall-Weg        | 2026-09-28 | Phase 0–6 umgesetzt                                   |
| [mitglieder-rechte-plan.md](mitglieder-rechte-plan.md)                           | Mitglieder- & Rechteverwaltung – Redesign, produktionsbezogene Rechte | 2026-09-26 | Phase 1–2 weitgehend umgesetzt, offen E2E und Release |
| [produktionen-mitglieder-plan.md](produktionen-mitglieder-plan.md)               | Produktionsbezogene Mitglieder, Onboarding & Fotoerlaubnis            | 2026-09-23 | Schritte 1–5 umgesetzt, offen Phase C                 |
| [sperrliste-migration-plan.md](sperrliste-migration-plan.md)                     | Sperrlistenübersicht – Migration vom Spielplatz                       | 2025-10-11 | Umgesetzt, später durch den Umbau abgelöst            |
| [sperrliste-redesign-plan.md](sperrliste-redesign-plan.md)                       | Sperrliste & Termine – Umbau (2026-09)                                | 2026-09-25 | Umgesetzt                                             |
| [termin-ansicht-probenprotokoll-plan.md](termin-ansicht-probenprotokoll-plan.md) | Terminansicht, „Meine Termine" und Probenprotokoll                    | 2026-09-28 | Phase 1–3 umgesetzt, offen Phase 4 und 5              |
| [termin-erinnerungen-plan.md](termin-erinnerungen-plan.md)                       | Vorzeitige Termin-Erinnerungen (individuell einstellbar)              | 2026-09-29 | Umgesetzt (Phase 1–6), Cron-Taktung im k8s-Repo offen |
| [terminplanung-plan.md](terminplanung-plan.md)                                   | Terminplanung mit Zielgruppen, Szenen und Terminfinder                | 2026-09-27 | Phase 1–5a umgesetzt, Phase 6 bis auf E2E und Release |
| [testplan-produktionen-staging.md](testplan-produktionen-staging.md)             | Testplan Staging – Produktionen, Onboarding und Fotoerlaubnis         | 2026-09-24 | Integrationstests vorhanden, manuelle Prüfung offen   |
| [tweakcn-theming-plan.md](tweakcn-theming-plan.md)                               | Theming auf tweakcn umstellen                                         | 2026-09-24 | Umgesetzt, Phase 4 zurückgestellt                     |

Studien, Analysen und Berichte liegen in `docs/Analysen/`.

## Vorlage

```markdown
# Plan: <Titel>

Stand: <YYYY-MM-DD>. <Status in einem Satz>. Checkliste am Ende wird gepflegt.

## Ziel

1. …

## Ist-Stand (Befunde)

| #   | Befund | Stelle |
| --- | ------ | ------ |

## Zielbild

### Datenmodell

### Rechte

### Oberflächen (mobil zuerst)

## Integration

## Phasen

1. **…**

## Entscheidungen (<YYYY-MM-DD>)

- E1: …

## Checkliste

- [ ] Phase 1 …
```
