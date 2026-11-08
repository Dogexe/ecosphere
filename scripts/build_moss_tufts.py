"""Build ECOSPHERE's moss tuft assets in Blender (owner's moss brief, 2026-11-08).

Asset-first record (artifacts/moss-asset/SEARCH.md): Poly Pizza and Sketchfab were searched first.
The closest free models, Quaternius "Bush" (CC0, 360 triangles, one leaf-textured mesh) and "Bushes"
(CC0, 1,298 triangles), are coarse shrub domes that read as bushes, not moss, at macro zoom; the
Sketchfab moss clumps found need a login to download. So the tufts are modelled here, reusing the
leaf-rosette idea of the earlier in-game moss shoots.

Each variant follows the Moss Turnaround reference (artifacts/moss-asset/reference-turnaround.png):
a brown soil plinth, and on it 4-5 overlapping rounded lobes ("shelves") of moss. Each lobe is a
solid olive body covered by rosettes: radial sprays of rounded, cupped, notched leaflets, all real
triangles with vertex colours (olive in the creases -> lime on the crowns). Rim rosettes lean out
and down so the cushion overhangs its soil, as in the reference.

Run: D:/Blender/blender.exe -b -P scripts/build_moss_tufts.py
Writes public/assets/organisms/moss-tuft-{1..4}.glb, each holding two meshes, "lod0" (close) and
"lod1" (mid: fewer, larger rosettes) and "lod2" (overview), unit width, base at y = 0; and
artifacts/moss-asset/{turnaround,lod1}-{n}-{view}.png renders (front/back/left/right/top/three-quarter).
"""
import bpy, bmesh, math, random, os
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'organisms')
ART = os.path.join(ROOT, 'artifacts', 'moss-asset')

def lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(len(a)))
# Byte colour layers hold sRGB; the glTF exporter converts them to linear.
def lin(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
SOIL_D, SOIL, PEBBLE = lin('4f3420'), lin('7a5332'), lin('8c6a48')
CREASE, BODY, LIT, TIP = lin('2a440e'), lin('6a9819'), lin('9cc62c'), lin('c9e046')   # Codex 2026-11-08: ~20% less yellow   # paired Codex A/B 2026-11-08: lime won

def colour_layer(bm):
    return bm.loops.layers.color.get('Col') or bm.loops.layers.color.new('Col')

def face(bm, col, pts, colours):
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    for loop, c in zip(f.loops, colours): loop[col] = c
    return f

class Tuft:
    def __init__(self, seed):
        rng = self.rng = random.Random(seed)
        self.seed = seed
        self.lobes = [(rng.uniform(-0.2, 0.2), rng.uniform(-0.16, 0.16), rng.uniform(0.16, 0.25), rng.uniform(0.13, 0.24)) for _ in range(rng.randint(4, 6))]
        self.soil = 0.07

    def height(self, x, z):
        best = 0.0
        for cx, cz, r, h in self.lobes:
            d = math.hypot(x - cx, z - cz) / r
            if d < 1: best = max(best, self.soil + h * (1 - d ** 2) ** 0.55)
        return best

    def normal(self, x, z):
        e = 0.008
        return Vector((-(self.height(x + e, z) - self.height(x - e, z)) / (2 * e), 1, -(self.height(x, z + e) - self.height(x, z - e)) / (2 * e))).normalized()

    def lobe_of(self, x, z):
        best, which = 0, 0
        for i, (cx, cz, r, h) in enumerate(self.lobes):
            d = math.hypot(x - cx, z - cz) / r
            if d < 1:
                y = h * (1 - d ** 2) ** 0.55
                if y > best: best, which = y, i
        return which

def soil_plinth(bm, col, tuft):
    """Brown soil under the moss: the moss footprint pulled in a little, with gently bulging sides."""
    seg = 40
    def radius(a):
        r = 0.0
        while r < 0.7 and tuft.height(math.cos(a) * (r + 0.01), math.sin(a) * (r + 0.01)) > 0: r += 0.01
        return max(0.08, r * 0.72)   # tucked under the overhanging leaves (Codex: no visible brown band)
    rim = [(math.cos(s / seg * math.tau), math.sin(s / seg * math.tau), radius(s / seg * math.tau)) for s in range(seg)]
    rows = []
    for t, y in ((0.86, 0.0), (1.0, tuft.soil * 0.45), (0.94, tuft.soil * 0.95)):
        rows.append([bm.verts.new((c * r * t, y, s * r * t)) for c, s, r in rim])
    for k in range(2):
        for s in range(seg):
            q = [rows[k][s], rows[k][(s + 1) % seg], rows[k + 1][(s + 1) % seg], rows[k + 1][s]]
            f = bm.faces.new(q)
            for loop in f.loops:
                tone = lerp(SOIL_D, SOIL, loop.vert.co.y / tuft.soil)
                if tuft.rng.random() < 0.18: tone = PEBBLE
                loop[col] = tone
    top = bm.faces.new(rows[2][::-1])
    for loop in top.loops: loop[col] = SOIL_D

def body(bm, col, tuft, n):
    """The solid olive cushion under the rosettes (keeps gaps from showing through)."""
    span = 0.6; grid = {}; verts = {}
    for a in range(n + 1):
        for b in range(n + 1):
            x, z = -span + 2 * span * a / n, -span + 2 * span * b / n
            h = tuft.height(x, z)
            grid[a, b] = (x, max(0.0, tuft.soil + (h - tuft.soil) * 0.68 - 0.03) if h > 0 else 0.0, z)
    for a in range(n):
        for b in range(n):
            quad = [(a, b), (a, b + 1), (a + 1, b + 1), (a + 1, b)]
            if min(grid[q][1] for q in quad) <= 0: continue
            vs = [verts.setdefault(q, bm.verts.new(grid[q])) for q in quad]
            f = bm.faces.new(vs)
            for loop in f.loops: loop[col] = tuple(c * 0.85 for c in lerp(CREASE, BODY, 0.15)[:3]) + (1.0,)   # shade between shoots, not a green shell

NORMALS = {}   # vertex -> shading normal (puff radial), applied as custom normals

def leaflet(bm, col, origin, d, side, length, width, bright, shade_normal=None, colours=None):
    """A rounded, cupped leaflet with a notched tip (two points), 6 triangles."""
    d = d.normalized(); s = side.normalized(); up = d.cross(s).normalized()
    if up.y < 0: up = -up
    cup = up * width * 0.22                         # shallow fold: less ridge contrast (Codex)
    bend = up * length * 0.12                       # tips curl up a little
    P = [origin,
         origin + d * length * 0.3 + s * width * 0.45 + cup,
         origin + d * length * 0.62 + s * width * 0.5 + cup * 0.7 + bend * 0.4,
         origin + d * length * 0.9 + s * width * 0.3 + cup * 0.3 + bend,
         origin + d * length * 0.55 + cup * 0.9,
         origin + d * length * 1.0 + bend * 1.2,
         origin + d * length * 0.9 - s * width * 0.3 + cup * 0.3 + bend,
         origin + d * length * 0.62 - s * width * 0.5 + cup * 0.7 + bend * 0.4,
         origin + d * length * 0.3 - s * width * 0.45 + cup]
    # Bright tips only on the sunniest leaves (about a fifth), mid green elsewhere.
    base = lerp(CREASE, BODY, 0.15 * bright); mid = lerp(BODY, LIT, 0.6 * bright); tip = lerp(LIT, TIP, bright)
    C = colours or [base, mid, mid, tip, mid, tip, tip, mid, mid]
    V = [bm.verts.new(p) for p in P]          # shared within the leaflet: one vertex per point
    if shade_normal is not None:
        for vert in V: NORMALS[vert] = shade_normal
    for tri in ((0, 1, 2), (0, 2, 4), (2, 3, 4), (3, 5, 4), (4, 5, 6), (4, 6, 7), (0, 4, 7), (0, 7, 8)):
        f = bm.faces.new([V[i] for i in tri])
        for loop, i in zip(f.loops, tri): loop[col] = C[i]

def small_leaf(bm, col, origin, d, side, length, width, colours, shade_normal):
    """A small rounded leaf in four triangles (base, two shoulders, tip, raised middle)."""
    d = d.normalized(); s = side.normalized(); up = d.cross(s).normalized()
    if up.y < 0: up = -up
    P = [origin, origin + d * length * 0.45 + s * width * 0.5, origin + d * length, origin + d * length * 0.45 - s * width * 0.5, origin + d * length * 0.5 + up * width * 0.18]
    V = [bm.verts.new(p) for p in P]
    for vert in V: NORMALS[vert] = shade_normal
    base, body, tip = colours
    C = [base, body, tip, body, body]
    for tri in ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)):
        f = bm.faces.new([V[i] for i in tri])
        for loop, i in zip(f.loops, tri): loop[col] = C[i]

