"""Diagnostic image of the inspected original or adapted geometry."""
from pathlib import Path
import sys
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
adapted = '--adapted' in sys.argv
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / ('artifacts/candidates/springtail-candidate.glb' if adapted else 'artifacts/candidates/Senckenberg_springtail.gltf')))
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
points = []
depsgraph = bpy.context.evaluated_depsgraph_get()
for obj in bpy.context.scene.objects:
    # glTF's imported rig also creates hidden unit-size bone widgets. Their
    # editor-only meshes must not determine the camera around this tiny body.
    if obj.type != 'MESH' or not obj.name.startswith(('Mesaphorura', 'SpringtailMuseumAnatomy')):
        continue
    evaluated = obj.evaluated_get(depsgraph)
    geometry = evaluated.to_mesh()
    points.extend(evaluated.matrix_world @ vertex.co for vertex in geometry.vertices)
    evaluated.to_mesh_clear()
low = Vector([min(p[i] for p in points) for i in range(3)])
high = Vector([max(p[i] for p in points) for i in range(3)])
center = (low + high) / 2
length = max(high - low)
print('Diagnostic bounds', list(low), list(high), 'length', length)
bpy.ops.mesh.primitive_plane_add(size=length * 200, location=(0, 0, low.z - length * .005))
floor = bpy.context.object
mat = bpy.data.materials.new('Diagnostic background')
mat.diffuse_color = (.18, .23, .19, 1)
floor.data.materials.append(mat)
bpy.ops.object.camera_add(location=center + Vector((.8, -1.2, .9)) * length)
camera = bpy.context.object
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = length * 1.45
camera.data.lens = 45
camera.data.clip_start = length * .001
camera.data.clip_end = length * 100
bpy.context.scene.camera = camera
for location, energy in [((0, -1, 2), 20), ((-1, .3, 1), 10)]:
    bpy.ops.object.light_add(type='AREA', location=center + Vector(location) * length)
    light = bpy.context.object
    light.data.energy = energy * length ** 2
    light.data.size = length
    light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1100
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.world.color = (.25, .25, .25)
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(ROOT / f'artifacts/candidates/springtail-{"adapted" if adapted else "original"}.png')
bpy.ops.render.render(write_still=True)
