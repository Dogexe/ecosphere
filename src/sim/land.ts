// Shared pure navigation. Existing animals use zero hull clearance; tap/mesh
// dimensions are never inputs. Preserve the original center-only trajectories.
export type LandPose = { id: number; x: number; z: number; heading: number }
const pond = { x: -1.1, z: 0.72, radius: 1.05 }

export function isLand(x: number, z: number, clearance = 0): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) <= 3.15 - clearance + 1e-9 && Math.hypot(x - pond.x, z - pond.z) >= pond.radius + clearance - 1e-9
}

export function isLandSegment(ax: number, az: number, bx: number, bz: number, clearance = 0): boolean {
  if (!isLand(ax, az, clearance) || !isLand(bx, bz, clearance)) return false
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
  if (Math.hypot(nextX - pond.x, nextZ - pond.z) < bank || clearance > 0 && !isLandSegment(x, z, nextX, nextZ, clearance)) {
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
