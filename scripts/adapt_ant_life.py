"""Adapt licensed original ant/grub geometry into ant castes/development.

Source blend scripts are disabled. Candidate outputs; no organism is added
to a world. Queen/gaster and folded pupa are artistic adaptations, not
species reconstructions. Larva removes actual grub eye/leg components.
"""
from pathlib import Path
import json
import math
import runpy
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/candidates'
runpy.run_path(str(ROOT / 'scripts/adapt_ant_candidate.py'))
rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
original = [v.co.copy() for v in mesh.data.vertices]
weights = [{mesh.vertex_groups[g.group].name: g.weight for g in vertex.groups} for vertex in mesh.data.vertices]

def export(name, animation=True):
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{name}.glb'), export_format='GLB', use_selection=True,
        export_animation_mode='ACTIONS', export_animations=animation, export_force_sampling=True,
        export_cameras=False, export_lights=False, export_extras=False)

# A dealate queen needs a larger gaster and mesosoma, not a uniformly big worker.
for vertex in mesh.data.vertices:
    p = vertex.co
    gaster = sum(g.weight for g in vertex.groups if mesh.vertex_groups[g.group].name == 'Bone.002')
    posterior = max(0, min(1, (-p.y - 0.13) / 0.08)) * gaster
    p.x *= 1 + posterior * 0.62
    p.z = 0.16 + (p.z - 0.16) * (1 + posterior * 0.45)
    p.y -= posterior * 0.10
    # Restrict thoracic widening to core-weighted vertices, leaving legs intact.
    core = sum(g.weight for g in vertex.groups if mesh.vertex_groups[g.group].name == 'Bone')
    p.x *= 1 + core * 0.18
export('ant-queen-candidate')

# A naked pupa retains imported ant anatomy; actual appendages are folded.
for vertex, point in zip(mesh.data.vertices, original): vertex.co = point
rig.animation_data.action = bpy.data.actions.get('idle')
rig.animation_data.action_slot = rig.animation_data.action.slots[0]
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
baked = bpy.data.meshes.new_from_object(evaluated)
mesh.modifiers.clear(); mesh.data = baked
mesh.parent = None
for vertex, influence in zip(mesh.data.vertices, weights):
    p = vertex.co
    limb = sum(weight for name, weight in influence.items() if name.startswith('Bone.') and 7 <= int(name[5:]) <= 30)
    antenna = sum(weight for name, weight in influence.items() if name.startswith('Bone.') and 32 <= int(name[5:]) <= 37)
    if limb > 0.4:
        p.x *= 0.20
        p.y = max(-0.28, min(0.16, p.y))
        p.z = 0.115 + (p.z - 0.115) * 0.12
    elif antenna > 0.4:
        p.x *= 0.35; p.y = min(0.31, p.y); p.z = 0.15 + (p.z - 0.15) * 0.2
for mat in mesh.data.materials:
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.72, 0.64, 0.42, 1)
mesh.rotation_euler.z = math.pi; mesh.scale.z = 0.72
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True)
export('ant-pupa-candidate', False)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT / 'BeetleGrub.glb'))
grub = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.vertex_groups)
parts = json.loads((OUT / 'ant-parts.json').read_text())['grub']
parts = next(item['parts'] for item in parts if item['name'] == grub.name)
remove = {i for part in parts if any('Leg' in name or 'Eye' in name for name in part['weights']) for i in part['indices']}
head = next(part for part in parts if part['vertices'] == 26 and part['high'][2] < 0)
head_ids = set(head['indices'])
bpy.context.view_layer.update()
world_matrix = grub.matrix_world.copy()
evaluated = grub.evaluated_get(bpy.context.evaluated_depsgraph_get())
data = bpy.data.meshes.new_from_object(evaluated)
assert len(data.vertices) == len(grub.data.vertices)
head_center = sum((data.vertices[i].co for i in head_ids), Vector()) / len(head_ids)
body_parts = [part for part in parts if part['vertices'] == 26 and part is not head]
centers = [sum((data.vertices[i].co for i in part['indices']), Vector()) / part['vertices'] for part in body_parts]
front = min(centers, key=lambda center: (center - head_center).length)
head_ids.update(i for part in parts if part['vertices'] == 9 and 'Spine' in part['weights'] for i in part['indices'])
for vertex in data.vertices:
    if vertex.index in head_ids: vertex.co = head_center + (vertex.co - head_center) * 0.55 + (front - head_center) * 0.32
bm = bmesh.new(); bm.from_mesh(data); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in sorted(remove)], context='VERTS')
bm.to_mesh(data); bm.free()
grub.modifiers.clear(); grub.data = data; grub.parent = None; grub.matrix_world = world_matrix
grub.animation_data_clear()
# Rest the source C-curve on its side rather than showing an upright beetle.
grub.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'Y') @ grub.matrix_world
for obj in list(bpy.context.scene.objects):
    if obj != grub: bpy.data.objects.remove(obj, do_unlink=True)
for mat in grub.data.materials:
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (0.70, 0.67, 0.46, 1)
    shader.inputs['Roughness'].default_value = 0.94
    # Original vertex colours must not reintroduce brown beetle head/eyes.
    for link in list(mat.node_tree.links):
        if link.to_socket == shader.inputs['Base Color']: mat.node_tree.links.remove(link)
bpy.ops.object.select_all(action='DESELECT'); grub.select_set(True)
export('ant-larva-candidate', False)
print('Adapted queen, folded naked pupa, legless eyeless larva from original geometry.')
