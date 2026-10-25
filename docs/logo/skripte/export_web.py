"""Downloads für die Website (Drupal-Seite „Design & Logo“) aus der aktuellen Rohfassung erzeugen.

Aufruf: python export_web.py <zielordner>   (z. B. Theme-Drupal-Sommertheater/downloads/design)

Erzeugt Logo mit/ohne Ring in Vollfarbe/Einfarbig/Negativ, Katze, Kopf (SVG + PNG), das Blatt
„Platzaufteilung“ und das ZIP-Paket. Vorher rohfassung.py laufen lassen. Symbole/App-Icon kommen
aus icons.py und werden hier nicht angefasst, nur ins Paket gelegt.
"""
import os, re, sys, zipfile
import resvg_py

here = os.path.dirname(__file__)
ROH = os.path.join(here, '..', 'konzept', 'rohfassung')
OUT = sys.argv[1]
src = open(os.path.join(ROH, 'logo-roh.svg')).read()

INK = ['#FFDD00', '#C7A100', '#744A27', '#015824', '#09783A', '#004D6B', '#171717', '#E84820', '#3C1B00']
PAPER = ['#fff', '#A00A0A', '#D2924D']
BLUE, BLACK = '#004D6B', '#171717'
NO_RING = 'viewBox="150 150 724 724"'          # Rahmen außen 0,794 R = 362 → 150…874


def recolor(svg, ink, paper):
    """Wie sheet3.py: erst Platzhalter, dann Zielfarben."""
    for c in INK:
        svg = re.sub(rf'"{c}"', '"@INK@"', svg, flags=re.I)
    for c in PAPER:
        svg = re.sub(rf'"{c}"', '"@PAPER@"', svg, flags=re.I)
    return svg.replace('@INK@', ink).replace('@PAPER@', paper)


def no_ring(svg):
    svg = re.sub(r'<g id="ring">.*?</g>\n', '', svg, flags=re.S)
    return svg.replace('viewBox="0 0 1024 1024"', NO_RING, 1)


