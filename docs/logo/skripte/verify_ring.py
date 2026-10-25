"""Konstruierten Ring über das BSZ-Original legen: Abweichungen rot (nur BSZ) / blau (nur Konstruktion)."""
import math, os, sys
from PIL import Image, ImageDraw
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import ring_geometry as g

here = os.path.dirname(__file__)
CX, CY, R = 415.5, 395.5, 297.9          # Kreis-Fit am BSZ-Logo (Crop 0,0,772,772)
src = Image.open(os.path.join(here, '..', 'quellen', 'bsz-agrar-logo.png')).convert('RGBA').crop((0, 0, 772, 772))
a = np.array(src).astype(int); rgb = a[..., :3]
bsz = (a[..., 3] > 128) & ((rgb.max(2) - rgb.min(2)) > 40)
yy, xx = np.mgrid[:772, :772]; rr = np.hypot(xx - CX, yy - CY)
bsz &= (rr > R * 0.8) & (rr < R * 1.05)        # nur Ring, ohne Blätter

S = 4  # Supersampling
im = Image.new('L', (772 * S, 772 * S), 0); d = ImageDraw.Draw(im)
for name, ((ro, a1, a2), (ri, b1, b2)) in g.segments():
    if a2 < a1: a2 += 360
    if b2 < b1: b2 += 360
    pts = [(CX + ro * R * math.cos(math.radians(t)), CY + ro * R * math.sin(math.radians(t))) for t in np.linspace(a1, a2, 400)]
    pts += [(CX + ri * R * math.cos(math.radians(t)), CY + ri * R * math.sin(math.radians(t))) for t in np.linspace(b2, b1, 400)]
    d.polygon([(x * S, y * S) for x, y in pts], fill=255)
con = np.array(im.resize((772, 772), Image.LANCZOS)) > 127

iou = (bsz & con).sum() / (bsz | con).sum()
out = np.full((772, 772, 3), 255, np.uint8)
out[bsz & con] = (190, 190, 190); out[bsz & ~con] = (220, 20, 40); out[con & ~bsz] = (20, 80, 220)
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'konzept', 'ring-bsz-abgleich.png')
Image.fromarray(out).save(dst)
print(f'IoU {iou:.4f}  nur BSZ {int((bsz & ~con).sum())} px  nur Konstruktion {int((con & ~bsz).sum())} px  Ring {int(bsz.sum())} px')
