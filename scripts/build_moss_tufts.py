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
Writes public/assets/organisms/moss-atlas.png (the detailed shoots baked to a texture) and
moss-tuft-{1..4}.glb, each holding "lod0" (close), "lod1" (medium) and "lod2" (far) built from
baked shoot cards (see the optimisation notes below), unit width, base at y = 0.
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
CREASE, BODY, LIT, TIP = lin('2c460e'), lin('74a21b'), lin('a8cc30'), lin('cfe24a')   # Codex 2026-11-08: ~20% less yellow   # paired Codex A/B 2026-11-08: lime won

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

# ---------------------------------------------------------------------------------------------
# Optimisation (owner brief, 2026-11-08): keep the look, cut the cost. The detailed shoots above are
# no longer exported leaf by leaf. Instead they are baked, as they are, into one texture atlas
# (public/assets/organisms/moss-atlas.png): four shoot variants seen from the side and from above,
# and a dense patch seen from above. Each exported shoot is then two textured, alpha-tested quads
# (a side card standing along the shoot axis and a top card across it), so one shoot costs four
# triangles instead of about forty, while its outline is the baked leaves themselves.
#   lod0  (close)  many shoot cards over a coarse shaded body
#   lod1  (medium) fewer, larger cards (clusters)
#   lod2  (far)    body textured with the baked patch plus a ring of rim cards
ATLAS = 1024
SIDE_Y, TOP_Y, CELL = 768, 512, 256          # atlas rows (Blender: origin bottom-left)
PATCH = (0, 0, 512)                           # x, y, size of the baked top-view patch
WHITE = (1016, 8)                             # an opaque white texel for untextured soil
BAKE_SCALE = 0.1                              # the shoot scale the cells were baked at
frame = {}                                    # baked frame sizes (side square, top square)

def emission_material():
    mat = bpy.data.materials.new('BakeVertex'); mat.use_nodes = True
    nt = mat.node_tree
    for node in list(nt.nodes): nt.nodes.remove(node)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'; nt.links.new(vc.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return mat

def render_cell(view, size, half, path, base=0.0):
    """Orthographic render: 'side' looks along +y, 'top' looks down."""
    scene = bpy.context.scene
    scene.render.resolution_x = scene.render.resolution_y = size
    cam = scene.camera
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = half * 2
    if view == 'side': cam.location = (0, -5, base + half); cam.rotation_euler = (math.pi / 2, 0, 0)
    else: cam.location = (0, 0, 5); cam.rotation_euler = (0, 0, 0)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

