import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, Vector3, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { animalWaterY } from '../src/scene/scale.ts'
import { swimmingClearance } from '../src/sim/pond.ts'

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
const bytes = readFileSync(new URL('../public/assets/organisms/daphnia.glb', import.meta.url))
const source = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const shape = { length: .14, base: 0, centered: true, measure: 'max' }
function bounds(instance) {
  instance.root.updateMatrixWorld(true)
  instance.root.traverse(o => { if (o instanceof SkinnedMesh) o.skeleton.update() })
  return new Box3().setFromObject(instance.root, true)
}

test('a newly loaded paused Daphnia already has spread antennae without advancing animation', () => {
  const animal = instantiateOrganism(source, shape)
  bounds(animal)
  const left = animal.model.getObjectByName('LS1_4_0156').getWorldPosition(new Vector3())
  const right = animal.model.getObjectByName('RS1_4_094').getWorldPosition(new Vector3())
  assert.ok(left.distanceTo(right) > .07, 'authored idle antenna span, not collapsed bind joints')
  const before = bounds(animal)
  animal.animate('idle', .05, 0)
  assert.deepEqual(bounds(animal), before)
  assert.equal(animal.mixer.time, 0)
  animal.dispose()
})

test('adapted Daphnia retains bounded source animation, underwater hull and independent pause', () => {
  const a = instantiateOrganism(source, shape)
  const b = instantiateOrganism(source, shape)
  a.root.scale.setScalar(.105 / .14 * 1.06)
  b.root.scale.copy(a.root.scale)
  a.root.position.y = b.root.position.y = animalWaterY('flea')
  const original = bounds(b).clone()
  const maxima = new Vector3()
  let maxRadius = 0
  const point = new Vector3()
  for (const clip of ['idle', 'walk', 'eat']) {
    for (let frame = 0; frame < 125; frame++) {
      a.animate(clip, .025, 1)
      a.root.rotation.y = frame * .13
      const box = bounds(a)
      maxima.max(box.getSize(new Vector3()))
      assert.ok(box.min.y > -.20 && box.max.y < .07, `water bounds ${box.min.y}..${box.max.y}`)
      assert.ok(Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) < .07, 'bank hull')
      a.root.traverse(mesh => {
        if (!(mesh instanceof SkinnedMesh)) return
        assert.ok(mesh.skeleton.bones.length <= 64)
        for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
          mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld)
          maxRadius = Math.max(maxRadius, Math.hypot(point.x, point.z))
        }
      })
    }
  }
  assert.deepEqual(bounds(b), original, 'other instance must not move')
  const time = a.mixer.time
  const frozen = bounds(a)
  a.animate('walk', .05, 0)
  assert.equal(a.mixer.time, time)
  assert.deepEqual(bounds(a), frozen)
  assert.ok(maxima.y <= .105 * 1.06 * 1.2, `animated height ${maxima.y}`)
  assert.ok(maxRadius < swimmingClearance('flea'), `animated radial hull ${maxRadius}`)
  a.dispose(); b.dispose()
})
