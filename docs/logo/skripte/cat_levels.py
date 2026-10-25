"""Katzen-Vereinfachungsstufen erzeugen → konzept/katze/stufe-*.svg

Stufe 1: Körper oberhalb der Bühnenkante aus dem Original nachgezeichnet (dort steht die Katze frei),
         Schwanz von Hand (liegt im Original auf der schwarzen Bühnenkante und ist nicht trennbar).
Stufe 2: wie 1, aber Spalt Bein/Bauch gefüllt, ein kräftiges Ohr, Pfoten auf gemeinsamem Sockel, Schwanz dicker.
Stufe 3: von Hand gezeichnete geometrische Profil-Silhouette (Icon).
Stufe 4: nur Kopf (von Hand).
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import measure, morphology

here = os.path.dirname(__file__)
SRC = os.path.join(here, '..', 'quellen', 'sommertheater-logo-1024.png')
OUT = os.path.join(here, '..', 'konzept', 'katze'); os.makedirs(OUT, exist_ok=True)

TAIL1 = """M612,664 L600,674 C585,678 562,682 546,686 C531,690 521,700 519,712 C517,728 526,742 540,742 C552,742 560,734 558,726 C556,719 548,717 543,721 C546,726 544,730 539,729 C532,727 530,716 538,710 C548,705 566,707 588,706 C608,704 626,697 633,687 C641,678 625,662 623,640 Z"""
TAIL2 = """M610,660 L598,672 C583,677 562,681 546,685 C529,689 517,700 515,713 C513,731 525,746 542,746 C556,746 565,736 563,726 C561,717 551,714 544,719 C548,725 545,731 539,730 C533,728 532,719 540,714 C550,710 568,712 590,710 C612,708 630,700 637,689 C643,678 628,664 625,644 Z"""
S3 = """<path d="M21,23 L26,3 L36,14 C38,13.4 40,13.4 42,14 L47,4 L50,24 C57,31 57,39 53,45 C70,51 86,66 86,88 C86,99 84,106 79,110 L22,110 C19,110 18,106 21,104 L26,103 C25,88 24,70 29,58 C30,52 27,49 22,48 C17,47 13,43 13.5,38.5 C14,34 17,31 18,28 C18.5,26 19.5,24.5 21,23 Z"/>
<path d="M85.7,84 C86.4,95 90,110 85,116.5 C81,121 72,121.8 60,121.8 C52,121.8 47,121.8 42,122 C34,123 29,116 33,111 C36,107 43,108 43,112.5 C43,115 41,116 40.5,117 C44,116.8 48,115 55,114.6 C64,114.2 72,114 76,112.5 C80,110.5 81,104 78,96 Z"/>"""
S4 = """<path d="M24,40 L26,6 L44,24 C48,23 52,23 56,24 L74,8 L78,42 C88,54 88,74 76,86 C66,96 46,98 34,90 C28,90 18,88 13,82 C9,77 10,70 15,67 C17,58 19,48 24,40 Z"/>"""

def _clamp(x, y, m):
    l = math.hypot(x, y)
    return (x, y) if l <= m or l == 0 else (x * m / l, y * m / l)


def path(mask, tol):
    """Kontur → geglätteter Bézier-Pfad (Catmull-Rom)."""
    out = []
    for c in measure.find_contours(np.pad(mask, 1).astype(float), 0.5):
        if len(c) < 40: continue
        p = measure.approximate_polygon(c, tol)[:-1]; pts = [(x - 1, y - 1) for y, x in p]; n = len(pts)
        d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
        for i in range(n):
            p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
            seg = math.dist(p1, p2) / 3          # Tangente begrenzen, sonst Überschwinger an langen Geraden
            t1 = _clamp((p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6, seg)
            t2 = _clamp((p3[0] - p1[0]) / 6, (p3[1] - p1[1]) / 6, seg)
            d += (f'C{p1[0]+t1[0]:.1f},{p1[1]+t1[1]:.1f} '
                  f'{p2[0]-t2[0]:.1f},{p2[1]-t2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}')
        out.append(d + 'Z')
    return ''.join(out)

a = np.array(Image.open(SRC).convert('RGBA')).astype(int)
dark = (a[..., 3] > 128) & (a[..., :3].max(2) < 90)
yy, xx = np.mgrid[:1024, :1024]
m = dark & (yy < 674) & (xx > 430) & (xx < 660) & (yy > 400)     # Bühnenkante beginnt bei y = 674
lab = measure.label(m); m = lab == lab[560, 520]
m &= ~((yy > 646) & (xx > 623))   # Hüftwölbung (Schwanzansatz im Original) weg, der Schwanz bildet die Kante
body1 = path(m, 1.2)

m &= ~((yy > 666) & ((xx < 456) | (xx > 634)))
m2 = ndi.binary_fill_holes(m); m2 &= ~(yy < 440)                  # Spalt füllen, dünne Ohren weg
im = Image.new('L', (1024, 1024), 0); dr = ImageDraw.Draw(im)
dr.polygon([(462, 452), (471, 413), (476, 412), (496, 442)], fill=255); dr.ellipse((452, 430, 520, 500), fill=255)
m2 |= (np.array(im) > 0) & ~((xx > 505) & (yy < 445))
m2 |= (yy >= 625) & (yy < 674) & (xx > 466) & (xx < 628)          # Pfoten-Sockel
m2 = ndi.binary_fill_holes(ndi.binary_closing(np.pad(m2, 10), morphology.disk(3))[10:-10, 10:-10])
m2 &= ~((yy > 668) & (xx < 462))                                   # dünner Fußrest links
m2 = ndi.gaussian_filter(m2.astype(float), 2.5) > 0.5                # Ecken runden, sonst schwingt die Glättung über
body2 = path(m2, 2.5)

items = {
    'stufe-1-nachgezeichnet': ('425 405 235 340', f'<path d="{body1}"/><path d="{TAIL1}"/>', 'originalgetreu: Körper aus dem Original nachgezeichnet, Schwanz von Hand'),
    'stufe-2-reduziert': ('425 405 235 345', f'<path d="{body2}"/><path d="{TAIL2}"/>', 'Spalt geschlossen, ein Ohr, Pfoten verschmolzen, Schwanz dicker'),
    'stufe-3-geometrisch': ('8 0 96 126', S3, 'Icon: glatte Profil-Silhouette, große Ohren, Schwanz vorn mit Lücke wie der Glanzstrich im Original'),
    'stufe-4-kopf': ('6 2 88 98', S4, 'nur Kopf, für 16 px'),
}
for n, (vb, b, note) in items.items():
    with open(os.path.join(OUT, n + '.svg'), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" fill="currentColor"><!-- {note} -->{b}</svg>')
    print(n)
