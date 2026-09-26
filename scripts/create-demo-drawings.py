"""Reproducible schematic fixture, not a production drawing. Requires reportlab."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "drawings"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1000, 700

def text(c, x, y, label, size=10, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, H-y, label)

def line(c, x1, y1, x2, y2):
    c.line(x1, H-y1, x2, H-y2)

def rect(c, x, y, w, h):
    c.rect(x, H-y-h, w, h)

def arrow(c, x, y, dx, dy):
    line(c, x, y, x+dx*7-dy*3, y+dy*7+dx*3)
    line(c, x, y, x+dx*7+dy*3, y+dy*7-dx*3)

def dim(c, x1, x2, y, base, label):
    c.setLineWidth(.5)
    line(c, x1, base, x1, y-8); line(c, x2, base, x2, y-8)
    line(c, x1, y, x2, y); arrow(c,x1,y,1,0); arrow(c,x2,y,-1,0)
    c.setFillColor(HexColor("#ffffff")); c.rect((x1+x2)/2-42,H-y-1,84,15,fill=1,stroke=0)
    c.setFillColor(HexColor("#18222b")); text(c,(x1+x2)/2-36,y-3,label,11)

def frame(c, rev, page):
    c.setStrokeColor(HexColor("#18222b")); c.setFillColor(HexColor("#18222b")); c.setLineWidth(.65)
    rect(c,30,30,940,640)
    for x in range(1,6):
        line(c,30+x*156.66,30,30+x*156.66,39)
        text(c,105+(x-1)*156.66,24,str(x),8)
    text(c,52,66,"CALLIPER  /  ENGINEERING DEMO",11,True)
    text(c,52,90,"PRECISION MOUNTING BRACKET",22,True)
    text(c,52,112,"FC-1042   /   ALUMINIUM 6061-T6   /   DIMENSIONS IN mm",10)
    text(c,758,66,f"REVISION {rev}    -    SHEET {page} OF 2",10,True)
    line(c,30,586,970,586); line(c,610,586,610,670); line(c,820,586,820,670)
    text(c,48,607,"FIXTURE DRAWING - NOT FOR PRODUCTION",11,True)
    text(c,48,627,"Authored dimensions for a reproducible DFM demonstration.",10)
    text(c,48,646,"Views are schematic. Do not scale. Engineering validation pending.",9)
    text(c,628,607,"PART NUMBER",8); text(c,628,630,"FC-1042",18,True)
    text(c,628,651,"Precision mounting bracket",10)
    text(c,838,607,"REV",8); text(c,838,632,rev,20,True)
    text(c,890,607,"SHEET",8); text(c,890,632,f"{page}/2",16)
    text(c,838,653,"SCALE: SCHEMATIC",8)

for rev in ("A", "B"):
    revised = rev == "B"
    c = canvas.Canvas(str(OUT / f"cnc-bracket-rev-{rev.lower()}.pdf"), pagesize=(W,H), invariant=1)
    c.setTitle(f"FC-1042 bracket - revision {rev} - demonstration fixture")
    frame(c,rev,1)
    text(c,105,157,"01   PLAN VIEW",10,True)
    c.setLineWidth(1.6)
    c.roundRect(160,H-410,310,190,12,stroke=1,fill=0)
    c.roundRect(215,H-355,195,90,8 if revised else 2,stroke=1,fill=0)
    for x in (182,448):
        for y in (242,388):
            c.circle(x,H-y,8,stroke=1,fill=0)
            c.setLineWidth(.4); line(c,x-14,y,x+14,y); line(c,x,y-14,x,y+14); c.setLineWidth(1.6)
    c.setLineWidth(.5); c.setDash([10,4,2,4])
    line(c,130,315,510,315); c.setDash()
    text(c,128,306,"A",11,True); text(c,506,306,"A",11,True)
    dim(c,160,470,190,220,"80")
    text(c,210,247,"POCKET 12 WIDE x 24 DEEP" if revised else "POCKET 8 WIDE x 40 DEEP",11,True)
    line(c,280,253,290,277); arrow(c,290,277,-.4,-1)
    line(c,407,350,452,370); line(c,452,370,525,370)
    text(c,363,342,"4X INTERNAL R3.5" if revised else "4X INTERNAL R0.5",11,True)
    dim(c,160,470,450,410,"80")
    text(c,176,485,"4X MOUNTING HOLES THRU",9)
    text(c,623,157,"02   SECTION A-A",10,True)
    c.setLineWidth(1.5)
    path=c.beginPath(); path.moveTo(644,H-239); path.lineTo(686,H-239); path.lineTo(686,H-366); path.lineTo(769,H-366); path.lineTo(769,H-239); path.lineTo(813,H-239); path.lineTo(813,H-425); path.lineTo(644,H-425); path.close(); c.drawPath(path)
    c.saveState(); c.clipPath(path, stroke=0, fill=0); c.setLineWidth(.45)
    for offset in range(-190,190,12): line(c,644+offset,239,830+offset,425)
    c.restoreState(); c.setLineWidth(1.2); c.setFillColor(HexColor("#ffffff"))
    c.rect(656,H-239-(64 if revised else 90),16,64 if revised else 90,stroke=1,fill=1)
    c.rect(785,H-239-(64 if revised else 90),16,64 if revised else 90,stroke=1,fill=1)
    c.setFillColor(HexColor("#18222b"))
    text(c,645,205,"2X DIA 6 BLIND, DEPTH 24" if revised else "2X DIA 4 BLIND, DEPTH 32",11,True)
    c.setLineWidth(.5); line(c,673,211,664,263); arrow(c,664,263,0,-1)
    text(c,680,460,"POCKET SECTION",9)
    text(c,55,537,"GENERAL NOTES",9,True)
    text(c,55,554,"1. Material: aluminium 6061-T6.   2. Deburr edges.   3. General tolerance: +/-0.10 mm unless stated.",10)
    text(c,55,573,"4. Locating span and functional tolerance: see sheet 2.   5. Surface finish to be agreed for the demonstration.",10)
    c.showPage()
    frame(c,rev,2)
    text(c,180,175,"03   LOCATING FEATURE DETAIL",11,True)
    text(c,180,198,"Tolerance callout is retained in both revisions for engineer review.",10)
    dim(c,275,705,256,325,"40.00 +/-0.01")
    text(c,375,292,"LOCATING SPAN 40.00 +/-0.01",13,True)
    c.setLineWidth(1.6); rect(c,210,326,560,150)
    for x in (275,705):
        c.circle(x,H-396,22,stroke=1,fill=0)
        c.setLineWidth(.5); c.setDash([8,3,2,3]); line(c,x,312,x,494); line(c,x-38,396,x+38,396); c.setDash(); c.setLineWidth(1.6)
    text(c,210,516,"ENGINEERING REVIEW",10,True)
    text(c,210,538,"Confirm the assembly requirement and supplier process capability before changing this tolerance.",10)
    text(c,210,557,"The drawing does not establish functional criticality or certify manufacturability.",10)
    c.save()
    print(OUT / f"cnc-bracket-rev-{rev.lower()}.pdf")
