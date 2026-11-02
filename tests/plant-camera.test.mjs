import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three-stdlib'
import { plantCameraFocus } from '../src/scene/plantCamera.ts'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { plantDimensions, plantGroundY, plantGrowthScale, plantModelScale } from '../src/scene/scale.ts'

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
async function imported(kind) {
  const raw = readFileSync(new URL(`../public/assets/organisms/${kind}.glb`, import.meta.url))
  const length = raw.readUInt32LE(12)
  const doc = JSON.parse(raw.subarray(20, 20 + length))
  for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture
  doc.buffers[0].uri = `data:application/octet-stream;base64,${raw.subarray(28 + length).toString('base64')}`
  return new GLTFLoader().parseAsync(JSON.stringify(doc), '')
}

test('close plant camera fits actual imported foliage at growth, orbit and viewport extremes', async () => {
  for (const kind of ['lily', 'reed', 'bloom', 'tree']) {
    const source = await imported(kind)
    for (const fraction of [0.25, 0.75, 1]) {
      const plant = { id: 50, kind, x: -1.1, z: 0.72, age: 90, development: 90, biomass: fraction * 10, capacity: 10 }
      const original = structuredClone(plant)
      const base = kind === 'lily' ? 0.025 * plantModelScale('lily')[1] : 0
      const model = instantiateOrganism(source, { ...plantDimensions[kind], base })
      model.root.position.set(plant.x, plantGroundY(plant), plant.z)
      model.root.scale.setScalar(plantGrowthScale(plant))
      model.root.rotation.y = plant.id * 2.4
      model.root.updateMatrixWorld(true)
      const bounds = new Box3().setFromObject(model.root, true)
      for (const aspect of [0.32, 0.5, 0.65, 1, 16 / 9]) {
        const frame = plantCameraFocus(plant, aspect)
        assert.ok(frame.distance >= 1.7 && frame.distance <= frame.maxDistance)
        for (const shift of [0, 0.12]) for (const theta of [0, 1.2, 2.4, 4.8]) for (const polar of [0.25, 0.8, 1.42]) {
          const viewFrame = plantCameraFocus(plant, aspect, 38, shift > 0)
          const camera = new PerspectiveCamera(38, aspect, 0.1, 70)
          if (shift) camera.setViewOffset(aspect * 1000, 1000, aspect * 1000 * shift, 0, aspect * 1000, 1000)
          const target = new Vector3(viewFrame.x, viewFrame.y, viewFrame.z)
          camera.position.copy(target).add(new Vector3(Math.sin(polar) * Math.sin(theta), Math.cos(polar), Math.sin(polar) * Math.cos(theta)).multiplyScalar(viewFrame.distance))
          camera.lookAt(target)
          camera.updateMatrixWorld(true)
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
            const point = new Vector3(x, y, z).project(camera)
            assert.ok(Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95 && point.z > -1 && point.z < 1, `${kind} clipped at ${aspect}`)
          }
        }
      }
      assert.deepEqual(plant, original)
      model.dispose()
    }
  }
})

test('installed orbit controls apply the required tree frame even in very tall side-panel layouts', () => {
  const plant = { id: 30, kind: 'tree', x: 0, z: 0, age: 90, development: 90, biomass: 18, capacity: 18 }
  for (const [width, height] of [[800, 1600], [761, 1800], [761, 2400]]) {
    const frame = plantCameraFocus(plant, width / height, 38, true)
    assert.ok(frame.distance > 21)
    const camera = new PerspectiveCamera(38, width / height, 0.1, 70), orbit = new OrbitControls(camera)
    orbit.target.set(frame.x, frame.y, frame.z)
    orbit.maxDistance = frame.maxDistance
    camera.position.copy(orbit.target).add(new Vector3(0.5, 0.5, 0.7).normalize().multiplyScalar(frame.distance))
    orbit.update()
    assert.ok(Math.abs(camera.position.distanceTo(orbit.target) - frame.distance) < 1e-8)
    orbit.dispose()
  }
})

test('seeds use the tiny seed envelope and identities cannot collide with animal follow', () => {
  const plant = { id: 1, kind: 'tree', x: 0, z: 1, biomass: 0.55, capacity: 18, age: 0, development: 0 }
  const seed = plantCameraFocus(plant, 0.65)
  assert.ok(seed.distance >= 0.04 && seed.distance < 1.7)
  assert.notEqual(seed.key, 'animal:1')
  assert.ok(seed.y < 0.1)
  const adult = plantCameraFocus({ ...plant, biomass: 18, development: 90, age: 90 }, 0.65)
  assert.ok(adult.distance > seed.distance * 3)
  assert.ok(adult.y > 1)
})
