import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, Mesh, SkinnedMesh, Vector3, Raycaster, DoubleSide, MeshBasicMaterial, PerspectiveCamera } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { makeNestGeometry, nestVoidField, nestFrame, nestCameraSettings } from '../src/scene/nestGeometry.ts'
import { introduceColony } from '../src/sim/colony.ts'
import { createWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { antFixture } from '../scripts/probe_ant_colony.mjs'

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
async function load(kind) {
  const bytes = readFileSync(`public/assets/organisms/ant-${kind}.glb`)
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
function bounds(instance) {
  instance.root.updateMatrixWorld(true)
  instance.model.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.update() })
  return new Box3().setFromObject(instance.root, true)
}

test('actual ant caste assets keep tiny independent rigs, foot contact and bounded poses', async () => {
  for (const [kind, length] of [['worker', 0.115], ['queen', 0.2]]) {
    const source = await load(kind), a = instantiateOrganism(source, { length, base: 0 }), b = instantiateOrganism(source, { length, base: 0 })
    let skinA, skinB
    a.model.traverse((object) => { if (object instanceof SkinnedMesh) skinA = object })
    b.model.traverse((object) => { if (object instanceof SkinnedMesh) skinB = object })
    assert.equal(skinA.skeleton.bones.length, 38)
    assert.notEqual(skinA.skeleton.bones[0], skinB.skeleton.bones[0])
    assert.equal(skinA.geometry, skinB.geometry)
    assert.notEqual(skinA.material, skinB.material)
    const core = new Box3()
    bounds(a)
    const joints = skinA.geometry.attributes.skinIndex, weights = skinA.geometry.attributes.skinWeight
    for (let i = 0; i < joints.count; i++) {
      let coreWeight = 0
      for (let c = 0; c < 4; c++) if (['Bone', 'Bone001', 'Bone002', 'Bone031'].includes(skinA.skeleton.bones[joints.getComponent(i, c)].name)) coreWeight += weights.getComponent(i, c)
      if (coreWeight > 0.7) core.expandByPoint(skinA.getVertexPosition(i, new Vector3()).applyMatrix4(skinA.matrixWorld))
    }
    assert.ok(!core.isEmpty())
    assert.ok(core.getSize(new Vector3()).z < length, 'body length must be measured separately from antennae')
    for (const action of ['idle', 'walk', 'eat']) for (let i = 0; i < 120; i++) {
      a.animate(action, 1 / 60, 1)
      const box = bounds(a)
      assert.ok(box.min.y > -0.012 && box.min.y < 0.02)
      assert.ok(box.getSize(new Vector3()).length() < length * 1.9)
    }
    const time = a.mixer.time, box = bounds(a).clone()
    a.animate('walk', 1, 0)
    assert.equal(a.mixer.time, time)
    assert.deepEqual(bounds(a), box)
    a.dispose(); b.dispose()
  }
})

test('larval and pupal adaptations are static original geometry with bounded developmental sizes', async () => {
  for (const [kind, length, triangles] of [['larva', 0.065, 460], ['pupa', 0.08, 1080]]) {
    const source = await load(kind)
    assert.equal(source.animations.length, 0)
    let count = 0
    source.scene.traverse((object) => { if (object instanceof Mesh) count += object.geometry.index.count / 3 })
    assert.equal(count, triangles)
    const a = instantiateOrganism(source, { length, base: 0 })
    const box = bounds(a)
    assert.ok(Math.abs(box.getSize(new Vector3()).z - length) < 1e-6)
    assert.ok(box.getSize(new Vector3()).length() < 0.15)
    assert.ok(Math.abs(box.min.y) < 1e-6)
    a.dispose()
  }
})

test('fallen ant source models retain their scale, rest on their contact plane and never play living clips', async () => {
  for (const [kind, length] of [['worker', 0.115], ['queen', 0.2], ['larva', 0.065], ['pupa', 0.08]]) {
    const source = await load(kind), dead = instantiateOrganism(source, { length, base: 0, fallen: true })
    const box = bounds(dead), size = box.getSize(new Vector3())
    assert.ok(Math.abs(box.min.y) < 1e-6)
    assert.ok(Math.abs(size.z - length) < 1e-6)
    assert.ok(Math.abs(box.getCenter(new Vector3()).x) < 1e-6)
    assert.ok(size.length() < length * 1.9)
    dead.animate('walk', 10, 3)
    assert.equal(dead.mixer.time, 0)
    assert.deepEqual(bounds(dead), box)
    dead.dispose()
  }
})

test('volumetric cavity union keeps real3D routes open and bounds mesh cost', () => {
  const colony = introduceColony(createWorld(), 0.3, -1.7).colony
  const geometry = makeNestGeometry(colony)
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }))
  mesh.updateMatrixWorld(true)
  for (const [aId, bId] of colony.edges) {
    const a = colony.nodes.find(n => n.id === aId), b = colony.nodes.find(n => n.id === bId)
    for(let i=0;i<=20;i++) {
      const p = new Vector3(a.x,a.y,a.z).lerp(new Vector3(b.x,b.y,b.z),i/20)
      assert.ok(nestVoidField(colony,p)<-0.08)
      const hit = new Raycaster(p, new Vector3(0,0,1)).intersectObject(mesh)[0]
      assert.ok(hit && hit.distance > 0.065, 'route center cannot be sealed by intersecting tube caps')
    }
  }
  assert.ok(nestVoidField(colony,{x:2,y:-0.8,z:0})>0)
  assert.ok(geometry.attributes.position.count / 3 < 40000)
  for (const value of geometry.attributes.position.array) assert.ok(Number.isFinite(value))
  geometry.dispose(); mesh.material.dispose()
})

test('actual graph bounds admit wide native nests, whole-nest framing and close queen follow', () => {
  const world = introduceColony(createWorld(), 0.3, -1.7)
  world.colony.nodes.forEach((node) => { node.x = 0.3 + (node.x - 0.3) * 2.5 })
  const colony = parseSave(serializeSave(world)).colony, frame = nestFrame(colony)
  for (const [width, height] of [[390, 650], [820, 1180], [920, 690], [1280, 720]]) {
    const settings = nestCameraSettings(colony, width, height)
    const camera = new PerspectiveCamera(settings.fov, width / height, 0.008, 12)
    if (settings.offsetX) camera.setViewOffset(width, height, settings.offsetX, settings.offsetY, width, height)
    camera.position.copy(frame.center).addScaledVector(frame.normal, settings.distance)
    camera.lookAt(frame.center); camera.updateMatrixWorld()
    for (const node of colony.nodes) {
      const p = new Vector3(node.x, node.y, node.z).project(camera)
      assert.ok(Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.85)
      assert.ok(new Vector3(node.x, node.y, node.z).distanceTo(frame.center) < settings.radius)
    }
    const queen = colony.nodes.find((node) => node.role === 'queen')
    const target = new Vector3(queen.x, queen.y, queen.z)
    camera.position.copy(target).addScaledVector(frame.normal, 0.65); camera.lookAt(target); camera.updateMatrixWorld()
    const p = target.clone().project(camera)
    assert.ok(Math.abs(p.x) < 0.5 && Math.abs(p.y) < 0.2)
  }
})
