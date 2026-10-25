"""Vorhang aus wenigen Bézierkurven konstruieren (statt Pixel-Nachzeichnung).

Jede Kante ist EINE kubische Bézierkurve mit festen Endpunkten. Die beiden Kontrollpunkte werden per
Least-Squares an Messpunkte aus dem Original angepasst (Messpunkte unten, gemessen 2026-10-25,
1024er-Raster). Schabracke: symmetrische Kurven (Kontrollpunkte gespiegelt). Seitenvorhang: linke Hälfte,
im Logo an x = 512 gespiegelt.
"""
import numpy as np
from scipy.optimize import least_squares

T = np.linspace(0, 1, 400)


def bez(p0, c1, c2, p3, t=T):
    p0, c1, c2, p3 = map(np.asarray, (p0, c1, c2, p3))
    t = t[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t ** 2 * c2 + t ** 3 * p3


def _resid(curve, pts):
    d = np.linalg.norm(curve[None, :, :] - np.asarray(pts, float)[:, None, :], axis=2)
    return d.min(1)


def fit(p0, p3, pts):
    """Kontrollpunkte für Kurve p0→p3 durch pts. Rückgabe (c1, c2, max. Abweichung px)."""
    p0, p3 = np.asarray(p0, float), np.asarray(p3, float)
    x0 = np.r_[p0 + (p3 - p0) / 3, p0 + 2 * (p3 - p0) / 3]
    r = least_squares(lambda v: _resid(bez(p0, v[:2], v[2:], p3), pts), x0)
    return r.x[:2], r.x[2:], _resid(bez(p0, r.x[:2], r.x[2:], p3), pts).max()


def fit_sym(p0, pts, cx=512):
    """Symmetrische Kurve p0 → Spiegelpunkt; pts nur linke Hälfte."""
    p0 = np.asarray(p0, float); p3 = np.array([2 * cx - p0[0], p0[1]])
    f = lambda v: _resid(bez(p0, v, (2 * cx - v[0], v[1]), p3), pts)
    r = least_squares(f, [p0[0] + 40, p0[1] + 40])
    return r.x, np.array([2 * cx - r.x[0], r.x[1]]), f(r.x).max()


def yx(d):   # {y: x} → [(x, y)]
    return [(x, y) for y, x in d.items()]


def xy(d):   # {x: y} → [(x, y)]
    return list(d.items())


# --- Messpunkte -----------------------------------------------------------------
TOP = 186                                   # Oberkante Vorhang/Schabracke
VAL_BOTTOM = xy({408: 301, 416: 309, 424: 315, 432: 320, 440: 325, 448: 330, 456: 334, 464: 337,
                 472: 340, 480: 342, 488: 344, 496: 345, 504: 346, 512: 346})
SWAG1_TOP = xy({416: 227, 424: 233, 432: 237, 440: 241, 448: 245, 456: 248, 464: 250, 472: 252, 480: 253, 496: 256, 512: 257})
SWAG1_BOT = xy({424: 235, 432: 241, 440: 247, 448: 251, 456: 255, 464: 259, 472: 261, 480: 263, 496: 266, 512: 267})
SWAG2_TOP = xy({416: 266, 424: 272, 432: 277, 440: 281, 448: 285, 456: 289, 464: 292, 472: 294, 480: 296, 512: 299})
SWAG2_BOT = xy({416: 274, 424: 282, 432: 289, 440: 295, 448: 300, 456: 305, 464: 308, 472: 311, 480: 314, 496: 317, 512: 318})

INNER = yx({510: 276, 220: 413, 240: 411, 260: 408, 280: 404, 300: 398, 320: 393, 340: 387, 360: 380, 380: 371, 400: 362,
            420: 351, 440: 338, 460: 324, 480: 307, 500: 287, 520: 263})
BAND_L = yx({250: 403, 280: 393, 300: 386, 320: 378, 340: 369, 360: 360, 380: 350, 400: 338, 420: 325, 440: 311,
             460: 295, 480: 276, 500: 253.5, 510: 240.8, 516: 232.5, 520: 226.5, 522: 223.4})
F2_L = yx({320: 324, 340: 317, 360: 309, 380: 300, 400: 291, 420: 280, 440: 268, 460: 255, 480: 240.5, 500: 224.9,
            510: 217.4, 516: 212.5, 520: 209.3})
F2_R = yx({320: 331, 340: 327, 360: 322, 380: 315, 400: 307, 420: 297, 440: 287, 460: 275, 480: 260.3, 500: 241.5,
            510: 230.5, 516: 223.3, 520: 218.4})
F3_L = yx({340: 270, 360: 263, 380: 256, 400: 248, 420: 239, 440: 230, 460: 220, 480: 209.7, 500: 200.2,
            510: 194.8, 514: 192.5})
F3_R = yx({340: 273, 360: 269, 380: 264, 400: 259, 420: 252, 440: 244, 460: 235, 480: 224.6, 500: 209.5,
            510: 200.5, 514: 196.8})
LOW_R = yx({570: 257, 600: 267, 620: 274, 640: 282, 660: 288, 680: 295, 700: 302, 720: 308, 740: 313, 760: 318, 780: 321})
LA_L = yx({570: 201, 600: 207, 640: 214, 680: 218}); LA_R = yx({570: 213, 600: 218, 640: 224, 680: 227})
LB_L = yx({564: 228, 570: 230, 600: 238, 640: 248, 680: 256, 720: 261}); LB_R = yx({561: 242, 570: 243, 600: 251, 640: 260, 680: 268, 720: 275})

TIE = (522, 566)                            # Falten oben laufen bis unter das Band, unten beginnen sie darin
# Raffhalter (gemessen bei 8-facher Vergrößerung, beide Seiten verglichen):
# Band-Oberkante: Bogen, auf dem die oberen Bahnen schräg enden; fällt nach rechts zum Knoten ab
# gemessen subpixelgenau (Hell/Dunkel-Übergang im Grünkanal); die mittlere Bahn endet NICHT am Band,
# sondern läuft zwischen Falte A und Saum zu einer Spitze bei (215 | 524) zusammen
BAND_TOP = xy({171: 513, 184: 516, 193: 518, 201: 520, 209: 521.5, 215: 523.5})
# Band-Unterkante: hängt leicht durch, schneidet die unteren Bahnen schräg an; ab x = 213 steigt sie als
# Oberkante der hellen Bahn unter dem Knoten schräg zur unteren linken Knotenecke an (kein dunkler Streifen)
BAND_BOT = xy({200: 565.5, 185: 564, 174: 562.8})
# Knoten (helle Schlaufe vorn): Ecken leicht gerundet
KNOT = dict(tl=(223.5, 527.5), tr=(256, 526.5), br=(252.5, 556.5), bl=(223.5, 564), r=1)


def c(p0, p3, pts, log, name):
    c1, c2, err = fit(p0, p3, pts); log.append((name, err))
    return f'C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p3[0]:.1f},{p3[1]:.1f}'


def cs(p0, pts, log, name):
    c1, c2, err = fit_sym(p0, pts); log.append((name, err))
    return f'C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {1024 - p0[0]:.1f},{p0[1]:.1f}'


def build(RED, FOLD):
    log = []
    # Schabracke (ganz, symmetrisch): Fläche + zwei sichelförmige Faltenbänder
    v0 = (400, 292)
    c1, c2, e = fit_sym(v0, VAL_BOTTOM); log.append(('Schabracke unten', e))
    val = f'<path fill="{RED}" d="M{v0[0]},{TOP}H{1024 - v0[0]}V{v0[1]}C{c2[0]:.1f},{c2[1]:.1f} {c1[0]:.1f},{c1[1]:.1f} {v0[0]},{v0[1]}Z"/>'
    s1, s2 = (410, 220), (406, 260)
    swag1 = f'<path fill="{FOLD}" d="M{s1[0]},{s1[1]}{cs(s1, SWAG1_TOP, log, "Falte 1 oben")}' \
            f'L{1024 - s1[0]},{s1[1]}' + _rev_sym(s1, SWAG1_BOT, log, 'Falte 1 unten') + 'Z"/>'
    swag2 = f'<path fill="{FOLD}" d="M{s2[0]},{s2[1]}{cs(s2, SWAG2_TOP, log, "Falte 2 oben")}' \
            + _rev_sym(s2, SWAG2_BOT, log, 'Falte 2 unten') + 'Z"/>'
    # Seitenvorhang links oben: außen nur Gerade, der Bühnenkreis schneidet ab
    # Silhouette dunkel (eine einzige Außenkante), helle Fläche darüber endet an der linken Saumkante
    tip, end = (418, TOP), (257.5, 527)
    # Oberkante außen: Schräge von der Ecke (418|186) zum Rahmen (gemessen (390|195), (410|188)), Steigung 0,34
    btip, bend = (414, 214), (217.2, 526)
    top_out = f'M100,{TOP + (418 - 100) * 0.34:.1f}L418,{TOP}'
    upper = f'<path fill="{FOLD}" d="{top_out}{c(tip, end, INNER, log, "Innenkante")}L256,532H100Z"/>'
    band = f'<path fill="{RED}" d="{top_out}H421L{btip[0]},{btip[1]}{c(btip, bend, BAND_L, log, "Saum links")}H100Z"/>'
    folds = ''
    for name, tp, l, r, e1, e2 in (('Falte A', (339, 274), F2_L, F2_R, (204.5, 526), (211, 526)),
                                   ('Falte B', (277, 316), F3_L, F3_R, (185.6, 526), (185.7, 526))):
        folds += f'<path fill="{FOLD}" d="M{tp[0]},{tp[1]}{c(tp, e2, r, log, name + " rechts")}' \
                 f'L{e1[0]},{e1[1]}{c(e1, tp, l[::-1], log, name + " links")}Z"/>'
    # Raffhalter
    # Band: Oberkante als ein Bogen bis unter den Knoten, rechts verdeckt der Knoten, Unterkante durchhängend
    b0, b1, bl = (150, 508), (222, 525.5), KNOT['bl']
    tie = (f'<path fill="{FOLD}" d="M{b0[0]},{b0[1]}{c(b0, b1, BAND_TOP, log, "Band oben")}'
           f'L240,527L240,556L225,563.5L213,566.5{c((213, 566.5), (150, 561.5), BAND_BOT, log, "Band unten")}Z"/>')
    tie += knot(RED)
    # unterer Teil
    lo0, lo1 = KNOT['br'], (323, 800)
    lower = f'<path fill="{RED}" d="M100,540H246L{lo0[0]},{lo0[1]}{c(lo0, lo1, LOW_R, log, "unten Kante")}H100Z"/>'
    for name, l, r, a0, a1, b0, b1 in (('unten A', LA_L, LA_R, (197, 545), (226, 720), (209, 545), (238, 720)),
                                       ('unten B', LB_L, LB_R, (223.3, 545), (272, 790), (237.8, 545), (286, 790))):
        lower += f'<path fill="{FOLD}" d="M{a0[0]},{a0[1]}{c(a0, a1, l, log, name + " links")}' \
                 f'L{b1[0]},{b1[1]}{c(b1, b0, r[::-1], log, name + " rechts")}Z"/>'
    side = upper + band + folds + lower + tie
    return val + swag1 + swag2, side, log


def _rev_sym(p0, pts, log, name):
    c1, c2, err = fit_sym(p0, pts); log.append((name, err))
    return f'L{1024 - p0[0]},{p0[1]}C{c2[0]:.1f},{c2[1]:.1f} {c1[0]:.1f},{c1[1]:.1f} {p0[0]},{p0[1]}'


def knot(fill):
    """Knoten: Oberkante hängt ~1,5 px durch, Ecke oben links leicht gerundet (r), oben rechts spitz
    (stößt dort an die Vorhang-Innenkante), rechte Seite leicht eingezogen bis zur Einschnürung,
    Unterkante hängt ~1 px durch, Ecke unten links leicht gerundet."""
    tl, tr, br, bl, r = KNOT['tl'], KNOT['tr'], KNOT['br'], KNOT['bl'], KNOT['r']
    return (f'<path fill="{fill}" d="M{tl[0]},{tl[1] + r}Q{tl[0]},{tl[1]} {tl[0] + r},{tl[1]}'
            f'Q{(tl[0] + tr[0]) / 2},{(tl[1] + tr[1]) / 2 + 3} {tr[0]},{tr[1]}'
            f'C{tr[0]},{tr[1] + 12} {br[0] + 2.5},{br[1] - 8} {br[0]},{br[1]}'
            f'Q{(br[0] + bl[0]) / 2},{(br[1] + bl[1]) / 2 + 2} {bl[0] + r},{bl[1]}Q{bl[0]},{bl[1]} {bl[0]},{bl[1] - r}Z"/>')
