# Plan: Fotoerlaubnis – strukturierte Einwilligungen, Nachweise & Versionierung

Stand: 2026-09-30. Entwurf zur Freigabe, Umsetzung noch nicht begonnen. Checkliste am Ende wird gepflegt.

## Ziel

1. Die Fotoerlaubnis wird **strukturiert** abgefragt: statt einer Ja/Nein-Checkbox plus Freitext werden die
   Verwendungszwecke aus den beiden PDF-Vorlagen als ankreuzbare Punkte gespeichert und dargestellt.
2. Ein Mitglied kann **ablehnen** („gar nicht“, wie im PDF), ohne eine Begründung angeben zu müssen. Diese
   Ablehnung ist als eigener Zustand für Mitglied und Verwaltung sichtbar.
3. Die Punkte sind **konfigurierbar** und gelten **pro Produktion** (Verwaltung kann sie pflegen).
4. Für **Minderjährige** wird das Formular **ausdruckbar**; das Onboarding lässt sich **ohne** Abgabe fortsetzen
   und der Nachweis später einreichen (Kamera-Foto **oder** Datei-Upload). Vor der Abgabe wird strukturiert
   angegeben, welche Punkte angekreuzt wurden.
5. Jede Einreichung ist **nachvollziehbar** (Versionshistorie). Auch nach einer Freigabe kann mit neuer
   Unterschrift bzw. neuem Dokument geändert werden.
6. Die **gesamte Ansicht** (Mitglied und Verwaltung) wird modernisiert und orientiert sich an Dashboard,
   Mitglieder und Stück.

## Ist-Stand (Befunde)

| #   | Befund                                                                                                                                                                                                                                                                                                    | Stelle                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `PhotoConsent.consentGiven` (Boolean, Default `true`) ist faktisch tot: Die Mitglieds-UI bietet nur „Ja, ich bin einverstanden“ an; eine echte Ablehnung durch das Mitglied gibt es nicht. Das PDF kennt „gar nicht“.                                                                                     | `prisma/schema.prisma` (`PhotoConsent`), `src/components/members/photo-consent-card.tsx` |
| 2   | Die abzufragenden Punkte existieren **nicht strukturiert**. `exclusionNote` ist ein Freitext (max. 1000 Zeichen). Die PDF-Punkte (privat intern / Programmheft & Instagram / … mit Einverständnis auf Nachfrage / gar nicht) lassen sich so weder speichern noch auswerten oder drucken.                  | `schema.prisma`, `src/app/api/photo-consents/route.ts`, `photo-consent-card.tsx`         |
| 3   | U18-Flow: Dokument als `Bytes`-Upload, aber **kein** Ausdruck, **kein** Kamera-Foto (nur Datei-Upload) und **keine** strukturierte Angabe, was angekreuzt wurde. „Später nachreichen“ existiert nur im Onboarding (`skipDocument`), nicht als eigenständige Pflege im Profil.                             | `photo-consent-card.tsx`, `src/components/onboarding/onboarding-wizard.tsx`              |
| 4   | **Keine Versionshistorie.** `PhotoConsent` ist ein Datensatz je `(userId, showId)`. Eine Änderung nach Freigabe überschreibt Dokument/Unterschrift; frühere Stände sind nicht nachvollziehbar.                                                                                                            | `schema.prisma`, `photo-consent-card.tsx` (`handleStartEditing`)                         |
| 5   | Reset (Verwaltung) setzt nur `status = pending`; das eingereichte Dokument und die Unterschrift bleiben stehen. „Abgegebenes Dokument entfernen“ ist nicht möglich.                                                                                                                                       | `src/app/api/photo-consents/admin/route.ts` (Aktion `reset`)                             |
| 6   | Ablehnung durch die Verwaltung setzt `rejected` + `rejectionReason`. Für das Mitglied ist das nur ein kompakter Hinweis; einen eigenen, sofort wirksamen Zustand „keine Aufnahmen“ gibt es nicht.                                                                                                         | `photo-consent-card.tsx`, `admin/route.ts`                                               |
| 7   | Verwaltungs-UI ist veraltet: `window.prompt` für den Ablehnungsgrund (AGENTS.md verbietet `window.confirm`/`window.prompt`), kein `PageHeader`, kein `SectionNav`, eigener Kartenaufbau, orange Struktur-Akzente (`border-primary/25 bg-primary/5` am „Aktualisieren“-Block) verletzen die Surface-Regel. | `src/components/members/photo-consent-admin-panel.tsx`                                   |
| 8   | Alters-/Summary-Logik ist mehrfach dupliziert: `calculateAge`/`requiresDocument`/`buildSummary` in `photo-consents/route.ts`, `photo-consent-summary.ts`, `produktionen/photo-consent-overview.ts` und `photo-consents/admin/route.ts`. Keine zentrale Quelle.                                            | `src/lib/photo-consent-summary.ts`, `src/app/api/photo-consents/*`                       |
| 9   | Das Blanko-„Elternformular hochladen“ (`parental-template`) passt nicht mehr zu strukturierten, konfigurierbaren Punkten; der Ausdruck soll aus den Punkten erzeugt werden.                                                                                                                               | `photo-consent-admin-panel.tsx`, `src/app/api/photo-consents/parental-template`          |
| 10  | `PhotoConsentStatus` kennt nur `pending                                                                                                                                                                                                                                                                   | approved                                                                                 | rejected`; ein Zustand für „keine Aufnahmen“ fehlt. | `prisma/schema.prisma` |
| 11  | Onboarding speichert die Fotoerlaubnis als Boolean (`photoConsent: z.boolean()` in `onboarding/update`); die strukturierten Punkte müssen dort ebenfalls ankommen.                                                                                                                                        | `src/app/api/onboarding/update/route.ts`, `onboarding-wizard.tsx`                        |

