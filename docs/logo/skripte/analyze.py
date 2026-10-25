import sys,math,collections
from PIL import Image; import numpy as np
from skimage import measure
im=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
H,W,_=im.shape
nonwhite=(im.min(axis=2)<200)
ys,xs=np.nonzero(nonwhite); print('bbox x',xs.min(),xs.max(),'y',ys.min(),ys.max())
pal={'yellow':(255,212,0),'ochre':(192,148,26),'brown':(117,75,45),'dkgreen':(18,108,64),'green':(0,140,72),'blue':(6,78,106),'black':(26,26,26),'red':(232,72,32),'dkred':(160,10,10),'wood':(192,122,48)}
def nearest(c):
  return min(pal,key=lambda k:sum((a-b)**2 for a,b in zip(pal[k],c)))
# fit circles to colour regions
def fitcircle(x,y):
  A=np.c_[2*x,2*y,np.ones(len(x))]; b=x**2+y**2; c=np.linalg.lstsq(A,b,rcond=None)[0]; r=math.sqrt(c[2]+c[0]**2+c[1]**2); return c[0],c[1],r
for k in ['yellow','ochre','brown','dkgreen','green','blue','black']:
  d=((im-np.array(pal[k]))**2).sum(axis=2)<1800
  if k=='black': d&=True
  lab=measure.label(d); props=sorted(measure.regionprops(lab),key=lambda p:-p.area)[:1]
  for p in props:
    m=lab==p.label
    # boundary pixels -> inner/outer radius around rough center
    yy,xx=np.nonzero(m); cx0,cy0=511.5,511.5
    rr=np.hypot(xx-cx0,yy-cy0); ang=np.degrees(np.arctan2(yy-cy0,xx-cx0))%360
    edge=m & ~np.roll(m,1,0) | m & ~np.roll(m,-1,0) | m& ~np.roll(m,1,1) | m & ~np.roll(m,-1,1)
    ey,ex=np.nonzero(edge); er=np.hypot(ex-cx0,ey-cy0)
    outer=er>np.median(rr); 
    print(f"{k:8s} area={int(p.area):6d} col={tuple(im[m].mean(0).astype(int))} r_in~{np.percentile(rr,1):.1f} r_out~{np.percentile(rr,99):.1f} ang {ang.min():.1f}-{ang.max():.1f}",
      'fit_out',tuple(round(v,1) for v in fitcircle(ex[outer].astype(float),ey[outer].astype(float))),
      'fit_in',tuple(round(v,1) for v in fitcircle(ex[~outer].astype(float),ey[~outer].astype(float))))
