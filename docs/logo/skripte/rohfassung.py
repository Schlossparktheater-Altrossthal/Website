"""Vektor-Rohfassung des Gesamtlogos → konzept/rohfassung/logo-roh.svg

Ring und Rahmen aus der Konstruktion (ring_geometry.py), R = 456 im 1024er-Raster, Mitte 512|512.
Vorhang: aus wenigen Bézierkurven konstruiert (vorhang.py), Seitenvorhang an x = 512 gespiegelt.
Bühnenboden: konstruiert, Bühnenkante + gleichmäßige Dielen.
Katze: eine Kontur aus Körper Stufe 1 (konzept/katze/stufe-1-nachgezeichnet.svg) und konstruiertem Schwanz.
"""
import math, os, re
import ring_geometry as rg
import vorhang

here = os.path.dirname(__file__)
OUT = os.path.join(here, '..', 'konzept', 'rohfassung'); os.makedirs(OUT, exist_ok=True)

C, R = 512, 456
F_IN, F_OUT = 0.750 * R, 0.794 * R            # schwarzer Rahmen
RED, FOLD, FLOOR, JOINT, BLACK = '#E84820', '#A00A0A', '#D2924D', '#3C1B00', '#171717'   # Boden/Fuge gemessen
EDGE = (673, 698)                            # Bühnenkante (gemessen 674–697), 1 px höher: Pfoten stehen ohne Naht darauf
PLANK_W, PLANK_PITCH, PLANKS = 11, 36, 3     # Fugen 11 px, gleichmäßig (Original 722/760/797 ungleich), nur 3 → kein Splitter am Rahmen
# Schwanz (gemessen 2026-10-25): wächst aus der Hüfte, läuft über die Bühnenkante nach links und wird dünner
# (22 → 14 px), endet in einer runden Locke; von rechts greift eine Kerbe bis (544|711,5) hinein.
# Fläche aus 8 Bézierkurven. Rechts bildet sie die Hüftwölbung = Schwanzansatz: weicher Bogen von (624|647)
# nach außen bis (638|674) auf die Bühnenkante (gemessen). Auf Schwarz trennt ihn ein weißer Saum (nur Oberkante) vom Körper.
TAIL_UPPER = 'M608,669.5C595,677 570,683 546,685C530,688 518,700 517,715'
# weißer Saum als Sichel: rechts spitz, Mitte ~5 px, läuft über die Bühnenkante hinaus und endet spitz an der Locke (517|707)
TAIL_SAUM = (TAIL_UPPER + 'L517.4,707C514,696 526.5,682.5 545,680C569,677.5 594,672.5 608,669.5Z')
# Katze = EINE Kontur aus Körper und Schwanz (2026-10-25): Der Hüftrand geht ohne Naht und mit gleicher Tangente
# in die Außenkante des Schwanzes über, statt dass zwei Flächen sich überlappen. Ab der Saumspitze (608|669,5)
# schließt die Kontur an die Körper-Unterkante (597|673,5) an.
HIP = 'C623.4,647.5 626,650 630,654.5C634,659 637.5,665 637.5,674'   # Hüftwölbung: tangential aus dem senkrechten Hüftrand (623,5|644), ~45° schräg, dann steil auf die Bühnenkante
# Ecke bei (637,5|674) und Gerade bis (630|688) durch einen tangentialen Bogen ersetzt; Unterkante etwas höher → schlanker
TAIL_OUTLINE = (HIP + 'C637.5,690 620,699 601,701C585,702.5 562,704.5 544,711.5'   # Mitte schlanker (~20 px)
                'C549,714 557,720 557,724C557,731 549,736 537,736.5C527,737 516,730 517,715'
                'C518,700 530,688 546,685C570,683 595,677 608,669.5'
                'C600,672 590,673.4 580,673.6L509,673.5')   # von der Saumspitze tangential in die Bauch-Unterkante, keine Ecke

