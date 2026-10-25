# Logo Sommertheater – Analyse, Konzept, Vektorisierung

Arbeitsordner für die Überarbeitung des Logos (Vorhang mit Katze, darum der Ring).
Ziel: saubere Konstruktion (Raster, Symmetrien, Farben) festlegen und dann final vektorisieren.

Stand: 2026-10-25 – Konzeptblatt 1 fertig, Entscheidungen offen.

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

## Offene Entscheidungen

1. Ring: BSZ-Maße und -Farben 1:1 übernehmen (Empfehlung) oder eigenes 2u-Raster (5–9 % kräftiger)?
2. Segmente: BSZ-Winkel mit Braun 34,5° (Empfehlung) oder fünf gleiche Segmente?
3. Vorhang: eine Hälfte zeichnen und spiegeln oder Handzeichnungs-Charakter behalten?
4. Katze: Position und Silhouette übernehmen oder auf die Achse setzen?
5. Varianten: einfarbig/negativ, Favicon ohne Dielen und Falten?
6. Nutzung des BSZ-Rings (eingetragene Marke) mit dem BSZ abstimmen, falls nicht schon geschehen.

## Nächste Schritte

1. Konzeptblatt 2: technische Zeichnung/Logogrid nach den Entscheidungen, BSZ-Ring und Sommertheater-Ring übereinander
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
node skripte/p.cjs "$(dirname "$(node -p 'require.resolve("playwright/package.json")')")"   # konzeptblatt-1.png/.pdf
```

Hinweis zu `ring.py`: Beim Sommertheater-Logo stört der schwarze Rahmen den Fit des Innenrands. Für die Ringbreite die Werte aus der Tabelle oben nehmen (r = 405–457).
