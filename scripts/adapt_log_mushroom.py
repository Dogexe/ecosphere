"""Adapt the jar's hollow log and mushrooms toward the owner's reference (2026-11-11).

Reference (artifacts/art-direction-2026-11-07/reference-main.png): a brown bark log with visible
grain and pale wood at its ends, and clusters of soft, rounded orange-tan mushroom caps on cream
stems. In the game the log read as a pinkish tube with a pitch-black hole and the mushroom as a
faceted red-and-white toadstool.

- natural-hollow-log.glb: "Log with Fungus" by sirkitree, CC BY 3.0 (Poly Pizza, credit required,
  modification allowed). Kept as the source (original kept at artifacts/natural-assets/
  natural-hollow-log.source.glb). Small bevel on hard edges, then vertex colours: bark brown with
  darker grain grooves running along the log, pale heartwood with growth rings on the cut ends, a
  dark-brown (not black) hollow, the orange bracket fungus kept.
- natural-mushroom.glb: now Quaternius Stylized Nature MegaKit "Mushroom_Common" (CC0, same archive
  as the other Quaternius assets), a cluster of five soft caps, replacing the faceted Poly Pizza
  toadstool (jeremy, CC BY 3.0; original kept at artifacts/natural-assets/natural-mushroom.source.glb).
  Its grey atlas texture is replaced by vertex colours: warm orange-brown cap tops lightening to the
  rim, cream undersides and stems.

Run: D:/Blender/blender.exe -b -P scripts/adapt_log_mushroom.py
"""
import bpy, bmesh, math, os, shutil
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'organisms')
KEEP = os.path.join(ROOT, 'artifacts', 'natural-assets')
QUAT = os.path.join(ROOT, 'artifacts', 'candidates', 'quaternius-standard', 'glTF')

def lin(h): return Vector(tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)))
def rgba(v): return (min(1, max(0, v.x)), min(1, max(0, v.y)), min(1, max(0, v.z)), 1.0)

def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def vc_material(name, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = rough
    attr = m.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
    m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    return m

def import_joined(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in [o for o in bpy.data.objects if o not in before and o != obj]: bpy.data.objects.remove(o)
    obj.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

def export(obj, name):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_normals=True, export_texcoords=False, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print('WROTE', name, os.path.getsize(path), 'tris', tris)

def keep_source(name):
    os.makedirs(KEEP, exist_ok=True)
    kept = os.path.join(KEEP, name.replace('.glb', '.source.glb'))
    if not os.path.exists(kept): shutil.copyfile(os.path.join(OUT, name), kept)
    return kept

# ---- Log ----
fresh()
log = import_joined(keep_source('natural-hollow-log.glb'))
log.name = 'log'
slots = [m.name for m in log.data.materials]
bark_i, hole_i, fungus_i = slots.index('mat20'), slots.index('mat23'), slots.index('mat19')
# Long axis of the log.
dims = log.dimensions
axis = max(range(3), key=lambda i: dims[i])
bb = [Vector(c) for c in log.bound_box]
centre = sum(bb, Vector()) / 8
bev = log.modifiers.new('bev', 'BEVEL'); bev.width = min(dims) * 0.025; bev.segments = 2; bev.limit_method = 'ANGLE'; bev.angle_limit = 0.7
bpy.context.view_layer.objects.active = log; bpy.ops.object.modifier_apply(modifier='bev')
BARK, BARK_DARK, WOOD, RING, HOLE = lin('6b4a2e'), lin('3f2a19'), lin('c9a477'), lin('9a7349'), lin('3a2616')
FUNGUS = lin('d08a3a')
bm = bmesh.new(); bm.from_mesh(log.data)
col = bm.loops.layers.color.new('Col')
others = [i for i in range(3) if i != axis]
length = dims[axis]
for f in bm.faces:
    n = f.normal
    along = abs(n[axis])
    for loop in f.loops:
        p = loop.vert.co
        if f.material_index == fungus_i:
            c = FUNGUS * (0.9 + 0.2 * (0.5 + 0.5 * noise.noise(p * 8)))
        elif f.material_index == hole_i:
            c = HOLE
        elif along > 0.75:
            # Cut end: pale heartwood with growth rings by distance from the log's axis.
            r = math.hypot(p[others[0]] - centre[others[0]], p[others[1]] - centre[others[1]])
            ring = 0.5 + 0.5 * math.sin(r / max(1e-4, min(dims[others[0]], dims[others[1]])) * 38)
            c = WOOD.lerp(RING, 0.35 * ring)
        else:
            # Bark: grain grooves stretched along the log, slightly darker underneath.
            q = Vector(p); q[axis] *= 0.12
            groove = 0.5 + 0.5 * noise.noise(q * (14 / max(1e-4, length)) * 6)
            c = BARK.lerp(BARK_DARK, min(1.0, max(0.0, groove - 0.3) * 2.4))
            c = c * (0.85 + 0.2 * max(0.0, n.z))
        loop[col] = rgba(c)
bm.to_mesh(log.data); bm.free()
bark = vc_material('bark', 0.95)
log.data.materials.clear(); log.data.materials.append(bark)
for poly in log.data.polygons: poly.use_smooth = True
bpy.ops.object.shade_smooth_by_angle(angle=0.6)
export(log, 'natural-hollow-log.glb')

# ---- Mushrooms ----
fresh()
keep_source('natural-mushroom.glb')
mush = import_joined(os.path.join(QUAT, 'Mushroom_Common.gltf'))
mush.name = 'mushroom'
bb = [Vector(c) for c in mush.bound_box]
z0, z1 = min(v.z for v in bb), max(v.z for v in bb)
CAP_TOP, CAP_RIM, UNDER, STEM = lin('b8652c'), lin('dc9a55'), lin('e8d3ac'), lin('efe2c6')
bm = bmesh.new(); bm.from_mesh(mush.data)
col = bm.loops.layers.color.new('Col')
# Stems are thin: a face belongs to a cap if it is wide relative to the cap height, i.e. its normal
# points mostly up or down. Side-facing faces low down are stems.
for f in bm.faces:
    n = f.normal
    for loop in f.loops:
        p = loop.vert.co
        h = (p.z - z0) / max(1e-4, z1 - z0)
        if n.z > 0.35:
            # Cap top: darker at the crown, lighter toward the rim (lower on the cap).
            c = CAP_RIM.lerp(CAP_TOP, min(1.0, max(0.0, (n.z - 0.35) / 0.6)))
            c = c * (0.94 + 0.1 * noise.noise(p * 9))
        elif n.z < -0.35:
            c = UNDER
        else:
            c = STEM if h < 0.75 else CAP_RIM.lerp(UNDER, 0.5)
        loop[col] = rgba(c)
bm.to_mesh(mush.data); bm.free()
mat = vc_material('mushroom', 0.85)
mush.data.materials.clear(); mush.data.materials.append(mat)
for poly in mush.data.polygons: poly.use_smooth = True
bpy.context.view_layer.objects.active = mush; mush.select_set(True)
bpy.ops.object.shade_smooth_by_angle(angle=0.9)
export(mush, 'natural-mushroom.glb')
