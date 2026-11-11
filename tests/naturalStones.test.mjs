import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// natural-rocks.glb (scripts/adapt_rocks.py, Quaternius CC0): 3 dressing stones and 5 pond pebbles,
// vertex coloured, no textures, small enough to load with the jar.
test('adapted low-poly stones hold the nodes the jar uses, without textures', () => {
  const bytes = readFileSync(new URL('../public/assets/organisms/natural-rocks.glb', import.meta.url))
  assert.ok(bytes.length < 260_000, `natural-rocks.glb is ${bytes.length} bytes`)
  const length = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'))
  const names = json.nodes.map((node) => node.name).sort()
  assert.deepEqual(names, ['pebble1', 'pebble2', 'pebble3', 'pebble4', 'pebble5', 'rock1', 'rock2', 'rock3'])
  assert.equal((json.images ?? []).length, 0)
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    assert.ok('COLOR_0' in primitive.attributes, `${mesh.name} has vertex colours`)
    const triangles = json.accessors[primitive.indices].count / 3
    assert.ok(triangles < 2400, `${mesh.name} has ${triangles} triangles`)
  }
})
