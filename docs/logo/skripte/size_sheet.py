"""Setzt die Einzel-Icons pixelgenau vergrößert zu konzept/katze/groessentest.png zusammen."""
import os, json
from PIL import Image, ImageDraw, ImageFont
here = os.path.dirname(__file__)
I = os.path.join(here, '..', 'konzept', 'katze', 'icons')
meta = json.load(open(os.path.join(I, 'meta.json'))); rows, sizes = meta['rows'], meta['sizes']
Z = 4; cell = [s * Z + 24 for s in sizes]; LW = 250
H = 60 + len(rows) * (max(sizes) * Z + 30) + 40 * 4
W = LW + sum(cell) + 40
img = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(img)
try:
    f = ImageFont.truetype('DejaVuSans.ttf', 16); fb = ImageFont.truetype('DejaVuSans-Bold.ttf', 20)
except OSError:
    f = fb = ImageFont.load_default()
x = LW
for s, c in zip(sizes, cell):
    d.text((x, 20), f'{s} px (×{Z})', fill='black', font=f); x += c
y = 50; last = None
for i, r in enumerate(rows):
    if r['layout'] != last:
        d.text((10, y + 6), r['layout'], fill='black', font=fb); y += 40; last = r['layout']
    d.text((10, y + 20), r['level'].replace('stufe-', 'Stufe ').replace('-', ' '), fill='#333', font=f)
    x = LW
    for s, c in zip(sizes, cell):
        ic = Image.open(os.path.join(I, f'{i}-{s}.png')).convert('RGB')
        img.paste(ic.resize((s * Z, s * Z), Image.NEAREST), (x, y)); x += c
    y += max(sizes) * Z + 30 - (max(sizes) - 48) * Z if False else max(sizes) * Z + 30
img = img.crop((0, 0, W, y + 10))
img.save(os.path.join(here, '..', 'konzept', 'katze', 'groessentest.png'))
print(img.size)
