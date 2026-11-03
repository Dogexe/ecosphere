"""Builds public/assets/paper/woodlouse/woodlouse.svg: a flat cartoon Porcellio scaber
traced over the owner-approved GPT design (variant 2, brown with pale spots). Side view, facing right.
Coordinates are viewBox units (half the reference image's pixels)."""
import math, sys

W, H = 888, 400
BOTTOM = 300          # underside of the body
GROUND = 382          # tips of the feet
BODY = '#7d6357'; TOP = '#765c52'; DARK = '#a3836f'; LINE = '#5f4840'
LEG = '#c9a58d'; LEG_DARK = '#8a6c5c'; LEG_LINE = '#a7846f'; SPOT = '#d1a77f'

def top(x):
    """Back profile: low tail, high middle, dipping to the head."""
    pts = [(70, 262), (100, 214), (140, 172), (215, 110), (300, 66), (385, 50), (475, 52), (565, 64), (650, 96), (684, 150)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0); t = t * t * (3 - 2 * t)
            return y0 + (y1 - y0) * t
    return pts[-1][1]

edges = [70, 100, 140, 215, 300, 385, 475, 565, 650, 672]   # plate boundaries, tail → head

def belly(x):
    """Lower edge of the plates: deepest mid-body, lifting at tail and head."""
    t = min(1, max(0, (x - 70) / (660 - 70)))
    return BOTTOM - 26 * (1 - t) ** 3 - 8 * t ** 6 + 6 * math.sin(math.pi * t)

def plate(x0, x1, i):
    """One back plate, drawn tail-first so each plate's curved rear edge overlaps the one behind."""
    y0, y1, ym = top(x0), top(x1), top((x0 + x1) / 2)
    b0, b1 = belly(x0), belly(x1)
    bulge = 12 + i * 1.2
    r = 16
    front = x1 + 22 if x1 < 640 else x1 + 4
    return (f'M{x0 + r},{b0} '
            f'C{x0 - bulge * 0.6},{b0 - 4} {x0 - bulge},{(y0 + b0) / 2} {x0 + 2},{y0 + 6} '
            f'Q{(x0 + x1) / 2},{ym - 24} {front},{top(front) + 10} '
            f'L{front},{b1} '
            f'Q{(x0 + front) / 2},{max(b0, b1) + 7} {x0 + r},{b0} Z')

plates = []
for i, (x0, x1) in enumerate(zip(edges, edges[1:])):
    plates.append(f'<path d="{plate(x0, x1, i)}" fill="url(#plate)" stroke="{LINE}" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round" filter="url(#gap)"/>')

head = (f'<path d="M650,{BOTTOM - 6} C640,240 650,175 690,160 C730,148 762,188 766,228 '
        f'C770,268 744,296 706,300 C680,302 660,300 650,{BOTTOM - 6} Z" fill="url(#plate)" stroke="{LINE}" stroke-opacity="0.55" stroke-width="2.5"/>')
eye = ('<circle cx="721" cy="223" r="24" fill="#fbf8f2"/>'
       '<circle cx="727" cy="225" r="13" fill="#4a2a20"/>'
       '<circle cx="731" cy="219" r="4" fill="#ffffff"/>')
uropods = (f'<path d="M78,250 L28,258" stroke="{LEG}" stroke-width="15" stroke-linecap="round"/>'
           f'<path d="M80,268 L26,288" stroke="{LEG}" stroke-width="15" stroke-linecap="round"/>')
# Pale spots on the upper plates (Porcellio scaber's mottling), softened.
spots_at = [(178, 182, 8), (205, 170, 6), (262, 152, 10), (280, 128, 7), (340, 92, 7), (372, 128, 9), (352, 152, 6), (378, 88, 5),
            (430, 140, 8), (470, 128, 10), (488, 90, 7), (448, 82, 5), (545, 118, 10), (590, 135, 9), (575, 92, 5), (640, 168, 10), (652, 122, 6), (122, 210, 5)]
def blob(x, y, r):
    return ''.join(f'<circle cx="{x + dx * r}" cy="{y + dy * r}" r="{r * k}" fill="{SPOT}"/>' for dx, dy, k in [(0, 0, 0.8), (0.55, 0.1, 0.5), (-0.5, 0.25, 0.45), (0.1, -0.55, 0.45), (-0.2, 0.6, 0.4)])
