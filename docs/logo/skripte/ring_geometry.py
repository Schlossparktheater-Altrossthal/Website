"""Ring-Konstruktion nach dem BSZ-Agrar-Logo (gemessen, Maße relativ zum Außenradius R).

Fugen haben parallele Kanten: jede Segmentkante ist eine Gerade im Abstand gap/2
zur radialen Mittellinie der Fuge bzw. zur waagerechten Mittellinie des Querbands.
"""
import math

R_IN = 0.8909          # Innenradius / R   (BSZ: 265,4 / 297,9)
GAP = 0.0772           # Breite der Fugen zwischen den oberen Segmenten / R (23 px)
BAND = 0.0738          # Breite der waagerechten Fuge / R (22 px)
BAND_OFFSET = 0.0201   # Mitte der waagerechten Fuge liegt so weit UNTER dem Kreismittelpunkt
GAP_ANGLES = (270 - 56.14, 270 - 19.56, 270 + 19.56, 270 + 56.14)  # Fugen-Mittellinien (SVG-Winkel, y nach unten)

COLORS = {  # BSZ-Farben, von links unten im Uhrzeigersinn
    'gelb': '#FFDD00', 'ocker': '#C7A100', 'braun': '#744A27',
    'dunkelgruen': '#015824', 'gruen': '#09783A', 'blau': '#004D6B',
}
UPPER = ('gelb', 'ocker', 'braun', 'dunkelgruen', 'gruen')


def _radial_edge(theta, side, r):
    """Winkel, unter dem die zur Fugenmitte theta parallele Kante (Abstand GAP/2) den Kreis r schneidet."""
    return theta + side * math.degrees(math.asin((GAP / 2) / r))


def _band_edge(y, r, left):
    """Winkel des Schnittpunkts der Waagerechten y (relativ zur Mitte, nach unten positiv) mit Kreis r."""
    a = math.degrees(math.asin(y / r))
    return 180 - a if left else a % 360


def segments():
    """Liefert [(name, [(r, winkel_start, winkel_ende) für Außen- und Innenbogen])]."""
    top_y = BAND_OFFSET - BAND / 2      # obere Kante des Querbands
    bot_y = BAND_OFFSET + BAND / 2      # untere Kante
    out = []
    bounds = [None, *GAP_ANGLES, None]
    for i, name in enumerate(UPPER):
        arcs = []
        for r in (1.0, R_IN):
            a1 = _band_edge(top_y, r, True) if bounds[i] is None else _radial_edge(bounds[i], +1, r)
            a2 = _band_edge(top_y, r, False) if bounds[i + 1] is None else _radial_edge(bounds[i + 1], -1, r)
            arcs.append((r, a1, a2))
        out.append((name, arcs))
    arcs = [(r, _band_edge(bot_y, r, False), _band_edge(bot_y, r, True)) for r in (1.0, R_IN)]
    out.append(('blau', arcs))
    return out


def svg_paths(cx, cy, R, fill=True, stroke=None):
    def pt(r, a):
        t = math.radians(a)
        return cx + r * R * math.cos(t), cy + r * R * math.sin(t)
    res = []
    for name, ((ro, a1, a2), (ri, b1, b2)) in segments():
        large = 1 if (a2 - a1) % 360 > 180 else 0
        p = [pt(ro, a1), pt(ro, a2), pt(ri, b2), pt(ri, b1)]
        d = (f'M{p[0][0]:.2f},{p[0][1]:.2f}A{ro*R:.2f},{ro*R:.2f} 0 {large} 1 {p[1][0]:.2f},{p[1][1]:.2f}'
             f'L{p[2][0]:.2f},{p[2][1]:.2f}A{ri*R:.2f},{ri*R:.2f} 0 {large} 0 {p[3][0]:.2f},{p[3][1]:.2f}Z')
        f = COLORS[name] if fill else 'none'
        s = f' stroke="{stroke}" stroke-width="2"' if stroke else ''
        res.append(f'<path d="{d}" fill="{f}"{s}/>')
    return res


def spans():
    """Segmentwinkel an der Ringmitte (zum Vergleich mit der Messung)."""
    rm = (1 + R_IN) / 2
    top = BAND_OFFSET - BAND / 2
    edges = [_band_edge(top, rm, True)]
    for g in GAP_ANGLES:
        edges += [_radial_edge(g, -1, rm), _radial_edge(g, +1, rm)]
    edges.append(_band_edge(top, rm, False))
    return [edges[i + 1] - edges[i] for i in range(0, len(edges), 2)]


if __name__ == '__main__':
    print(' / '.join(f'{s:.2f}°' for s in spans()))
