import os, sys
import numpy as np
from PIL import Image
def load(p):
    o=Image.open(p).convert('RGBA'); return Image.alpha_composite(Image.new('RGBA',o.size,'white'),o).convert('RGB')
o=load(os.path.join(os.path.dirname(__file__), '..', 'quellen', 'sommertheater-logo-1024.png')); r=load(sys.argv[1])
box=(150,170,530,830)
oc,rc=o.crop(box),r.crop(box)
# Kantenvergleich: Original-Kanten magenta über Rohfassung
def cls(im):
    a=np.array(im).astype(int); R,G,B=a[...,0],a[...,1],a[...,2]
    c=np.zeros(R.shape,int); c[(R>190)&(G>45)&(G<120)&(B<80)]=1; c[(R>120)&(G<45)&(B<45)]=2; return c
co,cr=cls(oc),cls(rc)
edge=np.zeros(co.shape,bool); edge[:-1]|=co[:-1]!=co[1:]; edge[:,:-1]|=co[:,:-1]!=co[:,1:]
ov=np.array(rc).copy(); ov[edge]=[0,200,255]
mism=(co!=cr)&(co>0)|(co!=cr)&(cr>0)
print('Fehlpixel Vorhang links:',mism.sum(),'von',(co>0).sum(), f'= {100*mism.sum()/(co>0).sum():.1f} %')
out=Image.new('RGB',(3*380+20,660),'white')
out.paste(oc,(0,0)); out.paste(Image.fromarray(ov),(390,0))
m=np.array(rc).copy(); m[mism]=[0,0,0]; out.paste(Image.fromarray(m),(780,0))
out.resize((out.width*3//2,out.height*3//2)).save(sys.argv[2])
