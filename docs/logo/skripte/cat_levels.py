"""Katzen-Vereinfachungsstufen erzeugen → konzept/katze/stufe-*.svg

Stufe 1: Körper oberhalb der Bühnenkante aus dem Original nachgezeichnet (dort steht die Katze frei),
         Schwanz von Hand (liegt im Original auf der schwarzen Bühnenkante und ist nicht trennbar).
Stufe 2: wie 1, aber Spalt Bein/Bauch gefüllt, ein kräftiges Ohr, Pfoten auf gemeinsamem Sockel, Schwanz dicker.
Stufe 3: von Hand gezeichnete geometrische Profil-Silhouette (Icon).
Stufe 4: nur Kopf (von Hand).
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import measure, morphology

here = os.path.dirname(__file__)
SRC = os.path.join(here, '..', 'quellen', 'sommertheater-logo-1024.png')
OUT = os.path.join(here, '..', 'konzept', 'katze'); os.makedirs(OUT, exist_ok=True)

TAIL1 = """M634,650 C646,660 640,672 628,676 C606,679 580,681 562,685 C546,689 532,697 525,707
C516,718 515,731 527,736 C540,741 556,736 559,727 C561,720 553,717 548,721
C543,716 548,710 562,707 C585,705 605,705 620,700 C640,694 652,680 650,664 C648,656 644,650 636,646 Z"""
TAIL2 = """M622,640 C650,650 656,684 628,696 C604,706 575,700 556,708 C541,714 538,728 550,733
C560,737 566,728 560,723 C574,722 580,736 568,746 C550,758 520,748 520,726
C520,700 548,690 575,686 C600,682 618,682 622,670 C625,660 618,650 610,646 Z"""
S3 = """<path d="M21,23 L26,3 L36,14 C38,13.4 40,13.4 42,14 L47,4 L50,24 C57,31 57,39 53,45 C70,51 86,66 86,88 C86,99 84,106 79,110 L22,110 C19,110 18,106 21,104 L26,103 C25,88 24,70 29,58 C30,52 27,49 22,48 C17,47 13,43 13.5,38.5 C14,34 17,31 18,28 C18.5,26 19.5,24.5 21,23 Z"/>
<path d="M77,110 C92,112 101,104 99,92 C98,84 93,79 86,79 L85,87 C89,87.5 91,90 91,93.5 C91,100 86,103 77,103 Z"/>"""
S4 = """<path d="M24,40 L26,6 L44,24 C48,23 52,23 56,24 L74,8 L78,42 C88,54 88,74 76,86 C66,96 46,98 34,90 C28,90 18,88 13,82 C9,77 10,70 15,67 C17,58 19,48 24,40 Z"/>"""

def path(mask, tol):
    """Kontur → geglätteter Bézier-Pfad (Catmull-Rom)."""
    out = []
    for c in measure.find_contours(np.pad(mask, 1).astype(float), 0.5):
        if len(c) < 40: continue
        p = measure.approximate_polygon(c, tol)[:-1]; pts = [(x - 1, y - 1) for y, x in p]; n = len(pts)
        d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
        for i in range(n):
            p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
            d += (f'C{p1[0]+(p2[0]-p0[0])/6:.1f},{p1[1]+(p2[1]-p0[1])/6:.1f} '
                  f'{p2[0]-(p3[0]-p1[0])/6:.1f},{p2[1]-(p3[1]-p1[1])/6:.1f} {p2[0]:.1f},{p2[1]:.1f}')
        out.append(d + 'Z')
    return ''.join(out)

a = np.array(Image.open(SRC).convert('RGBA')).astype(int)
dark = (a[..., 3] > 128) & (a[..., :3].max(2) < 90)
yy, xx = np.mgrid[:1024, :1024]
m = dark & (yy < 674) & (xx > 430) & (xx < 660) & (yy > 400)     # Bühnenkante beginnt bei y = 674
lab = measure.label(m); m = lab == lab[560, 520]
body1 = path(m, 1.2)

m &= ~((yy > 666) & ((xx < 456) | (xx > 634)))
m2 = ndi.binary_fill_holes(m); m2 &= ~(yy < 440)                  # Spalt füllen, dünne Ohren weg
im = Image.new('L', (1024, 1024), 0); dr = ImageDraw.Draw(im)
dr.polygon([(462, 452), (471, 413), (476, 412), (496, 442)], fill=255); dr.ellipse((452, 430, 520, 500), fill=255)
m2 |= (np.array(im) > 0) & ~((xx > 505) & (yy < 445))
m2 |= (yy >= 625) & (yy < 674) & (xx > 466) & (xx < 628)          # Pfoten-Sockel
m2 = ndi.binary_fill_holes(ndi.binary_closing(np.pad(m2, 10), morphology.disk(3))[10:-10, 10:-10])
body2 = path(m2, 2.5)

items = {
    'stufe-1-nachgezeichnet': ('425 405 235 340', f'<path d="{body1}{TAIL1}"/>', 'originalgetreu: Körper aus dem Original nachgezeichnet, Schwanz von Hand'),
    'stufe-2-reduziert': ('425 405 235 345', f'<path d="{body2}{TAIL2}"/>', 'Spalt geschlossen, ein Ohr, Pfoten verschmolzen, Schwanz dicker'),
    'stufe-3-geometrisch': ('8 0 96 114', S3, 'Icon: glatte Profil-Silhouette, große Ohren, kurzer dicker Schwanz'),
    'stufe-4-kopf': ('6 2 88 98', S4, 'nur Kopf, für 16 px'),
}
for n, (vb, b, note) in items.items():
    with open(os.path.join(OUT, n + '.svg'), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" fill="currentColor"><!-- {note} -->{b}</svg>')
    print(n)
