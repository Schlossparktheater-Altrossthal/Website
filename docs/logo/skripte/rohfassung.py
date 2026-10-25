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
RED, FOLD, FLOOR, BLACK = '#E84820', '#A00A0A', '#C07A30', '#171717'
EDGE = (676, 698)                            # Bühnenkante (gemessen 676–698)
PLANK_W, PLANK_PITCH = 8, 36                 # Dielenfugen gleichmäßig, Original 730/765/802 ungleich

valance, side, log = vorhang.build(RED, FOLD)
cat = open(os.path.join(here, '..', 'konzept', 'katze', 'stufe-1-nachgezeichnet.svg')).read()
cat = ''.join(re.findall(r'<path[^>]*/>', cat))
planks = ''.join(f'<rect x="0" y="{y}" width="1024" height="{PLANK_W}"/>'
                 for y in range(EDGE[1] + PLANK_PITCH - PLANK_W // 2, int(C + F_IN), PLANK_PITCH))
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<!-- Rohfassung, erzeugt von skripte/rohfassung.py -->
<defs>
  <clipPath id="buehne"><circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}"/></clipPath>
  <g id="seitenvorhang">{side}</g>
</defs>
<g id="ring">{''.join(rg.svg_paths(C, C, R))}</g>
<g clip-path="url(#buehne)">
  <circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}" fill="#fff"/>
  <g id="boden"><rect x="0" y="{EDGE[0]}" width="1024" height="400" fill="{FLOOR}"/>
    <rect x="0" y="{EDGE[0]}" width="1024" height="{EDGE[1] - EDGE[0]}" fill="{BLACK}"/>
    <g fill="#4A2E12">{planks}</g></g>
  <g id="schabracke">{valance}</g>
  <use href="#seitenvorhang"/><use href="#seitenvorhang" transform="matrix(-1 0 0 1 1024 0)"/>
</g>
<circle id="rahmen" cx="{C}" cy="{C}" r="{(F_IN + F_OUT) / 2:.1f}" fill="none" stroke="{BLACK}" stroke-width="{F_OUT - F_IN:.1f}"/>
<g id="katze" fill="{BLACK}">{cat}</g>
</svg>'''
open(os.path.join(OUT, 'logo-roh.svg'), 'w').write(svg)
for name, err in log:
    print(f'{name:22s} max. Abweichung {err:4.1f} px')
