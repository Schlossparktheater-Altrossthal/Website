# Wunschliste – Plan (2026-10-16)

Ziel: übersichtlich sehen, **wer sich welche Rollengröße und/oder welches Gewerk wünscht**, als
Arbeitsliste für die Besetzung – nicht als Statistik. Kompakter PDF-Export (Liste + Matrix),
Verantwortliche können Wünsche nachtragen.

## Entscheidungen (Nutzer 2026-10-16)

- Eigene Ansicht **„Wünsche“ in Produktionen → Zuweisung** (dort liegen Wünsche, Gewerke und
  Besetzung schon zusammen, `loadAssignmentData`), keine zweite Datenquelle in der
  Onboarding-Statistik.
- Nur Wünsche **dieser Produktion** (`MemberRolePreference.showId`); Altwünsche bleiben außen vor.
- Zwei Blickrichtungen: **nach Bereich** (Schauspiel nach Rollengröße, Gewerke) und **nach
  Person** (Chips je Wunsch, Fokus, neu/Rückkehrer, Interessen nur als Hinweis).
- Stufen statt Zahlen: Unbedingt · Sehr gern · Gern · Vielleicht (`ROLE_PREFERENCE_WEIGHT_LABELS`),
  nie Prozent. Zählzeile je Bereich mit absoluten Zahlen.
- Neben jedem Namen der Ist-Stand (Gewerk aktiv / Rolle dieser Größe besetzt); Filter
  **„ohne Zuteilung“**.
- Kennzahl **Wunscherfüllung**: „X von Y Zugeteilten haben einen Top-Wunsch bekommen“ (Top =
  ab „Sehr gern“, sonst der höchste eigene Wunsch) + Liste derer ohne.
- **Bearbeiten:** Regie/Planung (`PRIVATE.PRODUCTION.SHOW.MANAGE`) alle Bereiche,
  Gewerk-Leitung nur ihre Gewerke. **Nur nachtragen**, nie überschreiben: selbst angegebene
  Wünsche bleiben unverändert, dafür gibt es eine interne Notiz je Person.
- Herkunft: `MemberRolePreference.enteredById` (null = selbst angegeben). Speichert die Person
  ihre Wünsche später selbst, bleibt die Herkunft unveränderter Einträge erhalten.
- Mitglieder sehen im Profil, welche Wünsche für sie nachgetragen wurden (und von wem).
  Die interne Notiz sehen sie nicht.
- PDF: **Liste** (Hochformat, je Bereich nach Stufe gruppiert, Haken für Zuteilung) und
  **Matrix** Person × Bereich (Querformat, Stufe als Punkte).

## Phasen

1. Schema (`enteredById`, `MemberWishNote`) + Lader `src/lib/wishes/wishlist.ts` + Ansicht
   „Wünsche“ (Bereiche/Personen, Filter, Wunscherfüllung).
2. Nachtragen/Ändern/Entfernen nachgetragener Wünsche + Notiz (Server Actions, Rechte).
3. PDF-Vorlage `wunschliste` (Liste + Matrix).
4. Profil: Hinweis „nachgetragen von …“, Herkunft beim Selbst-Speichern erhalten.
5. Tests (Unit für Lader/Rechte), Staging-Screenshots mobil+desktop, E2E.

## Bewusst nicht

Prozente, Verteilungsdiagramme, Rankings über Personen; algorithmische Besetzung. Den Reiter
„Wünsche & Besetzung“ der Onboarding-Statistik später durch einen Link hierher ersetzen.

## Umbau Zuweisung (2026-10-16, Nutzer: „mega unübersichtlich“)

- Nur noch zwei Ansichten **Gewerke** und **Rollen** als aufklappbare Karten (Desktop offen,
  mobil zu): offene Wünsche nach Stufe mit „Zuweisen“, Team als Namens-Chips, Rollen der Größe.
- Personenliste und Ansicht „Wünsche“ entfallen; die Suche öffnet die Person (Gewerke, Rollen,
  Wünsche, Nachtragen, Notiz). PDF und „Neue Rolle“ im ⋯-Menü.
- PDF-Anhang „Personen“: dabei seit, Interessen, Hinweis ans Team, interne Notiz.
- Datenmigration: Alt-Codes → Blaupausen (Bühnenbild+Requisite → Bühnenbau, Kostüm → Kostüme,
  Licht & Ton → Technik, Werbung → Social Media & Werbung, Musik → Musik …); neue Blaupausen
  „Maske & Make-up“ und „Regieassistenz & Orga“ – die Gewerke legt die Regie in der Produktion an.
