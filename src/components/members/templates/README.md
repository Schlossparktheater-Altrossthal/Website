# Mitglieder-Templates

Die Template-Komponenten in diesem Ordner kapseln das Zusammenspiel von `MembersContentLayout`, App-Bar-Slots und wiederkehrenden Mobilmustern für den Mitgliederbereich. Sie dienen als Ausgangspunkt für neue Seitenvarianten und ersetzen individuelle Page-Header-Implementierungen.

## Komponentenüberblick

| Komponente | Zweck |
| ---------- | ----- |
| `MembersListPage` | Listen- und Übersichtsseiten mit Filterchips, Swipe-Actions und Sticky-CTA. |
| `MembersDetailPage` | Detailansichten mit optionaler Sidebar, Header-Metadaten und Sticky-CTA. |
| `MembersWizardPage` | Mehrschritt-Flows mit Fortschrittsanzeige und Stepper. |
| `SwipeActionsList` & `SwipeActionsItem` | Touch-optimierte Swipe-Actions für Kartenlisten. |
| `StickyBottomActions` & `StickyBottomActionsSpacer` | Fixierte Call-to-Action-Leiste im Safe-Area-Bereich mobiler Geräte. |

Weitere Pattern-Komponenten (z. B. `FilterChips`, `DetailPropertyList`) stehen für ergänzende Layoutaufgaben zur Verfügung.

## Breakpoint-Richtlinien

- Die Templates hinterlegen standardisierte Layoutparameter (`width`, `padding`, `spacing`, `gap`). Für Spezialfälle lassen sich diese über die `layout`-Prop überschreiben.
- Auf **SM**-Breakpoints (<640 px) werden Listen- und Formularbereiche maximal in einer Spalte gerendert und Sticky-CTAs automatisch eingeblendet.
- Ab **LG** (≥1024 px) aktivieren `MembersListPage` und `MembersDetailPage` zweispaltige Raster, sofern `sidebar`/`meta`-Inhalte vorhanden sind.
- Für sehr breite Tabellen gilt: statt `min-width`-Constraints werden Karten- oder Accordion-Layouts verwendet; horizontales Scrollen wird vermieden.

## Empty States

- Leere Datenquellen immer als Karten mit Icon/Überschrift/Handlungsaufforderung ausgeben.
- Sticky-CTA kann im leeren Zustand genutzt werden, um den primären Call-to-Action hervorzuheben (z. B. „Neue Buchung anlegen“).
- Verwende `text-muted-foreground` und beschreibende Copy („Noch keine Einträge vorhanden.“) statt generischer Platzhalter.

## App-Bar-Slots

- `MembersListPage`, `MembersDetailPage` und `MembersWizardPage` registrieren `MembersTopbar*`-Slots automatisch. Die Props `status` und `quickActions` mappen auf `MembersTopbarStatus` bzw. `MembersTopbarQuickActions`.
- Breadcrumbs werden über die `breadcrumbs`-Prop akzeptiert und intern zu `MembersBreadcrumbs` normalisiert.
- Zusätzliche Slot-Inhalte (z. B. globale Suchfelder) können über die `quickActions`-Prop eingeschleust werden.

## Mobile Interaction Patterns

- **Sticky Bottom CTA:** `StickyBottomActions` platziert einen sicheren CTA-Bereich über der Systemleiste. Ergänze immer einen `StickyBottomActionsSpacer`, damit der Inhaltsstrom nicht überdeckt wird (wird durch die Templates automatisch erledigt).
- **Swipe Actions:** `SwipeActionsItem` nutzt Pointer-Events für horizontales Offenfahren und bietet fallbackweise ein Dropdown-Menü. Aktionen lassen sich wahlweise als Link (`href`) oder Callback (`onSelect`) registrieren.

## Beispiele & Snapshots

Der Ordner `__stories__/members-templates.stories.tsx` enthält exemplarische Storybook-Stories für `MembersListPage`, `MembersDetailPage` und `MembersWizardPage`. Die Stories dienen zugleich als Referenz für Playwright-Snapshots: `pnpm exec playwright test e2e/snapshots/members-templates.spec.ts` erzeugt aktualisierte Render-Vergleiche für die wichtigsten Layoutzustände.

> Hinweis: Die Stories nutzen Mock-Daten und zeigen, wie Filterchips, Sticky-CTAs und Swipe-Actions zusammenspielen. Playwright greift auf dieselben Stories zu, um UI-Regressionen zu vermeiden.