spots = '<g filter="url(#soft)" opacity="0.9">' + ''.join(blob(x, y, r) for x, y, r in spots_at) + '</g>'

def leg(hx, side, order, lift=0):
    """One leg from its hip: a thick thigh bending back, a tapering shin down to a round foot."""
    colour = LEG if side == 'near' else LEG_DARK
    hy = BOTTOM - 4 - lift
    k = (hx - 40, hy + 36 - lift); f = (hx - 18, GROUND - 9 - lift)
    gid = f'leg-{side}-{order}'
    return (f'<g id="{gid}" data-motion="leg" data-side="{side}" data-order="{order}" data-pivot="{hx} {hy}">'
            f'<path d="M{hx},{hy} Q{hx - 8},{hy + 30} {k[0]},{k[1]}" fill="none" stroke="{colour}" stroke-width="26" stroke-linecap="round"/>'
            f'<path d="M{k[0]},{k[1]} Q{k[0] + 2},{(k[1] + f[1]) / 2 + 6} {f[0]},{f[1]}" fill="none" stroke="{colour}" stroke-width="20" stroke-linecap="round"/>'
            f'<path d="M{k[0] - 9},{k[1] - 9} q10,6 20,4 M{k[0] - 7},{k[1] + 14} q8,3 16,1 M{k[0] - 2},{k[1] + 28} q7,2 13,0" fill="none" stroke="{LEG_LINE}" stroke-width="2" stroke-linecap="round"/>'
            f'</g>')

hips = [182, 268, 352, 436, 522, 604, 660]
far = ''.join(leg(x + 22, 'far', i, lift=18) for i, x in enumerate(hips))
near = ''.join(leg(x, 'near', i) for i, x in enumerate(hips))

def antenna(i, base, mid, tip):
    return (f'<g id="antenna-{i}" data-motion="antenna" data-pivot="{base[0]} {base[1]}">'
            f'<path d="M{base[0]},{base[1]} L{mid[0]},{mid[1]} L{tip[0]},{tip[1]}" fill="none" stroke="#b48f7a" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="M{mid[0] - 7},{mid[1] + 4} l14,-2 M{(base[0] + mid[0]) / 2 - 7},{(base[1] + mid[1]) / 2 + 2} l14,-2 M{(mid[0] + tip[0]) / 2 - 2},{(mid[1] + tip[1]) / 2 - 7} l2,14" stroke="{LEG_LINE}" stroke-width="2.5" stroke-linecap="round"/>'
            f'</g>')

antennae = antenna(0, (748, 200), (780, 135), (836, 120)) + antenna(1, (758, 218), (804, 172), (860, 192))

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" data-length="64 766 0.64" data-ground="{GROUND}">
  <!-- ECOSPHERE cartoon woodlouse (Porcellio scaber). Traced from the owner-approved design; rig data in attributes. -->
  <defs>
    <linearGradient id="plate" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="{BOTTOM}">
      <stop offset="0" stop-color="{TOP}"/><stop offset="0.6" stop-color="{BODY}"/><stop offset="0.78" stop-color="{DARK}"/><stop offset="1" stop-color="{DARK}"/>
    </linearGradient>
    <filter id="gap" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="-5" dy="3" stdDeviation="3" flood-color="#3e2a22" flood-opacity="0.38"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise"/>
      <feColorMatrix in="noise" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 0.6" result="speck"/>
      <feComposite in="speck" in2="SourceGraphic" operator="in" result="specks"/>
      <feBlend in="SourceGraphic" in2="specks" mode="multiply"/>
    </filter>
  </defs>
  <g id="antenna-back">{antennae}</g>
  <g id="far-legs">{far}</g>
  <g id="body" data-motion="body" data-pivot="420 {BOTTOM}" filter="url(#grain)">{uropods}<path d="M100,262 Q380,300 668,262 L668,300 Q380,336 100,286 Z" fill="#6a4f43"/>{''.join(plates)}{spots}{head}{eye}</g>
  <g id="near-legs">{near}</g>
</svg>
'''
# Antennae sit behind the head, like the reference; the eye stays on top of the body group.
open(sys.argv[1], 'w').write(svg)
print('wrote', sys.argv[1])
