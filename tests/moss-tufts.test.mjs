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

test('moss tufts: four GLBs, each with four levels of detail inside budget', () => {
  for (let n = 1; n <= 4; n += 1) {
    const { bytes, doc } = gltf(`moss-tuft-${n}.glb`)
    assert.ok(bytes.length < 1_800_000, `moss-tuft-${n} is ${bytes.length} bytes`)
    const meshes = Object.fromEntries(doc.meshes.map((mesh) => [mesh.name, mesh.primitives[0]]))
    assert.ok(meshes.lod0 && meshes.lod1 && meshes.lod2 && meshes.lod3, 'all four levels present')
    for (const primitive of Object.values(meshes)) assert.ok(primitive.attributes.COLOR_0 !== undefined && primitive.attributes.NORMAL !== undefined && primitive.attributes.TEXCOORD_0 !== undefined)
    const tris = ['lod0', 'lod1', 'lod2', 'lod3'].map((name) => triangles(doc, meshes[name]))
    // Optimisation 2026-11-08: opaque real 3D shoots at the two near levels, baked cards beyond.
    assert.ok(tris[0] <= 23_000, `lod0 ${tris[0]}`)
    assert.ok(tris[1] <= 6_500, `lod1 ${tris[1]}`)
    assert.ok(tris[2] <= 900, `lod2 ${tris[2]}`)
    assert.ok(tris[3] <= 150, `lod3 ${tris[3]}`)
    assert.ok(tris[0] > tris[1] * 2 && tris[1] > tris[2] * 4 && tris[2] > tris[3] * 4, 'each level is much lighter than the last')
    assert.equal(doc.images, undefined, 'the shared atlas is loaded once by the game, not embedded per model')
  }
})

test('moss atlas is one shared 1024 PNG with an alpha channel', () => {
  const png = readFileSync(new URL('moss-atlas.png', root))
  assert.equal(png.toString('ascii', 1, 4), 'PNG')
  assert.equal(png.readUInt32BE(16), 1024)
  assert.equal(png.readUInt32BE(20), 1024)
  assert.equal(png[25], 6, 'RGBA')
  assert.ok(png.length < 1_000_000)
})

test('moss looks green in a fresh jar and browns, then thins, as the soil dries', () => {
  const fresh = mossLook(plantMoisture('moss', 58)), drying = mossLook(plantMoisture('moss', 35)), dry = mossLook(plantMoisture('moss', 6))
  assert.equal(fresh.brown, 0)
  assert.equal(fresh.cover, 1)
  assert.ok(drying.brown > fresh.brown && dry.brown > drying.brown)
  assert.ok(dry.cover < fresh.cover && dry.cover >= 0.35)
  for (let water = 0; water <= 100; water += 5) { const look = mossLook(plantMoisture('moss', water)); assert.ok(look.brown >= 0 && look.brown <= 1 && look.cover > 0 && look.cover <= 1) }
})
