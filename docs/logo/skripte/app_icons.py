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
# Kleinster Kreis um die Katze (gemessen): Mittelpunkt und Radius. Die Katze wird über diesen Kreis zentriert,
# Größe über den Kreis, damit sie überall Luft zum Ring hat.
CAT_CIRCLE = (515.3, 575.8, 162.4)
# Optische Mitte = Mittel aus Kreismitte (515|576) und Umriss-/Flächenmitte (536|578): nur Kreis wirkt nach
# rechts verschoben (Körper schwer), nur Umriss nach links – im Vergleich bei 256 px gewählt.
OPTICAL = (526, 577)
RING_IN = 0.8909 * 456                       # Innenradius des Rings (ring_geometry.R_IN × R)
CLEAR = 52                                   # Luft zwischen Katze und Ring

def cat(radius, cx=512, cy=512):
    r = CAT_CIRCLE[2]; x, y = OPTICAL; k = radius / r
    tx, ty = cx - x * k, cy - y * k
    return f'<path transform="translate({tx:.1f} {ty:.1f}) scale({k:.4f})" d="{CAT}" fill="{BLACK}" fill-rule="nonzero"/>'

def icon(ring_scale):
    ring = f'<g transform="translate(512 512) scale({ring_scale}) translate(-512 -512)">{RING}</g>'
    return f'<rect width="1024" height="1024" fill="{RED}"/>{ring}{cat((RING_IN - CLEAR) * ring_scale)}'

icons = {
    # any: Ring fast randlos (R = 456 von 512), iOS/Android runden selbst ab
    'app-icon': icon(1.0),
    # maskable: alles in der sicheren Zone (Kreis r = 0,4 × Kante = 410)
    'app-icon-maskable': icon(0.88),
}
for n, b in icons.items():
    open(os.path.join(OUT, n + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{b}</svg>')
# Kopf: viewBox wie logo-katze-kopf.svg, quadratisch mit etwas Rand
open(os.path.join(OUT, 'benachrichtigung.svg'), 'w').write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="426 404 132 132"><path d="{HEAD}" fill="#fff"/></svg>')
print('geschrieben: app-icon, app-icon-maskable, benachrichtigung')
