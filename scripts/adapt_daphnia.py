"""Adapt UC Davis TERC CC BY 4.0 Daphnia; retain source anatomy and relative gait."""
from pathlib import Path
import bpy
import hashlib
import json
import re
import struct
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/candidates'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT / 'UC_Davis_Daphnia.glb'))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
meshes = [o for o in scene.objects if o.type == 'MESH' and 'Waterflea' in o.data.name]
keep = [b.name for b in rig.data.bones if not re.search(r'Detail|detail|Hair|Joint_|Goal|Heart_[12]_', b.name)]
assert len(keep) <= 64, len(keep)
parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
def retained(name):
    while name not in keep:
        name = parents[name]
    return name

# Capture evaluated source poses before altering the rig. Remove whole-body
# motion, preserving relative antenna/feeding appendage motion in body space.
body_rest = rig.data.bones['Body_03'].matrix_local.copy()
poses = []
for frame in range(0, 73, 2):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    anchor = body_rest @ rig.pose.bones['Body_03'].matrix.inverted()
    poses.append((frame, {name: (rig.data.bones[name].matrix_local.copy() if name in ['_rootJoint', 'WaterFlea_02'] else anchor @ rig.pose.bones[name].matrix) for name in keep}))
rig.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
for obj in meshes:
    groups = {g.index: g.name for g in obj.vertex_groups}
    weights = []
    for vertex in obj.data.vertices:
        merged = {}
        for weight in vertex.groups:
            name = retained(groups[weight.group])
            merged[name] = merged.get(name, 0) + weight.weight
        weights.append(merged)
    obj.vertex_groups.clear()
    for name in keep:
        obj.vertex_groups.new(name=name)
    for index, merged in enumerate(weights):
        for name, weight in merged.items():
            obj.vertex_groups[name].add([index], weight, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for name in keep:
    parent = parents[name]
    rig.data.edit_bones[name].parent = rig.data.edit_bones[retained(parent)] if parent else None
for bone in list(rig.data.edit_bones):
    if bone.name not in keep:
        rig.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode='OBJECT')
for name in ['idle', 'walk', 'eat']:
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, matrices in ([(0, poses[0][1]), (72, poses[0][1])] if name == 'idle' else poses):
        scene.frame_set(frame)
        for bone_name in keep:
            bone = rig.pose.bones[bone_name]
            bone.rotation_mode = 'QUATERNION'
            bone.matrix = matrices[bone_name]
            bpy.context.view_layer.update()
            for channel in ['location', 'rotation_quaternion', 'scale']:
                bone.keyframe_insert(data_path=channel, frame=frame)
    action.use_fake_user = True
rig.animation_data.action = bpy.data.actions['idle']
rig.animation_data.action_slot = bpy.data.actions['idle'].slots[0]
scene.frame_set(0)
for obj in meshes:
    name = obj.data.name
    material = bpy.data.materials.new('Eyes' if 'Eye' in name else 'Daphnia ' + name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    color = (.035, .055, .045, 1) if 'Eye' in name else (.38, .48, .25, 1) if 'Gut' in name or 'Heart' in name else (.67, .74, .49, 1)
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = .85
    if 'Body' in name:
        shader.inputs['Alpha'].default_value = .58
        material.surface_render_method = 'DITHERED'
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    bpy.context.view_layer.objects.active = obj
    decimate = obj.modifiers.new('Mobile silhouette budget', 'DECIMATE')
    decimate.ratio = .15 if 'Extra' in name or 'Body' in name else .20
    bpy.ops.object.modifier_move_up(modifier=decimate.name)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig, *meshes]:
    obj.select_set(True)
path = OUT / 'daphnia-candidate.glb'
bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                         export_animations=True, export_animation_mode='ACTIONS',
                         export_force_sampling=True, export_frame_step=2,
                         export_morph=False, export_texcoords=False,
                         export_cameras=False, export_lights=False, export_extras=False)
raw = path.read_bytes()
doc = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
# Blender's ACTIONS export resets the node defaults to the reduced bind pose.
# Author the evaluated idle at time zero into node TRS, so a paused new animal
# is correct before any AnimationMixer update. Inverse bind matrices stay intact.
json_length = struct.unpack_from('<I', raw, 12)[0]
binary = raw[28 + json_length:]
idle = next(a for a in doc['animations'] if a['name'] == 'idle')
for channel in idle['channels']:
    sampler = idle['samplers'][channel['sampler']]
    accessor = doc['accessors'][sampler['output']]
    view = doc['bufferViews'][accessor['bufferView']]
    assert accessor['componentType'] == 5126
    count = {'VEC3': 3, 'VEC4': 4}[accessor['type']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    value = list(struct.unpack_from('<' + 'f' * count, binary, offset))
    doc['nodes'][channel['target']['node']][channel['target']['path']] = value
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
raw = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
path.write_bytes(raw)
report = {'file': 'daphnia.glb', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
          'triangles': sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] for p in m['primitives']),
          'bones': max(len(s['joints']) for s in doc['skins']), 'clips': [a['name'] for a in doc['animations']]}
(OUT / 'daphnia-adaptation.json').write_text(json.dumps(report, indent=2))
assert report['triangles'] < 6500 and report['bones'] <= 64, report
print(json.dumps(report))

# Render the actual adapted candidate at its idle pose for anatomy review.
bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
points = []
for obj in meshes:
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    points.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
    evaluated.to_mesh_clear()
low = Vector([min(p[i] for p in points) for i in range(3)])
high = Vector([max(p[i] for p in points) for i in range(3)])
center, length = (low + high) / 2, max(high - low)
bpy.ops.object.camera_add(location=center + Vector((1, -1.4, .5)) * length)
camera = bpy.context.object
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', length * 1.4
camera.data.clip_start, camera.data.clip_end = length * .001, length * 100
scene.camera = camera
for position, energy in [((0, -1, 2), 25), ((-1, .5, 1), 15)]:
    bpy.ops.object.light_add(type='AREA', location=center + Vector(position) * length)
    light = bpy.context.object
    light.data.energy, light.data.size = energy * length ** 2, length
    light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y = 800, 650
scene.render.resolution_percentage = 100
scene.world.color = (.2, .25, .22)
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(OUT / 'daphnia-candidate.png')
bpy.ops.render.render(write_still=True)
