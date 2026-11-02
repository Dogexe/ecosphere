import { environmentScale } from './scale.ts'
import { pondCenter } from '../sim/pond.ts'

type Point = { x: number; y: number; z: number }
export const pondCameraLimits = {
  minDistance: 0.32, maxDistance: 0.82,
  floor: environmentScale.pondBedY + 0.035,
  ceiling: environmentScale.pondSurfaceY - 0.025,
  radius: pondCenter.radius - 0.055,
  focusRadius: pondCenter.radius - 0.07,
} as const

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

// Presentation constraints only. Never move organisms to accommodate the camera.
function boundedCamera(position: Point, focus: Point) {
  const target = { x: focus.x, y: clamp(focus.y, environmentScale.pondBedY + 0.06, environmentScale.pondSurfaceY - 0.045), z: focus.z }
  const targetRadius = Math.hypot(target.x - pondCenter.x, target.z - pondCenter.z)
  if (targetRadius > pondCameraLimits.focusRadius) {
    target.x = pondCenter.x + (target.x - pondCenter.x) / targetRadius * pondCameraLimits.focusRadius
    target.z = pondCenter.z + (target.z - pondCenter.z) / targetRadius * pondCameraLimits.focusRadius
  }
  const eye = { ...position }
  const distance = Math.hypot(eye.x - target.x, eye.y - target.y, eye.z - target.z)
  if (distance > pondCameraLimits.maxDistance) {
    const ratio = pondCameraLimits.maxDistance / distance
    eye.x = target.x + (eye.x - target.x) * ratio
    eye.y = target.y + (eye.y - target.y) * ratio
    eye.z = target.z + (eye.z - target.z) * ratio
  }
  eye.y = clamp(eye.y, pondCameraLimits.floor, pondCameraLimits.ceiling)
  const radius = Math.hypot(eye.x - pondCenter.x, eye.z - pondCenter.z)
  if (radius > pondCameraLimits.radius) {
    eye.x = pondCenter.x + (eye.x - pondCenter.x) / radius * pondCameraLimits.radius
    eye.z = pondCenter.z + (eye.z - pondCenter.z) / radius * pondCameraLimits.radius
  }
  if (Math.hypot(eye.x - target.x, eye.y - target.y, eye.z - target.z) < pondCameraLimits.minDistance) {
    // Near a bank, look outward from open water instead of entering the body/wall.
    const dx = target.x - pondCenter.x, dz = target.z - pondCenter.z
    const radial = Math.hypot(dx, dz)
    eye.x = target.x - (radial > 0.001 ? dx / radial : -1) * 0.4
    eye.z = target.z - (radial > 0.001 ? dz / radial : 0) * 0.4
    eye.y = clamp(target.y - 0.01, pondCameraLimits.floor, pondCameraLimits.ceiling)
  }
  return { eye, target }
}

export function constrainPondCamera(position: Point, focus: Point, fish: readonly Pick<Point, 'x' | 'z'>[] = []) {
  const requested = boundedCamera(position, focus)
  const clear = (eye: Point) => fish.every((body) => Math.hypot(eye.x - body.x, eye.z - body.z) >= 0.29)
  if (clear(requested.eye)) return requested
  let best = requested, score = Infinity
  // Two fish at most. A small bounded search avoids body clipping without a solver.
  for (const distance of [0.4, 0.6, 0.82]) for (let angle = 0; angle < 32; angle++) {
    const radians = angle * Math.PI / 16
    const candidate = boundedCamera({ x: requested.target.x + Math.sin(radians) * distance, y: requested.eye.y, z: requested.target.z + Math.cos(radians) * distance }, requested.target)
    const movement = Math.hypot(candidate.eye.x - requested.eye.x, candidate.eye.z - requested.eye.z)
    if (clear(candidate.eye) && movement < score) { best = candidate; score = movement }
  }
  return best
}

export function pondEntryCamera(fish: readonly Pick<Point, 'x' | 'z'>[]) {
  const target = { x: pondCenter.x, y: -0.05, z: pondCenter.z }
  let eye = { x: pondCenter.x + 0.48, y: -0.055, z: pondCenter.z + 0.42 }, best = -1
  if (fish.length) for (let angle = 0; angle < 32; angle++) {
    const candidate = { x: pondCenter.x + Math.sin(angle * Math.PI / 16) * 0.65, y: -0.055, z: pondCenter.z + Math.cos(angle * Math.PI / 16) * 0.65 }
    const space = Math.min(...fish.map((body) => Math.hypot(candidate.x - body.x, candidate.z - body.z)))
    if (space > best) { eye = candidate; best = space }
  }
  return constrainPondCamera(eye, target, fish)
}