valance, side, log = vorhang.build(RED, FOLD)
cat = open(os.path.join(here, '..', 'konzept', 'katze', 'stufe-1-nachgezeichnet.svg')).read()
body = re.findall(r'<path d="([^"]*)"', cat)[0]   # nur der Körper, der Schwanz wird neu konstruiert
# Ohren (2026-10-25, nach Vorlage des Users): Kopf als Kuppel bis zum vorderen Ohr, vorderes Ohr mit runder Spitze
# und fast gerader Rückseite; hinteres Ohr als eigene Fläche, durch einen gleichmäßig schmalen weißen Spalt
# (~1,5 px) von Kuppel und vorderem Ohr getrennt, links offen.
a, b = body.index('C455.7,449.2'), body.index('C503.1,440.8')
EARS = ('C455,447 459,440.8 463,438.7C466,437.3 469.3,435.9 472,434.7'   # Stirn → Kuppel bis zum vorderen Ohr
        'C473.9,431 474.9,427.5 475.5,424.5C476.1,421.5 476.7,418.8 477.6,416.9'   # Vorderkante
        'C478.3,415.6 479.8,415.3 481,416.2'            # runde Spitze
        'C486.5,420.8 494,431 499,437.5')                 # Rückseite fast gerade in den Nacken
body = body[:a] + EARS + body[b:]
# Hinteres Ohr: Unter- und Vorderkante sind die um GAP versetzten Kopfkurven (Kuppel + Vorderkante vorderes Ohr),
# damit der Spalt überall gleich breit ist. Versatz je Bézier nach Tiller-Hanson (Kontrollpolygon parallel verschoben),
# am Knick Kuppel/vorderes Ohr spitz wie in der Vorlage.
GAP = 1.5
def _split(P, t):
    lerp = lambda a, b: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    a, b, c = lerp(P[0], P[1]), lerp(P[1], P[2]), lerp(P[2], P[3]); d, e = lerp(a, b), lerp(b, c); f = lerp(d, e)
    return [P[0], a, d, f], [f, e, c, P[3]]
def _normal(a, b):   # links der Laufrichtung = außen (Kontur läuft hier im Uhrzeigersinn)
    dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy); return (dy / l, -dx / l)
def _offset(P, g):
    n = [_normal(P[k], P[k + 1]) for k in range(3)]
    def mid(n0, n1):
        k = 1 + n0[0] * n1[0] + n0[1] * n1[1]; return ((n0[0] + n1[0]) / k, (n0[1] + n1[1]) / k)
    m = [n[0], mid(n[0], n[1]), mid(n[1], n[2]), n[2]]
    return [(P[k][0] + g * m[k][0], P[k][1] + g * m[k][1]) for k in range(4)]
DOME0 = [(452.5, 453), (455, 447), (459, 440.8), (463, 438.7)]
DOME1 = [(463, 438.7), (466, 437.3), (469.3, 435.9), (472, 434.7)]
FRONT = [(472, 434.7), (473.9, 431), (474.9, 427.5), (475.5, 424.5)]
o0 = _offset(_split(DOME0, 0.8)[1], GAP); o1 = _offset(DOME1, GAP); o2 = _offset(_split(FRONT, 0.42)[0], GAP)
# Knick: die beiden versetzten Kurven auf den Schnittpunkt ihrer Endtangenten verlängern
(ax, ay), (bx, by) = o1[3], o2[0]; ux, uy = o1[3][0] - o1[2][0], o1[3][1] - o1[2][1]; vx, vy = o2[1][0] - o2[0][0], o2[1][1] - o2[0][1]
t = ((bx - ax) * vy - (by - ay) * vx) / (ux * vy - uy * vx); K = (ax + ux * t, ay + uy * t)
o1[3] = o2[0] = K
f = lambda q: f'{q[0]:.2f},{q[1]:.2f}'
BACK_EAR = ('M' + f(o0[0]) + ''.join('C' + ' '.join(f(q) for q in o[1:]) for o in (o0, o1, o2))
            + 'C467.5,426.2 462.5,421.8 458.6,419.4C457.4,418.7 456.3,419.2 456.4,420.6'   # Oberkante, runde Spitze
            + 'C457.2,427 458.4,433 ' + f(o0[0]) + 'Z')                                     # Hinterkante
