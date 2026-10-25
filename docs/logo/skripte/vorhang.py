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

INNER = yx({220: 413, 240: 411, 260: 408, 280: 404, 300: 398, 320: 393, 340: 387, 360: 380, 380: 371, 400: 362,
            420: 351, 440: 338, 460: 324, 480: 307, 500: 287, 520: 263})
BAND_L = yx({250: 403, 280: 393, 300: 386, 320: 378, 340: 369, 360: 360, 380: 350, 400: 338, 420: 325, 440: 311,
             460: 295, 480: 276, 500: 254})
F2_L = yx({320: 324, 340: 317, 360: 309, 380: 300, 400: 291, 420: 280, 440: 268, 460: 255, 480: 241, 500: 225})
F2_R = yx({320: 331, 340: 327, 360: 322, 380: 315, 400: 307, 420: 297, 440: 287, 460: 275, 480: 260, 500: 241})
F3_L = yx({340: 270, 360: 263, 380: 256, 400: 248, 420: 239, 440: 230, 460: 220, 480: 210, 500: 201})
F3_R = yx({340: 273, 360: 269, 380: 264, 400: 259, 420: 252, 440: 244, 460: 235, 480: 224, 500: 209})
LOW_R = yx({570: 257, 600: 267, 620: 274, 640: 282, 660: 288, 680: 295, 700: 302, 720: 308, 740: 313, 760: 318, 780: 321})
LA_L = yx({570: 201, 600: 207, 640: 214, 680: 218}); LA_R = yx({570: 213, 600: 218, 640: 224, 680: 227})
LB_L = yx({570: 230, 600: 238, 640: 248, 680: 256, 720: 261}); LB_R = yx({570: 243, 600: 251, 640: 260, 680: 268, 720: 275})

TIE = (522, 566)                            # Raffhalter oben/unten
TIE_KNOT = (222, 256)                       # heller Knoten x


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
    tip, end = (418, TOP), (258, TIE[0] + 2)
    upper = f'<path fill="{RED}" d="M100,{TOP}H{tip[0]}{c(tip, end, INNER, log, "Innenkante")}H100Z"/>'
    btip, bend = (416, 200), (224, TIE[0] + 2)
    band = f'<path fill="{FOLD}" d="M{btip[0]},{btip[1]}{c(btip, end, INNER, log, "Saum rechts")}' \
           f'H{bend[0]}{c(bend, btip, BAND_L[::-1], log, "Saum links")}Z"/>'
    folds = ''
    for name, tp, l, r, e1, e2 in (('Falte A', (339, 274), F2_L, F2_R, (205, TIE[0] + 2), (214, TIE[0] + 2)),
                                   ('Falte B', (277, 316), F3_L, F3_R, (186, TIE[0] + 2), (196, TIE[0] + 2))):
        folds += f'<path fill="{FOLD}" d="M{tp[0]},{tp[1]}{c(tp, e2, r, log, name + " rechts")}' \
                 f'L{e1[0]},{e1[1]}{c(e1, tp, l[::-1], log, name + " links")}Z"/>'
    # Raffhalter
    tie = (f'<path fill="{FOLD}" d="M100,{TIE[0]}H{TIE_KNOT[0]}V{TIE[1]}H100Z"/>'
           f'<path fill="{RED}" d="M{TIE_KNOT[0]},{TIE[0] + 2}H{TIE_KNOT[1]}L{TIE_KNOT[1] - 4},{TIE[1]}H{TIE_KNOT[0]}Z"/>')
    # unterer Teil
    lo0, lo1 = (254, TIE[1]), (323, 800)
    lower = f'<path fill="{RED}" d="M100,{TIE[1]}H{lo0[0]}{c(lo0, lo1, LOW_R, log, "unten Kante")}H100Z"/>'
    for name, l, r, a0, a1, b0, b1 in (('unten A', LA_L, LA_R, (200, TIE[1]), (226, 720), (212, TIE[1]), (238, 720)),
                                       ('unten B', LB_L, LB_R, (229, TIE[1]), (272, 790), (242, TIE[1]), (286, 790))):
        lower += f'<path fill="{FOLD}" d="M{a0[0]},{a0[1]}{c(a0, a1, l, log, name + " links")}' \
                 f'L{b1[0]},{b1[1]}{c(b1, b0, r[::-1], log, name + " rechts")}Z"/>'
    side = upper + band + folds + tie + lower
    return val + swag1 + swag2, side, log


def _rev_sym(p0, pts, log, name):
    c1, c2, err = fit_sym(p0, pts); log.append((name, err))
    return f'L{1024 - p0[0]},{p0[1]}C{c2[0]:.1f},{c2[1]:.1f} {c1[0]:.1f},{c1[1]:.1f} {p0[0]},{p0[1]}'
