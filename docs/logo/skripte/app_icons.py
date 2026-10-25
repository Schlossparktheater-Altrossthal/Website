"""App-Icon und Benachrichtigungs-Icon aus der Rohfassung → konzept/icons/

Entscheidung 2026-10-25: App-Icon = volles Logo (Ring, Vorhang, Bühne) auf rotem Hintergrund, Katze darin
größer (CAT_ZOOM um die Pfoten auf der Bühnenkante, Ohren bleiben unter der Schabracke).
Benachrichtigungs-Icon (Android-Statusleiste/Badge) = Katzenkopf, weiß auf transparent (nur Alpha zählt).
Vorher rohfassung.py laufen lassen.
"""
import os, re
here = os.path.dirname(__file__)
ROH = os.path.join(here, '..', 'konzept', 'rohfassung')
OUT = os.path.join(here, '..', 'konzept', 'icons')
logo = open(os.path.join(ROH, 'logo-roh.svg')).read()
RING = re.search(r'<g id="ring">.*?</g>', logo, flags=re.S).group(0)
HEAD = re.search(r'<path d="([^"]*)"', open(os.path.join(ROH, 'logo-katze-kopf.svg')).read()).group(1)
RED, BLACK = '#E84820', '#171717'


CAT_ZOOM = 1.25   # User-Wahl aus 1,25 / 1,4 / 1,55
ZOOMED = logo.replace('<g id="katze">', f'<g id="katze" transform="translate(526 673) scale({CAT_ZOOM}) translate(-526 -673)">', 1)
LOGO_BODY = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', ZOOMED, flags=re.S)

def icon(ring_scale):
    return (f'<rect width="1024" height="1024" fill="{RED}"/>'
            f'<g transform="translate(512 512) scale({ring_scale}) translate(-512 -512)">{LOGO_BODY}</g>')


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
