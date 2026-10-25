# Logo Sommertheater – Analyse, Konzept, Vektorisierung

Arbeitsordner für die Überarbeitung des Logos (Vorhang mit Katze, darum der Ring).
Ziel: saubere Konstruktion (Raster, Symmetrien, Farben) festlegen und dann final vektorisieren.

Stand: 2026-10-25 – Konzeptblatt 1 und 2 fertig, Katzen-Vereinfachung im Test, nächster Schritt Entscheidung Katzenstufen, dann Vektor-Rohfassung.

## Ordner

| Pfad | Inhalt |
|---|---|
| `quellen/sommertheater-logo-1024.png` | Beste verfügbare Fassung (1024×1024, transparent). Dieselbe Datei wie `public/Logo-Sommertheater.png`. Die Website nutzt nur eine 192-px-Kopie. Eine Vektor-Urfassung gibt es nicht. |
| `quellen/bsz-agrar-logo.png` | Logo des BSZ für Agrarwirtschaft und Ernährung Dresden (4178×772, DPMA-Eintragung). Von dort stammt der Ring. |
| `konzept/konzeptblatt-1.{png,pdf}` | Konzeptblatt 1: Ist-Messung, Rastervorschlag, Spiegelprobe, offene Fragen |
| `konzept/konzept.html` | Quelle des Konzeptblatts (bindet die SVGs und PNGs aus `konzept/` ein) |
| `konzept/A-messung.svg` | Messung über dem Original (Bild eingebettet) |
| `konzept/B-konstruktion.svg` | Rastervorschlag mit u = 1/48 |
| `konzept/spiegel-check.png` | Original + gespiegelt, 50/50 überblendet |
| `konzept/konzeptblatt-2.{png,pdf}` | Konzeptblatt 2: Ring nach BSZ über dem jetzigen Logo, technische Zeichnung, Prüfung, Variantenskizzen |
| `konzept/konzept-2.html` | Quelle von Konzeptblatt 2 |
| `konzept/A2-ring-ueberlagerung.svg` | Neuer Ring (rot) über dem jetzigen Logo |
| `konzept/B2-technische-zeichnung.svg` | Logogrid/technische Zeichnung mit Maßen in R |
| `konzept/ring-bsz-abgleich.png` | Konstruktion gegen BSZ-Original (96 % Deckung, Rest Randpixel) |
| `konzept/katze/stufe-*.svg` | Katze in 4 Vereinfachungsstufen (Füllung `currentColor`) |
| `konzept/katze/groessentest.png` | Alle Stufen in 4 Icon-Aufbauten bei 16–64 px, pixelgenau ×4 vergrößert |
| `konzept/icons/*.svg` | Icon-Satz mit Symbol 3a: Favicon rot/blau, App-Icon (maskable), Statusleiste, Symbol schwarz |
| `skripte/` | Mess- und Erzeugungsskripte, siehe unten |

## Messergebnisse

### Sommertheater-Logo (1024 px)

- Mitte ≈ (512 | 513). Ring r = 405–457, schwarzer Rahmen r = 342–362.
- Segmente oben: 28,6° / 31,1° / 38,4° (Braun) / 31,3° / 28,7°.
- Fugen sind parallel (innen und außen ≈ 38 px breit), die waagerechte Fuge ≈ 37–42 px.
- Die waagerechte Fuge liegt 0,02 R unterhalb der Mitte.
- Vorhang und Schabracke sind nahezu spiegelsymmetrisch, die Falten leicht versetzt. Die Katze ist bewusst asymmetrisch.
- Bühnenboden: 4 Dielenstreifen mit ungleichen Abständen.
- Wirkt KI-generiert: weiche Kanten, Kreise ~1 px versetzt, blauer Bogen innen leicht unrund.

### Vergleich Ring BSZ ↔ Sommertheater

Maße relativ zum Außenradius R des Rings.

