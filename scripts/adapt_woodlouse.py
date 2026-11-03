"""Adapt .hapto/Senckenberg's CC BY4.0 static AR woodlouse.

Original geometry only: simplify connected anatomical parts, assign matte
materials and add a bounded presentation rig. This gait is our adaptation,
not an animation supplied/validated by the museum. No external code executes.
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
bpy.ops.import_scene.gltf(filepath=str(CANDIDATES / 'Senckenberg_woodlouse.gltf'))
original = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
bpy.context.view_layer.objects.active = original
bpy.ops.export_scene.gltf(filepath=str(CANDIDATES / 'woodlouse-original.glb'),
                         export_format='GLB', use_selection=True, export_animations=False,
                         export_cameras=False, export_lights=False)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')
parts = sorted([obj for obj in bpy.context.scene.objects if obj.type == 'MESH'], key=lambda obj: obj.name)
assert len(parts) == 142, 'The inspected source anatomy changed; review before adapting.'

def material(name, hex_color):
    values = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    color = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in values) + (1,)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = .94
    shader.inputs['Metallic'].default_value = 0
    mat.diffuse_color = color
    return mat

palette = [material('ShellSage', '#85968b'), material('ShellEdge', '#6e8076'),
           material('LegsWarmGrey', '#a79f87'), material('EyesCharcoal', '#303d38')]
leg_hips = [-.0216, -.0175, -.0113, -.0053, -.0002, .0048, .0096]
rig_data = bpy.data.armatures.new('WoodlouseAnatomy')
rig = bpy.data.objects.new('WoodlouseRig', rig_data)
bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, parent='Body'):
    item = rig_data.edit_bones.new(name)
    item.head = head
    item.tail = (head[0], head[1] + .004, head[2])
    if parent:
        item.parent = rig_data.edit_bones[parent]
    return item

bone('Body', (0, 0, .009), None)
bone('Head', (0, -.023, .008))
for side, sign in [('R', 1), ('L', -1)]:
    bone('Antenna' + side, (sign * .0014, -.027, .0065), 'Head')
    bone('Jaw' + side, (sign * .0005, -.0245, .005), 'Head')
    for index, hip in enumerate(leg_hips):
        bone(f'Leg{index}{side}', (sign * .0025, hip, .009))
bpy.ops.object.mode_set(mode='OBJECT')

for obj in parts:
    index = int(obj.name.rsplit('.', 1)[1]) if '.' in obj.name else 0
    # The static source contains disconnected original joints, shell plates,
    # eyes and mouthparts in a stable mirrored order (see inspection report).
    group = 'Body'
    shade = 0 if index % 2 else 1
    if index < 4:
        group = 'Head'
        shade = 3 if index in (2, 3) else 0
    elif index < 20:
        group = 'Antenna' + ('R' if index % 2 == 0 else 'L')
        shade = 2
    elif index < 28:
        # The main jaw and its tip are consecutive on one side, unlike the
        # remaining mirrored mouthparts (see original component bounds).
        side = 'R' if index in (20, 21) else 'L' if index in (22, 23) else 'R' if index % 2 == 0 else 'L'
        group = 'Jaw' + side
        shade = 2
    elif index >= 58:
        group = f'Leg{(index - 58) // 12}' + ('R' if index % 2 == 0 else 'L')
        shade = 2
    obj.data.materials.clear()
    obj.data.materials.append(palette[shade])
    for face in obj.data.polygons:
        face.material_index = 0
        # Smooth within each original disconnected plate/joint; its boundary
        # retains a crisp silhouette without duplicating every triangle vertex.
        face.use_smooth = True
    for layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(layer)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    decimate = obj.modifiers.new('PreserveOriginalSilhouette', 'DECIMATE')
    decimate.ratio = .007 if index in (2, 3) else .16 if 28 <= index <= 55 else .08
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    obj.vertex_groups.new(name=group).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'WoodlouseOriginalAnatomy'
mesh.data.validate()
modifier = mesh.modifiers.new('AnatomicalRig', 'ARMATURE')
modifier.object = rig
mesh.parent = rig

for name in ['idle', 'walk', 'eat']:
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    frames = [1, 25] if name == 'idle' else range(1, 34, 2)
    for frame in frames:
        phase = (frame - 1) / 32 * math.tau
        for pose in rig.pose.bones:
            pose.rotation_mode = 'XYZ'
            pose.rotation_euler = (0, 0, 0)
            pose.location = (0, 0, 0)
            if name == 'walk' and pose.name.startswith('Leg'):
                index, side = int(pose.name[3]), pose.name[-1]
                wave = phase - index * .72 + (0 if side == 'R' else math.pi)
                pose.rotation_euler.z = math.sin(wave) * .19 * (1 if side == 'R' else -1)
                pose.location.z = max(0, math.cos(wave)) * .00075
            if name == 'eat' and pose.name.startswith('Jaw'):
                pose.rotation_euler.z = math.sin(phase * 2) * .18 * (1 if pose.name[-1] == 'R' else -1)
            if name == 'eat' and pose.name.startswith('Antenna'):
                pose.rotation_euler.z = math.sin(phase) * .07 * (1 if pose.name[-1] == 'R' else -1)
            pose.keyframe_insert(data_path='location', frame=frame)
            pose.keyframe_insert(data_path='rotation_euler', frame=frame)
    action.use_fake_user = True

rig.animation_data.action = bpy.data.actions['idle']
rig.animation_data.action_slot = bpy.data.actions['idle'].slots[0]
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
path = CANDIDATES / 'woodlouse-candidate.glb'
bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                         export_animations=True, export_animation_mode='ACTIONS',
                         export_force_sampling=True, export_frame_step=1,
                         export_morph=False, export_texcoords=False,
                         export_cameras=False, export_lights=False, export_extras=False)
raw = path.read_bytes()
doc = json.loads(raw[20:20+struct.unpack_from('<I', raw, 12)[0]])
report = {'file': 'woodlouse.glb', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
          'triangles': sum(doc['accessors'][part['indices']]['count'] // 3 for item in doc['meshes'] for part in item['primitives']),
          'clips': [clip['name'] for clip in doc['animations']]}
(CANDIDATES / 'woodlouse-adaptation.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
