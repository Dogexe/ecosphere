"""Adapt Quaternius Stylized Nature MegaKit plants (CC0) into ECOSPHERE's soft low-poly violet and broadleaf.

Phase 3 of the target look (2026-11-22): the natural look still drew 'bloom' (sweet violet, Viola odorata)
and 'tree' (the Fittonia/Calathea-like broadleaf) as painted cards. The Quaternius megakit already on disk
(artifacts/candidates/quaternius-standard, CC0, archive hash in ASSETS.md) was searched first
(artifacts/visual/phase3-candidates.png). Nothing in it is a violet or a broad-oval houseplant, so the two
nearest models are edited rather than modelling from primitives:

- natural-violet.glb, from Clover_2 + Flower_3_Group:
  * Clover_2's five leaf stalks (kept as real petioles) and a second copy turned 36 deg and scaled 0.85, so
    the rosette has ten leaves. The stalks are bent outward and lowered into a low rosette (height x0.42,
    spread growing with height). The small stem leaflets are dropped (violets have none).
  * Clover_2's clover leaf cards are alpha-cut textures; without the texture they would be rectangles, so
    each card is replaced, at its own stalk tip, by a heart-shaped (cordate), finely scalloped blade with
    a raised midrib, tilted up from horizontal and facing away from the centre.
  * Flower_3_Group's three flower heads become violet flowers: the 5-petal outline is traced from the
    source flower texture's alpha onto the source head's own cupped geometry (so the cup is kept), then
    each head is shrunk, nodded sideways like a violet and set on its own (shortened) source stalk just
    above the leaves. Petals #6a4fa0 with a pale cream-yellow centre.
- natural-broadleaf.glb, from Plant_1_Big:
  * Each of its 18 leaf cards keeps the source placement, lean and curve (its centreline is read through
    the source card's own triangles), but the lanceolate alpha-cut blade is redrawn as a broad oval blade
    on a short petiole (Calathea/Fittonia habit), slightly cupped. Deep green #3e6b45 family with a pink
    #c0587a midrib and a faint pink edge.

Textures are dropped for vertex colours (one corner colour layer 'Col'); smooth shading split above 35 deg;
materials are double sided. Flowers live in their own object and material named 'Flowers...' so
organismModel.ts can hide them until the plant flowers. Unit footprint (largest horizontal size 1), base at
y = 0, centred.

Run: D:/Blender/blender.exe -b -P scripts/adapt_violet_broadleaf.py
Writes public/assets/organisms/natural-violet.glb and natural-broadleaf.glb. Visual only.
"""
import bpy, bmesh, os, math, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.geometry import barycentric_transform, intersect_point_tri_2d

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'artifacts', 'candidates', 'quaternius-standard', 'glTF')
OUT = os.path.join(ROOT, 'public', 'assets', 'organisms')


def lin(h):
    return Vector(tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)))


def mix(a, b, t):
    return a * (1 - t) + b * t