| | BSZ | Sommertheater |
|---|---|---|
| Ringbreite | 0,109 R | 0,114 R |
| Fuge zwischen Segmenten | 0,077 R (parallel) | 0,084 R (parallel) |
| Waagerechte Fuge | 0,074 R | 0,082 R |
| Versatz der Fuge unter die Mitte | 0,020 R | 0,020 R |
| Gelb / Ocker / Braun / Dunkelgrün / Grün | 30,3° / 32,0° / 34,5° / 31,8° / 30,2° | 28,5° / 30,4° / 37–38° / 30,2° / ≈28,5° |
| Blauer Bogen | 173° | 172° |

| Farbe | BSZ | Sommertheater |
|---|---|---|
| Blau | `#004D6B` | `#054F6C` |
| Gelb | `#FFDD00` | `#FFD401` |
| Ocker | `#C7A100` | `#C39317` |
| Braun | `#744A27` | `#72492D` |
| Dunkelgrün | `#015824` | `#0F693E` |
| Grün | `#09783A` | `#008D4B` |

Weitere Farben im Logo (gemessen): Vorhang `#E84820`, Falten `#A00A0A`, Boden `#C07A30`, Rahmen/Katze `#171717`.

## Entscheidungen (2026-10-25)

1. **Ring:** Maße und Farben 1:1 vom BSZ übernehmen. Die Nutzung ist mit dem BSZ abgestimmt.
2. **Segmente:** BSZ-Winkel 30,5° / 31,9° / 34,4° / 31,9° / 30,5°.
3. **Vorhang:** eine Hälfte nachzeichnen und spiegeln.
4. **Katze:** Position (leicht rechts, Blick nach links) und Pose bleiben, nur der Umriss wird geglättet.
5. **Varianten:** Vollfarbe, Einfarbig, Negativ (weiß auf BSZ-Blau), Favicon/App-Icon und ein Statusleisten-Icon für Benachrichtigungen (weiße Katzen-Silhouette, Android 24 dp).

## Konstruktion Ring (`skripte/ring_geometry.py`)

Alle Maße relativ zum Außenradius R. Im 1024er-Raster ist R = 456 px, die Mitte liegt bei 512|512.

| Maß | Wert |
|---|---|
| Innenradius Ring | 0,8909 R |
| Fugen oben (parallele Kanten) | 0,0772 R, Mittellinien bei ±19,56° und ±56,14° zur Senkrechten |
| Waagerechte Fuge | 0,0738 R, Mitte 0,0201 R unter dem Kreismittelpunkt |
| Schwarzer Rahmen | 0,750–0,794 R (aus dem Original übernommen) |
| Bühnenbild | innerhalb 0,750 R |
| Farben | `#FFDD00` `#C7A100` `#744A27` `#015824` `#09783A` `#004D6B` |

Hinweise aus den Variantenskizzen:
- In Einfarbig und Negativ wirkt die Katze allein klein im großen Kreis. Beim Ausarbeiten prüfen, ob dort Bühnenkante oder Vorhang-Umriss mit hinein sollen.
- Bei 16 px ist die Katze nicht mehr erkennbar. Eventuell braucht es eine eigene 16-px-Fassung (nur Ring + Fläche).

## Katze in kleinen Größen (2026-10-25)

Problem: Im Favicon wirkt die Katze verschmiert. Zwei Ursachen:
1. Sie ist zu klein. Mit Ring und Rahmen bleiben ihr nur ~40 % der Höhe, bei 32 px also ~13 px.
2. Sie hat zu feine Details: weißer Spalt zwischen Bein und Bauch (2–3 px im Original), zwei dünne Ohren, kleine Pfoten, dünner Schwanzkringel.

Stufen (`konzept/katze/`):

