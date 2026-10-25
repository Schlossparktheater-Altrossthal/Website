"""Vektor-Rohfassung des Gesamtlogos → konzept/rohfassung/logo-roh.svg

Ring und Rahmen aus der Konstruktion (ring_geometry.py), R = 456 im 1024er-Raster, Mitte 512|512.
Vorhang: aus wenigen Bézierkurven konstruiert (vorhang.py), Seitenvorhang an x = 512 gespiegelt.
Bühnenboden: konstruiert, Bühnenkante + gleichmäßige Dielen.
Katze: eine Kontur aus Körper Stufe 1 (konzept/katze/stufe-1-nachgezeichnet.svg) und konstruiertem Schwanz.
"""
import os, re
import ring_geometry as rg
import vorhang

here = os.path.dirname(__file__)
OUT = os.path.join(here, '..', 'konzept', 'rohfassung'); os.makedirs(OUT, exist_ok=True)

C, R = 512, 456
F_IN, F_OUT = 0.750 * R, 0.794 * R            # schwarzer Rahmen
RED, FOLD, FLOOR, JOINT, BLACK = '#E84820', '#A00A0A', '#D2924D', '#3C1B00', '#171717'   # Boden/Fuge gemessen
EDGE = (673, 698)                            # Bühnenkante (gemessen 674–697), 1 px höher: Pfoten stehen ohne Naht darauf
PLANK_W, PLANK_PITCH, PLANKS = 11, 36, 3     # Fugen 11 px, gleichmäßig (Original 722/760/797 ungleich), nur 3 → kein Splitter am Rahmen
# Schwanz (gemessen 2026-10-25): wächst aus der Hüfte, läuft über die Bühnenkante nach links und wird dünner
# (22 → 14 px), endet in einer runden Locke; von rechts greift eine Kerbe bis (544|711,5) hinein.
# Fläche aus 8 Bézierkurven. Rechts bildet sie die Hüftwölbung = Schwanzansatz: weicher Bogen von (624|647)
# nach außen bis (638|674) auf die Bühnenkante (gemessen). Auf Schwarz trennt ihn ein weißer Saum (nur Oberkante) vom Körper.
TAIL_UPPER = 'M608,669.5C595,677 570,683 546,685C530,688 518,700 517,715'
# weißer Saum als Sichel: rechts spitz, Mitte ~5 px, läuft über die Bühnenkante hinaus und endet spitz an der Locke (517|707)
TAIL_SAUM = (TAIL_UPPER + 'L517.4,707C514,696 526.5,682.5 545,680C569,677.5 594,672.5 608,669.5Z')
# Katze = EINE Kontur aus Körper und Schwanz (2026-10-25): Der Hüftrand geht ohne Naht und mit gleicher Tangente
# in die Außenkante des Schwanzes über, statt dass zwei Flächen sich überlappen. Ab der Saumspitze (608|669,5)
# schließt die Kontur an die Körper-Unterkante (597|673,5) an.
HIP = 'C623.4,647.5 626,650 630,654.5C634,659 637.5,665 637.5,674'   # Hüftwölbung: tangential aus dem senkrechten Hüftrand (623,5|644), ~45° schräg, dann steil auf die Bühnenkante
# Ecke bei (637,5|674) und Gerade bis (630|688) durch einen tangentialen Bogen ersetzt; Unterkante etwas höher → schlanker
TAIL_OUTLINE = (HIP + 'C637.5,690 620,699 601,702C584,704.5 560,708 544,711.5'
                'C549,714 557,720 557,724C557,731 549,736 537,736.5C527,737 516,730 517,715'
                'C518,700 530,688 546,685C570,683 595,677 608,669.5C602,671.5 599,673.4 597,673.5')   # weich in die Unterkante, keine Ecke

valance, side, log = vorhang.build(RED, FOLD)
cat = open(os.path.join(here, '..', 'konzept', 'katze', 'stufe-1-nachgezeichnet.svg')).read()
body = re.findall(r'<path d="([^"]*)"', cat)[0]   # nur der Körper, der Schwanz wird neu konstruiert
# Körper ab der Unterkante (597|673,5) bis zum Hüftrand (623,5|644), dann Schwanz, zurück zur Unterkante
start, hip = body.index('C580.7,674.3'), body.index('C622.9,651.9')
CAT = 'M597,673.5' + body[start:hip] + TAIL_OUTLINE + 'Z'
planks = ''.join(f'<rect x="0" y="{EDGE[1] + 25 + i * PLANK_PITCH}" width="1024" height="{PLANK_W}"/>' for i in range(PLANKS))
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<!-- Rohfassung, erzeugt von skripte/rohfassung.py -->
<defs>
  <clipPath id="ueber-kante"><rect x="0" y="0" width="1024" height="{EDGE[1]}"/></clipPath>
  <clipPath id="buehne"><circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}"/></clipPath>
  <g id="seitenvorhang">{side}</g>
</defs>
<g id="ring">{''.join(rg.svg_paths(C, C, R))}</g>
<g clip-path="url(#buehne)">
  <circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}" fill="#fff"/>
  <g id="boden"><rect x="0" y="{EDGE[0]}" width="1024" height="400" fill="{FLOOR}"/>
    <rect x="0" y="{EDGE[0]}" width="1024" height="{EDGE[1] - EDGE[0]}" fill="{BLACK}"/>
    <g fill="{JOINT}">{planks}</g></g>
  <g id="schabracke">{valance}</g>
  <use href="#seitenvorhang"/><use href="#seitenvorhang" transform="matrix(-1 0 0 1 1024 0)"/>
</g>
<circle id="rahmen" cx="{C}" cy="{C}" r="{(F_IN + F_OUT) / 2:.1f}" fill="none" stroke="{BLACK}" stroke-width="{F_OUT - F_IN:.1f}"/>
<g id="katze"><path d="{CAT}" fill="{BLACK}"/>
  <path d="{TAIL_SAUM}" fill="#fff"/></g>
</svg>'''
open(os.path.join(OUT, 'logo-roh.svg'), 'w').write(svg)
for name, err in log:
    print(f'{name:22s} max. Abweichung {err:4.1f} px')

# Nur die Katze (2026-10-25): dieselbe Kontur, der weiße Saum wird ausgespart (transparent statt weiß),
# damit die Datei auf jedem Hintergrund funktioniert. viewBox = Umriss + 8 px Rand.
cat_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="428 406 218 339">
<!-- Katze allein, erzeugt von skripte/rohfassung.py -->
<defs><mask id="saum"><rect x="0" y="0" width="1024" height="1024" fill="#fff"/><path d="{TAIL_SAUM}" fill="#000"/></mask></defs>
<path d="{CAT}" fill="{BLACK}" mask="url(#saum)"/>
</svg>'''
open(os.path.join(OUT, 'logo-katze.svg'), 'w').write(cat_svg)
