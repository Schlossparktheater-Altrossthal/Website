# WebKit-Überlaufmessung im Mitgliederbereich – Befunde

Stand: 2026-09-29. Ergebnis des Diagnoselaufs aus Phase 1 von
`docs/Plan/handy-responsiveness-plan.md`.

## Anlass

Auf dem iPhone des Nutzers (iPhone 17, kein Display-Zoom) laufen Boxen über den Bildschirmrand
und die Seite wird zeitweise winzig dargestellt – in einem Layout, das zur Breite eines iPad mini
passt. Die vorhandene Prüfung meldete dagegen alle Seiten als überlauffrei.

Ursache der Lücke: Alle Playwright-Projekte, auch das Projekt `mobile`, laufen mit Chromium.
Das betroffene Gerät ist WebKit (Safari). Die Prüfung war also nie mit der Engine unterwegs, in
der der Fehler auftritt.

## Vorgehen

- Neues Playwright-Projekt `mobile-webkit` in `playwright.config.ts`: `browserName: "webkit"`,
  402 × 874, `deviceScaleFactor: 3`, `isMobile`, `hasTouch` – die Maße des gemeldeten Geräts.
- `scripts/ui-check.mjs` um `--browser webkit` erweitert; Viewports `mobile-iphone` (402 × 874)
  und `tablet-mini` (744 × 1133) in `scripts/lib/e2e-session.mjs` ergänzt.
- `e2e/responsive-overflow.spec.ts` um 31 statische Routen, 9 Detail-Routen (ID aus dem ersten
  passenden Link der jeweiligen Übersicht) und eine Befundliste erweitert, die sowohl die
  äußerste überstehende Box als auch den auslösenden Inhalt nennt.

## Ergebnis des Laufs (WebKit, 402 px, hell)

| Route                                            | Befund                                             |
| ------------------------------------------------ | -------------------------------------------------- |
| `/mitglieder/server-analytics`                   | **Überlauf** – Dokument 428 px bei 402 px Viewport |
| alle übrigen 39 geprüften Routen                 | kein Überlauf                                      |
| `/mitglieder/probenplanung/proben/[rehearsalId]` | übersprungen (kein Eintrag im lokalen Datenstand)  |
| `/mitglieder/onboarding/[id]/talente/[userId]`   | übersprungen (kein Eintrag im lokalen Datenstand)  |

Lauf: 42 Tests, 39 grün, 1 rot, 2 übersprungen, 5,5 min. Derselbe Befund kommt auch aus
`pnpm ui:check /mitglieder/server-analytics --browser webkit --viewport mobile-iphone`
(„Überlauf JA (428px > 402px)“) – zwei unabhängige Werkzeuge, eine Zahl.

Die vier Seiten aus den Bildern des Nutzers – Dashboard, Meine Termine, Terminplanung,
Teams & Zuweisung – überlaufen mit dem lokalen Datenstand bei 402 px in WebKit **nicht**.

## Der belegte Mechanismus

Werkzeugliste der Karten in `/mitglieder/server-analytics`
(`server-analytics-content.tsx`):

```
<div className="grid gap-4 lg:grid-cols-2">   ← ohne Basis-Spalte
```

Auf dem Handy entsteht daraus eine einzige implizite `auto`-Spalte. Ihr Basismaß ist der
min-content-Beitrag der Inhalte, und eine `auto`-Spur wird nicht auf die Containerbreite
zurückgestutzt. Der Inhalt einer der Karten ist eine Zeile der Form

```
Kapazität: /Users/alexanderzimmer/Desktop/…
```

Ein langer, nicht umbrechbarer Wert in einer `flex items-center justify-between`-Zeile ohne
`min-w-0`. Sein min-content-Beitrag ist die volle Textbreite und treibt die Spur über den
Container. Gemessen: Karte 412 px breit in einem 402 px breiten Viewport, Dokument 428 px.

Das Muster `grid gap-N <breakpoint>:grid-cols-M` ohne Basis-Spalte steht **117-mal** in `src/**`.
Es ist damit keine Einzelstelle, sondern eine systemische Schwachstelle: Jeder Inhalt mit
großem min-content – ein langer Pfad, eine lange E-Mail-Adresse, ein langer Titel ohne
Leerzeichen, ein `whitespace-nowrap`-Element – reißt den Rasterbereich und damit die Seite auf.

