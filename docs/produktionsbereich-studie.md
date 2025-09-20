# Studie: UX-, Design- und Architektur-Review des Produktionsbereichs

## Vorgehen
- Analyse der vollständigen Produktbereichs-Navigation (Übersicht, Gewerke, Rollen & Besetzungen, Szenen & Breakdowns) anhand der bestehenden React-Server-Komponenten.
- Heuristische Evaluation nach Nielsen (Informationsarchitektur, Sichtbarkeit des Systemstatus, Konsistenz) kombiniert mit User-Flow-Simulationen für Kernaufgaben (Aktive Produktion auswählen, Rollen pflegen, Szenen planen).
- Quellcode-Review der Seitenmodule und Aktionshandler, Fokus auf Wiederverwendbarkeit, Trennung von Zuständigkeiten und Reduktion redundanter Layout-Elemente.

## Beobachtungen
### Informationsarchitektur & Navigation
- Orientierungspunkt fehlte auf Unterseiten: Gewerke, Rollen und Szenen wiederholten jeweils individuelle Header ohne gemeinsamen Kontext zur aktiven Produktion.
- Quick-Navigation zwischen den Arbeitsbereichen war nur über die seitliche Mitglieder-Navigation verfügbar; innerhalb der Seiten gab es keinen konsistenten „Workspace“-Wechsel.
- Inaktive Produktionszustände (keine Auswahl gesetzt) lieferten unterschiedliche Hinweise und störten den Bearbeitungsfluss.

### Usability & Interaktionskosten
- Umfangreiche Bearbeitungsformulare waren permanent sichtbar, wodurch Seiten (insbesondere Rollen/Szenen) sehr lang wurden und kognitive Last erzeugten.
- Optionalen Metadaten (Timeline-Daten einer Produktion, Slugs, Notizen) fehlte eine optische Gewichtung – Pflicht- und Kür-Felder wurden gleich prominent dargestellt.
- Wiederkehrende Aktionen (z. B. Wechsel zur Übersicht, Aufruf anderer Workspaces) waren nicht an einer Stelle gebündelt.

### Visuelles Design & Layout
- Hero-Abschnitt der Übersicht wiederholte Informationen aus dem Active-Card-Modul, ohne echte Mehrwerte; die wichtigsten Kennzahlen lagen verteilt in mehreren Karten.
- Zwischen den Unterseiten fehlten einheitliche Abstände und Card-Stile (z. B. unterschiedliche Hintergründe/Border-Stärken bei Identkarten, Update-Formulare ohne klare Abgrenzung).

### Architektur & Codequalität
- Drei Unterseiten duplizierten sehr ähnliche Header- und Empty-State-Logik, was zu inkonsistenten Texten und höherem Wartungsaufwand führte.
- Aktionen zur Aktualisierung (z. B. Formular für Department-Updates) waren mehrfach identisch implementiert; es fehlte ein gemeinsames UI-Grundmuster (Accordion/Details) zur Reduktion von Scroll-Strecken.
- Übersichtliche Kompositionskomponenten für Workspace-Header, Statistiken und Navigation fehlten komplett, obwohl dieselben UI-Elemente mehrfach gebraucht wurden.

## Optimierungsansätze
### Kurzfristig (jetzt umgesetzt)
1. **Gemeinsamer Workspace-Header** mit einheitlicher Navigation, Status-Badge und optionalen Kennzahlen (Komponente `ProductionWorkspaceHeader`).
2. **Sekundäre Navigation** innerhalb des Produktionsbereichs (`ProductionWorkspaceNav`), damit Benutzer:innen direkt zwischen Arbeitsflächen wechseln können.
3. **Standardisierter Empty-State** (`ProductionWorkspaceEmptyState`), der auf allen Unterseiten identische Leittexte und CTAs anzeigt.
4. **Kollabierbare Bearbeitungsformulare** via native `<details>`-Elemente, um Editoren auf Gewerke-, Rollen- und Szenenseiten zu entlasten.
5. **Überarbeitetes Layout der Übersicht**: Zusammenführung der herohaften Einleitung, Kennzahlenkacheln und Quick-Actions, Entkopplung des Anlege-Formulars vom Produktionsgrid.

### Mittelfristig
- Persistente Sektionen für Zusammenfassungen im rechten Seitenbereich (z. B. sticky Info-Panel) zur schnelleren Orientierung bei langen Listen.
- Kontextbezogene Filter (Status, Gewerk) für Breakdowns mit Client-State, um große Listen fokussiert bearbeiten zu können.
- Einführung eines Audit-Logs pro Produktion (Frontend + API), um Änderungen an Rollen/Szenen nachvollziehbar zu machen.

### Langfristig
- Workspace-orientiertes Layout mit segmentbasierten Layout-Dateien im App Router (`produktionen/(workspace)/layout.tsx`), das serverseitig alle gemeinsamen Daten vorlädt.
- Vereinheitlichung der Aktionshandler mit Domain-Services (z. B. `ProductionService.updateDepartment`), um Geschäftslogik vom UI zu trennen und Tests zu erleichtern.

## Umgesetzte Maßnahmen
- **Neue Produktions-Komponenten** (`ProductionWorkspaceHeader`, `ProductionWorkspaceNav`, `ProductionWorkspaceEmptyState`) eingeführt und auf Übersicht, Gewerke-, Rollen- und Szenenseiten integriert.
- **Übersicht überarbeitet**: Kennzahlen zusammengeführt, Quick-Actions konsolidiert und Anlegeformular strukturiert (Basisdaten vs. Timeline-Details).
- **Gewerke**-Seite mit collapsiblen Bearbeitungsformularen ausgestattet, Teamstatistiken ergänzt und Header kontextualisiert.
- **Rollen & Besetzungen** reorganisiert: gemeinsamer Header, collapsible Editoren für Rollen/Besetzungen und Statistiken über Rollen, Besetzungen und verfügbare Mitglieder.
- **Szenen & Breakdowns** vereinheitlicht: Header + Navigation, kollabierbare Editoren, strukturierte Kennzahlen sowie klare Aufteilung der Breakdown-Formulare.
