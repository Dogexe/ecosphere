"""Assemble any rigged SVG animal from GPT-painted part images (white background).

General version of assemble_traced.py: the config lists traced shapes and
the parts that use them, so animals with different anatomy (springtail
furcula, Daphnia swimming antennae, a caterpillar that crawls as one body)
share one tool. vtracer is a dev-only tool (`pip install vtracer`).

Config:
  name, canvas [w, h], length "from to units", ground y   (viewBox units)
  scale        viewBox units per source pixel for parts placed "source"
  shapes       {id: {image, detail?}}
  parts        [{id, motion, shape, pivot [x, y], side?, order?, far?,
                 place: "source" | {anchor [fx, fy], height|width, rotate?, flip?}}]
"source" keeps the drawing where it sits in its own image (body layers);
otherwise the shape's anchor (fractions of its drawn box, e.g. the hip at
[0.5, 0]) lands on the pivot, scaled to the given height or width.
Parts are drawn in list order, first at the back.

Usage: python3 scripts/paper-svg/assemble_rig.py <config.json> <out.svg> [folder with the images]
"""
import json, os, sys
from assemble_traced import trace

def main(config_path, out_path, images=None):
    config = json.load(open(config_path))
    base = images or os.path.dirname(config_path)
    scale = config['scale']
    width, height = config['canvas']
    shapes = {key: trace(os.path.join(base, shape['image']), shape.get('detail', config.get('detail', 8)))
              for key, shape in config['shapes'].items()}

    def placed(part):
        markup, box = shapes[part['shape']]
        w, h = box[2] - box[0], box[3] - box[1]
        place = part.get('place', 'source')
        if place == 'source':
            return f'translate({box[0] * scale:.1f} {box[1] * scale:.1f}) scale({scale})'
        k = place['height'] / h if 'height' in place else place['width'] / w
        ax, ay = place.get('anchor', [0.5, 0])
        x, y = part['pivot']
        flip = ' scale(-1 1)' if place.get('flip') else ''
        return f'translate({x:.1f} {y:.1f}) rotate({place.get("rotate", 0)}){flip} translate({-ax * w * k:.1f} {-ay * h * k:.1f}) scale({k:.4f})'

    def group(part):
        attrs = f'id="{part["id"]}" data-motion="{part["motion"]}" data-pivot="{part["pivot"][0]:.1f} {part["pivot"][1]:.1f}"'
        if 'side' in part: attrs += f' data-side="{part["side"]}"'
        if 'order' in part: attrs += f' data-order="{part["order"]}"'
        far = ' filter="url(#far)"' if part.get('far') else ''
        return f'<g {attrs}><use href="#{part["shape"]}-shape" transform="{placed(part)}"{far}/></g>\n'

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {width} {height}" '
           f'data-length="{config["length"]}" data-ground="{config["ground"]}">\n'
           f'<!-- {config["name"]}: auto-traced from GPT-painted parts; rig data in attributes. -->\n<defs>'
           + ''.join(f'<g id="{key}-shape">{markup}</g>' for key, (markup, _) in shapes.items())
           + '<filter id="far"><feColorMatrix type="matrix" values="0.72 0 0 0 0  0 0.72 0 0 0  0 0 0.72 0 0  0 0 0 1 0"/></filter>'
           '</defs>\n' + ''.join(group(part) for part in config['parts']) + '</svg>\n')
    open(out_path, 'w').write(svg)
    print(f'wrote {out_path} ({len(svg) // 1024} KB)')

if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(__file__))
    main(*sys.argv[1:4])
