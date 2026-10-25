"""Vektor-Rohfassung des Gesamtlogos → konzept/rohfassung/logo-roh.svg

Ring und Rahmen aus der Konstruktion (ring_geometry.py), R = 456 im 1024er-Raster, Mitte 512|512.
Vorhang: linke Hälfte aus dem Original nachgezeichnet (Vorhangrot und Falten getrennt) und an x = 512 gespiegelt.
Bühnenboden: konstruiert, Bühnenkante + gleichmäßige Dielen.
Katze: Stufe 1 (konzept/katze/stufe-1-nachgezeichnet.svg).
"""
import os, re
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import morphology
import ring_geometry as rg
from cat_levels import path  # gleiche Glättung wie bei der Katze

here = os.path.dirname(__file__)
SRC = os.path.join(here, '..', 'quellen', 'sommertheater-logo-1024.png')
OUT = os.path.join(here, '..', 'konzept', 'rohfassung'); os.makedirs(OUT, exist_ok=True)

C, R = 512, 456
F_IN, F_OUT = 0.750 * R, 0.794 * R            # schwarzer Rahmen
RED, FOLD, FLOOR, BLACK = '#E84820', '#A00A0A', '#C07A30', '#171717'
EDGE = (676, 698)                            # Bühnenkante (gemessen 676–698)
PLANK_W, PLANK_PITCH = 8, 36                 # Dielenfugen gleichmäßig, Original 730/765/802 ungleich

a = np.array(Image.open(SRC).convert('RGBA')).astype(int)
r, g, b, al = (a[..., i] for i in range(4))
yy, xx = np.mgrid[:1024, :1024]
rad = np.hypot(xx - C, yy - C)
fold = (al > 128) & (r > 120) & (g < 45) & (b < 45)
red = (al > 128) & (r > 190) & (g > 45) & (g < 120) & (b < 80)
cloth = ndi.binary_closing(red | fold, morphology.disk(2))
cloth = ndi.binary_opening(cloth, morphology.disk(2))
# Vorhang unter den Rahmen verlängern, damit die Kante später exakt der Rahmenkreis ist
cloth |= ndi.binary_dilation(cloth, morphology.disk(14)) & (rad > F_IN - 8) & (yy < 640)
cloth = ndi.binary_fill_holes(cloth)
cloth &= ~((yy > 790) & (rad > F_IN - 30))       # Antialiasing-Saum am unteren Rahmen weg
half = xx <= C + 3
def clean(m, s):
    return ndi.gaussian_filter((m & half).astype(float), s) > 0.5
cloth_d = path(clean(cloth, 1.5), 1.2)
fold_d = path(clean(ndi.binary_opening(fold, morphology.disk(1)), 1.2), 1.0)

cat = open(os.path.join(here, '..', 'konzept', 'katze', 'stufe-1-nachgezeichnet.svg')).read()
cat = ''.join(re.findall(r'<path[^>]*/>', cat))

planks = ''.join(f'<rect x="0" y="{y}" width="1024" height="{PLANK_W}"/>'
                 for y in range(EDGE[1] + PLANK_PITCH - PLANK_W // 2, int(C + F_IN), PLANK_PITCH))
mirror = 'matrix(-1 0 0 1 1024 0)'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<!-- Rohfassung, erzeugt von skripte/rohfassung.py -->
<defs>
  <clipPath id="buehne"><circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}"/></clipPath>
  <g id="vorhang"><path fill="{RED}" d="{cloth_d}"/><path fill="{FOLD}" d="{fold_d}"/></g>
</defs>
<g id="ring">{''.join(rg.svg_paths(C, C, R))}</g>
<g clip-path="url(#buehne)">
  <circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}" fill="#fff"/>
  <g id="boden"><rect x="0" y="{EDGE[0]}" width="1024" height="400" fill="{FLOOR}"/>
    <rect x="0" y="{EDGE[0]}" width="1024" height="{EDGE[1] - EDGE[0]}" fill="{BLACK}"/>
    <g fill="#4A2E12">{planks}</g></g>
  <use href="#vorhang"/><use href="#vorhang" transform="{mirror}"/>
</g>
<circle id="rahmen" cx="{C}" cy="{C}" r="{(F_IN + F_OUT) / 2:.1f}" fill="none" stroke="{BLACK}" stroke-width="{F_OUT - F_IN:.1f}"/>
<g id="katze" fill="{BLACK}">{cat}</g>
</svg>'''
open(os.path.join(OUT, 'logo-roh.svg'), 'w').write(svg)
print('logo-roh.svg', len(svg) // 1024, 'KB')
