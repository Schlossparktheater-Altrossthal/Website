# Layout- & Design-Redesign – Sprint-Plan

Dieser Plan übersetzt die Analyse des aktuellen Screenshots in umsetzbare Arbeitspakete. Die Sprints sind jeweils auf 1–2 Wochen ausgelegt und bauen aufeinander auf. Jeder Sprint enthält Ziele, zentrale Aufgaben, Deliverables und Erfolgskriterien.

## Sprint 0 – Vorbereitung & Discovery (0,5–1 Woche)
- **Ziele:** Anforderungen präzisieren, Erfolgskennzahlen festlegen, technische Basis verifizieren.
- **Aufgaben:**
  - Stakeholder-Interviews durchführen und Nutzerziele priorisieren.
  - Bestehende Codebasis, Design-Dokumente (`docs/design-system.md`) und Tailwind-Konfiguration analysieren.
  - Styleguide-Audits (Farben, Typografie, Spacing) und Accessibility-Checkliste ableiten.
  - Jira/Linear-Board für das Redesign vorbereiten, Definition of Done dokumentieren.
- **Deliverables:** Research-Dokument, abgestimmtes Zielbild, Backlog mit priorisierten User Stories.
- **Erfolgskriterien:** Alle Stakeholder stimmen dem Scope zu, Risiken wurden dokumentiert, technische Constraints sind geklärt.

## Sprint 1 – Informationsarchitektur & Layout-Fundament (1–2 Wochen)
- **Ziele:** Grundstruktur der Seite und Navigation etablieren.
- **Aufgaben:**
  - Navigationskonzept inkl. Header/Footer, Responsive Breakpoints (320/768/1024/1440px) definieren.
  - Layout-Raster (CSS Grid/Flex) aufsetzen und in `src/app/layout.tsx` bzw. globalen Styles verankern.
  - Skip-Link, Landmark-Roles (`header`, `main`, `footer`, `nav`) hinzufügen.
  - Hero-Section mit Value Proposition und primärem Call-to-Action prototypisch implementieren.
- **Deliverables:** Wireframes/Prototypen, aktualisierte Layout-Komponenten, dokumentierte Navigation-Richtlinien.
- **Erfolgskriterien:** Lighthouse Layout/Accessibility-Score ≥ 90, Hero & Navigation funktionieren auf Desktop und Mobile.

## Sprint 2 – Design-System & Tokens erweitern (1–2 Wochen)
- **Ziele:** Konsistente Styles und wiederverwendbare Basis schaffen.
- **Aufgaben:**
  - Farbpalette in `docs/swatches` und Tailwind Theme aktualisieren, Kontrastwerte (≥ 4.5:1) überprüfen.
  - Typografie-Hierarchie (Headings, Body, Caption) definieren, `@/components/ui` um Text-Komponenten ergänzen.
  - Spacing- und Grid-Variablen (8pt-System) dokumentieren, Utility-Klassen harmonisieren.
  - Komponenten-Varianten (Buttons, Links, Badges) mit Zuständen (default/hover/focus/disabled) umsetzen.
- **Deliverables:** Aktualisiertes Design-System-Dokument, Token-Dateien, Storybook/Playroom-Preview (falls vorhanden).
- **Erfolgskriterien:** Alle UI-Elemente verwenden die neuen Tokens, Design-Dokumentation ist im Repo versioniert.

## Sprint 3 – Content-Module & Interaktion (1–2 Wochen)
- **Ziele:** Zentrale Inhaltsbereiche realisieren und Nutzerführung optimieren.
- **Aufgaben:**
  - Feature-/Programmsektionen, Testimonials, FAQ und Kontaktbereich als modulare Komponenten bauen.
  - Bild- und Medienhandling (Optimized Images, Ratio-Wrapper) integrieren.
  - Formular-Interaktionen (Newsletter, Kontakt) mit Validierung, Fehlermeldungen und Success States ergänzen.
  - Animationen/Transitions sparsam implementieren (z. B. `framer-motion` oder CSS), Fokus auf Micro-Feedback.
- **Deliverables:** Content-Komponenten mit Beispieldaten, dokumentierte Props & Usage-Beispiele, Responsiveness-Tests.
- **Erfolgskriterien:** Nutzer finden Kerninformationen binnen <3 Klicks, Formulare erfüllen WCAG-Standards.

## Sprint 4 – Qualitätssicherung & Launch-Vorbereitung (1 Woche)
- **Ziele:** Stabilität, Performance und Barrierefreiheit finalisieren.
- **Aufgaben:**
  - Umfassende `pnpm lint`, `pnpm test`, `pnpm build` Pipelines durchlaufen lassen und Issues beheben.
  - Manuelle Accessibility-Tests (Screenreader, Keyboard-Navigation), Kontrastprüfung, Dark-/Light-Mode-Checks.
  - Content-Finalisierung (Texte, Übersetzungen, SEO-Metadaten), Metadaten in `src/app/head.tsx` prüfen.
  - Rollout-Plan, Migrationshinweise und Monitoring/Analytics (z. B. Plausible) vorbereiten.
- **Deliverables:** Testprotokolle, Release-Checklist, aktualisierte README/Onboarding-Dokumentation.
- **Erfolgskriterien:** Alle Tests grün, QA-Abnahme dokumentiert, Launch-Fenster abgestimmt.

## Querschnittsaufgaben
- Design- und Engineering-Sync pro Sprint, tägliche Standups.
- Fortschritt in Design-Tools (Figma) spiegeln, Komponentenbibliothek aktuell halten.
- User-Feedback frühzeitig einholen (z. B. mit Remote-Tests nach Sprint 2).

## Nächste Schritte
1. Sprint-0-Aufgaben bestätigen und Team-Rollen besetzen.
2. Board mit User Stories füllen, Aufwand schätzen (Planning Poker).
3. Kick-off-Meeting terminieren und Kommunikationskanäle (Slack, Notion) festlegen.

Dieser Plan lässt sich je nach Teamgröße und Budget anpassen; bei knapper Kapazität können Sprint 2 und 3 als zweiwöchiger Sammelsprint kombiniert werden.
