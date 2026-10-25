"""Konzeptblatt 2: Ring nach BSZ-Geometrie, technische Zeichnung, Variantenskizzen."""
import base64, io, math, os, sys
import numpy as np
from PIL import Image
from skimage import measure
sys.path.insert(0, os.path.dirname(__file__))
import ring_geometry as g

here = os.path.dirname(__file__)
OUT = os.path.join(here, '..', 'konzept')
SRC = os.path.join(here, '..', 'quellen', 'sommertheater-logo-1024.png')
C, R = 512, 456                    # Mittelpunkt und Außenradius im 1024er-Raster
FRAME = (0.750, 0.794)             # schwarzer Rahmen innen/außen (/R), aus dem Original übernommen
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
def svg(body, vb='0 0 1024 1024', w=680):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{w}" font-family="sans-serif">{"".join(body)}</svg>'

# Katzen-Silhouette aus dem Original (für Variantenskizzen)
src = np.array(Image.open(SRC).convert('RGBA')).astype(int)
dark = (src[..., 3] > 128) & (src[..., :3].max(2) < 60)
yy, xx = np.mgrid[:1024, :1024]
dark &= np.hypot(xx - 512, yy - 513) < 335
lab = measure.label(dark); cat = lab == lab[560, 520]
cat &= ~((yy > 672) & ((xx < 452) | (xx > 642)))           # Bühnenkante abschneiden
cat &= ~((yy > 672) & (yy < 698) & (src[..., :3].max(2) < 60) & ~((xx > 455) & (xx < 640) & (yy < 690)))
def mask_png(m, rgb):
    im = np.zeros((1024, 1024, 4), np.uint8); im[m] = (*rgb, 255)
    buf = io.BytesIO(); Image.fromarray(im).save(buf, 'PNG'); return base64.b64encode(buf.getvalue()).decode()
cat_white, cat_black = mask_png(cat, (255, 255, 255)), mask_png(cat, (23, 23, 23))
ys, xs = np.nonzero(cat); print('Katze bbox', xs.min(), xs.max(), ys.min(), ys.max(), 'Schwerpunkt x %.0f' % xs.mean())

# A: neue Ringgeometrie über dem Original
A = [f'<image href="data:image/png;base64,{b64(SRC)}" width="1024" height="1024" opacity=".55"/>']
A += g.svg_paths(C, C, R, fill=False, stroke='#d0021b')
A.append('<text x="20" y="1010" font-size="22">rot = Ring in BSZ-Geometrie (R = 456, Mitte 512|512)</text>')

# B: technische Zeichnung
B = []
u = 1024 / 48
for i in range(49):
    w = 1.1 if i % 4 == 0 else .35
    B.append(f'<path d="M{i*u:.1f} 0V1024M0 {i*u:.1f}H1024" stroke="#a9c4c4" stroke-width="{w}"/>')
B += g.svg_paths(C, C, R)
fr = (FRAME[0] + FRAME[1]) / 2 * R
B.append(f'<circle cx="{C}" cy="{C}" r="{fr:.1f}" fill="none" stroke="#171717" stroke-width="{(FRAME[1]-FRAME[0])*R:.1f}"/>')
B.append(f'<path d="M{C} 20V1004M20 {C}H1004" stroke="#000" stroke-width=".8" stroke-dasharray="10 4 2 4"/>')
for ga in g.GAP_ANGLES:
    t = math.radians(ga); B.append(f'<line x1="{C}" y1="{C}" x2="{C+1.08*R*math.cos(t):.1f}" y2="{C+1.08*R*math.sin(t):.1f}" stroke="#d0021b" stroke-width=".8" stroke-dasharray="6 4"/>')
    lx, ly = C + 1.12 * R * math.cos(t), C + 1.12 * R * math.sin(t)
    B.append(f'<text x="{lx:.0f}" y="{ly:.0f}" font-size="17" fill="#d0021b" text-anchor="middle">{ga-270:+.2f}°</text>')
by = C + g.BAND_OFFSET * R
B.append(f'<line x1="0" y1="{by:.1f}" x2="1024" y2="{by:.1f}" stroke="#d0021b" stroke-width=".8" stroke-dasharray="6 4"/>')
for i, (r, lab_) in enumerate([(1, 'R = 1'), (g.R_IN, f'{g.R_IN:.4f} R'), (FRAME[1], f'{FRAME[1]:.3f} R'), (FRAME[0], f'{FRAME[0]:.3f} R')]):
    a = math.radians(25 + i * 16); x, y = C + r * R * math.cos(a), C + r * R * math.sin(a)
    B.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="#d0021b"/><text x="{x+8:.0f}" y="{y+5:.0f}" font-size="17" fill="#d0021b">{lab_}</text>')
B.append(f'<text x="{C}" y="{C-40}" font-size="22" text-anchor="middle" fill="#444">Fugen {g.GAP:.4f} R · Querfuge {g.BAND:.4f} R</text>')
B.append(f'<text x="{C}" y="{C-12}" font-size="22" text-anchor="middle" fill="#444">Querfuge {g.BAND_OFFSET:.4f} R unter Mitte</text>')
B.append(f'<text x="{C}" y="{C+70}" font-size="20" text-anchor="middle" fill="#444">Segmente ' + ' / '.join(f'{s:.1f}°' for s in g.spans()) + '</text>')
B.append(f'<text x="{C}" y="{C+100}" font-size="20" text-anchor="middle" fill="#444">Rahmen {FRAME[0]:.3f}–{FRAME[1]:.3f} R · Bühne bis {FRAME[0]:.3f} R</text>')

# C: Varianten
def ring_only(fillmap):
    out = []
    for p, (name, _) in zip(g.svg_paths(C, C, R), g.segments()):
        out.append(p.replace(g.COLORS[name], fillmap(name)))
    return out