def bake_atlas():
    import numpy as np
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    mat = emission_material()
    tmp = os.path.join(ART, 'bake'); os.makedirs(tmp, exist_ok=True)
    shoots = []
    for k in range(4):
        mesh = bpy.data.meshes.new(f'shoot{k}'); bm = bmesh.new(); col = colour_layer(bm)
        mini = Tuft(201 + k * 17); mini.soil = 0.0
        mini.lobes = [(0.0, 0.0, 0.05, 0.04)] + [(math.cos(a) * 0.02, math.sin(a) * 0.02, 0.03, 0.028) for a in (k, k + 2.1, k + 4.2)]
        shingles(bm, col, mini, 0.011, 0.024, k)
        bm.to_mesh(mesh); bm.free()
        obj = bpy.data.objects.new(f'shoot{k}', mesh); scene.collection.objects.link(obj); mesh.materials.append(mat)
        obj.rotation_euler = (math.pi / 2, 0, 0)
        shoots.append(obj)
    bpy.context.view_layer.update()
    lat = top = hgt = 0.0
    for obj in shoots:
        for v in obj.data.vertices:
            w = obj.matrix_world @ v.co
            lat = max(lat, abs(w.x)); top = max(top, abs(w.x), abs(w.y)); hgt = max(hgt, w.z)
    side_half = max(lat, hgt / 2) * 1.04; top_half = top * 1.04
    frame['side'] = side_half * 2; frame['top'] = top_half * 2
    for k, obj in enumerate(shoots):
        for other in shoots: other.hide_render = other is not obj
        render_cell('side', CELL, side_half, os.path.join(tmp, f'side{k}.png'))
        render_cell('top', CELL, top_half, os.path.join(tmp, f'top{k}.png'))
    for obj in shoots: obj.hide_render = True
    # A dense patch of shoots over a dark shade floor, seen from above, for the far body.
    mesh = bpy.data.meshes.new('patch'); bm = bmesh.new(); col = colour_layer(bm)
    half = 0.25; rng = random.Random(7)
    floor = [bm.verts.new((x, -0.002, z)) for x, z in ((-half, -half), (half, -half), (half, half), (-half, half))]
    f = bm.faces.new(floor[::-1])
    for loop in f.loops: loop[col] = lerp(CREASE, BODY, 0.1)
    patch = Tuft(5); patch.soil = 0.0
    patch.lobes = [(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0.06, 0.1), rng.uniform(0.03, 0.05)) for _ in range(70)]
    shingles(bm, col, patch, 0.016, 0.034, 99)
    bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new('patch', mesh); scene.collection.objects.link(obj); mesh.materials.append(mat)
    obj.rotation_euler = (math.pi / 2, 0, 0)
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    c = lerp(CREASE, BODY, 0.1)
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    render_cell('top', PATCH[2], half * 0.96, os.path.join(tmp, 'patch.png'))
    # Compose the atlas (Blender pixels are bottom-up rows of RGBA floats).
    atlas = np.zeros((ATLAS, ATLAS, 4), dtype=np.float32)
    def put(path, x, y):
        img = bpy.data.images.load(path); w, h = img.size
        atlas[y:y + h, x:x + w] = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
        bpy.data.images.remove(img)
    for k in range(4):
        put(os.path.join(tmp, f'side{k}.png'), k * CELL, SIDE_Y)
        put(os.path.join(tmp, f'top{k}.png'), k * CELL, TOP_Y)
    put(os.path.join(tmp, 'patch.png'), PATCH[0], PATCH[1])
    atlas[0:16, 1008:1024] = (1, 1, 1, 1)
    # Bleed leaf colour into the empty texels beside leaves, so mipmaps keep green edges.
    rgb, alpha = atlas[..., :3].copy(), atlas[..., 3:4].copy()
    solid = (alpha > 0.5).astype(np.float32)
    for _ in range(8):
        grown = np.zeros_like(rgb); weight = np.zeros_like(solid)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            grown += np.roll(np.roll(rgb * solid, dy, 0), dx, 1); weight += np.roll(np.roll(solid, dy, 0), dx, 1)
        fill = (solid < 0.5) & (weight > 0)
        rgb = np.where(fill, grown / np.maximum(weight, 1e-6), rgb)
        solid = np.where(fill, 1.0, solid)
    atlas[..., :3] = rgb
    image = bpy.data.images.new('moss-atlas', ATLAS, ATLAS, alpha=True)
    image.pixels = atlas.ravel()
    image.filepath_raw = os.path.join(OUT, 'moss-atlas.png'); image.file_format = 'PNG'; image.save()
    print('atlas', os.path.getsize(image.filepath_raw), 'bytes; side frame', round(frame['side'], 4), 'top frame', round(frame['top'], 4))

def uv_layer(bm): return bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')

def quad(bm, col, uv, corners, uvs, colour, normal):
    vs = [bm.verts.new(p) for p in corners]
    for v in vs: NORMALS[v] = normal
    f = bm.faces.new(vs)
    for loop, t in zip(f.loops, uvs): loop[uv].uv = t; loop[col] = colour
    return f

def cell_uv(x, y, size=CELL):
    a, b = x / ATLAS, y / ATLAS; s = size / ATLAS
    return [(a, b), (a + s, b), (a + s, b + s), (a, b + s)]