def png(svg, name, size):
    w, h = [float(v) for v in re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', svg).groups()]
    data = resvg_py.svg_to_bytes(svg_string=svg, width=size, height=round(size * h / w))
    open(os.path.join(OUT, name), 'wb').write(bytes(data))


files = []
def save(name, svg, sizes=()):
    open(os.path.join(OUT, name + '.svg'), 'w').write(svg)
    files.append(name + '.svg')
    for s in sizes:
        png(svg, f'{name}-{s}.png', s)
        files.append(f'{name}-{s}.png')


var = {
    'vollfarbe': src,
    'einfarbig-schwarz': recolor(src, BLACK, '#fff'),
    'negativ-blau': recolor(src, '#fff', BLUE).replace('<g id="ring">', f'<circle cx="512" cy="512" r="500" fill="{BLUE}"/><g id="ring">', 1),
}
for n, s in var.items():
    save(f'sommertheater-logo-{n}', s, (256, 512, 1024, 2048) if n == 'vollfarbe' else (512, 2048))
    r = no_ring(s)
    if n == 'negativ-blau':   # Fläche auf Rahmengröße
        r = r.replace('r="500" fill', 'r="362" fill', 1)
    save(f'sommertheater-logo-ohne-ring-{n}', r, (512, 2048))

for n in ('katze', 'katze-kopf'):
    s = open(os.path.join(ROH, f'logo-{n}.svg')).read()
    save(f'sommertheater-{n}-schwarz', s, (512, 2048))
    save(f'sommertheater-{n}-weiss', s.replace(f'fill="{BLACK}"', 'fill="#fff"'), (512, 2048))

# Konstruktion: Radien, Winkel, Fugen, Verhältnisse, Farben – Werte direkt aus ring_geometry.py / rohfassung.py
import math
import ring_geometry as rg
C, R = 512, 456
EDGE, PLANK_W, PLANK_PITCH = (673, 698), 11, 36
logo_inner = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', src.strip())
GUIDE, TXT = '#C0392B', '#171717'
def pol(r, a):
    t = math.radians(a); return C + r * math.cos(t), C + r * math.sin(t)
def circ(rr, dash=''):
    return f'<circle cx="{C}" cy="{C}" r="{rr:.1f}" fill="none" stroke="{GUIDE}" stroke-width="1.6"{dash}/>'
g = []
# Hilfskreise
for k in (1.0, rg.R_IN, 0.794, 0.750):
    g.append(circ(k * R, ' stroke-dasharray="6 5"'))
# Mittelachsen
g.append(f'<path d="M{C},20V1004M20,{C}H1004" stroke="{GUIDE}" stroke-width="1" stroke-dasharray="2 6"/>')
# Fugen-Mittellinien + Winkel zur Senkrechten
for ga in rg.GAP_ANGLES:
    x1, y1 = pol(0, ga); x2, y2 = pol(1.06 * R, ga)
    g.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{GUIDE}" stroke-width="1.6" stroke-dasharray="10 6"/>')
    lx, ly = pol(1.11 * R, ga)
    g.append(f'<text x="{lx:.1f}" y="{ly + 10:.1f}" text-anchor="middle" font-size="26" font-weight="700" fill="{GUIDE}">' + f'{abs(ga - 270):.2f}°'.replace('.', ',') + '</text>')
# Segmentwinkel an der Ringmitte
rm = (1 + rg.R_IN) / 2 * R
edges_top = rg.BAND_OFFSET - rg.BAND / 2
spans = rg.spans()
starts = [rg._band_edge(edges_top, (1 + rg.R_IN) / 2, True)]
for ga in rg.GAP_ANGLES:
    starts.append(rg._radial_edge(ga, +1, (1 + rg.R_IN) / 2))
for st, sp in zip(starts, spans):
    mx, my = pol(rm, st + sp / 2)
    g.append(f'<text x="{mx:.1f}" y="{my + 9:.1f}" text-anchor="middle" font-size="24" font-weight="700" fill="#fff" stroke="#171717" stroke-width="5" paint-order="stroke">' + f'{sp:.1f}°'.replace('.', ',') + '</text>')
# Querband (waagerechte Fuge)
yb = C + rg.BAND_OFFSET * R
g.append(f'<line x1="20" y1="{yb:.1f}" x2="1004" y2="{yb:.1f}" stroke="{GUIDE}" stroke-width="1.6" stroke-dasharray="10 6"/>')
# Bühnenkante + Dielen
for y in (EDGE[0], EDGE[1]):
    g.append(f'<line x1="150" y1="{y}" x2="874" y2="{y}" stroke="{GUIDE}" stroke-width="1.2" stroke-dasharray="4 4"/>')
guides = ''.join(g)

def mm(v):   # Anteil von R, deutsch formatiert
    return f'{v:.3f}'.replace('.', ',') + ' R'
rows = [
    ('Ring', ''),
    ('Außenradius', '1,000 R'),
    ('Innenradius', mm(rg.R_IN)),
    ('Ringbreite', mm(1 - rg.R_IN)),
    ('Fugenbreite oben (parallel)', mm(rg.GAP)),
    ('Querfuge, Breite', mm(rg.BAND)),
    ('Querfuge, unter Mitte', mm(rg.BAND_OFFSET)),
    ('Fugen zur Senkrechten', '±19,56° · ±56,14°'),
    ('Segmente oben (Ringmitte)', ' / '.join(f'{s:.1f}'.replace('.', ',') for s in spans) + '°'),
    ('Bühne', ''),
    ('Rahmen außen / innen', mm(0.794) + ' / ' + mm(0.750)),
    ('Rahmenbreite', mm(0.044)),
    ('Bühnenkante (Oberkante, unter Mitte)', mm((EDGE[0] - C) / R)),
    ('Bühnenkante, Höhe', mm((EDGE[1] - EDGE[0]) / R)),
    ('Dielenfugen: Breite / Abstand', mm(PLANK_W / R) + ' / ' + mm(PLANK_PITCH / R)),
    ('Katze: Höhe', mm((674 - 414) / R)),
    ('Vorhang', 'linke Hälfte, an der Senkrechten gespiegelt'),
]
y = 40; tx = []
for k, v in rows:
    if not v:
        y += 26; tx.append(f'<text x="1160" y="{y}" font-size="34" font-weight="700" fill="{TXT}">{k}</text>'); y += 46
    else:
        tx.append(f'<text x="1160" y="{y}" font-size="25" fill="#555">{k}</text><text x="2040" y="{y}" font-size="25" font-weight="600" fill="{TXT}" text-anchor="end">{v}</text>'); y += 38
y += 30
tx.append(f'<text x="1160" y="{y}" font-size="34" font-weight="700" fill="{TXT}">Farben</text>'); y += 26
cols = [('Gelb', '#FFDD00'), ('Ocker', '#C7A100'), ('Braun', '#744A27'), ('Dunkelgrün', '#015824'), ('Grün', '#09783A'), ('BSZ-Blau', '#004D6B'),
        ('Vorhangrot', '#E84820'), ('Faltenrot', '#A00A0A'), ('Boden', '#D2924D'), ('Dielenfuge', '#3C1B00'), ('Schwarz', '#171717'), ('Weiß', '#FFFFFF')]
for i, (n, c) in enumerate(cols):
    cx, cy = 1160 + (i % 3) * 300, y + (i // 3) * 64
    tx.append(f'<rect x="{cx}" y="{cy}" width="44" height="44" rx="6" fill="{c}" stroke="#ccc"/><text x="{cx + 56}" y="{cy + 20}" font-size="22" fill="{TXT}">{n}</text><text x="{cx + 56}" y="{cy + 42}" font-size="20" fill="#555">{c}</text>')
H = y + 4 * 64 + 20
blatt = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2080 {max(H, 1080)}" font-family="Inter, Helvetica, Arial, DejaVu Sans, sans-serif">
<rect width="2080" height="{max(H, 1080)}" fill="#fff"/>
<g transform="translate(40 40)"><g opacity="0.55">{logo_inner}</g>{guides}</g>
{''.join(tx)}
</svg>'''
save('sommertheater-logo-konstruktion', blatt, (2080,))

for extra in ('sommertheater-symbol-blau.svg', 'sommertheater-symbol-rot.svg', 'sommertheater-symbol-schwarz.svg',
              'sommertheater-symbol-blau-512.png', 'sommertheater-symbol-rot-512.png', 'sommertheater-app-icon.svg', 'sommertheater-app-icon-512.png'):
    if os.path.exists(os.path.join(OUT, extra)):
        files.append(extra)
with zipfile.ZipFile(os.path.join(OUT, 'sommertheater-logo-paket.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(OUT, f), f)
print(len(files), 'Dateien')