# Körper ab der Pfote (509|673,5) bis zum Hüftrand (623,5|644), dann Schwanz, über die Saumspitze zurück zur Pfote
start, hip = body.index('C508.3,673.5'), body.index('C622.9,651.9')
CAT = 'M509,673.5' + body[start:hip] + TAIL_OUTLINE + 'Z' + BACK_EAR
planks = ''.join(f'<rect x="0" y="{EDGE[1] + 25 + i * PLANK_PITCH}" width="1024" height="{PLANK_W}"/>' for i in range(PLANKS))
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<!-- Rohfassung, erzeugt von skripte/rohfassung.py -->
<defs>
  <clipPath id="ueber-kante"><rect x="0" y="0" width="1024" height="{EDGE[1]}"/></clipPath>
  <clipPath id="buehne"><circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}"/></clipPath>
  <g id="seitenvorhang">{side}</g>
</defs>
<g id="ring">{''.join(rg.svg_paths(C, C, R))}</g>
<g clip-path="url(#buehne)">
  <circle cx="{C}" cy="{C}" r="{F_IN + 1:.1f}" fill="#fff"/>
  <g id="boden"><rect x="0" y="{EDGE[0]}" width="1024" height="400" fill="{FLOOR}"/>
    <rect x="0" y="{EDGE[0]}" width="1024" height="{EDGE[1] - EDGE[0]}" fill="{BLACK}"/>
    <g fill="{JOINT}">{planks}</g></g>
  <g id="schabracke">{valance}</g>
  <use href="#seitenvorhang"/><use href="#seitenvorhang" transform="matrix(-1 0 0 1 1024 0)"/>
</g>
<circle id="rahmen" cx="{C}" cy="{C}" r="{(F_IN + F_OUT) / 2:.1f}" fill="none" stroke="{BLACK}" stroke-width="{F_OUT - F_IN:.1f}"/>
<g id="katze"><path d="{CAT}" fill="{BLACK}"/>
  <path d="{TAIL_SAUM}" fill="#fff"/></g>
</svg>'''
open(os.path.join(OUT, 'logo-roh.svg'), 'w').write(svg)
for name, err in log:
    print(f'{name:22s} max. Abweichung {err:4.1f} px')

# Nur die Katze (2026-10-25): dieselbe Kontur ohne Saum – die Lücke zwischen Bauch und Schwanz ist frei (transparent),
# damit die Datei auf jedem Hintergrund funktioniert. viewBox = Umriss + 8 px Rand.
cat_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="428 406 218 339">
<!-- Katze allein, erzeugt von skripte/rohfassung.py -->
<path d="{CAT}" fill="{BLACK}"/>
</svg>'''
open(os.path.join(OUT, 'logo-katze.svg'), 'w').write(cat_svg)

# Nur der Kopf (2026-10-25): Körperkontur vom Hals vorn (462,5|535) über Kinn, Ohren und Hinterkopf bis zum
# Nacken (536,5|472), unten ein leicht gewölbter Halsabschluss. viewBox = Umriss + 8 px Rand.
a, b = body.index('C463.8,528.5'), body.index('C539.0,478.5')
HEAD = 'M462.5,535.0' + body[a:b] + 'C540,482 522,532 462.5,535.0Z' + BACK_EAR   # tangential aus dem Nacken, runder Abschluss
open(os.path.join(OUT, 'logo-katze-kopf.svg'), 'w').write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="428 406 120 140">
<!-- Katzenkopf allein, erzeugt von skripte/rohfassung.py -->
<path d="{HEAD}" fill="{BLACK}"/>
</svg>''')
