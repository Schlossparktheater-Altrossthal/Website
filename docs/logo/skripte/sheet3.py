"""Konzeptblatt 3: Varianten der Vektor-Rohfassung → konzept/varianten/*.svg + konzept/konzept-3.html

Einfarbig/Negativ entstehen per Farbzuordnung aus logo-roh.svg:
Druckfarbe = Ring, Rahmen, Bühnenkante, Vorhangrot, Fugen, Katze; Papier = Falten, Boden, Bühne, Schwanz-Saum.
"""
import os, re
here = os.path.dirname(__file__)
K = os.path.join(here, '..', 'konzept')
OUT = os.path.join(K, 'varianten'); os.makedirs(OUT, exist_ok=True)
src = open(os.path.join(K, 'rohfassung', 'logo-roh.svg')).read()

INK = ['#FFDD00', '#C7A100', '#744A27', '#015824', '#09783A', '#004D6B', '#171717', '#E84820', '#3C1B00']
PAPER = ['#fff', '#A00A0A', '#D2924D']


def recolor(svg, ink, paper):
    """Erst auf Platzhalter, dann auf Zielfarben – sonst färbt die zweite Runde die erste wieder um."""
    for c in INK:
        svg = re.sub(rf'"{c}"', '"@INK@"', svg, flags=re.I)
    for c in PAPER:
        svg = re.sub(rf'"{c}"', '"@PAPER@"', svg, flags=re.I)
    return svg.replace('@INK@', ink).replace('@PAPER@', paper)


BLUE = '#004D6B'
var = {
    'vollfarbe': src,
    'einfarbig-schwarz': recolor(src, '#171717', '#fff'),
    'negativ-blau': recolor(src, '#fff', BLUE).replace('<g id="ring">', f'<circle cx="512" cy="512" r="500" fill="{BLUE}"/><g id="ring">', 1),
}
for n, s in var.items():
    open(os.path.join(OUT, f'logo-{n}.svg'), 'w').write(s)

fig = lambda img, w, cap, bg='#fff': (f'<figure style="margin:0;text-align:center"><div style="background:{bg};border:1px solid #ddd;padding:8px">'
                                      f'<img src="{img}" width="{w}" height="{w}"></div><figcaption>{cap}</figcaption></figure>')
sizes = ''.join(f'<div style="text-align:center"><img src="varianten/logo-vollfarbe.svg" width="{s}" height="{s}"><br><small>{s} px</small></div>' for s in (256, 128, 96, 64, 48, 32))
icons = ''.join(f'<div style="text-align:center"><img src="icons/{f}.svg" width="{s}" height="{s}"><br><small>{f.split("-")[1]} {s}</small></div>'
                for f in ('favicon-blau', 'favicon-rot') for s in (64, 32, 16))
html = f'''<html><body style="font-family:sans-serif;margin:24px;width:1420px">
<h1 style="margin:0 0 4px">Logo Sommertheater – Konzeptblatt 3: Varianten der Vektorfassung</h1>
<p style="margin:0 0 16px;color:#555">Stand 2026-10-25 · Ring nach BSZ · Vorhang aus Bézierkurven, gespiegelt · Raffhalter, Schwanz, Boden konstruiert · Vorhangrot oben bis zum Rahmen</p>
<div style="display:flex;gap:20px">
{fig("varianten/logo-vollfarbe.svg", 420, "<b>A · Vollfarbe</b> – Hauptlogo, ab 128 px, Druck, Website-Kopf")}
{fig("varianten/logo-einfarbig-schwarz.svg", 420, "<b>B · Einfarbig</b> – Stempel, Fax, Gravur. Falten und Boden als Papierfarbe")}
{fig("varianten/logo-negativ-blau.svg", 420, "<b>C · Negativ</b> – weiß auf BSZ-Blau #004D6B", "#004D6B")}
</div>
<h3>D · Größenreihe Vollfarbe</h3><div style="display:flex;gap:24px;align-items:flex-end">{sizes}</div>
<h3>E · Kleine Größen: Symbol 3a – Entscheidung offen: blau oder rot?</h3><div style="display:flex;gap:24px;align-items:flex-end">{icons}
<div style="text-align:center;background:#333;padding:8px"><img src="icons/statusleiste.svg" width="24" height="24"><br><small style="color:#fff">Statusleiste 24</small></div></div>
<p style="color:#555">Unter 64 px ersetzt Symbol 3a das volle Logo (Ring und Vorhang werden dort unlesbar).</p>
</body></html>'''
open(os.path.join(K, 'konzept-3.html'), 'w').write(html)
print('ok')