def shoot_cards(bm, col, uv, rng, centre, n, scale, bright, outward, spray=None, top_card=True):
    """One shoot as two baked cards: a side card along the shoot axis and a top card across it."""
    lean = (spray if spray is not None else Vector((0, 0, 0))) + outward * 0.9
    axis = (n + lean * 0.8 + Vector(((rng.random() - 0.5) * 0.3, 0, (rng.random() - 0.5) * 0.3))).normalized()
    f = scale / BAKE_SCALE
    k = rng.randrange(4)
    yaw = rng.random() * math.tau
    ref = Vector((math.cos(yaw), 0, math.sin(yaw)))
    t = (ref - axis * ref.dot(axis)).normalized()
    w = 0.79 * scale                       # card size in world units, independent of the baked frame
    v = max(0.0, min(1.0, 0.4 + 0.55 * bright * (0.85 + rng.random() * 0.3)))   # cushion light and shade over the baked leaves
    colour = (v, v, v, 1.0)
    shade = (n * 0.65 + axis * 0.35).normalized()
    base = centre - axis * w * 0.06
    quad(bm, col, uv, [base - t * w / 2, base + t * w / 2, base + t * w / 2 + axis * w, base - t * w / 2 + axis * w], cell_uv(k * CELL, SIDE_Y), colour, shade)
    if top_card:
        q = axis.cross(t).normalized(); s = 0.94 * scale
        mid = centre + axis * w * 0.32
        quad(bm, col, uv, [mid - t * s / 2 - q * s / 2, mid + t * s / 2 - q * s / 2, mid + t * s / 2 + q * s / 2, mid - t * s / 2 + q * s / 2], cell_uv(k * CELL, TOP_Y), colour, shade)

def card_moss(bm, col, uv, tuft, step, scale, top_card=True):
    """The same placement as moss(), with shoot cards instead of leaf geometry."""
    rng = random.Random(tuft.seed * 7 + int(step * 1000))
    placed = 0; span = 0.6
    cells = int(2 * span / step) + 1
    for a in range(cells):
        for b in range(cells):
            x = -span + a * step + rng.uniform(-0.35, 0.35) * step
            z = -span + b * step + rng.uniform(-0.35, 0.35) * step
            if tuft.height(x, z) <= 0: continue
            nn = tuft.normal(x, z)
            extra = 1 + int((1 / max(nn.y, 0.3) - 1) * 1.3)
            for e in range(extra):
                ox = x + (rng.uniform(-0.5, 0.5) * step if e else 0); oz = z + (rng.uniform(-0.5, 0.5) * step if e else 0)
                oy = tuft.height(ox, oz)
                if oy <= 0: continue
                lobe = tuft.lobes[tuft.lobe_of(ox, oz)]
                rel = min(1, math.hypot(ox - lobe[0], oz - lobe[1]) / lobe[2])
                outward = Vector((ox - lobe[0], 0, oz - lobe[1]))
                outward = (outward.normalized() if outward.length > 1e-5 else Vector((0, 0, 0))) * max(0, rel - 0.55)
                bright = 1.0 - 0.75 * rel ** 1.6 + 0.1 * noise.noise(Vector((ox * 9, oz * 9, tuft.seed)))
                sx, sz = math.floor(ox * 7), math.floor(oz * 7)
                sr = random.Random(hash((tuft.seed, sx, sz)) & 0xffffffff)
                spray = Vector((sr.uniform(-1, 1), 0, sr.uniform(-1, 1))) * 0.6
                shoot_cards(bm, col, uv, rng, Vector((ox, oy - 0.012, oz)), tuft.normal(ox, oz), scale * rng.uniform(0.8, 1.2), max(0.2, min(1, bright * (0.9 + sr.random() * 0.2))), outward, spray, top_card)
                placed += 1
    return placed