## PDF-Vorlagen (Quelle der Punkte)

**Ü18 – „Von mir dürfen Aufnahmen … gemacht werden“:**

1. private Foto- und Filmaufnahmen (Verwendung innerhalb der Gruppe)
2. Aufnahmen für Programmheft/Flyer oder für Werbezwecke z. B. auf dem Instagram-Account des Theaters bzw. Schule
3. Aufnahmen für Programmheft/Flyer oder für Werbezwecke z. B. auf dem Instagram-Account des Theaters bzw. Schule **mit Einverständnis auf Nachfrage**
4. gar nicht

**U18 – „Von meinem Kind dürfen Aufnahmen … gemacht werden“:**

1. private Foto- und Filmaufnahmen (Verwendung innerhalb der Gruppe)
2. Aufnahmen für Programmheft/Flyer oder für Werbezwecke z. B. auf dem Instagram-Account des Theaters bzw. Schule
3. gar nicht

## Zielbild

### Datenmodell

```
PhotoConsentPurpose            Katalog der ankreuzbaren Punkte, pro Produktion.
  id, showId? (null = globaler Standard, pro Produktion überschreibbar)
  code            eindeutiger Schlüssel (z. B. "internal", "promo", "promo_on_request", "none")
  label, description
  sortOrder
  appliesTo       "adult" | "minor" | "both"   // Punkt 3 "mit Nachfrage" nur für Volljährige
  isRefusal       bool                          // "gar nicht": exklusiv, deaktiviert alle anderen
  active          bool

PhotoConsent (Kopf, bleibt je (userId, showId) eindeutig)
  status          pending | approved | rejected | noPhotos
  // consentGiven entfällt, exclusionNote bleibt als optionaler Zusatz-Freitext erhalten
  // Dokument/Unterschrift wandern in die Versionen (aktueller Stand zusätzlich am Kopf lesbar)

PhotoConsentChoice             angekreuzte Punkte einer Einreichung
  consentId, purposeId, chosen  // alle angefragten Punkte mit chosen: true/false für Nachvollziehbarkeit

PhotoConsentVersion            Versionshistorie (eine Zeile je Einreichung/Änderung)
  consentId, version           fortlaufend
  purposesSnapshot Json        Snapshot der gewählten Punkte zum Zeitpunkt der Einreichung
  documentName/Mime/Size/Data  Nachweis (PDF/JPG/PNG) – je Version archiviert
  signatureVersion/Payload     digitale Unterschrift
  submittedAt, submittedById, source ("onboarding" | "member" | "admin")
```

- **`noPhotos`** ist der Zustand für „gar nicht“: sofort wirksam, ohne Verwaltungs-Freigabe, ohne Grundpflicht.
- **`rejected`** bleibt der Verwaltungs-Zustand „Formular/Nachweis nicht in Ordnung“ (mit Begründung).
- Migration überführt Bestandsdaten: `consentGiven = false` → `noPhotos`; bestehende Dokumente/Unterschriften → Version 1; `exclusionNote` bleibt am Kopf erhalten.

### Rechte

- Verwaltung und Katalog-Pflege laufen weiter über `PRIVATE.ADMIN.PHOTOCONSENT.MANAGE` – kein neues Recht nötig.
- Mitglieder sehen und ändern nur ihre eigene Einwilligung (wie bisher über die Session).
- Kein neuer Permission-Key, damit keine Registrierung in `DEFAULT_PERMISSION_DEFINITIONS` erforderlich.

### Oberflächen (mobil zuerst)

**A. Mitglied (Profil, `PhotoConsentCard` neu):**

- Strukturierte Punkte als Checkbox-Liste (Mehrfachauswahl); „gar nicht“ exklusiv.
- „gar nicht“ gewählt → eigener Zustand „keine Aufnahmen“ statt Formular.
- Drucken: Browser-Druckansicht, die aus den konfigurierten Punkten ein unterschreibbares Formular erzeugt (U18: Elternformular-Variante).
- Nachweis: Kamera-Foto **oder** Datei-Upload; vor der Abgabe strukturierte Angabe der angekreuzten Punkte.
- Nach Freigabe änderbar (neue Unterschrift/Dokument) → erzeugt eine neue Version und geht erneut in Prüfung.
- Verlauf (Versionshistorie) einsehbar.

**B. Verwaltung (`/mitglieder/fotoerlaubnisse` neu):**

