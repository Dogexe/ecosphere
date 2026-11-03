import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Box3, Vector3, SkinnedMesh, Mesh, MeshBasicMaterial, Raycaster, DoubleSide } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { worldPickRadius, animalTargetPixels } from '../src/scene/picking.ts'
import { animalModelScale, plantDimensions, plantGroundY, plantModelScale, environmentScale, stableVariation } from '../src/scene/scale.ts'
import { terrainGeometry } from '../src/scene/terrainGeometry.ts'
import { pondCenter, swimmingClearance } from '../src/sim/pond.ts'

const root = new URL('../public/assets/organisms/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)))
// Node's fetch lacks the DOM progress event used by Three's FileLoader.
globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
function source(file) {
  const bytes = readFileSync(new URL(file, root))
  const length = bytes.readUInt32LE(12)
  const doc = JSON.parse(bytes.subarray(20, 20 + length))
  return { bytes, doc, buffer: bytes.subarray(28 + length) }
}
async function parse(file, stripImages = false) {
  const { bytes, doc, buffer } = source(file)
  if (!stripImages) return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  // Bounds do not need PNG decoding. Still parse actual source geometry/nodes.
  for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture
  doc.buffers[0].uri = `data:application/octet-stream;base64,${buffer.toString('base64')}`
  return new GLTFLoader().parseAsync(JSON.stringify(doc), '')
}

test('shipped assets match provenance hashes, remain self-contained and have bounded texture cost', () => {
  assert.equal(manifest.length, 16)
  let total = 0
  for (const entry of manifest) {
    const { bytes, doc, buffer } = source(entry.file)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    assert.equal(bytes.length, entry.bytes)
    total += bytes.length
    assert.equal(doc.buffers.length, 1)
    assert.equal(doc.buffers[0].uri, undefined)
    for (const image of doc.images ?? []) {
      assert.equal(image.uri, undefined)
      const view = doc.bufferViews[image.bufferView]
      const png = buffer.subarray(view.byteOffset, view.byteOffset + view.byteLength)
      assert.ok(png.readUInt32BE(16) <= 512 && png.readUInt32BE(20) <= 512)
    }
    assert.ok(entry.triangles < 6500)
  }
  // Sixteen local models: the source-derived 395KB animated Daphnia adds
  // anatomy/rigging to the former primitive; retain a bounded total budget.
  assert.ok(total < 2_800_000)
})

test('imported plant geometry fits the same biological envelopes as fallback art', async () => {
  for (const kind of ['clover', 'grass', 'bloom', 'tree', 'lily', 'reed']) {
    const gltf = await parse(`${kind}.glb`, true)
    const instance = instantiateOrganism(gltf, plantDimensions[kind])
    const bounds = new Box3().setFromObject(instance.root, true)
    const size = bounds.getSize(new Vector3())
    assert.ok(Math.abs(size.y - plantDimensions[kind].height) < 0.00001)
    assert.ok(Math.abs(Math.max(size.x, size.z) - plantDimensions[kind].spread) < 0.00001)
    assert.ok(Math.abs(bounds.min.y) < 0.00001)
    instance.dispose()
  }
})

test('aquatic reproductive parts follow maturity without hiding leaves or losing source palette', async () => {
  for (const kind of ['lily', 'reed']) {
    const gltf = await parse(`${kind}.glb`)
    const a = instantiateOrganism(gltf, plantDimensions[kind])
    const b = instantiateOrganism(gltf, plantDimensions[kind])
    const colors = a.materials.map((material) => material.color.toArray())
    const sourceColors = gltf.scene.children.flatMap((object) => object.material ? [object.material.color.toArray()] : [])
    const leaves = [], flowers = []
    a.model.traverse((mesh) => {
      if (mesh instanceof Mesh) (mesh.material.name.startsWith('Flowers') ? flowers : leaves).push(mesh)
    })
    assert.ok(leaves.length > 0 && flowers.length > 0)
    a.setAppearance(1, false)
    assert.ok(leaves.every((mesh) => mesh.visible))
    assert.ok(flowers.every((mesh) => !mesh.visible))
    assert.deepEqual(a.materials.map((material) => material.color.toArray()), colors)
    a.setAppearance(0.1, true)
    assert.ok(flowers.every((mesh) => mesh.visible))
    assert.notDeepEqual(a.materials.map((material) => material.color.toArray()), colors)
    assert.deepEqual(b.materials.map((material) => material.color.toArray()), colors)
    a.setAppearance(1, true)
    assert.deepEqual(a.materials.map((material) => material.color.toArray()), colors)
    assert.deepEqual(gltf.scene.children.flatMap((object) => object.material ? [object.material.color.toArray()] : []), sourceColors)
    assert.ok(a.materials.some((material) => material.color.r !== material.color.g))
    a.dispose()
    b.dispose()
  }
})

test('imported floating pads clear the real water anchor at juvenile and mature growth', async () => {
  const base = 0.025 * plantModelScale('lily')[1]
  const gltf = await parse('lily.glb')
  for (const growth of [0.2, 0.45, 0.7, 1.06]) {
    const instance = instantiateOrganism(gltf, { ...plantDimensions.lily, base })
    instance.root.position.y = environmentScale.pondSurfaceY + 0.002 - base * growth
    instance.root.scale.setScalar(growth)
    instance.root.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(instance.root, true)
    assert.ok(Math.abs(bounds.min.y - (environmentScale.pondSurfaceY + 0.002)) < 0.00001)
    instance.model.traverse((mesh) => {
      if (mesh instanceof Mesh && !mesh.material.name.startsWith('Flowers')) {
        assert.equal(mesh.material.side, DoubleSide)
        const pad = new Box3().setFromObject(mesh, true)
        assert.ok(pad.max.y < environmentScale.pondSurfaceY + 0.05)
      }
    })
    instance.dispose()
  }
  const reed = instantiateOrganism(await parse('reed.glb'), plantDimensions.reed)
  reed.root.position.y = plantGroundY({ kind: 'reed' })
  reed.root.updateMatrixWorld(true)
  const rooted = new Box3().setFromObject(reed.root, true)
  assert.ok(Math.abs(rooted.min.y - environmentScale.pondBedY - 0.002) < 0.00001)
  assert.ok(rooted.max.y > environmentScale.pondSurfaceY + 0.7)
  reed.dispose()
})

test('animated animals have independent rigs, state-driven clips and paused poses', async () => {
  for (const [file, length, kind] of [['tiger-beetle.glb', 0.75, 'beetle'], ['pond-fish.glb', 0.48, 'fish']]) {
    const gltf = await parse(file)
    const a = instantiateOrganism(gltf, { length, base: 0 })
    const b = instantiateOrganism(gltf, { length, base: 0 })
    const skin = (instance) => { let found; instance.model.traverse((o) => { if (o instanceof SkinnedMesh) found = o }); return found }
    assert.notEqual(skin(a).skeleton.bones[1], skin(b).skeleton.bones[1])
    assert.notEqual(skin(a).material, skin(b).material)
    assert.equal(skin(a).geometry, skin(b).geometry)
    const adult = { id: 0, kind, age: 100 }
    a.root.scale.setScalar(animalModelScale(adult))
    a.root.updateMatrixWorld(true)
    skin(a).skeleton.update()
    const adultLength = new Box3().setFromObject(a.root, true).getSize(new Vector3()).z
    assert.ok(Math.abs(adultLength - (kind === 'beetle' ? 0.55 : 0.43) * 0.94) < 0.00001)
    a.animate('walk', 0.05, 1)
    a.animate('walk', 0.05, 1)
    assert.ok(a.mixer.time > b.mixer.time)
    const time = a.mixer.time
    const bones = skin(a).skeleton.bones.map((bone) => bone.quaternion.toArray())
    a.animate('walk', 0.05, 0)
    assert.equal(a.mixer.time, time)
    assert.deepEqual(skin(a).skeleton.bones.map((bone) => bone.quaternion.toArray()), bones)
    a.animate('eat', 0.05, 1) // fish explicitly falls back to idle
    assert.ok(Number.isFinite(new Box3().setFromObject(a.root, true).min.y))
    a.dispose()
    b.animate('idle', 0.05, 1)
    assert.ok(b.mixer.time > 0)
    b.dispose()
  }
})

test('28 CSS-pixel touch targets remain constant across zoom and viewport sizes', () => {
  for (const height of [350, 720, 768, 1180]) for (const distance of [1.7, 3.2, 8, 21]) {
    const radius = worldPickRadius(distance, 38, height)
    const projectedDiameter = radius / (distance * Math.tan(38 * Math.PI / 360)) * height
    assert.ok(Math.abs(projectedDiameter - animalTargetPixels) < 0.000001)
  }
})

test('pond opening admits real submerged fish bounds without a terrain lid', async () => {
  const cap = new Mesh(terrainGeometry.cap, new MeshBasicMaterial({ side: DoubleSide }))
  cap.rotation.x = -Math.PI / 2
  cap.updateMatrixWorld(true)
  const ray = new Raycaster(new Vector3(pondCenter.x, 2, pondCenter.z), new Vector3(0, -1, 0))
  assert.equal(ray.intersectObject(cap).length, 0)
  ray.ray.origin.set(2.5, 2, 0)
  assert.ok(ray.intersectObject(cap).length > 0)
  const instance = instantiateOrganism(await parse('pond-fish.glb'), { length: 0.48, base: 0, centered: true })
  instance.root.scale.setScalar(animalModelScale({ id: 100, kind: 'fish', age: 100 }))
  instance.root.position.y = -0.05
  instance.root.updateMatrixWorld(true)
  instance.model.traverse((o) => { if (o instanceof SkinnedMesh) o.skeleton.update() })
  const bounds = new Box3().setFromObject(instance.root, true)
  assert.ok(bounds.min.y > environmentScale.pondBedY)
  assert.ok(bounds.max.y < environmentScale.pondSurfaceY + 0.01)
  for (let step = 0; step < 90; step++) {
    instance.animate('walk', 0.05, 1)
    instance.root.updateMatrixWorld(true)
    instance.model.traverse((o) => { if (o instanceof SkinnedMesh) o.skeleton.update() })
    const swimming = new Box3().setFromObject(instance.root, true)
    assert.ok(swimming.min.y > environmentScale.pondBedY)
    assert.ok(swimming.max.y < environmentScale.pondSurfaceY + 0.01)
  }
  instance.dispose()
  cap.material.dispose()
})

test('adapted grazer morphs move only when advanced and clones keep separate poses', async () => {
  const gltf = await parse('leaf-grazer.glb', true)
  const a = instantiateOrganism(gltf, { length: 0.87, base: -0.145 })
  const b = instantiateOrganism(gltf, { length: 0.87, base: -0.145 })
  const mesh = (instance) => instance.model.getObjectByProperty('isMesh', true)
  a.animate('walk', 0.05, 1)
  assert.notDeepEqual(mesh(a).morphTargetInfluences, mesh(b).morphTargetInfluences)
  const pose = [...mesh(a).morphTargetInfluences]
  a.animate('walk', 0.05, 0)
  assert.deepEqual(mesh(a).morphTargetInfluences, pose)
  a.dispose(); b.dispose()
})

test('actual animated adult fish clears the bank at the physics boundary in every heading', async () => {
  const id = Array.from({ length: 101 }, (_, i) => i).sort((a, b) => stableVariation(b) - stableVariation(a))[0]
  const instance = instantiateOrganism(await parse('pond-fish.glb'), { length: 0.48, base: 0, centered: true })
  instance.root.scale.setScalar(animalModelScale({ id, kind: 'fish', age: 100 }))
  instance.root.position.set(pondCenter.x + pondCenter.radius - swimmingClearance('fish'), -0.05, pondCenter.z)
  for (let step = 0; step < 90; step++) {
    instance.animate('walk', 0.05, 1)
    for (let angle = 0; angle < 8; angle++) {
      instance.root.rotation.y = angle * Math.PI / 4
      instance.root.updateMatrixWorld(true)
      instance.model.traverse((o) => { if (o instanceof SkinnedMesh) o.skeleton.update() })
      const bounds = new Box3().setFromObject(instance.root, true)
      for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
        assert.ok(Math.hypot(x - pondCenter.x, z - pondCenter.z) < pondCenter.radius)
      }
    }
  }
  instance.dispose()
})
