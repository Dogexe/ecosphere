"""Inspect source anatomy as mesh data; never execute downloaded blend scripts."""
from pathlib import Path
import json
import bpy

ROOT = Path(__file__).resolve().parents[1]
def components(obj):
    pending = set(range(len(obj.data.vertices)))
    links = {i: set() for i in pending}
    for edge in obj.data.edges:
        a, b = edge.vertices; links[a].add(b); links[b].add(a)
    report = []
    while pending:
        group, stack = set(), [min(pending)]
        while stack:
            i = stack.pop()
            if i in group: continue
            group.add(i); stack.extend(links[i] - group)
        pending -= group
        points = [obj.matrix_world @ obj.data.vertices[i].co for i in group]
        weights = {}
        for i in group:
            for influence in obj.data.vertices[i].groups:
                name = obj.vertex_groups[influence.group].name
                weights[name] = weights.get(name, 0) + influence.weight
        report.append({'indices': sorted(group), 'vertices': len(group), 'low': [min(p[a] for p in points) for a in range(3)],
                       'high': [max(p[a] for p in points) for a in range(3)], 'weights': weights})
    return report

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
with bpy.data.libraries.load(str(ROOT / 'artifacts/candidates/OGA_ant.blend'), link=False) as (available, selected):
    selected.objects = available.objects
for obj in selected.objects:
    if obj and obj.type in {'MESH', 'ARMATURE', 'EMPTY'}: bpy.context.collection.objects.link(obj)
bpy.context.view_layer.update()
ant = [{'name': obj.name, 'parts': components(obj)} for obj in bpy.context.scene.objects if obj.type == 'MESH']
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'artifacts/candidates/BeetleGrub.glb'))
bpy.context.view_layer.update()
grub = [{'name': obj.name, 'materials': [m.name for m in obj.data.materials], 'parts': components(obj)} for obj in bpy.context.scene.objects if obj.type == 'MESH']
report = {'ant': ant, 'grub': grub}
(ROOT / 'artifacts/candidates/ant-parts.json').write_text(json.dumps(report, indent=2))
print(json.dumps({kind: [{'name': item['name'], 'parts': [{k: v for k, v in part.items() if k != 'indices'} for part in item['parts']]} for item in items] for kind, items in report.items()}, indent=2))
