"""Assemble a rigged SVG animal from GPT-painted part images (white background).

Each part image is auto-traced to vector paths (vtracer, a dev-only tool:
`pip install vtracer`), the white background is dropped, and the parts are
placed on one canvas with the rig data the game reads (see paperRig.ts
rigFromSvg). Legs are traced once and reused for every hip; far-side legs
are the same shape, darker.

Usage: python3 scripts/paper-svg/assemble_traced.py <config.json> <out.svg>
"""
import json, re, sys, os, tempfile
import vtracer
from PIL import Image

def near_white(hex_colour):
    r, g, b = (int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
    return min(r, g, b) > 236

def trace(path, detail):
    """Trace one image; return (inner svg markup without white paths, bbox of the drawn pixels)."""
    image = Image.open(path).convert('RGB')
    grey = image.convert('L').point(lambda v: 255 if v < 236 else 0)
    bbox = grey.getbbox()
    pad = 6
    box = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(image.width, bbox[2] + pad), min(image.height, bbox[3] + pad))
    crop = image.crop(box).convert('RGBA')
    # Key out the white background so the tracer leaves it empty (the white eye is enclosed, so it stays).
    from PIL import ImageDraw
    flood = crop.copy()
    for corner in [(0, 0), (flood.width - 1, 0), (0, flood.height - 1), (flood.width - 1, flood.height - 1)]:
        ImageDraw.floodfill(flood, corner, (255, 0, 255, 0), thresh=40)
    pixels = flood.load()
    for y in range(flood.height):
        for x in range(flood.width):
            if pixels[x, y][:3] == (255, 0, 255):
                pixels[x, y] = (0, 0, 0, 0)
    crop = flood
    with tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, 'in.png'), os.path.join(tmp, 'out.svg')
        crop.save(src)
        vtracer.convert_image_to_svg_py(src, out, colormode='color', hierarchical='stacked', mode='spline',
                                        color_precision=8, layer_difference=detail, filter_speckle=10,
                                        corner_threshold=60, length_threshold=5.0, splice_threshold=45, path_precision=1)
        text = open(out).read()
    paths = re.findall(r'<path [^>]*/>', text)
    return ''.join(paths), box

def main(config_path, out_path):
    config = json.load(open(config_path))
    base = os.path.dirname(config_path)
    scale = config['scale']                      # viewBox units per source pixel
    width, height = config['canvas']
    body, body_box = trace(os.path.join(base, config['body']['image']), config.get('detail', 10))
    leg, leg_box = trace(os.path.join(base, config['leg']['image']), config.get('detail', 10))
    antenna, ant_box = trace(os.path.join(base, config['antenna']['image']), config.get('detail', 10))

    # Leg: hip = top centre of its drawn box, scaled so its length matches config.
    leg_w, leg_h = leg_box[2] - leg_box[0], leg_box[3] - leg_box[1]
    leg_scale = config['leg']['length'] / leg_h
    hip_x = config['leg'].get('hip_x', 0.5) * leg_w
    ant_w, ant_h = ant_box[2] - ant_box[0], ant_box[3] - ant_box[1]
    ant_scale = config['antenna']['length'] / max(ant_w, ant_h)

    def leg_group(side, order, x, y):
        darker = ' filter="url(#far)"' if side == 'far' else ''
        return (f'<g id="leg-{side}-{order}" data-motion="leg" data-side="{side}" data-order="{order}" data-pivot="{x:.1f} {y:.1f}">'
                f'<use href="#leg-shape" transform="translate({x - hip_x * leg_scale:.1f} {y:.1f}) scale({leg_scale:.4f})"{darker}/></g>')

    def antenna_group(i, x, y, turn):
        return (f'<g id="antenna-{i}" data-motion="antenna" data-pivot="{x:.1f} {y:.1f}">'
                f'<use href="#antenna-shape" transform="translate({x:.1f} {y:.1f}) rotate({turn}) translate(0 {-ant_h * ant_scale:.1f}) scale({ant_scale:.4f})"/></g>')

    hips = config['leg']['hips']
    far_dx, far_lift = config['leg'].get('far_offset', [18, -14])
    bx, by = body_box[0] * scale, body_box[1] * scale
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {width} {height}" '
           f'data-length="{config["length"]}" data-ground="{config["ground"]}"'
           + (f' data-joints="{" ".join(str(x) for x in config["joints"]["at"])}" data-joint-limit="{config["joints"]["limit"]}"' if 'joints' in config else '')
           + '>\n'
           f'<!-- {config["name"]}: auto-traced from GPT-painted parts; rig data in attributes. -->\n'
           '<defs>'
           f'<g id="leg-shape">{leg}</g><g id="antenna-shape">{antenna}</g>'
           '<filter id="far"><feColorMatrix type="matrix" values="0.72 0 0 0 0  0 0.72 0 0 0  0 0 0.72 0 0  0 0 0 1 0"/></filter>'
           '</defs>\n'
           + ''.join(antenna_group(i, *a) for i, a in enumerate(config['antenna']['bases'])) + '\n'
           + ''.join(leg_group('far', i, x + far_dx, y + far_lift) for i, (x, y) in enumerate(hips)) + '\n'
           # Near legs sit behind the body too: the plates cover their tops, as in the painted design.
           + ''.join(leg_group('near', i, x, y) for i, (x, y) in enumerate(hips)) + '\n'
           + f'<g id="body" data-motion="body" data-pivot="{config["body"]["pivot"]}"><g transform="translate({bx:.1f} {by:.1f}) scale({scale})">{body}</g></g>\n</svg>\n')
    open(out_path, 'w').write(svg)
    print(f'wrote {out_path} ({len(svg) // 1024} KB)')

if __name__ == '__main__':
    main(*sys.argv[1:3])
