"""Spiegelprobe: Original und horizontal gespiegeltes Logo 50/50 überblenden."""
import os, sys
from PIL import Image
here = os.path.dirname(__file__)
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'quellen', 'sommertheater-logo-1024.png')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'konzept', 'spiegel-check.png')
im = Image.open(src).convert('RGBA')
flat = Image.alpha_composite(Image.new('RGBA', im.size, 'white'), im).convert('RGB')
Image.blend(flat, flat.transpose(Image.FLIP_LEFT_RIGHT), 0.5).save(out)
