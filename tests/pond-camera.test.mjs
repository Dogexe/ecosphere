import test from 'node:test'
import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three-stdlib'
import { constrainPondCamera, pondCameraLimits, pondEntryCamera } from '../src/scene/pondCamera.ts'
import { pondCenter } from '../src/sim/pond.ts'

function safe({ eye, target }) {
  for (const p of [eye, target]) for (const axis of ['x', 'y', 'z']) assert.ok(Number.isFinite(p[axis]))
  assert.ok(eye.y >= pondCameraLimits.floor && eye.y <= pondCameraLimits.ceiling)
  assert.ok(Math.hypot(eye.x - pondCenter.x, eye.z - pondCenter.z) <= pondCameraLimits.radius + 1e-9)
  assert.ok(Math.hypot(target.x - pondCenter.x, target.z - pondCenter.z) <= pondCameraLimits.focusRadius + 1e-9)
  const distance = Math.hypot(eye.x - target.x, eye.y - target.y, eye.z - target.z)
  assert.ok(distance >= pondCameraLimits.minDistance - 1e-9 && distance <= pondCameraLimits.maxDistance + 1e-9)
}

test('underwater eyes stay inside the basin and clear the inspected body at every bank and zoom', () => {
  for (const r of [0, 0.4, 0.69, 0.86, 0.93]) for (let angle = 0; angle < 24; angle++) {
    const target = { x: pondCenter.x + Math.sin(angle) * r, y: angle % 2 ? 0.025 : -0.05, z: pondCenter.z + Math.cos(angle) * r }
    for (const distance of [0, 0.1, 0.32, 0.82, 14]) for (let heading = 0; heading < 12; heading++) {
      const eye = { x: target.x + Math.sin(heading) * distance, y: target.y + (heading % 2 ? 2 : -2), z: target.z + Math.cos(heading) * distance }
      const before = structuredClone({ eye, target })
      safe(constrainPondCamera(eye, target))
      assert.deepEqual({ eye, target }, before)
    }
  }
  safe(constrainPondCamera({ x: pondCenter.x, y: -0.05, z: pondCenter.z }, { x: pondCenter.x, y: -0.05, z: pondCenter.z }))
})

test('installed OrbitControls zoom, orbit and moving focus remain constrained over repeated updates', () => {
  const camera = new PerspectiveCamera(54, 1, 0.012, 8)
  camera.position.set(pondCenter.x - 0.48, -0.055, pondCenter.z + 0.42)
  const controls = new OrbitControls(camera)
  controls.target.set(pondCenter.x, -0.05, pondCenter.z)
  controls.minDistance = pondCameraLimits.minDistance
  controls.maxDistance = pondCameraLimits.maxDistance
  controls.minPolarAngle = 1.36; controls.maxPolarAngle = 1.78
  for (let frame = 0; frame < 720; frame++) {
    controls.target.set(pondCenter.x + Math.sin(frame * 0.03) * 0.86, frame % 2 ? 0.025 : -0.05, pondCenter.z + Math.cos(frame * 0.03) * 0.86)
    controls.setAzimuthalAngle(frame * 0.04)
    controls.setPolarAngle(1.4 + Math.sin(frame * 0.02) * 0.2)
    if (frame % 30 === 0) controls.dollyIn(0.6)
    if (frame % 40 === 0) controls.dollyOut(0.6)
    controls.update()
    const result = constrainPondCamera(camera.position, controls.target)
    safe(result)
    camera.position.set(result.eye.x, result.eye.y, result.eye.z)
    controls.target.set(result.target.x, result.target.y, result.target.z)
    camera.lookAt(controls.target)
  }
  controls.dispose()
})

test('entry and free panning avoid actual fish bodies beyond the selected focus', () => {
  const entry = { x: pondCenter.x - 0.48, y: -0.055, z: pondCenter.z + 0.42 }
  const focus = { x: pondCenter.x, y: -0.05, z: pondCenter.z }
  const occupying = [{ x: entry.x, z: entry.z }, { x: pondCenter.x + 0.2, z: pondCenter.z }]
  const initial = pondEntryCamera(occupying)
  safe(initial)
  for (const fish of occupying) assert.ok(Math.hypot(initial.eye.x - fish.x, initial.eye.z - fish.z) >= 0.55)
  const moved = constrainPondCamera(entry, focus, occupying)
  safe(moved)
  for (const fish of occupying) assert.ok(Math.hypot(moved.eye.x - fish.x, moved.eye.z - fish.z) >= 0.29)
  for (let step = 0; step < 300; step++) {
    const fish = [0, 1].map((index) => ({ x: pondCenter.x + Math.sin(step * 0.1 + index * 2) * 0.69, z: pondCenter.z + Math.cos(step * 0.1 + index * 2) * 0.69 }))
    const target = { x: pondCenter.x + Math.sin(step * 0.03) * 0.86, y: 0.025, z: pondCenter.z + Math.cos(step * 0.03) * 0.86 }
    const result = constrainPondCamera({ ...fish[0], y: -0.05 }, target, fish)
    safe(result)
    for (const body of fish) assert.ok(Math.hypot(result.eye.x - body.x, result.eye.z - body.z) >= 0.29)
  }
})
