"""App-Icon und Benachrichtigungs-Icon aus der Rohfassung → konzept/icons/

Entscheidung 2026-10-25: App-Icon = roter Hintergrund, echte Katze (nicht Symbol 3a), bunter Ring.
Benachrichtigungs-Icon (Android-Statusleiste/Badge) = Katzenkopf, weiß auf transparent (nur Alpha zählt).
Vorher rohfassung.py laufen lassen.
"""
import os, re
here = os.path.dirname(__file__)
ROH = os.path.join(here, '..', 'konzept', 'rohfassung')
OUT = os.path.join(here, '..', 'konzept', 'icons')
logo = open(os.path.join(ROH, 'logo-roh.svg')).read()
RING = re.search(r'<g id="ring">.*?</g>', logo, flags=re.S).group(0)
CAT = re.search(r'<g id="katze"><path d="([^"]*)"', logo).group(1)
HEAD = re.search(r'<path d="([^"]*)"', open(os.path.join(ROH, 'logo-katze-kopf.svg')).read()).group(1)
RED, BLACK = '#E84820', '#171717'
CAT_BOX = (436.4, 415.7, 637.4, 736.4)       # Umriss der Katze (gemessen)

def cat(height, cx=512, cy=512):
    x0, y0, x1, y1 = CAT_BOX; k = height / (y1 - y0)
    tx, ty = cx - (x0 + x1) / 2 * k, cy - (y0 + y1) / 2 * k
    return f'<path transform="translate({tx:.1f} {ty:.1f}) scale({k:.4f})" d="{CAT}" fill="{BLACK}" fill-rule="nonzero"/>'

def icon(ring_scale, cat_height):
    ring = f'<g transform="translate(512 512) scale({ring_scale}) translate(-512 -512)">{RING}</g>'
    return f'<rect width="1024" height="1024" fill="{RED}"/>{ring}{cat(cat_height * ring_scale)}'

icons = {
    # any: Ring fast randlos (R = 456 von 512), iOS/Android runden selbst ab
    'app-icon': icon(1.0, 760),
    # maskable: alles in der sicheren Zone (Kreis r = 0,4 × Kante = 410)
    'app-icon-maskable': icon(0.88, 760),
}
for n, b in icons.items():
    open(os.path.join(OUT, n + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{b}</svg>')
# Kopf: viewBox wie logo-katze-kopf.svg, quadratisch mit etwas Rand
open(os.path.join(OUT, 'benachrichtigung.svg'), 'w').write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="426 404 132 132"><path d="{HEAD}" fill="#fff"/></svg>')
print('geschrieben: app-icon, app-icon-maskable, benachrichtigung')
