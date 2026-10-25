import sys,math
from PIL import Image; import numpy as np
im=Image.open(sys.argv[1]).convert('RGBA')
if sys.argv[2]!='-': im=im.crop(tuple(map(int,sys.argv[2].split(','))))
a=np.array(im).astype(int); rgb=a[...,:3]
cand=(a[...,3]>128)&((rgb.max(2)-rgb.min(2))>40)
cx,cy,ro,ri=map(float,sys.argv[3:7])
for f in (0.08,0.5,0.92):
  r=ri+(ro-ri)*f; gaps=[];inside=False
  for ang in np.arange(178,362,0.02):
    t=math.radians(ang);x=int(round(cx+r*math.cos(t)));y=int(round(cy+r*math.sin(t)))
    v=cand[y,x]
    if not v and not inside: s=ang;inside=True
    if v and inside: gaps.append((s,ang));inside=False
  gaps=[g for g in gaps if g[1]-g[0]>1]
  print('r=%.0f'%r,' '.join('%.2f°/%.1fpx'%(g[1]-g[0],math.radians(g[1]-g[0])*r) for g in gaps[1:-1] ))
