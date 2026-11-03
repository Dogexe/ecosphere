import test from 'node:test'
import assert from 'node:assert/strict'
import { animalDimensions, animalModelScale, environmentScale, plantDimensions, plantGrowthScale, plantModelScale, stableVariation } from '../src/scene/scale.ts'
import { plantGeometry } from '../src/scene/plantGeometry.ts'

test('measured baked plant bounds normalize to distinct ground, understory and canopy targets', () => {
  for (const [kind, parts] of Object.entries(plantGeometry)) {
    const source = parts.isBufferGeometry ? [parts] : Object.values(parts)
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const geometry of source) {
      geometry.computeBoundingBox()
      for (const [i, axis] of ['x', 'y', 'z'].entries()) { min[i] = Math.min(min[i], geometry.boundingBox.min[axis]); max[i] = Math.max(max[i], geometry.boundingBox.max[axis]) }
    }
    const scale = plantModelScale(kind), size = max.map((n, i) => (n - min[i]) * scale[i])
    assert.ok(Math.abs(Math.max(size[0], size[2]) - plantDimensions[kind].spread) < 0.001)
    assert.ok(Math.abs(size[1] - plantDimensions[kind].height) < 0.001)
  }
  assert.ok(plantDimensions.tree.height > plantDimensions.fern.height * 2)
  assert.ok(plantDimensions.fern.spread > plantDimensions.grass.spread * 2)
  assert.ok(plantDimensions.moss.height < plantDimensions.clover.height)
})

test('readable fauna preserve role hierarchy and age transitions are gradual with independent picking size', () => {
  const sizes = animalDimensions
  // The imported0.7mm soil springtail is smaller than the represented water
  // flea. The old provisional0.17 target had inverted that relationship.
  assert.ok(sizes.springtail.length < sizes.flea.length && sizes.flea.length < sizes.woodlouse.length && sizes.woodlouse.length < sizes.grazer.length)
  assert.ok(sizes.fish.length < environmentScale.pondRadius / 2)
  for (const kind of Object.keys(sizes)) {
    const adult = { id: 0, kind, age: 100, stage: 'adult' }
    const newborn = { ...adult, age: 0, stage: 'juvenile', ...(kind === 'woodlouse' ? { life: { mass: 0.055 } } : {}) }
    assert.ok(animalModelScale(newborn) < animalModelScale(adult) * 0.7)
    assert.ok(environmentScale.minimumPickRadius * 2 > sizes.springtail.length * 2)
  }
  const nearMature = { id: 5, kind: 'flea', age: 11, stage: 'juvenile' }
  assert.ok(animalModelScale({ ...nearMature, age: 12, stage: 'adult' }) / animalModelScale(nearMature) < 1.05)
})

test('visual variation is bounded, seeded by identity without RNG, and biomass changes size monotonically', () => {
  for (let id = 0; id < 300; id++) assert.ok(stableVariation(id) >= 0.94 && stableVariation(id) <= 1.06)
  const plant = { id: 7, kind: 'fern', age: 100, development: 90, biomass: 1, capacity: 6 }
  assert.ok(plantGrowthScale({ ...plant, biomass: 5 }) > plantGrowthScale(plant))
  assert.equal(plantGrowthScale(plant), plantGrowthScale({ ...plant }))
})
