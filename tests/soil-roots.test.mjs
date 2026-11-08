import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRoots, maxRootSegments } from '../src/scene/soilRoots.ts'

const plants = Array.from({ length: 20 }, (_, n) => ({ id: n, kind: ['tree', 'bloom', 'fern', 'clover', 'grass', 'moss'][n % 6], x: Math.cos(n) * (1 + n % 3), z: Math.sin(n) * (1 + n % 3), biomass: 3, capacity: 6 }))
const ground = () => 0.5

test('roots: deterministic, bounded, below the surface, only for rooted kinds', () => {
  const a = buildRoots(plants, ground), b = buildRoots(plants, ground)
  assert.deepEqual(a, b)
  assert.ok(a.length > 0 && a.length <= maxRootSegments)
  for (const s of a) {
    assert.ok(s.ay <= 0.5 && s.by <= s.ay + 0.05, 'roots start under the surface and grow downward')
    assert.ok(s.width > 0 && s.alpha > 0 && s.alpha <= 1)
  }
  assert.equal(buildRoots(plants.filter((p) => p.kind === 'moss'), ground).length, 0, 'moss has rhizoids, not roots')
})

test('roots: species differ (Fittonia reaches deeper than clover), growth scales reach', () => {
  const depthOf = (kind, biomass) => { const s = buildRoots([{ id: 3, kind, x: 3, z: 0, biomass, capacity: 6 }], ground); return 0.5 - Math.min(...s.map((r) => r.by)) }
  assert.ok(depthOf('tree', 6) > depthOf('clover', 6))
  assert.ok(depthOf('tree', 6) > depthOf('tree', 1))
})