def textured_body(bm, col, uv, tuft, n, colour_scale, lowered=True):
    """The cushion body, its top planar-mapped onto the baked patch."""
    span = 0.6; grid = {}; verts = {}
    for a in range(n + 1):
        for b in range(n + 1):
            x, z = -span + 2 * span * a / n, -span + 2 * span * b / n
            h = tuft.height(x, z)
            y = (max(0.0, tuft.soil + (h - tuft.soil) * 0.68 - 0.03) if lowered else max(0.0, h - 0.012)) if h > 0 else 0.0
            grid[a, b] = (x, y, z)
    for a in range(n):
        for b in range(n):
            ids = [(a, b), (a, b + 1), (a + 1, b + 1), (a + 1, b)]
            if min(grid[q][1] for q in ids) <= 0: continue
            f = bm.faces.new([verts.setdefault(q, bm.verts.new(grid[q])) for q in ids])
            for loop in f.loops:
                x, y, z = loop.vert.co
                loop[uv].uv = ((PATCH[0] + (x + span) / (2 * span) * PATCH[2]) / ATLAS, (PATCH[1] + (z + span) / (2 * span) * PATCH[2]) / ATLAS)
                lobe = tuft.lobes[tuft.lobe_of(x, z)]
                rel = min(1, math.hypot(x - lobe[0], z - lobe[1]) / lobe[2])
                v = colour_scale * (1.0 - 0.45 * rel ** 1.6)
                loop[col] = DEBUG_BODY or (v, v, v, 1.0)

def plinth(bm, col, uv, tuft, seg):
    """The brown soil base (soil_plinth's shape) with fewer segments, mapped to a white texel."""
    def radius(a):
        r = 0.0
        while r < 0.7 and tuft.height(math.cos(a) * (r + 0.01), math.sin(a) * (r + 0.01)) > 0: r += 0.01
        return max(0.08, r * 0.72)
    rim = [(math.cos(s / seg * math.tau), math.sin(s / seg * math.tau), radius(s / seg * math.tau)) for s in range(seg)]
    rows = [[bm.verts.new((c * r * t, y, s * r * t)) for c, s, r in rim] for t, y in ((0.86, 0.0), (1.0, tuft.soil * 0.45), (0.94, tuft.soil * 0.95))]
    white = (WHITE[0] / ATLAS, WHITE[1] / ATLAS)
    faces = []
    for k in range(2):
        for s in range(seg):
            f = bm.faces.new([rows[k][s], rows[k][(s + 1) % seg], rows[k + 1][(s + 1) % seg], rows[k + 1][s]])
            for loop in f.loops: loop[col] = DEBUG_BODY or (PEBBLE if tuft.rng.random() < 0.18 else lerp(SOIL_D, SOIL, loop.vert.co.y / tuft.soil))
            faces.append(f)
    f = bm.faces.new(rows[2][::-1])
    for loop in f.loops: loop[col] = SOIL_D
    faces.append(f)
    for f in faces:
        for loop in f.loops: loop[uv].uv = white

def rim_cards(bm, col, uv, tuft, count, scale):
    rng = random.Random(tuft.seed * 13)
    for k in range(count):
        a = k / count * math.tau + rng.uniform(-0.1, 0.1)
        r = 0.0
        while r < 0.7 and tuft.height(math.cos(a) * (r + 0.01), math.sin(a) * (r + 0.01)) > 0: r += 0.01
        r *= 0.9; x, z = math.cos(a) * r, math.sin(a) * r
        shoot_cards(bm, col, uv, rng, Vector((x, tuft.height(x, z) - 0.02, z)), tuft.normal(x, z), scale, 0.7, Vector((math.cos(a), 0, math.sin(a))) * 0.4, None, False)

def card_object(name, build):
    mesh = bpy.data.meshes.new(name); bm = bmesh.new(); col = colour_layer(bm); uv = uv_layer(bm)
    NORMALS.clear()
    info = build(bm, col, uv)
    bm.normal_update(); bm.verts.index_update()
    custom = [tuple(NORMALS.get(vert, vert.normal)) for vert in bm.verts]
    bm.to_mesh(mesh); bm.free()
    mesh.normals_split_custom_set_from_vertices(custom)
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    mesh.materials.append(material())
    for p in mesh.polygons: p.use_smooth = True
    return obj, info

