"""Adapt licensed.hapto/Senckenberg original anatomy, not primitive geometry.
Added gait/materials are artistic modifications, not museum-validated motion.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import bpy
ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / 'artifacts/candidates'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(CANDIDATES / 'Senckenberg_springtail.gltf'))
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
decimate = mesh.modifiers.new('RetainMuseumSilhouette', 'DECIMATE')
decimate.ratio = .24
bpy.ops.object.modifier_apply(modifier=decimate.name)

def material(name, hex_color):
    channels = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    color = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels) + (1,)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = .94
    mat.diffuse_color = color
    return mat

palette = [material('BodySoftIvory', '#c5c9ae'), material('HeadWarmIvory', '#d0d0b4'), material('LegsSoftSage', '#a4ae98')]
mesh.data.materials.clear()
for mat in palette:
    mesh.data.materials.append(mat)
for layer in list(mesh.data.uv_layers):
    mesh.data.uv_layers.remove(layer)
for face in mesh.data.polygons:
    points = [mesh.data.vertices[i].co for i in face.vertices]
    y = sum(p.y for p in points) / len(points)
    face.material_index = 1 if y < -.021 else 2 if all(abs(p.x) > .005 and p.z < .008 for p in points) else 0
    face.use_smooth = True

rig_data = bpy.data.armatures.new('SpringtailAnatomy')
rig = bpy.data.objects.new('SpringtailRig', rig_data)
bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, parent='Body'):
    item = rig_data.edit_bones.new(name)
    item.head = head
    item.tail = (head[0], head[1] + .003, head[2])
    if parent:
        item.parent = rig_data.edit_bones[parent]
    return item
bone('Body', (0, 0, .009), None)
bone('Head', (0, -.022, .009))
hips = [-.0185, -.0047, .005]
for side, sign in [('R', 1), ('L', -1)]:
    bone('Antenna' + side, (sign * .0025, -.029, .0075), 'Head')
    for i, y in enumerate(hips):
        bone(f'Leg{i}{side}', (sign * .004, y, .007))
bpy.ops.object.mode_set(mode='OBJECT')
for item in rig_data.bones:
    mesh.vertex_groups.new(name=item.name)
for vertex in mesh.data.vertices:
    x, y, z = vertex.co
    side = 'R' if x >= 0 else 'L'
    group = 'Head' if y < -.022 else 'Body'
    weight = 1
    if y < -.030 and abs(x) > .003:
        group = 'Antenna' + side
    elif z < .008 and abs(x) > .0045 and -.024 < y < .012:
        index = min(range(3), key=lambda i: abs(y - hips[i]))
        group = f'Leg{index}{side}'
        weight = min(1, max(0, (abs(x) - .0045) / .002))
        mesh.vertex_groups['Body'].add([vertex.index], 1 - weight, 'REPLACE')
    mesh.vertex_groups[group].add([vertex.index], weight, 'REPLACE')
mesh.name = 'SpringtailMuseumAnatomy'
mesh.parent = rig
modifier = mesh.modifiers.new('AnatomicalGait', 'ARMATURE')
modifier.object = rig
for name in ['idle', 'walk', 'eat']:
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in ([1, 25] if name == 'idle' else range(1, 34, 2)):
        phase = (frame - 1) / 32 * math.tau
        for pose in rig.pose.bones:
            pose.rotation_mode = 'XYZ'
            pose.rotation_euler = (0, 0, 0)
            pose.location = (0, 0, 0)
            if name == 'walk' and pose.name.startswith('Leg'):
                i, side = int(pose.name[3]), pose.name[-1]
                wave = phase + (i % 2) * math.pi + (0 if side == 'R' else math.pi)
                pose.rotation_euler.z = math.sin(wave) * .13
                pose.location.z = max(0, math.cos(wave)) * .0004
            if name == 'eat' and pose.name == 'Head':
                pose.rotation_euler.x = math.sin(phase * 2) * .025
            if name == 'eat' and pose.name.startswith('Antenna'):
                pose.rotation_euler.z = math.sin(phase) * .055 * (1 if pose.name[-1] == 'R' else -1)
            pose.keyframe_insert(data_path='location', frame=frame)
            pose.keyframe_insert(data_path='rotation_euler', frame=frame)
    action.use_fake_user = True
rig.animation_data.action = bpy.data.actions['idle']
rig.animation_data.action_slot = bpy.data.actions['idle'].slots[0]
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
path = CANDIDATES / 'springtail-candidate.glb'
bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                         export_animations=True, export_animation_mode='ACTIONS',
                         export_force_sampling=True, export_frame_step=1,
                         export_morph=False, export_texcoords=False,
                         export_cameras=False, export_lights=False, export_extras=False)
raw = path.read_bytes()
doc = json.loads(raw[20:20+struct.unpack_from('<I', raw, 12)[0]])
report = {'file': 'springtail.glb', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
          'triangles': sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] for p in m['primitives']),
          'bones': len(doc['skins'][0]['joints']), 'clips': [clip['name'] for clip in doc['animations']]}
(CANDIDATES / 'springtail-adaptation.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
