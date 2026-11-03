"""Adapt downloaded source meshes; run with the bundled Python/Pillow runtime.

No model generation. Originals remain under artifacts/candidates. Output GLBs
embed only referenced buffers/images and selected animation clips.
"""
from pathlib import Path
import colorsys
import hashlib
import io
import json
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'artifacts/candidates'
OUT = ROOT / 'public/assets/organisms'
OUT.mkdir(parents=True, exist_ok=True)


def read_model(path):
    raw = path.read_bytes()
    if path.suffix == '.glb':
        length = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + length])
        buffers = [raw[28 + length:]]
    else:
        doc = json.loads(raw)
        buffers = [(path.parent / b['uri']).read_bytes() for b in doc['buffers']]
    return doc, buffers


def view_bytes(doc, buffers, index):
    view = doc['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return buffers[view.get('buffer', 0)][start:start + view['byteLength']]


def palette(image, animal=False, flower=False):
    image = image.convert('RGBA')
    image.thumbnail((256 if animal else 512, 256 if animal else 512), Image.Resampling.LANCZOS)
    pixels = []
    for r, g, b, a in image.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if animal:
            # Keep eye markings and original UV colors, soften saturation.
            s *= 0.60
            if 0.15 < h < 0.48 and s > 0.1:
                h = 0.38
            v = v * 0.87 + 0.05
        elif flower:
            if s > 0.16:
                h, s = (0.10, s * 0.45) if 0.09 < h < 0.19 else (0.99, s * 0.40)
            v = v * 0.82 + 0.12
        else:
            if s > 0.14:
                h, s = 0.34, min(0.35, s * 0.55)
            v = v * 0.82 + 0.06
        rgb = colorsys.hsv_to_rgb(h, s, v)
        pixels.append((*[round(c * 255) for c in rgb], a))
    image.putdata(pixels)
    return image


def export(name, path, clips=None, animal=False):
    doc, buffers = read_model(path)
    if name == 'pond-fish':
        # Reduce the source's exaggerated cheek/eye breadth and body height;
        # retain length, source anatomy, rig and independent aquatic motion.
        scene = doc['scenes'][doc.get('scene', 0)]
        doc['nodes'].append({'name': 'EcosphereProportions', 'scale': [0.68, 0.80, 1], 'children': scene['nodes']})
        scene['nodes'] = [len(doc['nodes']) - 1]
    if clips is not None:
        doc['animations'] = [a for a in doc.get('animations', []) if a['name'] in clips]
    if name == 'leaf-grazer':
        primitive = doc['meshes'][0]['primitives'][0]
        positions = doc['accessors'][primitive['attributes']['POSITION']]
        data = view_bytes(doc, buffers, positions['bufferView'])
        def add_accessor(payload, component_type, count, kind):
            buffers.append(payload)
            doc['bufferViews'].append({'buffer': len(buffers) - 1, 'byteLength': len(payload)})
            doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1, 'componentType': component_type, 'count': count, 'type': kind})
            return len(doc['accessors']) - 1
        import math
        targets = []
        for phase in [0, math.pi / 2]:
            deltas = bytearray()
            minimum, maximum = [math.inf] * 3, [-math.inf] * 3
            for i in range(positions['count']):
                x, y, z = struct.unpack_from('<fff', data, positions.get('byteOffset', 0) + i * 12)
                # A subtle body wave on the actual source mesh, not generated
                # segments. Used only during actual travel, never at rest.
                wave = math.sin(z * 5 + phase)
                delta = [wave * 0.045, wave * 0.016, 0]
                minimum = [min(a, b) for a, b in zip(minimum, delta)]
                maximum = [max(a, b) for a, b in zip(maximum, delta)]
                deltas.extend(struct.pack('<fff', *delta))
            accessor = add_accessor(bytes(deltas), 5126, positions['count'], 'VEC3')
            doc['accessors'][accessor].update(min=minimum, max=maximum)
            targets.append({'POSITION': accessor})
        primitive['targets'] = targets
        doc['meshes'][0]['weights'] = [0, 0]
        time = add_accessor(struct.pack('<5f', 0, 0.25, 0.5, 0.75, 1), 5126, 5, 'SCALAR')
        doc['accessors'][time].update(min=[0], max=[1])
        output = add_accessor(struct.pack('<10f', 0, 1, 1, 0, 0, -1, -1, 0, 0, 1), 5126, 10, 'SCALAR')
        still = add_accessor(struct.pack('<10f', *([0] * 10)), 5126, 10, 'SCALAR')
        doc['animations'] = [{'name': name, 'samplers': [{'input': time, 'output': accessor, 'interpolation': 'LINEAR'}], 'channels': [{'sampler': 0, 'target': {'node': 0, 'path': 'weights'}}]} for name, accessor in [('idle', still), ('walk', output), ('eat', still)]]
    # Remove unused normal maps; the art direction uses matte, soft surfaces.
    for material in doc.get('materials', []):
        material.pop('normalTexture', None)
        pbr = material.setdefault('pbrMetallicRoughness', {})
        pbr.update(metallicFactor=0, roughnessFactor=0.94, baseColorFactor=[1, 1, 1, 1])
        if not animal:
            material['doubleSided'] = True
        if material.get('alphaMode') == 'MASK':
            material['alphaCutoff'] = 0.48
    # Animal palette atlases have nearly constant UV regions: bake sampled
    # linear vertex colors, eliminating their otherwise large shared atlas.
    if animal and name != 'leaf-grazer':
        for mesh in doc['meshes']:
            for primitive in mesh['primitives']:
                mat = doc['materials'][primitive['material']]['pbrMetallicRoughness']
                texture = doc['textures'][mat['baseColorTexture']['index']]
                source_image = doc['images'][texture['source']]
                image = palette(Image.open(io.BytesIO(view_bytes(doc, buffers, source_image['bufferView']))), animal=True)
                uv = doc['accessors'][primitive['attributes'].pop('TEXCOORD_0')]
                data = view_bytes(doc, buffers, uv['bufferView'])
                stride = doc['bufferViews'][uv['bufferView']].get('byteStride', 8)
                colors = bytearray()
                for i in range(uv['count']):
                    u, v = struct.unpack_from('<ff', data, uv.get('byteOffset', 0) + i * stride)
                    r, g, b, _ = image.getpixel((min(image.width - 1, max(0, int(u * image.width))), min(image.height - 1, max(0, int(v * image.height)))))
                    # glTF COLOR_0 is linear, unlike the source sRGB PNG.
                    def linear(c):
                        x = c / 255
                        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
                    colors.extend(struct.pack('<fff', linear(r), linear(g), linear(b)))
                index = len(buffers)
                buffers.append(bytes(colors))
                doc['bufferViews'].append({'buffer': index, 'byteLength': len(colors)})
                primitive['attributes']['COLOR_0'] = len(doc['accessors'])
                doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': uv['count'], 'type': 'VEC3'})
                mat.pop('baseColorTexture', None)
        doc.pop('textures', None)
        doc.pop('images', None)
        doc.pop('samplers', None)
    else:
        # Quaternius vertex colors encode source shader/wind information.
        # Standard glTF lighting must not multiply these masks into albedo.
        for mesh in doc['meshes']:
            for primitive in mesh['primitives']:
                primitive['attributes'].pop('COLOR_0', None)
        for image in doc.get('images', []):
            raw = (path.parent / image['uri']).read_bytes() if 'uri' in image else view_bytes(doc, buffers, image['bufferView'])
            im = Image.open(io.BytesIO(raw))
            image_name = image.get('name', '')
            if 'Bark' in image_name:
                im.thumbnail((128, 128), Image.Resampling.LANCZOS)
            else:
                im = palette(im, animal=animal, flower='Flowers' in image_name)
                if image_name.startswith('Leaves_NormalTree'):
                    # Match the fern's soft mids instead of a near-black crown.
                    im.putdata([(*[round(c * 0.65 + 60) for c in pixel[:3]], pixel[3]) for pixel in im.getdata()])
                elif image_name == 'Grass':
                    im.putdata([(*[round(c * 0.72 + 40) for c in pixel[:3]], pixel[3]) for pixel in im.getdata()])
            output = io.BytesIO()
            im.save(output, 'PNG', optimize=True)
            buffers.append(output.getvalue())
            doc['bufferViews'].append({'buffer': len(buffers) - 1, 'byteLength': len(output.getvalue())})
            image.pop('uri', None)
            image.update(bufferView=len(doc['bufferViews']) - 1, mimeType='image/png')
    # Repack only referenced accessors and bufferViews after clip/texture removal.
    refs = []
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            refs += [(p['attributes'], key) for key in p['attributes']]
            for target in p.get('targets', []):
                refs += [(target, key) for key in target]
            if 'indices' in p:
                refs.append((p, 'indices'))
    refs += [(s, 'inverseBindMatrices') for s in doc.get('skins', []) if 'inverseBindMatrices' in s]
    for anim in doc.get('animations', []):
        for sampler in anim['samplers']:
            refs += [(sampler, 'input'), (sampler, 'output')]
    used = sorted({obj[key] for obj, key in refs})
    mapping = {old: new for new, old in enumerate(used)}
    for obj, key in refs:
        obj[key] = mapping[obj[key]]
    doc['accessors'] = [doc['accessors'][i] for i in used]
    vrefs = [(a, 'bufferView') for a in doc['accessors'] if 'bufferView' in a]
    vrefs += [(im, 'bufferView') for im in doc.get('images', [])]
    views = sorted({obj[key] for obj, key in vrefs})
    data = bytearray()
    new_views = []
    for old in views:
        data.extend(b'\0' * (-len(data) % 4))
        content = view_bytes(doc, buffers, old)
        view = {**doc['bufferViews'][old], 'buffer': 0, 'byteOffset': len(data)}
        data.extend(content)
        new_views.append(view)
    mapping = {old: new for new, old in enumerate(views)}
    for obj, key in vrefs:
        obj[key] = mapping[obj[key]]
    doc['bufferViews'] = new_views
    doc['buffers'] = [{'byteLength': len(data)}]
    doc['asset']['generator'] = 'ECOSPHERE asset adaptation / scripts/adapt_assets.py'
    doc['asset']['extras'] = {'source': path.name, 'adaptation': 'Muted palette, compact resources; source anatomy retained'}
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    data.extend(b'\0' * (-len(data) % 4))
    raw = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(data)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(data), 0x004E4942) + data
    dest = OUT / (name + '.glb')
    dest.write_bytes(raw)
    triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] for p in m['primitives'])
    return {'file': dest.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'triangles': triangles, 'clips': [a['name'] for a in doc.get('animations', [])]}


report = [export('tiger-beetle', SOURCE / 'TigerBeetle.glb', ['idle', 'walk', 'eat'], animal=True),
          export('pond-fish', SOURCE / 'Archerfish.glb', ['idle', 'walk'], animal=True),
          export('leaf-grazer', SOURCE / 'PolyCaterpillar.glb', animal=True)]
for name, source in [('clover', 'Clover_1'), ('grass', 'Grass_Common_Short'), ('bloom', 'Flower_3_Group'), ('tree', 'CommonTree_1')]:
    report.append(export(name, SOURCE / 'quaternius-standard/glTF' / (source + '.gltf')))
manifest_path = OUT / 'manifest.json'
owned = {entry['file'] for entry in report}
existing = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
manifest_path.write_text(json.dumps(report + [entry for entry in existing if entry['file'] not in owned], indent=2) + '\n')
print(json.dumps(report, indent=2))
