import sys,math,collections
from PIL import Image; import numpy as np
im=Image.open(sys.argv[1]).convert('RGBA'); 
if len(sys.argv)>2: im=im.crop(tuple(map(int,sys.argv[2].split(','))))
a=np.array(im).astype(int); H,W,_=a.shape
rgb=a[...,:3]; op=a[...,3]>128
# ring pixels: saturated colors, exclude near-white
sat=(rgb.max(2)-rgb.min(2))>40
cand=op&sat
# rough center: blue ring lower + whole bbox
ys,xs=np.nonzero(cand)
def fit(x,y):
  A=np.c_[2*x,2*y,np.ones(len(x))]; b=x**2+y**2; c=np.linalg.lstsq(A,b,rcond=None)[0]; return c[0],c[1],math.sqrt(c[2]+c[0]**2+c[1]**2)
# outer edge per angle
cx,cy=(xs.min()+xs.max())/2,(ys.min()+ys.max())/2
R0=(xs.max()-xs.min())/2
pts_o=[];pts_i=[]
for ang in np.arange(0,360,0.25):
  t=math.radians(ang); prof=[]
  for r in np.arange(R0*0.75,R0*1.05,0.5):
    x=int(cx+r*math.cos(t)); y=int(cy+r*math.sin(t))
    if 0<=x<W and 0<=y<H: prof.append((r,cand[y,x],x,y))
  on=[p for p in prof if p[1]]
  if on: pts_o.append((on[-1][2],on[-1][3])); pts_i.append((on[0][2],on[0][3]))
po=np.array(pts_o,float);pi=np.array(pts_i,float)
fo=fit(po[:,0],po[:,1]); fi=fit(pi[:,0],pi[:,1]); cx,cy=fo[0],fo[1]; Ro=fo[2]
print('outer fit',[round(v,1) for v in fo],'inner fit',[round(v,1) for v in fi])
print('ring width / Ro = %.4f'%((fo[2]-fi[2])/Ro))
# angular segments at mid radius
rm=(fo[2]+fi[2])/2; runs=[];cur=None
for ang in np.arange(0,360,0.05):
  t=math.radians(ang); x=int(round(cx+rm*math.cos(t))); y=int(round(cy+rm*math.sin(t)))
  c=tuple(rgb[y,x]) if cand[y,x] else None
  key=None if c is None else tuple(v//24 for v in c)
  if cur and key and sum(abs(p-q) for p,q in zip(key,cur[2]))<=3: cur[1]=ang; cur[3].append(c)
  else:
    if key: cur=[ang,ang,key,[c]]; runs.append(cur)
    else: cur=None
runs=[r for r in runs if r[1]-r[0]>2]
for r in runs:
  col=np.median(np.array(r[3]),0).astype(int); print('seg %.2f-%.2f span %.2f  #%02X%02X%02X'%(r[0],r[1],r[1]-r[0],*col))
for i in range(len(runs)-1): print('gap %.2f'%(runs[i+1][0]-runs[i][1]),end='  ')
# horizontal band: find y extents of gap at left side x=cx-rm
print()
for side in (-1,1):
  x=int(cx+side*rm); col=cand[:,x]; ys=[y for y in range(int(cy-0.2*Ro),int(cy+0.2*Ro)) if not col[y]]
  if ys: print('side',side,'gap y %d-%d  => band %.4f Ro, centre offset %.4f Ro'%(ys[0],ys[-1],(ys[-1]-ys[0]+1)/Ro,((ys[0]+ys[-1])/2-cy)/Ro))
