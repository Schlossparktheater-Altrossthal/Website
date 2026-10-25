"""Größentest der Katzen-Stufen in verschiedenen Icon-Aufbauten.

Schreibt konzept/katze/groessentest.html. Gerendert wird mit skripte/size_test.cjs
(jedes Icon in Originalgröße, dann pixelgenau vergrößert zu konzept/katze/groessentest.png).
"""
import os, re, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import ring_geometry as g

here = os.path.dirname(__file__)
K = os.path.join(here, '..', 'konzept', 'katze')
LEVELS = ['stufe-1-nachgezeichnet', 'stufe-2-reduziert', 'stufe-3-geometrisch', 'stufe-3a-symbol-haken', 'stufe-3b-symbol-vorn', 'stufe-4-kopf']
SIZES = [16, 24, 32, 48, 64]

def cat(name, x, y, w, h, color):
    s = open(os.path.join(K, name + '.svg')).read()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    body = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', s, flags=re.S)
    return f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="{vb}" fill="{color}" color="{color}">{body}</svg>'

RED, BLUE, BLACK = '#E84820', '#004D6B', '#171717'
ring = ''.join(g.svg_paths(50, 50, 48))
fr_in, fr_out = g.R_IN * 48 - 0.1 * 48, g.R_IN * 48 - 0.1 * 48 + 0.044 * 48  # Rahmen wie im Logo (0,750–0,794 R)
fr_in, fr_out = 0.750 * 48, 0.794 * 48
LAYOUTS = {
    'A · Ring + Rahmen (wie Logo)': lambda n: ring + f'<circle cx="50" cy="50" r="{fr_out}" fill="{BLACK}"/><circle cx="50" cy="50" r="{fr_in}" fill="{RED}"/>' + cat(n, 30, 27, 40, 46, BLACK),
    'B · nur Rahmen, Katze groß': lambda n: f'<circle cx="50" cy="50" r="48" fill="{BLACK}"/><circle cx="50" cy="50" r="43" fill="{RED}"/>' + cat(n, 19, 14, 62, 72, BLACK),
    'C · BSZ-Blau, weiße Katze': lambda n: f'<circle cx="50" cy="50" r="48" fill="{BLUE}"/>' + cat(n, 18, 12, 64, 76, '#fff'),
    'D · Statusleiste (weiß, transparent)': lambda n: cat(n, 4, 2, 92, 96, '#fff'),
}
rows = []
for lname, f in LAYOUTS.items():
    for lv in LEVELS:
        rows.append({'layout': lname, 'level': lv, 'svg': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{f(lv)}</svg>',
                     'bg': '#2b2b2b' if lname.startswith('D') else '#ffffff'})
icons = ''.join(f'<div class="i" data-k="{i}-{s}" style="width:{s}px;height:{s}px;background:{r["bg"]}">{r["svg"].replace("<svg ", f"<svg width={s} height={s} ", 1)}</div>'
                for i, r in enumerate(rows) for s in SIZES)
open(os.path.join(K, 'groessentest.html'), 'w').write(
    f'<html><body style="margin:0"><style>.i{{display:inline-block;line-height:0;margin:2px}}</style>{icons}'
    f'<script>window.ROWS={json.dumps([{k: r[k] for k in ("layout", "level", "bg")} for r in rows])};window.SIZES={SIZES}</script></body></html>')
print(len(rows) * len(SIZES), 'Icons')
