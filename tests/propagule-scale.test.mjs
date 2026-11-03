import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { propaguleGeometry } from '../src/scene/plantGeometry.ts'
import { animalDimensions, environmentScale, plantDimensions, plantSeedDimensions, plantGroundY, plantGrowthScale, stableVariation } from '../src/scene/scale.ts'
import { plantCameraFocus } from '../src/scene/plantCamera.ts'
import { worldPickRadius, animalTargetPixels } from '../src/scene/picking.ts'

test('actual propagules preserve species envelopes without magnifying spores above tiny fauna', () => {
  propaguleGeometry.computeBoundingBox()
  const source = propaguleGeometry.boundingBox.getSize(new Vector3())
  for (const size of Object.values(plantSeedDimensions)) {
    assert.ok(Math.abs(source.x * size.length - size.length) < 1e-8)
    assert.ok(Math.abs(source.y * size.height - size.height) < 1e-8)
    assert.ok(Math.abs(source.z * size.width - size.width) < 1e-8)
  }
  assert.ok(plantSeedDimensions.fern.length < animalDimensions.springtail.length / 10)
  assert.ok(plantSeedDimensions.moss.length < plantSeedDimensions.fern.length)
  assert.ok(plantSeedDimensions.clover.length < 0.115 / 2)
  assert.ok(plantSeedDimensions.tree.length > plantSeedDimensions.clover.length * 2)
})

test('tiny seed framing fits the actual geometry across viewport and orbit angles', () => {
  for (const [kind, size] of Object.entries(plantSeedDimensions)) for (const aspect of [0.5, 0.7, 1, 16 / 9]) {
    const plant = { id: 7, kind, x: -0.6, z: 0.2, age: 0, development: 0, biomass: 0.55, capacity: 12 }
    const original = structuredClone(plant), frame = plantCameraFocus(plant, aspect)
    assert.ok(frame.distance >= 0.04 && frame.distance < 1.7)
    assert.equal(frame.y, plantGroundY(plant) + size.height / 2)
    const bounds = new Box3(new Vector3(plant.x - size.length / 2, plantGroundY(plant), plant.z - size.width / 2), new Vector3(plant.x + size.length / 2, plantGroundY(plant) + size.height, plant.z + size.width / 2))
    for (const shift of [0, 0.12]) for (const theta of [0, 1.2, 2.4, 4.8]) for (const polar of [0.25, 0.8, 1.42]) {
      const viewFrame = plantCameraFocus(plant, aspect, 38, shift > 0)
      const camera = new PerspectiveCamera(38, aspect, 0.0001, 70), target = new Vector3(viewFrame.x, viewFrame.y, viewFrame.z)
      if (shift) camera.setViewOffset(aspect * 1000, 1000, aspect * 1000 * shift, 0, aspect * 1000, 1000)
      camera.position.copy(target).add(new Vector3(Math.sin(polar) * Math.sin(theta), Math.cos(polar), Math.sin(polar) * Math.cos(theta)).multiplyScalar(viewFrame.distance))
      camera.lookAt(target); camera.updateMatrixWorld(true)
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new Vector3(x, y, z).project(camera)
        assert.ok(Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9 && p.z > -1 && p.z < 1, `${kind} clipped at ${aspect}`)
      }
    }
    assert.deepEqual(plant, original)
  }
})

test('micro targets retain 28 CSS pixels while their biology stays tiny', () => {
  for (const distance of [0.02, 0.04, 0.12, 1.7, 21]) for (const height of [350, 768, 1180]) {
    const radius = worldPickRadius(distance, 38, height)
    assert.ok(Math.abs(radius / (distance * Math.tan(38 * Math.PI / 360)) * height - animalTargetPixels) < 1e-8)
  }
})

test('whole-form germinants emerge gradually and retain their mature funded envelope', () => {
  for (const kind of ['fern', 'moss', 'lily', 'reed']) {
    const plant = { id: 7, kind, x: 0, z: 0, age: 5, development: 3.1, biomass: 0.55, capacity: 8 }
    const first = plantGrowthScale(plant)
    assert.ok(first < 0.01, `${kind} emerged at adult scale`)
    let previous = first
    for (const development of [3.5, 6, 12, 18, 24]) {
      const scale = plantGrowthScale({ ...plant, development })
      assert.ok(scale >= previous)
      previous = scale
    }
    for (const development of [24, 60, 90]) {
      const expected = (0.32 + 0.68 * Math.sqrt(plant.biomass / plant.capacity)) * (0.6 + 0.4 * Math.min(1, development / 60)) * stableVariation(plant.id)
      assert.ok(Math.abs(plantGrowthScale({ ...plant, development }) - expected) < 1e-10)
    }
    const frame = plantCameraFocus(plant, 0.65)
    assert.ok(frame.distance < 0.2)
    assert.ok(frame.y >= plantGroundY(plant))
    assert.ok(plantDimensions[kind].height * first < 0.012)
  }
})

test('terrestrial spores and emerging roots contact the same actual soil surface', () => {
  for (const kind of ['moss', 'fern', 'clover', 'grass', 'bloom', 'tree']) for (const development of [0, 3.1, 12, 23]) {
    const plant = { id: 7, kind, age: 5, development, biomass: 0.55, capacity: 8 }
    assert.equal(plantGroundY(plant), environmentScale.soilSurfaceY)
  }
})