- `PageHeader` + `SectionNav` mit zwei Bereichen: **Einwilligungen** und **Zwecke**.
- Werkzeugzeile: Suche links, primäre Aktionen rechts; Status-Filter als `SegmentedControl` oder Pills (kein horizontales Scrollen).
- Karten/Badges mit semantischen Tokens (success/warning/destructive/muted), keine orange Struktur-Akzente.
- Ablehnung mit Begründung über `ModalFormDialog`/`ConfirmDialog` statt `window.prompt`; Reset entfernt das eingereichte Dokument (mit Bestätigung).
- **Zwecke**-Bereich: Katalog der Punkte je Produktion anlegen, bearbeiten, sortieren, deaktivieren.

## Integration

- Onboarding-Wizard und Rückkehrer-Wizard auf die strukturierten Punkte umstellen (statt `photoConsent: { consent, skipDocument }`).
- `onboarding/update` und `onboarding/complete` validieren die neue Struktur per `zod`.
- Datenportal-Quelle „Fotoerlaubnisse“ (`src/lib/datenportal/`) um die gewählten Zwecke erweitern.
- Benachrichtigungen (`photo-consent-notifications`) um den Zustand `noPhotos` und Versionsänderungen ergänzen.
- `docs/datenmodell.md` neu erzeugen (Gruppe „Produktionen & Mitgliedschaft“ in `scripts/gen-datamodel-doc.py` bleibt, Modelle `PhotoConsentPurpose/Choice/Version` ergänzen).

## Phasen

1. **Phase 0 – Datenmodell & Migration:** `PhotoConsentPurpose`, `PhotoConsentChoice`, `PhotoConsentVersion`, Enum `noPhotos`, Kopf-Felder bereinigen. Migration idempotent schreiben, Bestandsdaten überführen (`consentGiven=false` → `noPhotos`, Dokumente → Version 1). `pnpm prisma:generate`, `docs/datenmodell.md` neu erzeugen.
2. **Phase 1 – Zentrale Logik:** Alters-/Summary-/Zweck-Logik in `src/lib/photo-consent/` bündeln, Duplikate (`route.ts`, `photo-consent-summary.ts`, `photo-consent-overview.ts`, admin) auflösen. Server-Action-Helper außerhalb von `app/`.
3. **Phase 2 – Server-Routen:** `GET/POST /api/photo-consents` auf Punkte + Versionierung; `PATCH /api/photo-consents/admin` um `reset` mit Dokument-Entfernen und `noPhotos`-Behandlung erweitern; Export (CSV) um Zwecke ergänzen; `onboarding/update|complete` anpassen.
4. **Phase 3 – Mitglieds-UI:** `PhotoConsentCard` neu (Punkte, „gar nicht“, Druck, Kamera/Upload, Versionsanzeige, Nachreichen).
5. **Phase 4 – Onboarding:** Fotoerlaubnis-Schritt auf Punkte umstellen; Ausdruck für U18; „später nachreichen“ beibehalten; ohne Abgabe fortsetzbar.
6. **Phase 5 – Verwaltungs-UI:** `PhotoConsentAdminPanel` neu nach Seiten-Muster (`PageHeader`, `SectionNav`, Werkzeugzeile, Cards); Zwecke-Verwaltung; Dialoge statt `window.prompt`.
7. **Phase 6 – Qualität & Doku:** Unit-/Integrationstests (inkl. `tests/integration/06-photo-consent.it.test.ts`), E2E (`e2e/responsive-overflow.spec.ts` bleibt grün), Benachrichtigungen, Doku (`docs/seiten/verwaltung.md`, `profil.md`, `onboarding.md`, `datenportal.md`), visuelle Pflichtprüfung mit Screenshots (Handy/Tablet/Desktop, hell/dunkel).

## Entscheidungen (2026-09-30)

- E1: Strukturierte Punkte in eigenen Tabellen; Katalog pro Produktion (`showId` nullable = globaler Standard, pro Produktion überschreibbar).
- E2: Auswahlmodus Mehrfachauswahl; „gar nicht“ exklusiv (`isRefusal`) und deaktiviert alle anderen.
- E3: „gar nicht“ wird eigener Zustand `noPhotos` – sofort wirksam, ohne Verwaltungs-Freigabe, ohne Grundpflicht.
- E4: Versionshistorie (`PhotoConsentVersion`); jede Einreichung/Änderung wird archiviert.
- E5: U18-Nachweis als Kamera-Foto **und** Datei-Upload; vor der Abgabe strukturierte Angabe der angekreuzten Punkte.
- E6: Reset entfernt das eingereichte Dokument (mit Bestätigung); Ablehnungsgrund über Dialog statt `window.prompt`.
- E7: Druck als Browser-Druckansicht aus den konfigurierten Punkten; `exclusionNote` bleibt als optionaler Zusatz-Freitext erhalten.

## Checkliste

- [ ] Phase 0 – Datenmodell & Migration
- [ ] Phase 1 – Zentrale Logik
- [ ] Phase 2 – Server-Routen
- [ ] Phase 3 – Mitglieds-UI
- [ ] Phase 4 – Onboarding
- [ ] Phase 5 – Verwaltungs-UI
- [ ] Phase 6 – Qualität & Doku
