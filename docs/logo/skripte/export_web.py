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

# Platzaufteilung: Schutzraum X = 1/8 Ringdurchmesser (114 px im 1024er-Raster), Proportionen, Mindestgrößen
X = 114
logo_inner = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', src.strip())
def dim(x1, y1, x2, y2, label, lx, ly, anchor='middle'):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#C0392B" stroke-width="3" marker-start="url(#pf)" marker-end="url(#pf)"/>'
            f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" fill="#C0392B" font-size="34" font-weight="600">{label}</text>')
inner = 512 - 456   # Ring außen 56…968
blatt = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 2160 1200" font-family="Inter, Helvetica, Arial, DejaVu Sans, sans-serif">
<defs><marker id="pf" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" fill="#C0392B"/></marker>
<pattern id="schraffur" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#FBEDEA"/><line x1="0" y1="0" x2="0" y2="16" stroke="#F2C6BE" stroke-width="6"/></pattern></defs>
<rect x="-80" y="-80" width="2160" height="1200" fill="#fff"/>
<text x="-40" y="-20" font-size="44" font-weight="700" fill="#171717">Platzaufteilung</text>
<rect x="{inner - X}" y="{inner - X}" width="{912 + 2 * X}" height="{912 + 2 * X}" fill="url(#schraffur)"/>
<rect x="{inner}" y="{inner}" width="912" height="912" fill="#fff"/>
<rect x="{inner - X}" y="{inner - X}" width="{912 + 2 * X}" height="{912 + 2 * X}" fill="none" stroke="#C0392B" stroke-width="3" stroke-dasharray="14 10"/>
<g>{logo_inner}</g>
{dim(inner - X, 512, inner, 512, 'X', inner - X / 2, 495)}
{dim(512, inner - X, 512, inner, 'X', 530, inner - X / 2 + 12, 'start')}
{dim(inner, 1010, 968, 1010, 'Ring ⌀ = 8 X', 512, 1060)}
<g font-size="34" fill="#171717">
<text x="1200" y="60" font-size="40" font-weight="700">Schutzraum</text>
<text x="1200" y="110">Rund um das Logo bleibt mindestens X frei</text>
<text x="1200" y="152">(X = ⅛ des Ringdurchmessers). Keine Schrift,</text>
<text x="1200" y="194">Bilder oder Kanten in der schraffierten Zone.</text>
<text x="1200" y="290" font-size="40" font-weight="700">Aufbau (Radius R = 4 X)</text>
<text x="1200" y="340">Ring außen R, innen 0,891 R – 6 Segmente</text>
<text x="1200" y="382">Rahmen 0,750 – 0,794 R (schwarz)</text>
<text x="1200" y="424">Bühne: Vorhang gespiegelt, Katze mittig</text>
<text x="1200" y="466">Ohne Ring: Ausschnitt = Rahmen außen</text>
<text x="1200" y="562" font-size="40" font-weight="700">Mindestgrößen</text>
<text x="1200" y="612">Logo mit Ring: ab 64 px · 20 mm</text>
<text x="1200" y="654">Logo ohne Ring: ab 48 px · 15 mm</text>
<text x="1200" y="696">Katze / Kopf: ab 32 px · 10 mm</text>
<text x="1200" y="738">Darunter: Symbol (Favicon, App-Icon)</text>
<text x="1200" y="834" font-size="40" font-weight="700">Farben</text>
<rect x="1200" y="860" width="56" height="56" fill="#E84820"/><text x="1272" y="900">Vorhangrot #E84820</text>
<rect x="1200" y="930" width="56" height="56" fill="#004D6B"/><text x="1272" y="970">BSZ-Blau #004D6B</text>
<rect x="1200" y="1000" width="56" height="56" fill="#171717"/><text x="1272" y="1040">Schwarz #171717</text>
</g>
</svg>'''
save("sommertheater-logo-platzaufteilung", blatt, (2160,))

for extra in ('sommertheater-symbol-blau.svg', 'sommertheater-symbol-rot.svg', 'sommertheater-symbol-schwarz.svg',
              'sommertheater-symbol-blau-512.png', 'sommertheater-symbol-rot-512.png', 'sommertheater-app-icon.svg', 'sommertheater-app-icon-512.png'):
    if os.path.exists(os.path.join(OUT, extra)):
        files.append(extra)
with zipfile.ZipFile(os.path.join(OUT, 'sommertheater-logo-paket.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(OUT, f), f)
print(len(files), 'Dateien')