# ---------------------------------------------------------------------------------------------
# Shingled leaf cover (owner, 2026-11-08: "leaves overlapping until the mound is hidden, like the
# reference"). Broad rounded leaves lie along the cushion like roof tiles: each points down-slope
# and outward from its lobe's crown, its tip lifted a little off the surface, its base tucked under
# the leaf above, so neighbours overlap and the body never shows. No radial rings (those read as
# flowers): leaves share the slope direction. A ring of drooping skirt leaves hides the soil plinth.
# A few spore stalks (moss sporophytes: seta + capsule) stand above the crown.
# MOSS_COVERAGE=1 builds variant 1 with a magenta body and prints how much of it shows.
DEBUG_BODY = (1.0, 0.0, 1.0, 1.0) if os.environ.get('MOSS_COVERAGE') else None
SETA, CAPSULE = lin('a8963a'), lin('d4cf3c')

def rotate_about(v, axis, angle):
    axis = axis.normalized()
    return v * math.cos(angle) + axis.cross(v) * math.sin(angle) + axis * axis.dot(v) * (1 - math.cos(angle))

def shingle_colours(light, rel):
    base = lerp(CREASE, BODY, 0.25 + 0.3 * light)
    mid = lerp(BODY, LIT, 0.2 + 0.6 * light)
    edge = lerp(mid, LIT, 0.08 * light)                         # barely lighter edge: pale rims read as scales (Codex)
    return [base, mid, mid, edge, mid, edge, edge, mid, mid]

def shingles(bm, col, tuft, spacing, length, seed_offset=0):
    rng = random.Random(tuft.seed * 31 + seed_offset)
    span = 0.62; cells = int(2 * span / spacing) + 1
    placed = 0
    up = Vector((0, 1, 0))
    for a in range(cells):
        for b in range(cells):
            x = -span + a * spacing + rng.uniform(-0.4, 0.4) * spacing
            z = -span + b * spacing + rng.uniform(-0.4, 0.4) * spacing
            h = tuft.height(x, z)
            if h <= 0: continue
            n = tuft.normal(x, z)
            extra = 1 + int((1 / max(n.y, 0.3) - 1) * 1.5)      # steep flanks have more area per cell
            for e in range(extra):
                ox = x + (rng.uniform(-0.5, 0.5) * spacing if e else 0); oz = z + (rng.uniform(-0.5, 0.5) * spacing if e else 0)
                oh = tuft.height(ox, oz)
                if oh <= 0: continue
                nn = tuft.normal(ox, oz)
                lobe = tuft.lobes[tuft.lobe_of(ox, oz)]
                rel = min(1, math.hypot(ox - lobe[0], oz - lobe[1]) / lobe[2])
                out = Vector((ox - lobe[0], 0, oz - lobe[1]))
                if out.length < 1e-4 or rel < 0.12: out = Vector((math.cos(rng.random() * math.tau), 0, math.sin(rng.random() * math.tau)))
                tangent = (out - nn * out.dot(nn)).normalized()
                tangent = rotate_about(tangent, nn, rng.uniform(-0.55, 0.55))
                lift = math.radians(rng.uniform(12, 28))
                d = (tangent * math.cos(lift) + nn * math.sin(lift)).normalized()
                L = length * rng.uniform(0.85, 1.2); W = L * rng.uniform(0.6, 0.75)
                origin = Vector((ox, oh, oz)) - d * L * 0.3 + nn * (0.002 + 0.01 * (1 - rel))
                light = max(0.15, min(1.0, (0.35 + 0.65 * nn.y) * (1.0 - 0.35 * rel) + 0.12 * noise.noise(Vector((ox * 8, oz * 8, tuft.seed)))))
                shade = (nn * 0.7 + d * 0.3).normalized()
                leaflet(bm, col, origin, d, nn.cross(d), L, W, light, shade_normal=shade, colours=shingle_colours(light, rel))
                placed += 1
    # Skirt: two rings of drooping leaves round the footprint edge, hiding the soil plinth down to the
    # ground: an upper ring at the cushion's rim and a lower one at the plinth.
    reach = max(math.hypot(cx, cz) + r for cx, cz, r, h in tuft.lobes)
    count = max(8, int(2 * math.pi * reach * 0.85 / (spacing * 0.7)))
    for ring, (inset, droops, low) in enumerate(((0.9, (25, 50), False), (0.78, (45, 70), True))):
      for k in range(count):
        ang = (k + 0.5 * ring) / count * math.tau + rng.uniform(-0.08, 0.08)
        r = 0.0
        while r < 0.7 and tuft.height(math.cos(ang) * (r + 0.01), math.sin(ang) * (r + 0.01)) > 0: r += 0.01
        r *= inset * rng.uniform(0.96, 1.04); x, z = math.cos(ang) * r, math.sin(ang) * r
        h = tuft.height(x, z)
        if h <= 0: continue
        if low: h = min(h, tuft.soil * 1.3)
        outward = Vector((math.cos(ang), 0, math.sin(ang)))
        droop = math.radians(rng.uniform(*droops))
        d = (outward * math.cos(droop) - up * math.sin(droop)).normalized()
        L = length * rng.uniform(1.0, 1.3); W = L * rng.uniform(0.6, 0.75)
        origin = Vector((x, h - 0.005, z)) - outward * L * 0.15
        light = 0.25 + 0.12 * rng.random()
        leaflet(bm, col, origin, d, up.cross(d), L, W, light, shade_normal=(outward * 0.8 + up * 0.1).normalized(), colours=shingle_colours(light, 1.0))
        placed += 1
    return placed