inner = lambda col: f'<circle cx="{C}" cy="{C}" r="{fr:.1f}" fill="none" stroke="{col}" stroke-width="{(FRAME[1]-FRAME[0])*R:.1f}"/>'
orig = f'<clipPath id="k"><circle cx="{C}" cy="{C}" r="{FRAME[0]*R:.1f}"/></clipPath><image href="data:image/png;base64,{b64(SRC)}" width="1024" height="1024" clip-path="url(#k)"/>'
V = {
    'Vollfarbe': [orig] + g.svg_paths(C, C, R) + [inner('#171717')],
    'Einfarbig': ring_only(lambda n: '#171717') + [inner('#171717'), f'<image href="data:image/png;base64,{cat_black}" width="1024" height="1024"/>'],
    'Negativ': [f'<rect width="1024" height="1024" rx="120" fill="#004D6B"/>'] + ring_only(lambda n: '#fff') + [inner('#fff'), f'<image href="data:image/png;base64,{cat_white}" width="1024" height="1024"/>'],
    'Favicon / App-Icon': [f'<circle cx="{C}" cy="{C}" r="{FRAME[0]*R:.1f}" fill="#E84820"/>'] + g.svg_paths(C, C, R) + [inner('#171717'), f'<image href="data:image/png;base64,{cat_black}" width="1024" height="1024"/>'],
    'Statusleiste (Android)': [f'<rect width="1024" height="1024" fill="#222"/><image href="data:image/png;base64,{cat_white}" x="-230" y="-330" width="1700" height="1700"/>'],
}
cards = ''.join(f'<figure style="margin:0;text-align:center"><div style="border:1px solid #ddd">{svg(body, w=205)}</div><figcaption>{name}</figcaption></figure>' for name, body in V.items())
small = ''.join(f'<span style="display:inline-block;margin-right:14px;text-align:center">{svg(V[n], w=s)}<br><small>{s}px</small></span>' for n, s in [('Favicon / App-Icon', 48), ('Favicon / App-Icon', 32), ('Favicon / App-Icon', 16), ('Statusleiste (Android)', 24)])

for name, body, vb in [('A2-ring-ueberlagerung.svg', A, '0 0 1024 1024'), ('B2-technische-zeichnung.svg', B, '-60 -60 1144 1144')]:
    open(os.path.join(OUT, name), 'w').write(svg(body, vb))
html = f'''<html><body style="font-family:sans-serif;margin:24px;width:1420px">
<h1 style="margin:0 0 4px">Logo Sommertheater – Konzeptblatt 2: Ring nach BSZ, Logogrid, Varianten</h1>
<p style="margin:0 0 16px;color:#555">Entscheidungen 2026-10-25: Ring-Maße, -Winkel und -Farben vom BSZ · Vorhang gespiegelt · Katze bleibt, Umriss wird geglättet · Varianten + Statusleisten-Icon</p>
<div style="display:flex;gap:20px">
<figure style="margin:0"><img src="A2-ring-ueberlagerung.svg"><figcaption><b>A · Neuer Ring über dem jetzigen Logo.</b> Der Ring wird etwas schmaler (0,109 R statt 0,114 R), die Fugen werden schmaler, Braun schrumpft von 37–38° auf 34,4°, Gelb/Grün außen werden breiter.</figcaption></figure>
<figure style="margin:0"><img src="B2-technische-zeichnung.svg"><figcaption><b>B · Technische Zeichnung.</b> Alle Maße relativ zum Außenradius R (im 1024er-Raster R = 456 px). Fugen mit parallelen Kanten, die Mittellinien bei ±19,56° und ±56,14° um die Senkrechte. Raster u = 1/48.</figcaption></figure></div>
<div style="display:flex;gap:20px;margin-top:18px;align-items:flex-start">
<figure style="margin:0"><img src="ring-bsz-abgleich.png" width="330"><figcaption><b>C · Prüfung gegen BSZ-Original.</b> Grau = deckungsgleich, rot/blau = Abweichung.<br>Deckung 96 %, Abweichungen nur in Randpixeln.</figcaption></figure>
<div><h3 style="margin-top:0">D · Varianten (Skizze – Katze noch aus dem Rasterbild, Vorhang noch nicht nachgezeichnet)</h3>
<div style="display:flex;gap:14px">{cards}</div>
<p style="margin:14px 0 4px"><b>Kleine Größen:</b></p><div style="background:#f3f3f3;padding:10px;display:inline-block">{small}</div>
<ul style="font-size:16px;line-height:1.45">
<li><b>Favicon/App-Icon:</b> Ring + Rahmen + Katze auf Vorhangrot, ohne Falten und Dielen. Ab 16 px nur noch Ring und Fläche erkennbar – evtl. eigene 16-px-Fassung ohne Katze.</li>
<li><b>Statusleiste:</b> Android färbt das Icon selbst ein und nutzt nur die Transparenz → weiße Katzen-Silhouette, 24 dp, mit etwas Rand. Der Ring ist bei dieser Größe nicht lesbar und entfällt.</li>
<li><b>Negativ:</b> weiß auf BSZ-Blau, z. B. für dunkle Flächen, Shirts, Stempel.</li></ul></div></div>
<h3>Nächster Schritt</h3><p style="font-size:16px">Vektor-Rohfassung: Ring und Rahmen aus dieser Konstruktion, Vorhang (eine Hälfte nachgezeichnet und gespiegelt), Katze (Umriss nachgezeichnet und geglättet), Bühnenboden mit gleichmäßigen Dielen. Danach Abgleich mit dem Original.</p>
</body></html>'''
open(os.path.join(OUT, 'konzept-2.html'), 'w').write(html)