| Stufe | Inhalt |
|---|---|
| 1 nachgezeichnet | wie im Logo, geglättet |
| 2 reduziert | Spalt gefüllt, ein Ohr, Pfoten verschmolzen, Schwanz dicker |
| 3 geometrisch | glatte Profil-Silhouette, große Ohren, Schwanz vorn mit Lücke (wie der Glanzstrich im Original) |
| 3a Symbol Haken | eigenständiges Symbol auf 24er-Raster, Schwanz hinten als Haken |
| 3b Symbol vorn | eigenständiges Symbol auf 24er-Raster, Schwanz vorn um die Pfoten (näher am Original) |
| 4 Kopf | nur Kopf mit Ohren |

Ergebnis des Größentests (`groessentest.png`):
- **Aufbau A (Ring + Rahmen + Katze):** Unter 48 px ist die Katze in keiner Stufe erkennbar, der Ring dominiert. Nur für ≥ 64 px sinnvoll.
- **Aufbau B/C (ohne Ring, Katze groß):** Stufe 3 ist ab 24 px klar erkennbar, Stufe 1/2 erst ab 48 px.
- **16 px:** Nur Stufe 3 und 4 bleiben als Katze lesbar. Der Schwanz von Stufe 3 verschwindet dabei.
- **Statusleiste:** Stufe 3 ist am besten, Stufe 2 ab 32 px brauchbar.
- Stufe 4 (Kopf) wirkt generisch („irgendeine Katze“) und verliert die Verbindung zum Logo.

Vorschlag Größensystem:

| Größe / Einsatz | Fassung |
|---|---|
| ≥ 128 px, Druck, Website-Kopf | volles Logo, Katze Stufe 1 |
| 48–96 px (App-Icon, PWA) | ohne Ring, Rahmen + Vorhangrot oder BSZ-Blau, Katze Stufe 2 oder 3 |
| 16–32 px (Favicon) | ohne Ring, Katze Stufe 3 möglichst groß |
| Statusleiste (24 dp) | Stufe 3 weiß |

Schwanzansatz (2026-10-25 korrigiert): Im Original wächst der Schwanz unten rechts aus der Hüfte und läuft vor der Bühnenkante nach links. Die Hüftwölbung ist schon der Schwanzansatz.
- Stufe 1/2: Hüftwölbung aus dem Körper geschnitten. Die Außenkante des Schwanzes setzt tangential am senkrechten Hüftrand an (x ≈ 623–625) und überlappt mit dem Körper. Der Schwanz ist ein eigenes `<path>`-Element, damit die Überlappung kein Loch ergibt.
- Stufe 3: Schwanz läuft wie im Original vorn unter der Katze, mit schmaler Lücke zum Körper.
- Die Kurvenglättung (Catmull-Rom) begrenzt die Tangentenlänge auf ⅓ der Segmentlänge, sonst entstehen an langen Geraden Dorne.
- In kleinen Größen (≤ 32 px) wird die Lücke bei Stufe 3 zu einem hellen Strich. Für Favicon/Statusleiste sollte sie entfallen.

Symbol-Varianten 3a/3b (2026-10-25, Entscheidung: Stufe 3 darf eigenständig und symbolhaft sein):
- Gezeichnet auf einem 24er-Raster wie Material-/Android-Icons. Formen ≥ 1,5–2 Einheiten, Ohren mit klarer Kerbe, Profil-Schnauze nach links, eindeutiger Schwanz.
- Beide sind ab 16 px als Katze erkennbar, auf Weiß und als weiße Silhouette.
- 3a: Der Schwanz-Haken bleibt bis 16 px klar getrennt, die Silhouette ist am stärksten.
- 3b: näher am Logo (Schwanz vorn). Bei 16 px verschmilzt der Schwanz aber mit dem Sockel.
- Im Größentest sitzen 3a/3b in den Kreisen etwas tief und links, weil die Platzierung noch für die hohen Stufen 1–3 eingestellt ist. Beim Ausarbeiten optisch zentrieren.

