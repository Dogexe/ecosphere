import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { animalDimensions, animalModelScale } from '../src/scene/scale.ts'

globalThis.ProgressEvent ??= class extends Event { constructor(type, data) { super(type); Object.assign(this, data) } }
const load = async () => {
  const bytes = readFileSync('public/assets/organisms/springtail.glb')
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
function bounds(instance) {
  instance.root.updateMatrixWorld(true)
  instance.model.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.update() })
  return new Box3().setFromObject(instance.root, true)
}

test('museum springtail retains three leg pairs, independent rigs, original segmentation and tiny scale', async () => {
  const source = await load(), a = instantiateOrganism(source, { length: 0.39, base: -0.07 }), b = instantiateOrganism(source, { length: 0.39, base: -0.07 })
  let skinA, skinB
  a.model.traverse((o) => { if (o instanceof SkinnedMesh) skinA = o })
  b.model.traverse((o) => { if (o instanceof SkinnedMesh) skinB = o })
  assert.equal(skinA.skeleton.bones.length, 10)
  assert.equal(skinA.skeleton.bones.filter((bone) => /^Leg[0-2][RL]$/.test(bone.name)).length, 6)
  assert.equal(skinA.geometry, skinB.geometry)
  assert.notEqual(skinA.skeleton.bones[0], skinB.skeleton.bones[0])
  assert.ok(a.materials.every((material) => !material.map && !/eye/i.test(material.name)))
  assert.ok(Math.abs(bounds(a).getSize(new Vector3()).z - 0.39) < 1e-6)
  for (const age of [0, 12, 48, 100]) {
    const scale = animalModelScale({ id: 1, kind: 'springtail', age })
    assert.ok(bounds(a).getSize(new Vector3()).z * scale <= animalDimensions.springtail.length * 1.06 + 1e-8)
  }
  a.dispose(); b.dispose()
})

test('springtail gait is grounded and state-driven, with frozen paused bones and no root hopping', async () => {
  const source = await load(), a = instantiateOrganism(source, { length: 0.39, base: -0.07 })
  let skin
  a.model.traverse((o) => { if (o instanceof SkinnedMesh) skin = o })
  const restRoot = a.model.position.clone()
  for (const clip of ['walk', 'eat', 'idle']) for (let i = 0; i < 120; i++) {
    a.animate(clip, 1 / 30, 1)
    const box = bounds(a), size = box.getSize(new Vector3())
    assert.ok(box.min.y >= -0.0701, `${clip} feet below plane: ${box.min.y}`)
    assert.ok(size.z < 0.405 && size.x < 0.15 && size.y < 0.1)
    assert.deepEqual(a.model.position, restRoot)
  }
  a.animate('walk', 0.1, 1)
  const frozen = skin.skeleton.bones.map((bone) => [...bone.position.toArray(), ...bone.quaternion.toArray()])
  a.animate('walk', 10, 0)
  assert.deepEqual(skin.skeleton.bones.map((bone) => [...bone.position.toArray(), ...bone.quaternion.toArray()]), frozen)
  assert.ok(skin.skeleton.bones.filter((bone) => /^Leg/.test(bone.name)).some((bone) => Math.abs(bone.quaternion.z) > 1e-5))
  a.dispose()
})
