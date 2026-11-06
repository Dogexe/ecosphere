// Shared pure navigation. Existing animals use zero hull clearance; tap/mesh
// dimensions are never inputs. Preserve the original center-only trajectories.
import { pondCenter, pondShape, pushToShore, shoreNormal } from './pondShape.ts'

export type LandPose = { id: number; x: number; z: number; heading: number }
/** Dry ground starts a 0.12 (about 2 mm) bank outside the open water. */
const pond = { x: pondCenter.x, z: pondCenter.z, radius: pondCenter.radius + 0.12 }
const bankWidth = 0.12
/** A poured jar's pond has a free shape; its shore comes from the distance field. */
const poured = () => pondShape().kind === 'mask'
const shoreGap = (x: number, z: number) => pondShape().signedDistance(x, z) - bankWidth

/**
 * Moves a point that sits in the water or on the bank to the nearest dry
 * ground with `clearance`, walking around the pond if the straight push would
 * leave the jar. Used only when loading worlds saved before the pond grew.
 */
export function settleOnLand(x: number, z: number, clearance = 0): { x: number; z: number } {
  if (isLand(x, z, clearance)) return { x, z }
  if (poured()) {
    const point = pushToShore(x, z, bankWidth + clearance + 0.02)
    if (isLand(point.x, point.z, clearance)) return point
    // Where the pond meets the glass the shore's outward push leaves the jar: take the nearest bank instead.
    for (let ring = 1; ring <= 40; ring += 1) {
      const radius = ring * 0.08
      for (let step = 0; step < 32; step += 1) {
        const angle = step / 32 * Math.PI * 2
        const near = { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius }
        if (isLand(near.x, near.z, clearance)) return near
      }
    }
    return { x, z }
  }
  const fromPond = Math.atan2(z - pond.z, x - pond.x)
  const reach = pond.radius + clearance + 0.01
  for (let step = 0; step <= 64; step += 1) {
    const angle = fromPond + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 0.05
    const point = { x: pond.x + Math.cos(angle) * reach, z: pond.z + Math.sin(angle) * reach }
    if (isLand(point.x, point.z, clearance)) return point
  }
  return { x, z }
}

export function isLand(x: number, z: number, clearance = 0): boolean {
  if (poured()) return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) <= 3.15 - clearance + 1e-9 && shoreGap(x, z) >= clearance - 1e-9
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) <= 3.15 - clearance + 1e-9 && Math.hypot(x - pond.x, z - pond.z) >= pond.radius + clearance - 1e-9
}

export function isLandSegment(ax: number, az: number, bx: number, bz: number, clearance = 0): boolean {
  if (!isLand(ax, az, clearance) || !isLand(bx, bz, clearance)) return false
  if (poured()) {
    // The shore can curve any way: check points along the segment, a few mm apart.
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.04)
    for (let step = 1; step < steps; step += 1) if (shoreGap(ax + (bx - ax) * step / steps, az + (bz - az) * step / steps) < clearance - 1e-9) return false
    return true
  }
  const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((pond.x - ax) * dx + (pond.z - az) * dz) / length2))
  // The outer disk is convex; only the inset pond needs an interior check.
  return Math.hypot(ax + t * dx - pond.x, az + t * dz - pond.z) >= pond.radius + clearance - 1e-9
}

export function walkOnLand(creature: LandPose, targetX: number, targetZ: number, stride: number, clearance = 0) {
  let { x, z } = creature
  let distance = Math.hypot(targetX - x, targetZ - z)
  let nextX = x + (targetX - x) / (distance || 1) * stride
  let nextZ = z + (targetZ - z) / (distance || 1) * stride
  const bank = pond.radius + clearance
  if (clearance > 0 && Math.hypot(nextX, nextZ) > 3.15 - clearance) {
    const radius = Math.hypot(nextX, nextZ)
    nextX *= (3.15 - clearance) / radius
    nextZ *= (3.15 - clearance) / radius
  }
  if (poured()) {
    if (shoreGap(nextX, nextZ) < clearance || clearance > 0 && !isLandSegment(x, z, nextX, nextZ, clearance)) {
      // Walk along the shore instead of into the water: sideways along the bank, on the side of the target.
      const normal = shoreNormal(x, z)
      const cross = normal.x * (targetZ - z) - normal.z * (targetX - x)
      const side = Math.sign(cross) || (creature.id % 2 ? 1 : -1)
      nextX = x - normal.z * stride * side
      nextZ = z + normal.x * stride * side
      if (shoreGap(nextX, nextZ) < clearance) { const point = pushToShore(nextX, nextZ, bankWidth + clearance + 0.005); nextX = point.x; nextZ = point.z }
    }
  } else if (Math.hypot(nextX - pond.x, nextZ - pond.z) < bank || clearance > 0 && !isLandSegment(x, z, nextX, nextZ, clearance)) {
    const fromPond = Math.hypot(x - pond.x, z - pond.z)
    const radialX = (x - pond.x) / (fromPond || 1)
    const radialZ = (z - pond.z) / (fromPond || 1)
    const cross = radialX * (targetZ - z) - radialZ * (targetX - x)
    const side = Math.sign(cross) || (creature.id % 2 ? 1 : -1)
    nextX = x - radialZ * stride * side
    nextZ = z + radialX * stride * side
    const nextRadius = Math.hypot(nextX - pond.x, nextZ - pond.z)
    if (nextRadius < bank) {
      const angle = Math.atan2(nextZ - pond.z, nextX - pond.x)
      nextX = pond.x + Math.cos(angle) * bank
      nextZ = pond.z + Math.sin(angle) * bank
    }
  }
  const fromCenter = Math.hypot(nextX, nextZ)
  if (fromCenter > 3.15 - clearance) {
    nextX *= (3.15 - clearance) / fromCenter
    nextZ *= (3.15 - clearance) / fromCenter
  }
  distance = Math.hypot(nextX - x, nextZ - z)
  return { x: nextX, z: nextZ, heading: distance > 0 ? Math.atan2(nextX - x, nextZ - z) : creature.heading, distance }
}
