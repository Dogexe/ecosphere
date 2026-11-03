"""Fit generated woodlouse layers (body, leg, antenna) onto the shared rig canvas.

Usage: python3 scripts/fit_paper_woodlouse.py <folder with woodlouse-body/leg/antenna.png> <out folder>
Removes the faint halo GPT leaves around cut-outs, scales each part to the
woodlouse's proportions, and writes body.png, leg-near.png, leg-far.png,
antenna.png plus rig.json on a 1280x560 canvas.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageEnhance

source, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
W, H, GROUND = 1280, 560, 505

def clean(name):
    image = Image.open(source / f'woodlouse-{name}.png').convert('RGBA')
    alpha = image.getchannel('A').point(lambda a: 0 if a < 40 else min(255, int((a - 40) * 255 / 175)))
    image.putalpha(alpha)
    return image.crop(image.getbbox())

def fit(image, width=None, height=None):
    scale = width / image.width if width else height / image.height
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)

def place(image, x, y):
    canvas = Image.new('RGBA', (W, H))
    canvas.alpha_composite(image, (round(x), round(y)))
    return canvas

# Body: tail tip to head about 880 px, belly resting just above the legs.
body = fit(clean('body'), width=880)
body_left, body_top = 130, GROUND - 78 - body.height
alpha = body.getchannel('A')
def underside(x):
    column = [alpha.getpixel((x, y)) for y in range(body.height)]
    return max(y for y, a in enumerate(column) if a > 128)
place(body, body_left, body_top).save(out / 'body.png')

# Legs: seven pairs under the front two-thirds of the body.
leg = fit(clean('leg'), height=108)
hips = [round(body_left + body.width * t) for t in (0.24, 0.33, 0.42, 0.51, 0.60, 0.69, 0.78)]
hip_y = [body_top + underside(x - body_left) - 34 for x in hips]
first = (hips[0], hip_y[0])
place(leg, first[0] - leg.width * 0.45, first[1] - 6).save(out / 'leg-near.png')
far = ImageEnhance.Brightness(leg).enhance(0.62)
place(far, first[0] + 18 - leg.width * 0.45, first[1] - 10).save(out / 'leg-far.png')

# Antenna: about a quarter of the body length, base at the head.
antenna = fit(clean('antenna'), width=250)
head_x, head_y = body_left + body.width - 70, body_top + body.height * 0.55
place(antenna, head_x - 8, head_y - antenna.height + 8).save(out / 'antenna.png')

rig = {
    'canvas': [W, H],
    'length': {'from': body_left + 40, 'to': body_left + body.width, 'units': 0.64},
    'ground': GROUND,
    'parts': [
        {'file': 'leg-far.png', 'motion': 'leg', 'side': 'far', 'order': 0, 'pivot': [first[0] + 18, first[1] - 4],
         'repeat': [[x + 18, y - 4] for x, y in zip(hips[1:], hip_y[1:])]},
        {'file': 'body.png', 'motion': 'body', 'pivot': [body_left + body.width // 2, body_top + body.height]},
        {'file': 'leg-near.png', 'motion': 'leg', 'side': 'near', 'order': 0, 'pivot': list(first),
         'repeat': [[x, y] for x, y in zip(hips[1:], hip_y[1:])]},
        {'file': 'antenna.png', 'motion': 'antenna', 'pivot': [round(head_x), round(head_y)]},
    ],
}
(out / 'rig.json').write_text(json.dumps(rig, indent=2) + '\n')
print(json.dumps(rig))