def sporophytes(bm, col, tuft, count, height):
    """Moss spore stalks: a thin seta (three-sided) with a small capsule, on the highest crowns."""
    rng = random.Random(tuft.seed * 53)
    tops = sorted(tuft.lobes, key=lambda lobe: -lobe[3])
    for k in range(count):
        cx, cz, r, h = tops[k % len(tops)]
        a = rng.random() * math.tau; d = rng.uniform(0, 0.5) * r
        x, z = cx + math.cos(a) * d, cz + math.sin(a) * d
        base = Vector((x, tuft.height(x, z) - 0.01, z))
        lean = Vector((rng.uniform(-0.25, 0.25), 1, rng.uniform(-0.25, 0.25))).normalized()
        top = base + lean * height * rng.uniform(0.8, 1.2)
        w = height * 0.025
        ring_b = [base + Vector((math.cos(t) * w, 0, math.sin(t) * w)) for t in (0, 2.09, 4.19)]
        ring_t = [top + Vector((math.cos(t) * w * 0.7, 0, math.sin(t) * w * 0.7)) for t in (0, 2.09, 4.19)]
        for i in range(3):
            face(bm, col, [ring_b[i], ring_b[(i + 1) % 3], ring_t[(i + 1) % 3], ring_t[i]], [SETA] * 4)
        c = height * 0.07
        tip = top + lean * c * 2.2
        mids = [top + lean * c * 0.9 + Vector((math.cos(t) * c, 0, math.sin(t) * c)) for t in (0, 1.57, 3.14, 4.71)]
        for i in range(4):
            face(bm, col, [top, mids[(i + 1) % 4], mids[i]], [lerp(SETA, CAPSULE, 0.5), CAPSULE, CAPSULE])
            face(bm, col, [mids[i], mids[(i + 1) % 4], tip], [CAPSULE, CAPSULE, lerp(CAPSULE, TIP, 0.5)])

