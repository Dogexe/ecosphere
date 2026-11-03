"""Adapt inspected Pixor CC0 source meshes with Blender; no new organism geometry.

Run: Blender --background --factory-startup --python scripts/adapt_aquatic_assets.py
Source files and the publisher's license are retained under artifacts/candidates.
"""
from pathlib import Path
import hashlib
import json
import struct
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/organisms'


def linear_color(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in values) + (1,)


report = []
for name, source, palette in [
    ('lily', 'Pixor_water-lily.glb', {'Pink paint': ('FlowersPetals', '#dfb5a5'),
                                   'Blossom': ('FlowersBlossom', '#e9cbb5'),
                                   'Yellow flower': ('FlowersCenter', '#cba96c'),
                                   'Leaf': ('LilyLeaf', '#679775')}),
    ('reed', 'Pixor_reeds.glb', {'Grass': ('ReedLeaf', '#839a69'),
                               'Olive leaf': ('ReedShadow', '#637e5c'),
                               'Cattail': ('FlowersSeedHead', '#9c8060')}),
]:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'artifacts/candidates' / source))
    imported = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    for obj in imported:
        obj.animation_data_clear()
        if obj.data.shape_keys:
            obj.shape_key_clear()
        for layer in list(obj.data.uv_layers):
            obj.data.uv_layers.remove(layer)
        for material in obj.data.materials:
            original = material.name.split('.')[0]
            target_name, color = palette[original]
            material.name = target_name
            shader = material.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value = linear_color(color)
            shader.inputs['Metallic'].default_value = 0
            shader.inputs['Roughness'].default_value = 0.94
            material.diffuse_color = linear_color(color)
        # Separate existing faces so maturity hides reproductive structures only.
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL')
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.select_set(True)
            obj.name = obj.data.materials[0].name
    path = OUT / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_animations=False, export_morph=False, export_texcoords=False,
                             export_cameras=False, export_lights=False, export_extras=False)
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for mesh in doc['meshes'] for p in mesh['primitives'])
    report.append({'file': path.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                   'triangles': triangles, 'clips': []})

manifest_path = OUT / 'manifest.json'
existing = json.loads(manifest_path.read_text())
owned = {entry['file'] for entry in report}
manifest_path.write_text(json.dumps([entry for entry in existing if entry['file'] not in owned] + report, indent=2) + '\n')
print(json.dumps(report, indent=2))