Behebung braucht beide Teile: die Basis-Spalte (`grid-cols-1`, also `minmax(0,1fr)`), damit die
Spur nicht wachsen kann, **und** `min-w-0` plus Umbrechmöglichkeit an der Textstelle, damit der
Inhalt nicht stattdessen aus seiner Box läuft.

## Telemetriebeleg für die Miniatur-Ansicht

Die Anwendung zeichnet in `AnalyticsDeviceSnapshot` die Layout-Breite auf
(`src/hooks/useWebVitals.ts` verwendet `window.innerWidth`, nicht den visuellen Viewport). Im
lokalen Datenstand (Import vom 2026-09-26) finden sich für das iPhone des Nutzers:

| Breite × Höhe  | DPR | Anzahl | Zeitraum   |
| -------------- | --- | ------ | ---------- |
| **804 × 1428** | 3   | 13     | 23.–25.09. |
| **804 × 1508** | 3   | 1      | 24.09.     |
| 402 × 714      | 2   | 2      | 26.09.     |
| 430 × 721      | 3   | 10     | 24.09.     |
| 390 × 844      | 2   | 3      | 24.–25.09. |

804 px ist das Doppelte von 402 px. Bei dieser Breite liegen die `md:`-Stile (768 px) vor, die
`lg:`-Stile (1024 px) nicht – genau die Darstellung aus Bild 5 des Nutzers: großer Kopf mit
Produktionstitel, zweispaltiges Raster, alles halb so groß. Die Aufzeichnungen hängen an
`/login`, `/old`, `/mitglieder`, `/mitglieder/rechte`, `/mitglieder/produktionen`,
`/mitglieder/profil` und `/mitglieder/onboarding`. Der Kopfbereich bestätigt das unabhängig:
`src/components/site-header.tsx` rendert den Website-Titel erst ab `md:`.

Damit ist die Miniatur-Ansicht keine Vermutung mehr, sondern am Gerät belegt: Der Layout-Viewport
war doppelt so breit wie der Bildschirm. Die Breite selbst kann nur etwas vergrößern, das den
Viewport aufreißt – genau deshalb ist der Überlauf die Ursache und nicht eine Nebenwirkung.

## Messfallen

**Gegen einen kalten `next dev` messen erzeugt Fehlbefunde.** Der erste Lauf meldete fünf Seiten
als überlaufend (`/mitglieder`, `/mitglieder/profil`, `/mitglieder/benachrichtigungen`,
`/mitglieder/meine-proben`, `/mitglieder/server-analytics`). Im warmen Lauf waren bei
unverändertem Code und Datenstand vier davon grün. `networkidle` feuert auch dann, wenn die Seite
noch Skeletons zeigt, und Skeletons haben andere Breiten als der fertige Inhalt.

Behoben durch `waitForStableWidth` in `scripts/lib/e2e-session.mjs`: erst Ladezustand, dann zwei
gleichbleibende Messungen der Dokumentbreite hintereinander. `scripts/ui-check.mjs` misst
seitdem genauso; der Ladezustands-Timeout ist auf 3 s begrenzt, weil einzelne Seiten ein
dauerhaftes `animate-pulse` tragen (Statusanzeigen, die kein Skeleton sind).

**Screenshots und Protokolle:** `test-results/` wird von jedem Playwright-Lauf geleert. Logdateien
gehören außerhalb von `test-results/` abgelegt, Belege vor dem nächsten Lauf wegsichern.

## Offene Frage

Mit dem lokalen Datenstand ist nur eine einzige Route betroffen. Die Seiten aus den Bildern des
Nutzers überlaufen hier nicht. Ursachen dafür kommen weiterhin in Frage:

1. Der Datenstand auf Staging weicht ab (längere Werte, mehr Zeilen).
2. Eine der inzwischen entfernten Seiten (`/old`) hat die Layout-Breite gesetzt; die Aufzeichnung
   mit 804 px stammt teils von dort. `/old` ist seit 2026-09-25 entfernt.
3. Ein Inhalt, der nur auf dem Gerät entsteht (z. B. ein sehr langer Produktionstitel oder eine
   lange Terminbezeichnung).

Deshalb bleibt die Reihenfolge des Plans bestehen: erst die systemische Schwachstelle beheben
(Basis-Spalten und umbrechbare lange Werte), dann mit dem Prüfnetz absichern. Ein einzelner
Auslöser lässt sich nicht beheben, ohne die Widerstandsfähigkeit der Vorlagen insgesamt zu
erhöhen.
