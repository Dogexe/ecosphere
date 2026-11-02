"""Render already-downloaded CC0 candidates with the installed Blender.

Diagnostic scene only; no generated geometry is exported to the game.
"""
from pathlib import Path
import json
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
report = []
pixor = '--pixor' in sys.argv
ants = '--ants' in sys.argv
names = ['OGA_ant', 'Gobkit_LeafcutterAnt'] if ants else ['Pixor_water-lily', 'Pixor_reeds'] if pixor else ['Kenney_lily_large', 'Kenney_lily_small', 'Kenney_hanging_moss']
for index, name in enumerate(names):
    path = ROOT / 'artifacts/candidates' / f'{name}{".blend" if name == "OGA_ant" else ".glb"}'
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    if path.suffix == '.blend':
        # Append data only, with --disable-autoexec at invocation; never execute
        # embedded texts/handlers from a downloaded .blend.
        with bpy.data.libraries.load(str(path), link=False) as (available, selected):
            selected.objects = available.objects
        for obj in selected.objects:
            if obj and obj.type in {'MESH', 'ARMATURE', 'EMPTY'}:
                bpy.context.collection.objects.link(obj)
    else:
        bpy.ops.import_scene.gltf(filepath=str(path))
    imported = set(bpy.data.objects) - before
    bpy.context.view_layer.update()
    meshes = [obj for obj in imported if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector(tuple(min(p[axis] for p in points) for axis in range(3)))
    high = Vector(tuple(max(p[axis] for p in points) for axis in range(3)))
    report.append({'file': path.name, 'bounds_blender': [list(low), list(high)],
                   'bones': sum(len(obj.data.bones) for obj in imported if obj.type == 'ARMATURE'),
                   'actions': [{'name': action.name, 'frames': list(action.frame_range)} for action in set(bpy.data.actions) - before_actions],
                   'meshes': [{'name': obj.name, 'vertices': len(obj.data.vertices),
                               'faces': len(obj.data.polygons),
                               'materials': [mat.name for mat in obj.data.materials]} for obj in meshes]})
    scale = 1.6 / max(high - low)
    offset = Vector(((index - (len(names) - 1) / 2) * 2.3, 0, 0)) - (low + high) / 2 * scale
    offset.z += (high.z - low.z) / 2 * scale + 0.02
    for obj in imported:
        if obj.parent not in imported:
            obj.location = obj.location * scale + offset
            obj.scale *= scale

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.03))
floor = bpy.context.object
mat = bpy.data.materials.new('Diagnostic background')
mat.use_nodes = True
mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.12, 0.18, 0.15, 1)
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 1
floor.data.materials.append(mat)
bpy.ops.object.camera_add(location=(4.3, -7.2, 7.0))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 0.25)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 5.8
bpy.context.scene.camera = camera
for location, energy, size in [((1, -4, 7), 1200, 7), ((-4, 2, 5), 500, 6)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy, light.data.shape, light.data.size = energy, 'DISK', size
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat('-Z', 'Y').to_euler()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1200
scene.render.resolution_y = 650
scene.render.resolution_percentage = 100
scene.world.color = (0.25, 0.25, 0.25)
scene.view_settings.view_transform = 'Standard'
prefix = 'ants' if ants else 'pixor' if pixor else 'kenney'
scene.render.filepath = str(ROOT / f'artifacts/candidates/{prefix}-aquatic-inspection.png')
(ROOT / f'artifacts/candidates/{prefix}-aquatic-inspection.json').write_text(json.dumps(report, indent=2))
bpy.ops.render.render(write_still=True)
