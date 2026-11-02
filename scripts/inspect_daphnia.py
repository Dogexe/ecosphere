"""Inspect/render the licensed UC Davis source as data, before adaptation."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'artifacts/candidates/UC_Davis_Daphnia.glb'))
scene = bpy.context.scene
scene.frame_set(1)
bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
points, meshes = [], []
for obj in scene.objects:
    if obj.type != 'MESH' or 'Waterflea' not in obj.data.name:
        continue
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
    meshes.append({'name': obj.name, 'mesh': obj.data.name, 'vertices': len(mesh.vertices), 'triangles': sum(len(face.vertices) - 2 for face in mesh.polygons)})
    evaluated.to_mesh_clear()
low = Vector([min(p[i] for p in points) for i in range(3)])
high = Vector([max(p[i] for p in points) for i in range(3)])
center, length = (low + high) / 2, max(high - low)
report = {'meshes': meshes, 'low': list(low), 'high': list(high),
          'rigs': [{'name': obj.name, 'bones': len(obj.data.bones), 'action': obj.animation_data.action.name if obj.animation_data and obj.animation_data.action else None,
                    'matrix_world': [list(row) for row in obj.matrix_world],
                    'hierarchy': [{'name': bone.name, 'parent': bone.parent.name if bone.parent else None} for bone in obj.data.bones]} for obj in scene.objects if obj.type == 'ARMATURE'],
          'actions': [{'name': action.name, 'range': list(action.frame_range)} for action in bpy.data.actions]}
(ROOT / 'artifacts/candidates/ucdavis-daphnia-inspection.json').write_text(json.dumps(report, indent=2))
print('Source:', len(meshes), 'meshes;', report['rigs'][0]['bones'], 'bones; active action:', report['rigs'][0]['action'], '; bounds:', list(low), list(high))
bpy.ops.object.camera_add(location=center + Vector((1, -1.4, .5)) * length)
camera = bpy.context.object
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = length * 1.4
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
scene.render.filepath = str(ROOT / 'artifacts/candidates/ucdavis-daphnia-original.png')
bpy.ops.render.render(write_still=True)
