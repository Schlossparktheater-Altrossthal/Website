import math, sys, os, base64
OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..','konzept')
SRC=os.path.join(os.path.dirname(__file__),'..','quellen','sommertheater-logo-1024.png')
B64=base64.b64encode(open(SRC,'rb').read()).decode()
u=1024/48; C=512
def P(r,a): a=math.radians(a); return C+r*math.cos(a), C+r*math.sin(a)
def arc(r1,r2,a1,a2,fill,op=1):
  x1,y1=P(r2,a1);x2,y2=P(r2,a2);x3,y3=P(r1,a2);x4,y4=P(r1,a1);L=1 if (a2-a1)%360>180 else 0
  return f'<path d="M{x1:.1f},{y1:.1f}A{r2},{r2} 0 {L} 1 {x2:.1f},{y2:.1f}L{x3:.1f},{y3:.1f}A{r1},{r1} 0 {L} 0 {x4:.1f},{y4:.1f}Z" fill="{fill}" opacity="{op}"/>'
# --- measured overlay (A)
meas=[('gelb',180.8,209.4),('ocker',214.6,245.7),('braun',250.8,289.2),('dunkelgrün',294.3,325.6),('grün',330.5,359.2)]
A=[f'<image href="data:image/png;base64,{B64}" width="1024" height="1024" opacity=".45"/>']
for r,c in [(457,'#d0021b'),(405,'#d0021b'),(362,'#0057d9'),(342,'#0057d9')]:
  A.append(f'<circle cx="512" cy="513" r="{r}" fill="none" stroke="{c}" stroke-width="2"/>')
for n,a1,a2 in meas:
  for a in (a1,a2):
    x,y=P(470,a); A.append(f'<line x1="512" y1="513" x2="{x:.0f}" y2="{y:.0f}" stroke="#d0021b" stroke-width="1" stroke-dasharray="4 4"/>')
  x,y=P(490,(a1+a2)/2); A.append(f'<text x="{x:.0f}" y="{y:.0f}" font-size="22" text-anchor="middle" fill="#000">{a2-a1:.1f}°</text>')
A.append('<line x1="0" y1="507" x2="1024" y2="507" stroke="#d0021b" stroke-width="1.5"/><line x1="0" y1="549" x2="1024" y2="549" stroke="#d0021b" stroke-width="1.5"/>')
A.append('<text x="990" y="535" font-size="20" text-anchor="end">Fuge 42 px</text><line x1="512" y1="0" x2="512" y2="1024" stroke="#000" stroke-width="1"/><line x1="0" y1="513" x2="1024" y2="513" stroke="#000" stroke-width="1"/>')
A.append('<text x="20" y="40" font-size="20">Mitte gemessen (512 | 513) · Ring 405–457 · Rahmen 342–362 · Lücken ≈ 5,1°</text>')
# --- proposed construction (B): unit u = 1/48 canvas
R={'ring_out':21.5*u,'ring_in':19*u,'frame_out':17*u,'frame_in':16*u}
B=[]
for i in range(49):
  w=1.2 if i%4==0 else .4
  B.append(f'<line x1="{i*u:.1f}" y1="0" x2="{i*u:.1f}" y2="1024" stroke="#9bb" stroke-width="{w}"/><line y1="{i*u:.1f}" x1="0" y2="{i*u:.1f}" x2="1024" stroke="#9bb" stroke-width="{w}"/>')
gap=2*u  # constant-width gaps everywhere
def seg(a1,a2,col):  # constant-width gap via angular offset at mid radius
  return arc(R['ring_in'],R['ring_out'],a1,a2,col)
cols=['#FED302','#C2921A','#72492D','#0F683E','#008C48']
rm=(R['ring_in']+R['ring_out'])/2; g=math.degrees(gap/rm)
# upper half: from 180+h to 360-h where h makes the horizontal band = gap
h=math.degrees(math.asin((gap/2)/rm))
span=(180-2*h-4*g)/5
a=180+h
for c in cols: B.append(seg(a,a+span,c)); a+=span+g
B.append(arc(R['ring_in'],R['ring_out'],h,180-h,'#054E6A'))
B.append(f'<circle cx="512" cy="512" r="{(R["frame_in"]+R["frame_out"])/2}" fill="none" stroke="#171717" stroke-width="{u}"/>')
B.append(f'<circle cx="512" cy="512" r="{R["frame_in"]}" fill="#fff" stroke="#e84820" stroke-dasharray="6 6"/>')
for r,l in [(R['ring_out'],'21,5u'),(R['ring_in'],'19u'),(R['frame_out'],'17u'),(R['frame_in'],'16u')]:
  B.append(f'<circle cx="512" cy="512" r="{r:.1f}" fill="none" stroke="#d0021b" stroke-width=".8" stroke-dasharray="3 3"/><text x="{512+r*0.707+4:.0f}" y="{512+r*0.707:.0f}" font-size="18" fill="#d0021b">{l}</text>')
B.append(f'<text x="20" y="40" font-size="20">u = 1/48 Kantenlänge · alle Fugen 2u · Segmente je {span:.1f}° · Fuge {g:.2f}°</text>')
B.append('<text x="512" y="560" font-size="26" text-anchor="middle" fill="#555">Bühnenbild (Vorhang · Katze · Boden)</text><text x="512" y="595" font-size="20" text-anchor="middle" fill="#555">Rahmen-Innenkreis r = 16u, Achse x = 24u</text>')
svg=lambda body,vb='0 0 1024 1024':f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="680" height="680" font-family="sans-serif">{"".join(body)}</svg>'
open(os.path.join(OUT,'A-messung.svg'),'w').write(svg(A,'0 -30 1024 1054'))
open(os.path.join(OUT,'B-konstruktion.svg'),'w').write(svg(B))
print('span',span,'gap deg',g,'h',h)