**Entscheidung 2026-10-25: Symbol 3a** für Favicon, App-Icon und Statusleiste.
- Feinschliff: Sockel, Brust und Schwanz liegen auf ganzen Rasterwerten, damit das Symbol bei 24 px scharf ist (vorher lagen die Schwanzkanten auf x,5).
- Optische Mitte (12,0 | 12,5) im 24er-Raster = Mittelwert aus Flächenschwerpunkt und Mitte der Umrandung, siehe `skripte/icons.py`.
- Icon-Satz in `konzept/icons/`: `favicon-rot` (Rahmen + Vorhangrot, schwarze Katze), `favicon-blau` (BSZ-Blau, weiße Katze), `app-icon-maskable` (Vollfläche, Motiv in der sicheren Zone), `statusleiste` (weiß, nur Alpha zählt), `symbol-schwarz`.
- Bei 16 px liest sich `favicon-blau` am klarsten (höchster Kontrast). Bei `favicon-rot` wird der schwarze Rahmen bei 16 px weich.

Offen (ältere Notiz zu Stufe 3): Stufe 3 weiter ausarbeiten (Schwanz für 16 px kräftiger, Ohr-Kerbe klarer, Brust/Vorderpfote) und abstimmen, wie nah sie am Original bleiben soll.

## Nächste Schritte

1. ~~Konzeptblatt 2~~ – erledigt 2026-10-25
2. Vektor-Rohfassung: Ring und Rahmen konstruiert, Vorhang/Katze/Boden nachgezeichnet
3. Abgleich mit dem Original, Feinschliff
4. Export: SVG (Haupt), einfarbig/negativ, Favicon, PNG-Größen; Austausch in Mitgliederbereich und Drupal-Theme

## Skripte

Python mit Pillow, NumPy und scikit-image (z. B. in einer venv). Das Rendern nutzt das Playwright aus dem Mitgliederbereich.

```bash
python -I skripte/analyze.py quellen/sommertheater-logo-1024.png        # Farben, Kreis-Fits je Segment
python -I skripte/ring.py quellen/bsz-agrar-logo.png 0,0,772,772         # Ring: Radien, Segmentwinkel, Farben (Crop optional)
python -I skripte/ring.py quellen/sommertheater-logo-1024.png
python -I skripte/gaps.py quellen/bsz-agrar-logo.png 0,0,772,772 415.5 395.5 297.9 265.4   # Fugenbreite innen/mitte/außen
python -I skripte/gaps.py quellen/sommertheater-logo-1024.png - 512 513 457 405
python -I skripte/mirror.py                                              # konzept/spiegel-check.png
python -I skripte/sheet.py                                               # konzept/A-messung.svg, B-konstruktion.svg
python -I skripte/ring_geometry.py                                       # Segmentwinkel der Konstruktion
python -I skripte/verify_ring.py                                         # konzept/ring-bsz-abgleich.png + Deckung
python -I skripte/sheet2.py                                              # Konzeptblatt-2-SVGs + konzept-2.html
python -I skripte/cat_levels.py                                          # konzept/katze/stufe-*.svg (Stufe 1–3, 4)
python -I skripte/icons.py                                               # konzept/icons/*.svg mit Symbol 3a
python -I skripte/size_test.py && node skripte/size_test.cjs "$PW" && python -I skripte/size_sheet.py   # groessentest.png
PW="$(dirname "$(node -p 'require.resolve("playwright/package.json")')")"
node skripte/p.cjs "$PW"                                                 # konzeptblatt-1.png/.pdf
node skripte/p.cjs "$PW" konzept/konzept-2.html konzept/konzeptblatt-2   # konzeptblatt-2.png/.pdf
```

Hinweis zu `ring.py`: Beim Sommertheater-Logo stört der schwarze Rahmen den Fit des Innenrands. Für die Ringbreite die Werte aus der Tabelle oben nehmen (r = 405–457).