def rosette(bm, col, rng, centre, n, scale, bright, outward, leaves, spray=None):
    """A short leaning moss shoot (Codex, 2026-11-08, on why puffs read as flowers): 5-7 narrow
    teardrop leaves (about 3.5:1) staggered in tiers up a tilted shoot, most of them biased toward the
    spray's shared lean, so neighbouring shoots overlap into one spray instead of each making a
    rosette with a centre. Colour runs olive at the base to a tip only slightly lighter, with no lime
    rim; shading follows the cushion, not each shoot."""
    lean = (spray if spray is not None else Vector((0, 0, 0))) + outward * 0.9
    axis = (n * 1.0 + lean * 0.8 + Vector(((rng.random() - 0.5) * 0.3, 0, (rng.random() - 0.5) * 0.3))).normalized()
    ref = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 0, 1))
    u = axis.cross(ref).normalized(); v = axis.cross(u).normalized()
    bias = (lean - axis * lean.dot(axis))
    bias = bias.normalized() if bias.length > 1e-4 else u
    # Owner 2026-11-08: up close it must read as moss, not flowers. Real cushion moss (Dicranum,
    # Leucobryum) is a stem densely clothed in small leaves all the way up, the tip leaves clasped
    # together into a closed point, so there is no open centre for the eye to read as a blossom.
    height = scale * (0.6 + rng.random() * 0.3) * 0.42        # compact shoots: shorter again (Codex round 6)
    tone = 0.9 + rng.random() * 0.2
    count = rng.randint(6, 7)
    phase = rng.random() * math.tau
    for k in range(count):
        t = k / (count - 1)
        at = centre + axis * height * (0.08 + 0.85 * t)
        a = phase + k * 2.39996 + (rng.random() - 0.5) * 0.5          # spiral, as moss leaves are set
        side_dir = (u * math.cos(a) + v * math.sin(a))
        out = (bias * 0.45 + side_dir * 0.55).normalized()
        spread = 1.3 - t * 1.05 + (rng.random() - 0.5) * 0.3        # low leaves spread and droop, tip leaves clasp
        d = (out * math.sin(spread) + axis * math.cos(spread)).normalized()
        length = scale * (0.42 - t * 0.18) * (0.85 + rng.random() * 0.3)
        width = length / 2.6                                    # a little broader, less fern-like
        light = bright * tone * (0.45 + 0.55 * t)                 # darker inside, lighter tips
        body = lerp(BODY, LIT, 0.35 + 0.55 * light); tipc = lerp(body, TIP, 0.25 * light); base = lerp(CREASE, body, 0.55)
        shade = (n * 0.65 + d * 0.35).normalized()
        if t < 0.35:
            leaflet(bm, col, at, d, axis.cross(out), length, width, light, shade_normal=shade, colours=[base, body, body, tipc, body, tipc, tipc, body, body])
        else:
            small_leaf(bm, col, at, d, axis.cross(out), length, width, (base, body, tipc), shade)

def moss(bm, col, tuft, step, scale, leaves):
    rng = random.Random(tuft.seed * 7 + int(step * 1000))
    placed = 0; span = 0.6
    cells = int(2 * span / step) + 1
    for a in range(cells):
        for b in range(cells):
            x = -span + a * step + rng.uniform(-0.35, 0.35) * step
            z = -span + b * step + rng.uniform(-0.35, 0.35) * step
            y = tuft.height(x, z)
            if y <= 0: continue
            nn = tuft.normal(x, z)
            extra = 1 + int((1 / max(nn.y, 0.3) - 1) * 1.3)      # steep sides have more area per cell
            for e in range(extra):
                ox = x + (rng.uniform(-0.5, 0.5) * step if e else 0); oz = z + (rng.uniform(-0.5, 0.5) * step if e else 0)
                oy = tuft.height(ox, oz)
                if oy <= 0: continue
                lobe = tuft.lobes[tuft.lobe_of(ox, oz)]
                rel = min(1, math.hypot(ox - lobe[0], oz - lobe[1]) / lobe[2])   # 0 crown .. 1 rim of this lobe
                outward = Vector((ox - lobe[0], 0, oz - lobe[1]))
                outward = (outward.normalized() if outward.length > 1e-5 else Vector((0, 0, 0))) * max(0, rel - 0.55)
                bright = 1.0 - 0.75 * rel ** 1.6 + 0.1 * noise.noise(Vector((ox * 9, oz * 9, tuft.seed)))
                sx, sz = math.floor(ox * 7), math.floor(oz * 7)          # ~10 sprays per tuft, each with one lean
                sr = random.Random(hash((tuft.seed, sx, sz)) & 0xffffffff)
                spray = Vector((sr.uniform(-1, 1), 0, sr.uniform(-1, 1))) * 0.6
                spray_tone = 0.9 + sr.random() * 0.2
                rosette(bm, col, rng, Vector((ox, oy - 0.01, oz)), tuft.normal(ox, oz), scale * rng.uniform(0.8, 1.2), max(0.2, min(1, bright * spray_tone)), outward, leaves, spray)
                placed += 1
    return placed

