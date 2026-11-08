import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mossLook } from '../src/scene/mossLook.ts'
import { plantMoisture } from '../src/sim/ecosystem.ts'

const root = new URL('../public/assets/organisms/', import.meta.url)
function gltf(file) {
  const bytes = readFileSync(new URL(file, root))
  return { bytes, doc: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12))) }
}
const triangles = (doc, primitive) => (primitive.indices !== undefined ? doc.accessors[primitive.indices].count : doc.accessors[primitive.attributes.POSITION].count) / 3

test('moss tufts are four real-geometry GLBs with close, mid and overview levels, inside budget', () => {
  for (let n = 1; n <= 4; n += 1) {
    const { bytes, doc } = gltf(`moss-tuft-${n}.glb`)
    assert.ok(bytes.length < 1_350_000, `moss-tuft-${n} is ${bytes.length} bytes`)
    const meshes = Object.fromEntries(doc.meshes.map((mesh) => [mesh.name, mesh.primitives[0]]))
    assert.ok(meshes.lod0 && meshes.lod1 && meshes.lod2, 'all three levels present')
    for (const primitive of Object.values(meshes)) assert.ok(primitive.attributes.COLOR_0 !== undefined && primitive.attributes.NORMAL !== undefined)
    assert.ok(triangles(doc, meshes.lod0) <= 24_000)
    assert.ok(triangles(doc, meshes.lod1) <= 4_800)
    assert.ok(triangles(doc, meshes.lod1) * 3 < triangles(doc, meshes.lod0), 'mid level is much lighter')
    assert.ok(triangles(doc, meshes.lod2) <= 1_700 && triangles(doc, meshes.lod2) * 2 < triangles(doc, meshes.lod1), 'overview level is lighter still')
    assert.equal(doc.images, undefined, 'vertex colours, no textures or alpha cards')
  }
})

test('moss looks green in a fresh jar and browns, then thins, as the soil dries', () => {
  const fresh = mossLook(plantMoisture('moss', 58)), drying = mossLook(plantMoisture('moss', 35)), dry = mossLook(plantMoisture('moss', 6))
  assert.equal(fresh.brown, 0)
  assert.equal(fresh.cover, 1)
  assert.ok(drying.brown > fresh.brown && dry.brown > drying.brown)
  assert.ok(dry.cover < fresh.cover && dry.cover >= 0.35)
  for (let water = 0; water <= 100; water += 5) { const look = mossLook(plantMoisture('moss', water)); assert.ok(look.brown >= 0 && look.brown <= 1 && look.cover > 0 && look.cover <= 1) }
})
