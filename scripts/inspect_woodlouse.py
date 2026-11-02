"""Read the museum's downloaded mesh as data; report connected anatomy."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'artifacts/candidates/Senckenberg_woodlouse.gltf'))
report = []
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    report.append({'name': obj.name, 'vertices': len(points), 'polygons': len(obj.data.polygons),
                   'low': low, 'high': high, 'materials': [mat.name for mat in obj.data.materials]})
report.sort(key=lambda entry: entry['vertices'], reverse=True)
(ROOT / 'artifacts/candidates/woodlouse-components.json').write_text(json.dumps(report, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'artifacts/candidates/woodlouse-inspection.blend'))
print(json.dumps(report[:35], indent=2))