# ---------------------------------------------------------------- source reading
def load(name):
    """Import one source glTF; return (islands, images). Each island is a loose part with its triangles."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.gltf'))
    obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    obj.data.transform(obj.matrix_world)
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    uv = bm.loops.layers.uv.active
    seen, islands = set(), []
    for f in bm.faces:
        if f in seen: continue
        stack, part = [f], []
        seen.add(f)
        while stack:
            g = stack.pop(); part.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen: seen.add(h); stack.append(h)
        tris = []
        for g in part:
            tris.append(([Vector((l[uv].uv.x, l[uv].uv.y, 0)) for l in g.loops], [l.vert.co.copy() for l in g.loops]))
        islands.append({'faces': len(part), 'mat': obj.data.materials[part[0].material_index].name, 'tris': tris,
                        'verts': list({v.co.to_tuple(): v.co.copy() for g in part for v in g.verts}.values())})
    images = {}
    for img in bpy.data.images:
        w, h = img.size
        images[img.name] = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bm.free()
    return islands, images


def locate(island, u, v):
    """3D point of UV (u, v) on the island's own triangles; outside it, the nearest triangle's plane extends it."""
    p = Vector((u, v, 0))
    best, bestd = None, 1e9
    for uvs, cos in island['tris']:
        if intersect_point_tri_2d(p.to_2d(), uvs[0].to_2d(), uvs[1].to_2d(), uvs[2].to_2d()):
            return barycentric_transform(p, *uvs, *cos)
        d = (p - (uvs[0] + uvs[1] + uvs[2]) / 3).length
        if d < bestd: best, bestd = (uvs, cos), d
    return barycentric_transform(p, *best[0], *best[1])


def alpha(img, u, v):
    h, w = img.shape[:2]
    x = min(w - 1, max(0, int(u * w))); y = min(h - 1, max(0, int(v * h)))
    return img[y, x, 3]


def uv_bounds(island):
    us = [q.x for uvs, _ in island['tris'] for q in uvs]; vs = [q.y for uvs, _ in island['tris'] for q in uvs]
    return min(us), max(us), min(vs), max(vs)


def centroid(points):
    return sum(points, Vector()) / len(points)


# ---------------------------------------------------------------- output building
class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new('Col')

    def vert(self, co, color):
        v = self.bm.verts.new(co)
        self._c = getattr(self, '_c', {}); self._c[v] = color
        return v

    def tri(self, a, b, c):
        if len({a, b, c}) < 3: return
        try:
            f = self.bm.faces.new((a, b, c))
        except ValueError:
            return
        f.smooth = True
        for l in f.loops: l[self.col] = tuple(self._c[l.vert]) + (1.0,)

    def quad(self, a, b, c, d):
        self.tri(a, b, c); self.tri(a, c, d)

    def tris(self):
        return len(self.bm.faces)


def mesh_from_island(b, island, xform, color_of):
    """Copy a source part (e.g. a stalk) through xform, coloured per vertex by color_of(original co)."""
    index = {}
    for uvs, cos in island['tris']:
        vs = []
        for co in cos:
            k = co.to_tuple(5)
            if k not in index: index[k] = b.vert(xform(co), color_of(co))
            vs.append(index[k])
        b.tri(*vs)


def finish(builders, names_mats, out, decimate=None):
    """Turn builders into objects, normalise to a unit footprint with base at 0, export one GLB.
    decimate = (index, ratio, join_index): collapse-decimate that object, then join it into another."""
    objs = []
    for b, (name, mat) in zip(builders, names_mats):
        me = bpy.data.meshes.new(name); b.bm.to_mesh(me); b.bm.free()
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        me.materials.append(mat); objs.append(ob)
    if decimate:
        index, ratio, into = decimate
        src, dst = objs[index], objs[into]
        bpy.context.view_layer.objects.active = src
        mod = src.modifiers.new('dec', 'DECIMATE'); mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier='dec')
        src.data.materials.clear(); src.data.materials.append(dst.data.materials[0])
        bpy.ops.object.select_all(action='DESELECT')
        src.select_set(True); dst.select_set(True); bpy.context.view_layer.objects.active = dst
        bpy.ops.object.join()
        objs = [o for o in objs if o is not src]
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    size = max(hi.x - lo.x, hi.y - lo.y)
    for o in objs:
        for v in o.data.vertices:
            v.co = Vector(((v.co.x - (lo.x + hi.x) / 2) / size, (v.co.y - (lo.y + hi.y) / 2) / size, (v.co.z - lo.z) / size))
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_normals=True, export_texcoords=False, export_vertex_color='ACTIVE',
                              export_all_vertex_colors=False)
    tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs}
    print('WROTE', os.path.basename(out), os.path.getsize(out), 'bytes', 'tris', tris, 'total', sum(tris.values()),
          'height', round((hi.z - lo.z) / size, 3))


def material(name, rough=0.82):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.use_backface_culling = False
    nodes = m.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
    m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    return m


# ---------------------------------------------------------------- violet
def heart_outline(k):
    """Cordate leaf outline in local 2D, notch at the origin (petiole), tip along +x. Scalloped margin."""
    pts = []
    for i in range(k):
        th = 2 * math.pi * i / k
        hx = 16 * math.sin(th) ** 3
        hy = 13 * math.cos(th) - 5 * math.cos(2 * th) - 2 * math.cos(3 * th) - math.cos(4 * th)
        # classic heart: notch at top (y ~ 5), tip at bottom (y = -17); blend towards a round blade
        cx, cy = 0.0, -4.0
        r = math.hypot(hx - cx, hy - cy); a = math.atan2(hy - cy, hx - cx)
        r = mix(r, 11.0, 0.35) * (1 + 0.035 * math.sin(16 * th))
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    # map so notch (top) sits at origin and the tip points along +x, unit length
    notch_y = 5.0; tip_y = min(p[1] for p in pts)
    L = notch_y - tip_y
    return [((notch_y - y) / L, x / L) for x, y in pts], ((notch_y - (-4.0)) / L, 0.0)


def build_violet():
    clover, _ = load('Clover_2')
    stems = [i for i in clover if i['faces'] >= 60]
    cards = [i for i in clover if i['faces'] in (8, 18)]  # clover leaf cards; 15-face stem leaflets dropped
    zmax = max(v.z for s in stems for v in s['verts'])

    def spread(co):
        t = max(0.0, co.z) / zmax
        f = 1 + 1.7 * t ** 1.3
        return Vector((co.x * f, co.y * f, co.z * 0.42))

    rng = random.Random(11)
    leaf_mat_b, flower_b, stalk_b = Builder(), Builder(), Builder()
    LEAF = [lin(h) for h in ('4f7f4a', '5d8a50', '6f9a5a', '56844d')]
    STALK_LO, STALK_HI = lin('4a6a3c'), lin('6f9a5a')
    outline, centre2d = heart_outline(36)
    leaf_tops = []
    for copy, (turn, scale) in enumerate(((0.0, 1.0), (math.radians(36), 0.85))):
        R = Matrix.Rotation(turn, 3, 'Z')
        for si, stem in enumerate(stems):
            top = max(stem['verts'], key=lambda v: v.z)
            xform = lambda co, R=R, scale=scale: R @ (spread(co) * scale)
            mesh_from_island(stalk_b, stem, xform, lambda co: mix(STALK_LO, STALK_HI, min(1, max(0, co.z / zmax))))
            attach = xform(top)
            out = Vector((attach.x, attach.y, 0))
            out = out.normalized() if out.length > 1e-4 else Vector((math.cos(si), math.sin(si), 0))
            leaf_tops.append(attach.z)
            # leaf frame: forward = outward tilted up, side horizontal, up = normal
            tilt = math.radians(rng.uniform(14, 30))
            fwd = (out * math.cos(tilt) + Vector((0, 0, 1)) * math.sin(tilt)).normalized()
            side = Vector((0, 0, 1)).cross(out).normalized()
            up = fwd.cross(side).normalized()
            if up.z < 0: up = -up
            L = 0.34 * scale * rng.uniform(0.9, 1.1)
            base = LEAF[(si + copy * 2) % len(LEAF)] * rng.uniform(0.95, 1.05)

            def P(x, y, lift=0.0):
                cup = 0.10 * (y * y) / 0.25 - 0.06 * x * (1 - x)  # margins curl up, blade arches gently
                return attach + fwd * (x * L) + side * (y * L) + up * ((cup + lift) * L)

            c = leaf_mat_b.vert(P(*centre2d, 0.02), base * 1.12)
            mid = [leaf_mat_b.vert(P(mix(centre2d[0], x, 0.5), mix(centre2d[1], y, 0.5), 0.01), base * 1.02) for x, y in outline]
            rim = [leaf_mat_b.vert(P(x, y), base * 0.9) for x, y in outline]
            n = len(outline)
            for i in range(n):
                j = (i + 1) % n
                leaf_mat_b.tri(c, mid[i], mid[j])
                leaf_mat_b.quad(mid[i], rim[i], rim[j], mid[j])

    # flowers: Flower_3_Group stalks + heads, traced from the flower texture alpha
    flower, fimg = load('Flower_3_Group')
    fstems = [i for i in flower if i['faces'] >= 100]
    heads = [i for i in flower if i['mat'].startswith('Flowers')]
    tex = fimg[[k for k in fimg if k.startswith('Flowers')][0]]
    leaf_top = max(leaf_tops)
    PETAL, PETAL_IN, EYE = lin('6a4fa0'), lin('8468b8'), lin('efe3b4')
    for hi_, head in enumerate(heads):
        hc = centroid(head['verts'])
        stem = min(fstems, key=lambda s: (max(s['verts'], key=lambda v: v.z) - hc).length)
        stop = max(stem['verts'], key=lambda v: v.z)
        sz = (leaf_top * rng.uniform(1.12, 1.3)) / stop.z
        ang = 2 * math.pi * hi_ / len(heads) + 0.4
        out = Vector((math.cos(ang), math.sin(ang), 0))
        sbase = min(stem['verts'], key=lambda v: v.z)

        def sx(co, sz=sz, out=out, sbase=sbase, top=stop.z):
            t = max(0.0, co.z) / top
            p = Vector((co.x - sbase.x, co.y - sbase.y, co.z * sz))
            return p + out * (0.16 * t ** 1.5)
        mesh_from_island(stalk_b, stem, sx, lambda co: mix(STALK_LO, STALK_HI, min(1, max(0, co.z / stop.z))))
        attach = sx(stop)
        # trace 5-petal outline from alpha around the flower centre in UV
        u0, u1, v0, v1 = uv_bounds(head)
        ws = []; acc = Vector((0, 0)); tot = 0
        for a in np.linspace(u0, u1, 40):
            for b in np.linspace(v0, v1, 40):
                w = alpha(tex, a, b)
                if w > 0.5: acc += Vector((a, b)) * w; tot += w
        cu, cv = acc / tot
        rmax = max(u1 - u0, v1 - v0) * 0.75
        K = 40
        rim_uv = []
        for k in range(K):
            th = 2 * math.pi * k / K
            r = 0.0
            for s in np.linspace(0, rmax, 120):
                if alpha(tex, cu + s * math.cos(th), cv + s * math.sin(th)) < 0.5 and s > rmax * 0.08: break
                r = s
            rim_uv.append((cu + r * math.cos(th), cv + r * math.sin(th)))
        centre3 = locate(head, cu, cv)
        rim3 = [locate(head, a, b) for a, b in rim_uv]
        mid3 = [locate(head, mix(cu, a, 0.32), mix(cv, b, 0.32)) for a, b in rim_uv]
        width = max((p - centre3).length for p in rim3) * 2
        hs = 0.2 / width  # head about 0.2 across before normalisation (leaves ~0.34 long)
        # nod: turn the head so it faces sideways-outward, like a violet on its crooked pedicel
        nod = Matrix.Rotation(math.radians(rng.uniform(55, 70)), 3, Vector((0, 0, 1)).cross(out).normalized())

        def H(p):
            return attach + nod @ ((p - centre3) * hs) + Vector((0, 0, 0.01))
        c = flower_b.vert(H(centre3), EYE)
        mid = [flower_b.vert(H(p), mix(PETAL_IN, EYE, 0.25)) for p in mid3]
        rim = [flower_b.vert(H(p), PETAL * rng.uniform(0.95, 1.05)) for p in rim3]
        for i in range(K):
            j = (i + 1) % K
            flower_b.tri(c, mid[i], mid[j])
            flower_b.quad(mid[i], rim[i], rim[j], mid[j])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    finish([leaf_mat_b, flower_b, stalk_b],
           [('Violet', material('VioletLeaf')), ('FlowersViolet', material('FlowersViolet', 0.7)), ('VioletStalks', material('Stalk'))],
           os.path.join(OUT, 'natural-violet.glb'), decimate=(2, 0.45, 0))


# ---------------------------------------------------------------- broadleaf
def build_broadleaf():
    plant, img = load('Plant_1_Big')
    rng = random.Random(5)
    GREENS = [lin(h) for h in ('3e6b45', '44724a', '38603f', '426e47')]
    PINK = lin('c0587a')
    b = Builder()
    FS = (-1.0, -0.14, 0.0, 0.14, 1.0)
    for li, card in enumerate(plant):
        u0, u1, v0, v1 = uv_bounds(card)
        um = (u0 + u1) / 2
        lo_end, hi_end = locate(card, um, v0), locate(card, um, v1)
        vb, vt = (v0, v1) if lo_end.z < hi_end.z else (v1, v0)
        # centreline through the source card's own (bent) triangles
        samples = [mix(vb, vt, t) for t in np.linspace(0.0, 1.0, 24)]
        line = [locate(card, um, v) for v in samples]
        sides = [(locate(card, um + 0.02, v) - locate(card, um - 0.02, v)).normalized() for v in samples]
        seg = [0.0]
        for i in range(1, len(line)): seg.append(seg[-1] + (line[i] - line[i - 1]).length)
        Lc = seg[-1]

        def at(t):
            d = t * Lc
            i = max(1, min(len(seg) - 1, next((k for k in range(1, len(seg)) if seg[k] >= d), len(seg) - 1)))
            f = (d - seg[i - 1]) / max(1e-6, seg[i] - seg[i - 1])
            p = mix(line[i - 1], line[i], f); s = mix(sides[i - 1], sides[i], f).normalized()
            tan = (line[i] - line[i - 1]).normalized()
            n = tan.cross(s).normalized()
            if n.z < 0: n = -n
            return p, s, n
        tp = 0.3
        wmax = 0.25 * Lc * rng.uniform(0.92, 1.08)
        green = GREENS[li % len(GREENS)] * rng.uniform(0.94, 1.06)
        rows = [0.0, 0.15] + [tp + (1 - tp) * s for s in np.linspace(0.0, 0.94, 10)]
        prev = None
        for t in rows:
            p, s, n = at(t)
            if t < tp:
                w = 0.022 * Lc
                cols = [mix(green, PINK, 0.2) * 1.15] * 5
            else:
                q = (t - tp) / (1 - tp)
                w = max(0.03 * Lc, wmax * math.sin(math.pi * min(1.0, q ** 0.85)) ** 0.7)
                cols = [mix(green, PINK, 0.22) * 0.92, green * 1.06, PINK, green * 1.06, mix(green, PINK, 0.22) * 0.92]
            row = [b.vert(p + s * (f * w) + n * (0.16 * w * f * f), c) for f, c in zip(FS, cols)]
            if prev:
                for k in range(4): b.quad(prev[k], prev[k + 1], row[k + 1], row[k])
            prev = row
        tip, _, _ = at(1.0)
        tv = b.vert(tip, green * 0.95)
        for k in range(4): b.tri(prev[k], prev[k + 1], tv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    finish([b], [('Broadleaf', material('BroadleafLeaf'))], os.path.join(OUT, 'natural-broadleaf.glb'))


build_violet()
build_broadleaf()
