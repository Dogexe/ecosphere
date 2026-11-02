"""Inspect/export the downloaded CC0 Ant with Blender auto-execution disabled.

Candidate outputs only. No game model, world field or saved data is changed.
"""
from pathlib import Path
import json
import math
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'artifacts/candidates/OGA_ant.blend'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
with bpy.data.libraries.load(str(SOURCE), link=False) as (available, selected):
    selected.objects = available.objects
for obj in selected.objects:
    if obj and obj.type in {'MESH', 'ARMATURE', 'EMPTY'}:
        bpy.context.collection.objects.link(obj)
bpy.context.view_layer.update()
armatures = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
report = {'armatures': [], 'objects': []}
for obj in bpy.context.scene.objects:
    report['objects'].append({'name': obj.name, 'type': obj.type, 'location': list(obj.location),
                               'rotation': list(obj.rotation_euler), 'scale': list(obj.scale)})
for rig in armatures:
    report['armatures'].append({'name': rig.name, 'bones': [
        {'name': bone.name, 'head': list(rig.matrix_world @ bone.head_local),
         'tail': list(rig.matrix_world @ bone.tail_local)} for bone in rig.data.bones]})
report['actions'] = [{'name': action.name, 'frames': list(action.frame_range),
                      'slots': [slot.identifier for slot in action.slots]} for action in bpy.data.actions]
(ROOT / 'artifacts/candidates/ant-rig-inspection.json').write_text(json.dumps(report, indent=2))
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type in {'MESH', 'ARMATURE'}:
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'artifacts/candidates/OGA_ant_original.glb'),
                         export_format='GLB', use_selection=True, export_animation_mode='ACTIONS',
                         export_animations=True, export_force_sampling=True, export_frame_step=1,
                         export_cameras=False, export_lights=False, export_extras=False)

# Retain source anatomy/rig while limiting GPU skin influences explicitly.
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
for obj in meshes:
    obj.data.validate()
    for vertex in obj.data.vertices:
        weights = sorted([(group.group, group.weight) for group in vertex.groups if group.weight > 0], key=lambda item: item[1], reverse=True)[:4]
        total = sum(weight for _, weight in weights)
        for group in list(vertex.groups):
            obj.vertex_groups[group.group].remove([vertex.index])
        if total:
            for group, weight in weights:
                obj.vertex_groups[group].add([vertex.index], weight / total, 'REPLACE')
    for material in obj.data.materials:
        shader = material.node_tree.nodes.get('Principled BSDF')
        # Linear colour for muted warm charcoal; keep ant anatomy rather than
        # adding oversized cartoon eyes to make a tiny worker readable.
        shader.inputs['Base Color'].default_value = (0.185, 0.145, 0.108, 1)
        shader.inputs['Roughness'].default_value = 0.94
        shader.inputs['Metallic'].default_value = 0
        material.diffuse_color = (0.185, 0.145, 0.108, 1)

for rig in armatures:
    rig.animation_data_create()
    walk = bpy.data.actions.get('walk')
    rig.animation_data.action = walk
    rig.animation_data.action_slot = walk.slots[0]
    bpy.context.scene.frame_set(1)
    poses = [(bone, bone.matrix_basis.copy()) for bone in rig.pose.bones]
    idle = bpy.data.actions.new('idle')
    rig.animation_data.action = idle
    for bone, pose in poses:
        bone.matrix_basis = pose
        rotation = 'rotation_quaternion' if bone.rotation_mode == 'QUATERNION' else 'rotation_axis_angle' if bone.rotation_mode == 'AXIS_ANGLE' else 'rotation_euler'
        for frame in [1, 25]:
            for channel in ['location', rotation, 'scale']:
                bone.keyframe_insert(data_path=channel, frame=frame)
bpy.data.actions.get('bite').name = 'eat'
wrapper = bpy.data.objects.new('EcosphereAntProportions', None)
bpy.context.collection.objects.link(wrapper)
roots = [obj for obj in bpy.context.scene.objects if obj is not wrapper and obj.parent is None]
for obj in roots:
    obj.parent = wrapper
# Source head points Blender+Y (=glTF-Z). Face game+Z and lower the source's
# tall leg stance coherently, above the complete rig rather than inside clips.
wrapper.rotation_euler.z = math.pi
wrapper.scale.z = 0.72
wrapper.select_set(True)
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'artifacts/candidates/ant-worker-candidate.glb'),
                         export_format='GLB', use_selection=True, export_animation_mode='ACTIONS',
                         export_animations=True, export_force_sampling=True, export_frame_step=1,
                         export_cameras=False, export_lights=False, export_extras=False)
print(json.dumps(report, indent=2))