def coverage_report(obj):
    """Render the shingled level with emission vertex colours and count magenta (body) pixels."""
    import numpy as np
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'; scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = 400
    obj.data.materials.clear(); obj.data.materials.append(emission_material())
    cam = bpy.data.objects.new('covcam', bpy.data.cameras.new('covcam')); scene.collection.objects.link(cam); scene.camera = cam
    z = obj.dimensions.z
    for name, loc in (('top', (0.001, 0, 2.2)), ('three-quarter', (1.4, -1.4, 1.1)), ('side', (0, -2.0, 0.25))):
        cam.location = Vector(loc); cam.rotation_euler = (Vector((0, 0, z * 0.35)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        path = os.path.join(ART, f'coverage-{name}.png'); scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path); px = np.array(img.pixels[:]).reshape(-1, 4); bpy.data.images.remove(img)
        seen = px[:, 3] > 0.5
        body = seen & (px[:, 0] > 0.7) & (px[:, 2] > 0.7) & (px[:, 1] < 0.35)
        print(f'coverage {name}: body visible {100 * body.sum() / max(1, seen.sum()):.1f}% of moss pixels')

def build(variant, seed):
    global _mat
    bpy.ops.wm.read_factory_settings(use_empty=True); _mat = None
    tuft = Tuft(seed)
    white = (WHITE[0] / ATLAS, WHITE[1] / ATLAS)
    def real(bm, col, uv, spacing, length, body_n, spores):
        # Opaque real 3D shingled leaves over the shaded body (no cut-out texture: keeps the GPU's early
        # depth rejection, which alpha-tested cards switch off; that matters most on iPad tile GPUs).
        plinth(bm, col, uv, tuft, 20); textured_body(bm, col, uv, tuft, body_n, 0.62)
        before = set(bm.faces)
        placed = shingles(bm, col, tuft, spacing, length)
        if spores: sporophytes(bm, col, tuft, spores, 0.16)
        for f in bm.faces:
            if f not in before:
                for loop in f.loops: loop[uv].uv = white
        return placed
    def lod0(bm, col, uv): return real(bm, col, uv, 0.042, 0.085, 12, 4)      # close: overlapping leaves
    def lod1(bm, col, uv): return real(bm, col, uv, 0.075, 0.15, 10, 3)       # medium: fewer, larger leaves
    def lod2(bm, col, uv):
        # Far: baked shoot cards (alpha-tested) over a body that shows the baked foliage.
        plinth(bm, col, uv, tuft, 14); textured_body(bm, col, uv, tuft, 10, 0.75, lowered=False)
        return card_moss(bm, col, uv, tuft, 0.05, 0.16)
    def lod3(bm, col, uv):
        plinth(bm, col, uv, tuft, 10); textured_body(bm, col, uv, tuft, 8, 0.95, lowered=False)
        rim_cards(bm, col, uv, tuft, 18, 0.2)
        return 18
    objs = [card_object(name, fn) for name, fn in (('lod0', lod0), ('lod1', lod1), ('lod2', lod2), ('lod3', lod3))]
    for obj, _ in objs: obj.rotation_euler = (math.pi / 2, 0, 0)   # our y-up build into Blender's z-up
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = objs[0][0]
    bpy.ops.object.transform_apply(rotation=True)
    s = 1 / max(objs[0][0].dimensions.x, objs[0][0].dimensions.y)
    for obj, _ in objs: obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    path = os.path.join(OUT, f'moss-tuft-{variant}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_normals=True, export_attributes=True, export_texcoords=True, use_selection=True)
    tris = [sum(len(p.vertices) - 2 for p in o.data.polygons) for o, _ in objs]
    print(f'moss-tuft-{variant}: ' + ' / '.join(f'lod{k} {t}' for k, t in enumerate(tris)) + f' tris, {os.path.getsize(path)} bytes')

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

if DEBUG_BODY:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tuft = Tuft(11)
    for name, spacing, length in (('lod0', 0.042, 0.085), ('lod1', 0.075, 0.15)):
        for o in list(bpy.data.objects): bpy.data.objects.remove(o)
        def fn(bm, col, uv, spacing=spacing, length=length):
            plinth(bm, col, uv, tuft, 20); textured_body(bm, col, uv, tuft, 12, 0.62); return shingles(bm, col, tuft, spacing, length)
        obj, n = card_object(name, fn); obj.rotation_euler = (math.pi / 2, 0, 0)
        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(rotation=True)
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        print(f'{name}: {n} leaves, {tris} tris')
        coverage_report(obj)
else:
    bake_atlas()
    for variant, seed in ((1, 11), (2, 23), (3, 37), (4, 51)):
        build(variant, seed)
