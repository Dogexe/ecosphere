"""Adapt Quaternius Stylized Nature MegaKit rocks (CC0) into ECOSPHERE's soft low-poly stones.

Asset-first (2026-11-11): the jar's dressing stones were Poly Haven "Rock Moss Set 01" scans and the
pond pebbles "Namaqualand Stones 01" scans: photographic textures that clash with the soft low-poly
look. The Quaternius megakit already in artifacts/candidates/quaternius-standard (CC0, archive hash in
ASSETS.md) has stylized low-poly rocks, so they are adapted instead of modelling new ones:

- Rock_Medium_1..3 (244-522 tris): one Catmull-Clark level rounds the hard boxy corners (art
  direction: soft, no harsh angles); smooth shading with crisp edges kept only at real ridges.
  (A subdivide-then-decimate pass was tried first and gave noisy triangle speckle.)
- Pebble_Round_1..5 (114-136 tris): flat path stones, thickened x1.9 so they read as pebbles, one
  subdivision then decimate for the same softened facets.
- The source moss-tinted texture is dropped (moss on stones comes from the game's moss tufts, tied
  to the sim). Each face gets a vertex colour from the gravel's warm grey/beige/brown palette, lighter
  on upward faces and darker near the base, where the stone sits in soil.

Run: D:/Blender/blender.exe -b -P scripts/adapt_rocks.py
Writes public/assets/organisms/natural-rocks.glb with nodes rock1..rock3, pebble1..pebble5: unit
footprint (largest horizontal size 1), base at y = 0, centred. Visual only.
"""
import bpy, bmesh, os, random
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'artifacts', 'candidates', 'quaternius-standard', 'glTF')
OUT = os.path.join(ROOT, 'public', 'assets', 'organisms', 'natural-rocks.glb')

def lin(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
# Same family as GravelPebbles.tsx's palette, a step lighter for the larger stones.
STONES = [lin(h) for h in ('8a8276', '9a8f7e', '7f776c', 'a39784', '8d7d68')]
PEBBLES = [lin(h) for h in ('7c7469', '938672', '73624f', '9d907b', '655d54')]

PARTS = [('Rock_Medium_1', 'rock1', 1.0, 0.55), ('Rock_Medium_2', 'rock2', 1.0, 0.5), ('Rock_Medium_3', 'rock3', 1.0, 0.45)] + \
        [(f'Pebble_Round_{k}', f'pebble{k}', 1.9, 0.5) for k in range(1, 6)]

bpy.ops.wm.read_factory_settings(use_empty=True)
material = bpy.data.materials.new('stone')
material.use_nodes = True
tree = material.node_tree
bsdf = tree.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.88
attr = tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])

made = []
for index, (source, name, thicken, ratio) in enumerate(PARTS):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, source + '.gltf'))
    meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in [o for o in bpy.data.objects if o not in before and o != obj]: bpy.data.objects.remove(o)
    obj.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.name = name; obj.data.name = name
    # Blender is Z-up here. Thicken pebbles, then soften.
    obj.scale = (1, 1, thicken); bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.object.mode_set(mode='OBJECT')
    # Rounded edges, big flat faces: a small two-segment bevel on the sharp edges only.
    dims = obj.dimensions
    bev = obj.modifiers.new('bev', 'BEVEL'); bev.width = max(dims) * 0.05; bev.segments = 2; bev.limit_method = 'ANGLE'; bev.angle_limit = 0.5; bev.profile = 0.6
    bpy.ops.object.modifier_apply(modifier='bev')
    # Unit footprint, base at 0, centred.
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    size = max(hi.x - lo.x, hi.y - lo.y)
    me = obj.data
    for v in me.vertices:
        v.co = Vector(((v.co.x - (lo.x + hi.x) / 2) / size, (v.co.y - (lo.y + hi.y) / 2) / size, (v.co.z - lo.z) / size))
    height = (hi.z - lo.z) / size
    # Per-face vertex colours, flat shading.
    bm = bmesh.new(); bm.from_mesh(me)
    col = bm.loops.layers.color.new('Col')
    rand = random.Random(index * 31 + 7)
    palette = STONES if name.startswith('rock') else PEBBLES
    base = palette[index % len(palette)]
    seed = Vector((rand.random() * 50, rand.random() * 50, rand.random() * 50))
    for f in bm.faces:
        for loop in f.loops:
            v = loop.vert
            # Soft mottling (low-frequency noise) instead of per-face speckle, lighter on top, darker at the soil line.
            mottle = 0.94 + 0.12 * noise.noise(v.co * 3.0 + seed)
            light = mottle * (0.92 + 0.12 * max(0.0, v.normal.z)) * (0.74 + 0.26 * min(1.0, v.co.z / max(0.05, height * 0.3)))
            loop[col] = tuple(min(1.0, base[i] * light) for i in range(3)) + (1.0,)
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(material)
    # Soft shading across the rounded body, crisp only at real ridges (> 50 degrees).
    for poly in me.polygons: poly.use_smooth = True
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=0.6) if hasattr(bpy.ops.object, 'shade_smooth_by_angle') else None
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print('ROCK', name, 'tris', tris, 'height', round(height, 3))
    made.append(obj)

bpy.ops.object.select_all(action='DESELECT')
for o in made: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_normals=True, export_texcoords=False, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
print('WROTE', OUT, os.path.getsize(OUT))
