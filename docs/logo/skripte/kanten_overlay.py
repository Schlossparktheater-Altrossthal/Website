import sys, numpy as np
from PIL import Image, ImageDraw
from skimage import measure
def g(p):
    a=np.array(Image.open(p).convert('RGBA')).astype(float); return a
x0,y0,w,h,s=[int(v) for v in sys.argv[1:6]]
def masks(p):
    a=g(p)[y0:y0+h,x0:x0+w]; al=a[...,3]/255 if a.shape[2]==4 else 1
    light=np.clip((a[...,1]-10)/62,0,1)                       # hell vs dunkelrot
    bg=np.clip((a[...,2]-80)/100,0,1)                          # weiß (Blau hoch)
    return light, bg
r=Image.open(sys.argv[7]).convert('RGBA'); r=Image.alpha_composite(Image.new('RGBA',r.size,'white'),r).convert('RGB').crop((x0,y0,x0+w,y0+h)).resize((w*s,h*s),Image.LANCZOS)
d=ImageDraw.Draw(r)
for src,col,wd in ((__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'quellen', 'sommertheater-logo-1024.png'),(0,255,255),3),(sys.argv[7],(255,255,0),1)):
    o=Image.open(src).convert('RGBA'); o=np.array(Image.alpha_composite(Image.new('RGBA',o.size,'white'),o)).astype(float)[y0:y0+h,x0:x0+w]
    for m in (np.clip((o[...,1]-10)/62,0,1)*(o[...,2]<120), np.clip((o[...,2]-80)/100,0,1)):
        for c in measure.find_contours(m,0.5):
            d.line([(x*s+s/2,y*s+s/2) for y,x in c],fill=col,width=wd)
r.save(sys.argv[6])
