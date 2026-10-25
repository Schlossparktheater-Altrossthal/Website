"""Vektor-Rohfassung des Gesamtlogos → konzept/rohfassung/logo-roh.svg

Ring und Rahmen aus der Konstruktion (ring_geometry.py), R = 456 im 1024er-Raster, Mitte 512|512.
Vorhang: aus wenigen Bézierkurven konstruiert (vorhang.py), Seitenvorhang an x = 512 gespiegelt.
Bühnenboden: konstruiert, Bühnenkante + gleichmäßige Dielen.
Katze: Stufe 1 (konzept/katze/stufe-1-nachgezeichnet.svg).
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
# weißer Saum als Sichel: läuft rechts spitz aus, links breit (4 px), endet unten an der Bodenfläche
TAIL_SAUM = (TAIL_UPPER + 'L511.5,715C512.5,696 526.5,682.5 545,680C569,677.5 594,672.5 608,669.5Z')
TAIL = (TAIL_UPPER.replace('M608,669.5', 'M624,646L608,669.5') +
        'C516,730 527,737 537,736.5C549,736 557,731 557,724C557,720 549,714 544,711.5'
        'C560,709 590,708 606,704C617,701 625,696 630,688L637.5,674C637.5,664 629,652 624,648Z')

valance, side, log = vorhang.build(RED, FOLD)
cat = open(os.path.join(here, '..', 'konzept', 'katze', 'stufe-1-nachgezeichnet.svg')).read()
cat = re.findall(r'<path[^>]*/>', cat)[0]       # nur der Körper, der Schwanz wird neu konstruiert
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
<g id="katze" fill="{BLACK}">{cat}
  <path d="{TAIL_SAUM}" fill="#fff" clip-path="url(#ueber-kante)"/>
  <path d="{TAIL}"/></g>
</svg>'''
open(os.path.join(OUT, 'logo-roh.svg'), 'w').write(svg)
for name, err in log:
    print(f'{name:22s} max. Abweichung {err:4.1f} px')
