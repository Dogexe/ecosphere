import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, Vector3, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { animalModelScale, animalGroundY, stableVariation } from '../src/scene/scale.ts'

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
const bytes = readFileSync(new URL('../public/assets/organisms/woodlouse.glb', import.meta.url))
const source = () => new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
function skins(instance) {
  const meshes = []
  instance.model.traverse((mesh) => { if (mesh instanceof SkinnedMesh) meshes.push(mesh) })
  return meshes
}
function update(instance) {
  instance.root.updateMatrixWorld(true)
  for (const mesh of skins(instance)) mesh.skeleton.update()
}

test('imported woodlouse keeps seven leg pairs, independent poses and juvenile appearance', async () => {
  const gltf = await source()
  assert.deepEqual(gltf.animations.map((clip) => clip.name).sort(), ['eat', 'idle', 'walk'])
  const a = instantiateOrganism(gltf, { length: 0.64, base: -0.09 })
  const b = instantiateOrganism(gltf, { length: 0.64, base: -0.09 })
  const bones = skins(a)[0].skeleton.bones
  assert.equal(bones.length, 20)
  for (let pair = 0; pair < 7; pair++) for (const side of ['L', 'R']) assert.ok(bones.some((bone) => bone.name === `Leg${pair}${side}`))
  const colors = a.materials.map((material) => material.color.toArray())
  a.setAppearance(1, true, true)
  assert.notDeepEqual(a.materials.map((material) => material.color.toArray()), colors)
  assert.deepEqual(b.materials.map((material) => material.color.toArray()), colors)
  assert.deepEqual(a.materials.find((material) => material.name === 'EyesCharcoal').color.toArray(), b.materials.find((material) => material.name === 'EyesCharcoal').color.toArray())
  a.setAppearance(0, true, true)
  assert.deepEqual(a.materials.find((material) => material.name === 'EyesCharcoal').color.toArray(), b.materials.find((material) => material.name === 'EyesCharcoal').color.toArray())
  a.setAppearance(1, true)
  assert.deepEqual(a.materials.map((material) => material.color.toArray()), colors)
  assert.equal(skins(a)[0].geometry, skins(b)[0].geometry)
  assert.notEqual(bones[0], skins(b)[0].skeleton.bones[0])
  a.animate('walk', 0.05, 1)
  update(a)
  const pose = bones.map((bone) => bone.matrixWorld.toArray())
  const time = a.mixer.time
  a.animate('walk', 1, 0)
  update(a)
  assert.equal(a.mixer.time, time)
  assert.deepEqual(bones.map((bone) => bone.matrixWorld.toArray()), pose)
  a.dispose()
  b.animate('walk', 0.05, 1)
  assert.ok(b.mixer.time > 0)
  b.dispose()
})

test('actual woodlouse body grows from funded mass and gait keeps original feet above ground', async () => {
  const a = instantiateOrganism(await source(), { length: 0.64, base: -0.09 })
  const meshes = skins(a)
  let footMovement = 0
  for (const mass of [0.055, 0.11, 0.22, 0.24]) {
    const creature = { id: 100, kind: 'woodlouse', age: 100, life: { mass } }
    a.root.scale.setScalar(animalModelScale(creature))
    a.root.position.y = animalGroundY(creature)
    update(a)
    const body = new Box3()
    let legMesh, footIndex
    for (const mesh of meshes) {
      const joints = mesh.geometry.attributes.skinIndex
      for (let i = 0; i < joints.count; i++) {
        const name = mesh.skeleton.bones[joints.getX(i)].name
        const point = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)
        if (['Body', 'Head'].includes(name)) body.expandByPoint(point)
        if (name === 'Leg0L' && point.y < 0.06) { legMesh = mesh; footIndex = i }
      }
    }
    const expected = 0.34 * Math.cbrt(mass / 0.22) * stableVariation(creature.id)
    assert.ok(Math.abs(body.getSize(new Vector3()).z / expected - 1) < 0.05)
    assert.ok(legMesh)
    const standing = legMesh.getVertexPosition(footIndex, new Vector3()).applyMatrix4(legMesh.matrixWorld)
    for (const action of ['idle', 'walk', 'eat']) for (let frame = 0; frame < 180; frame++) {
      a.animate(action, 1 / 60, 1)
      update(a)
      const bounds = new Box3().setFromObject(a.root, true)
      assert.ok(bounds.min.y >= 0.049 && bounds.min.y < 0.057, `${action} ground: ${bounds.min.y}`)
      assert.ok(bounds.getSize(new Vector3()).z < expected * 1.15)
      if (action === 'walk') footMovement = Math.max(footMovement,
        legMesh.getVertexPosition(footIndex, new Vector3()).applyMatrix4(legMesh.matrixWorld).distanceTo(standing))
    }
  }
  assert.ok(footMovement > 0.005, 'original leg vertices must actually move')
  a.dispose()
})
