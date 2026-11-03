import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { Box3, PropertyBinding, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
const bytes = readFileSync('artifacts/candidates/ant-worker-candidate.glb')
const source = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
assert.deepEqual(source.animations.map((clip) => clip.name).sort(), ['eat', 'idle', 'walk'])
const a = instantiateOrganism(source, { length: 0.115, base: 0 })
const b = instantiateOrganism(source, { length: 0.115, base: 0 })
let skinA, skinB
a.model.traverse((object) => { if (object instanceof SkinnedMesh) skinA = object })
b.model.traverse((object) => { if (object instanceof SkinnedMesh) skinB = object })
assert.ok(skinA && skinB)
assert.equal(skinA.skeleton.bones.length, 38)
assert.notEqual(skinA.skeleton.bones[0], skinB.skeleton.bones[0])
assert.equal(skinA.geometry, skinB.geometry)
assert.notEqual(skinA.material, skinB.material)
const weights = skinA.geometry.attributes.skinWeight
for (let vertex = 0; vertex < weights.count; vertex++) {
  const sum = weights.getX(vertex) + weights.getY(vertex) + weights.getZ(vertex) + weights.getW(vertex)
  assert.ok(Math.abs(sum - 1) < 0.00001)
}
function bounds(instance) {
  instance.root.updateMatrixWorld(true)
  instance.model.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.update() })
  return new Box3().setFromObject(instance.root, true)
}
const initial = bounds(a)
const head = a.model.getObjectByName(PropertyBinding.sanitizeNodeName('Bone.031')).getWorldPosition(new Vector3())
const thorax = a.model.getObjectByName('Bone').getWorldPosition(new Vector3())
assert.ok(head.z > thorax.z, 'head must face game+Z')
const samples = []
for (const action of ['idle', 'walk', 'eat']) {
  let minY = Infinity, maxContactY = -Infinity, maxHeight = 0, maxLength = 0
  for (let frame = 0; frame < 720; frame++) {
    a.animate(action, 1 / 60, 1)
    const box = bounds(a), size = box.getSize(new Vector3())
    for (const value of [...box.min.toArray(), ...box.max.toArray()]) assert.ok(Number.isFinite(value))
    minY = Math.min(minY, box.min.y)
    maxContactY = Math.max(maxContactY, box.min.y)
    maxHeight = Math.max(maxHeight, size.y)
    maxLength = Math.max(maxLength, size.z)
  }
  samples.push({ action, minY, maxContactY, maxHeight, maxLength })
}
const frozen = bounds(a)
const paused = [...frozen.min.toArray(), ...frozen.max.toArray()]
const time = a.mixer.time
a.animate('eat', 1, 0)
assert.equal(a.mixer.time, time)
assert.deepEqual(bounds(a).min.toArray().concat(bounds(a).max.toArray()), paused)
const gait = instantiateOrganism(source, { length: 0.115, base: 0 })
let gaitSkin
gait.model.traverse((object) => { if (object instanceof SkinnedMesh) gaitSkin = object })
for (let frame = 0; frame < 90; frame++) gait.animate('idle', 1 / 60, 1)
const standing = bounds(gait)
const vertices = Array.from({ length: gaitSkin.geometry.attributes.position.count }, (_, index) => gaitSkin.getVertexPosition(index, new Vector3()).applyMatrix4(gaitSkin.matrixWorld))
const feet = vertices.map((point, index) => point.y < standing.min.y + 0.014 ? index : -1).filter((index) => index >= 0)
let footMovement = 0
for (let frame = 0; frame < 90; frame++) {
  gait.animate('walk', 1 / 60, 1)
  bounds(gait)
  for (const index of feet) footMovement = Math.max(footMovement,
    gaitSkin.getVertexPosition(index, new Vector3()).applyMatrix4(gaitSkin.matrixWorld).distanceTo(vertices[index]))
}
assert.ok(footMovement > 0.001, 'walk must move actual foot geometry, not just a named clip')
const report = { bytes: bytes.length, bones: skinA.skeleton.bones.length,
  clips: source.animations.map((clip) => ({ name: clip.name, seconds: clip.duration })),
  initial: initial.getSize(new Vector3()).toArray(), footMovement, samples }
writeFileSync('artifacts/candidates/ant-native-check.json', JSON.stringify(report, null, 2))
console.log(report)
for (const sample of samples) {
  assert.ok(sample.minY > -0.008 && sample.maxContactY < 0.012, 'foot contact drifts too far from the ground')
  assert.ok(sample.maxHeight < 0.1 && sample.maxLength < 0.18, 'animation escapes the tiny ant envelope')
}
a.dispose()
b.dispose()
gait.dispose()