_mat = None
def material():
    global _mat
    if _mat is not None and _mat.name in bpy.data.materials: return _mat
    _mat = bpy.data.materials.new('MossVertex'); _mat.use_nodes = True
    nt = _mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    return _mat

def mesh_object(name, build):
    mesh = bpy.data.meshes.new(name); bm = bmesh.new(); col = colour_layer(bm)
    NORMALS.clear()
    info = build(bm, col)
    bm.normal_update(); bm.verts.index_update()
    custom = [tuple(NORMALS.get(vert, vert.normal)) for vert in bm.verts]
    bm.to_mesh(mesh); bm.free()
    mesh.normals_split_custom_set_from_vertices(custom)
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    mesh.materials.append(material())
    for p in mesh.polygons: p.use_smooth = True
    return obj, info

def build(variant, seed):
    global _mat
    bpy.ops.wm.read_factory_settings(use_empty=True); _mat = None
    tuft = Tuft(seed)
    def lod0(bm, col):
        soil_plinth(bm, col, tuft); body(bm, col, tuft, 30)
        return moss(bm, col, tuft, 0.025, 0.095, 7)    # owner: denser (about 1.85x round 5)
    def lod1(bm, col):
        soil_plinth(bm, col, tuft); body(bm, col, tuft, 20)
        return moss(bm, col, tuft, 0.064, 0.15, 6)
    def lod2(bm, col):
        # Overview level: a coarse body and a few big rosettes, under a thousand triangles.
        soil_plinth(bm, col, tuft); body(bm, col, tuft, 10)
        return moss(bm, col, tuft, 0.13, 0.24, 5)
    objs = [mesh_object(name, fn) for name, fn in (('lod0', lod0), ('lod1', lod1), ('lod2', lod2))]
    for obj, _ in objs: obj.rotation_euler = (math.pi / 2, 0, 0)   # our y-up build into Blender's z-up
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = objs[0][0]
    bpy.ops.object.transform_apply(rotation=True)
    s = 1 / max(objs[0][0].dimensions.x, objs[0][0].dimensions.y)
    for obj, _ in objs: obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    path = os.path.join(OUT, f'moss-tuft-{variant}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_normals=True, export_attributes=True, use_selection=True)
    tris = [sum(len(p.vertices) - 2 for p in o.data.polygons) for o, _ in objs]
    print(f'moss-tuft-{variant}: lod0 {tris[0]} / lod1 {tris[1]} / lod2 {tris[2]} tris, {os.path.getsize(path)} bytes, rosettes {objs[0][1]}/{objs[1][1]}, height {objs[0][0].dimensions.z:.3f}')
    objs[1][0].hide_render = True; objs[2][0].hide_render = True
    render_turnaround(objs[0][0], variant, 'turnaround')
    objs[1][0].hide_render = False; objs[0][0].hide_render = True
    render_turnaround(objs[1][0], variant, 'lod1')
    objs[1][0].hide_render = True; objs[2][0].hide_render = False
    render_turnaround(objs[2][0], variant, 'lod2')

def render_turnaround(obj, variant, prefix):
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 480, 360
    if scene.camera is None:
        world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
        world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.95, 0.92, 0.85, 1)
        world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
        sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(40), 0, math.radians(30)); sun.data.energy = 3.5
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam = scene.camera
    centre = Vector((0, 0, obj.dimensions.z * 0.4))
    views = {'front': (0, -1.6, 0.45), 'back': (0, 1.6, 0.45), 'left': (-1.6, 0, 0.45), 'right': (1.6, 0, 0.45), 'top': (0.001, 0, 1.8), 'three-quarter': (1.15, -1.15, 0.8)}
    for name, (x, y, z) in views.items():
        cam.location = Vector((x, y, z))
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(ART, f'{prefix}-{variant}-{name}.png')
        bpy.ops.render.render(write_still=True)

for variant, seed in ((1, 11), (2, 23), (3, 37), (4, 51)):
    build(variant, seed)
