"""Adapt three CC0 Kenney props into small windowsill GLBs (Phase 6 room details).

Run headless:  D:/Blender/blender.exe -b -P scripts/adapt_room_props.py

Sources (CC0, Kenney, www.kenney.nl), downloaded to artifacts/candidates/room/raw/ (not committed):
  Furniture Kit 2.0  Models/GLTF format/pottedPlant.glb  -> public/assets/room/sill-plant.glb
  Furniture Kit 2.0  Models/GLTF format/books.glb        -> public/assets/room/sill-books.glb
  Food Kit           Models/GLB format/cup.glb           -> public/assets/room/sill-mug.glb

Changes: meshes joined, transforms applied, texture/UVs dropped, recoloured to the warm muted room palette,
soft shading (welded vertices + smooth-by-angle, slight bevel on book edges), origin at base centre, +Y up,
Kenney's native size kept. Writes a 3/4 preview PNG of each to artifacts/candidates/room/.
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')).replace('\\', '/')
RAW = ROOT + '/artifacts/candidates/room/raw'
OUT = ROOT + '/public/assets/room'
PREVIEW = ROOT + '/artifacts/candidates/room'

PALETTE = {
    'terracotta': '#b5653f',
    'leafDark': '#5f8a3e',
    'leafLight': '#7fa94e',
    'coverBrown': '#7a4b3a',
    'coverBlue': '#3f5f6b',
    'coverTan': '#c9a46a',
    'mugCream': '#e8dcc4',
}


def linear(hex_colour):
    out = []
    for i in (1, 3, 5):
        c = int(hex_colour[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def make_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = linear(PALETTE[name])
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Metallic'].default_value = 0.0
    return mat


def islands(bm, faces):
    """Group faces into islands by shared edge positions (Kenney meshes have split vertices; leaves touch
    only at single points near the base, so sharing a vertex is not enough)."""
    pos = lambda v: tuple(round(c, 5) for c in v.co)
    key = lambda e: tuple(sorted((pos(e.verts[0]), pos(e.verts[1]))))
    parent = {}

    def find(a):
        while parent.setdefault(a, a) != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for f in faces:
        ks = [key(e) for e in f.edges]
        for k in ks[1:]:
            parent[find(ks[0])] = find(k)
    groups = {}
    for f in faces:
        groups.setdefault(find(key(f.edges[0])), []).append(f)
    print(f'ROOMPROP leaf islands: {len(groups)}')
    return list(groups.values())


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return meshes


def weld(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(obj.data)
    bm.free()


def remap(obj, mapping, mats):
    """mapping: old material name -> new palette name."""
    old = [m.name.split('.')[0] if m else '' for m in obj.data.materials]
    new_index = []
    for name in old:
        target = mapping[name]
        new_index.append(list(mats).index(target))
    # Clearing the slots resets polygon indices, so record the targets first.
    targets = [new_index[p.material_index] for p in obj.data.polygons]
    obj.data.materials.clear()
    for name in mats:
        obj.data.materials.append(mats[name])
    for p, t in zip(obj.data.polygons, targets):
        p.material_index = t


def join(meshes):
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    return obj


def finish(obj, smooth_angle, bevel=0.0):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    # Origin at base centre: centre x/y (Blender z-up), base at z=0.
    lo = Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)])
    shift = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in obj.data.vertices:
        v.co -= shift
    obj.location = (0, 0, 0)
    return hi - lo


def export(obj, name, size):
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    path = f'{OUT}/{name}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=False, export_animations=False)
    obj.data.calc_loop_triangles()
    tris = len(obj.data.loop_triangles)
    print(f'ROOMPROP {name}.glb size_xyz(+Y up)=({size.x:.4f}, {size.z:.4f}, {size.y:.4f}) tris={tris} '
          f'materials={len(obj.data.materials)} bytes={os.path.getsize(path)}')
    render(obj, name)


def render(obj, name):
    scene = bpy.context.scene
    lo = Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)])
    centre = (lo + hi) / 2
    radius = (hi - lo).length
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.data.lens = 70
    cam.location = centre + Vector((radius * 1.6, -radius * 1.9, radius * 1.2))
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 2.4
    sun.data.color = (1.0, 0.95, 0.86)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.78, 0.74, 0.68, 1)
    bg.inputs[1].default_value = 0.55
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = f'{PREVIEW}/{name}.png'
    bpy.ops.render.render(write_still=True)


def plant():
    meshes = load(f'{RAW}/kit/Models/GLTF format/pottedPlant.glb')
    mats = {n: make_material(n) for n in ('terracotta', 'leafDark', 'leafLight')}
    leaves = next(o for o in meshes if 'plant' in [m.name.split('.')[0] for m in o.data.materials])
    pot = next(o for o in meshes if o is not leaves)
    weld(pot)
    # Soil reads as a dark mossy top dressing so the pot stays within three materials.
    remap(pot, {'wood': 'terracotta', 'woodDark': 'leafDark'}, mats)
    remap(leaves, {'plant': 'leafDark'}, mats)
    bm = bmesh.new()
    bm.from_mesh(leaves.data)
    groups = islands(bm, list(bm.faces))
    groups.sort(key=lambda g: math.atan2(*sum((f.calc_center_median() for f in g), Vector())[:2]))
    for i, g in enumerate(groups):
        for f in g:
            f.material_index = 1 if i % 2 == 0 else 2
    bm.to_mesh(leaves.data)
    bm.free()
    obj = join([pot, leaves])
    obj.name = 'sill-plant'
    size = finish(obj, smooth_angle=65)
    export(obj, 'sill-plant', size)


def books():
    meshes = load(f'{RAW}/kit/Models/GLTF format/books.glb')
    mats = {n: make_material(n) for n in ('coverBrown', 'coverBlue', 'coverTan')}
    obj = join(meshes)
    weld(obj)
    remap(obj, {'carpetDarker': 'coverBrown', 'metal': 'coverBlue', 'plant': 'coverTan', 'carpetWhite': 'coverTan'},
          mats)
    obj.name = 'sill-books'
    size = finish(obj, smooth_angle=50, bevel=0.003)
    export(obj, 'sill-books', size)


def mug():
    meshes = load(f'{RAW}/food/Models/GLB format/cup.glb')
    mats = {'mugCream': make_material('mugCream')}
    obj = join(meshes)
    weld(obj)
    remap(obj, {'colormap': 'mugCream'}, mats)
    # Turn the handle from the back (+Y in Blender) to +X so it shows in profile from a 3/4 view.
    for v in obj.data.vertices:
        v.co = Vector((v.co.y, -v.co.x, v.co.z))
    obj.name = 'sill-mug'
    size = finish(obj, smooth_angle=65)
    export(obj, 'sill-mug', size)


os.makedirs(OUT, exist_ok=True)
plant()
books()
mug()
