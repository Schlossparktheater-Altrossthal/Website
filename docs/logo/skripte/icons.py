"""Icon-Satz mit Katzen-Symbol 3a → konzept/icons/*.svg

Das Symbol (24er-Raster) wird über seine optische Mitte (siehe CENTER) zentriert.
"""
import os, re
here = os.path.dirname(__file__)
K = os.path.join(here, '..', 'konzept', 'katze', 'stufe-3a-symbol-haken.svg')
OUT = os.path.join(here, '..', 'konzept', 'icons'); os.makedirs(OUT, exist_ok=True)
sym = open(K).read()
body = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', sym, flags=re.S)
body = re.sub(r'<!--.*?-->', '', body, flags=re.S)

# Optische Mitte des Symbols im 24er-Raster: Mittelwert aus Flächenschwerpunkt (11,45 | 13,53)
# und Mitte der Umrandung (12,48 | 11,5). Nur Schwerpunkt → Symbol wirkt zu hoch, nur Umrandung → zu tief.
CENTER = (12.0, 12.5)

RED, BLUE, BLACK, WHITE = '#E84820', '#004D6B', '#171717', '#FFFFFF'

def place(scale, fill, cx=50, cy=50):
    """Symbol so skalieren (Einheiten pro 24er-Einheit) und verschieben, dass sein Schwerpunkt auf cx|cy liegt."""
    tx, ty = cx - CENTER[0] * scale, cy - CENTER[1] * scale
    return f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})" fill="{fill}">{body}</g>'

icons = {
    # Favicon/App-Icon: Rahmen + Vorhangrot (Farbwelt des Logos)
    'favicon-rot': f'<circle cx="50" cy="50" r="48" fill="{BLACK}"/><circle cx="50" cy="50" r="42" fill="{RED}"/>' + place(2.85, BLACK),
    # Alternative: BSZ-Blau, weiße Katze
    'favicon-blau': f'<circle cx="50" cy="50" r="48" fill="{BLUE}"/>' + place(3.1, WHITE),
    # PWA/Android maskable: Vollfläche, Motiv in der sicheren Zone (Kreis 80 %)
    'app-icon-maskable': f'<rect width="100" height="100" fill="{RED}"/>' + place(2.6, BLACK),
    # Statusleiste (Android): nur Alpha zählt, weiße Silhouette mit Rand
    'statusleiste': place(3.6, WHITE),
    # einfarbig
    'symbol-schwarz': place(3.9, BLACK),
}
for n, b in icons.items():
    open(os.path.join(OUT, n + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{b}</svg>')
print('geschrieben:', ', '.join(icons))
