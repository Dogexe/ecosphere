import { Box3, Quaternion, Vector3 } from 'three'
import type { NestShape } from './nestGeometry'

type Field = (x: number, y: number, z: number) => number

export function antSupportTranslation(field: Field, origin: Vector3, rotation: Quaternion, bounds: Box3, scale: number, nest: NestShape) {
  const clearance = (position: Vector3) => {
    let worst = -Infinity
    for (const x of [bounds.min.x, (bounds.min.x + bounds.max.x) / 2, bounds.max.x])
      for (const y of [bounds.min.y, (bounds.min.y + bounds.max.y) / 2, bounds.max.y])
        for (const z of [bounds.min.z, (bounds.min.z + bounds.max.z) / 2, bounds.max.z]) {
          const p = new Vector3(x,y,z).multiplyScalar(scale).applyQuaternion(rotation).add(position)
          worst = Math.max(worst, field(p.x,p.y,p.z))
        }
    return worst
  }
  let supported = origin
  let worst = clearance(origin)
  if (worst > 0) {
    // Contact separation can push the wide imported legs outside a narrow
    // shaft. Recover the presentation toward the nearest connected centerline.
    const candidates = nest.edges.map(([aId,bId]) => {
      const a = nest.nodes.find(n => n.id === aId)!, b = nest.nodes.find(n => n.id === bId)!
      const start = new Vector3(a.x,a.y,a.z), line = new Vector3(b.x-a.x,b.y-a.y,b.z-a.z)
      const t = Math.max(0,Math.min(1,origin.clone().sub(start).dot(line) / line.lengthSq()))
      return start.addScaledVector(line,t)
    }).filter(p => p.distanceToSquared(origin) <= 0.08 ** 2).sort((a,b) => a.distanceToSquared(origin)-b.distanceToSquared(origin))
    for (const anchor of candidates) {
      const candidate = clearance(anchor)
      if (candidate < worst) { supported = anchor; worst = candidate }
      if (worst <= 0) break
    }
    if (supported !== origin && worst <= 0) {
      // Preserve contact separation: move only far enough to clear the wall,
      // rather than collapsing opposite-side workers onto one centerline.
      let outside = 0, inside = 1
      for (let i = 0; i < 10; i++) {
        const middle = (outside + inside) / 2
        if (clearance(origin.clone().lerp(supported,middle)) <= 0) inside = middle
        else outside = middle
      }
      supported = origin.clone().lerp(supported,inside)
    }
  }
  const correction = supported.clone().sub(origin).applyQuaternion(rotation.clone().invert())
  correction.y += antSupportOffset(field,supported,rotation,bounds,scale)
  return correction
}

// Rigid-body support only. A conservative box protects the imported anatomy;
// it does not change graph travel, scale or the animal's ecological location.
export function antSupportOffset(field: Field, origin: Vector3, rotation: Quaternion, bounds: Box3, scale: number) {
  const points: Vector3[] = []
  for (const x of [bounds.min.x, (bounds.min.x + bounds.max.x) / 2, bounds.max.x])
    for (const y of [bounds.min.y, (bounds.min.y + bounds.max.y) / 2, bounds.max.y])
      for (const z of [bounds.min.z, (bounds.min.z + bounds.max.z) / 2, bounds.max.z])
        points.push(new Vector3(x, y, z).multiplyScalar(scale).applyQuaternion(rotation).add(origin))
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation)
  const fits = (depth: number) => points.every(p => field(p.x - up.x * depth, p.y - up.y * depth, p.z - up.z * depth) <= -0.008)
  if (!fits(0)) return 0
  // Walk from this connected void to its first boundary, not another chamber.
  let safe = 0
  for (let probe = 0.005; probe <= 0.305; probe += 0.005) {
    if (fits(probe)) { safe = probe; continue }
    let outside = probe
    for (let i = 0; i < 8; i++) {
      const middle = (safe + outside) / 2
      if (fits(middle)) safe = middle
      else outside = middle
    }
    return -safe
  }
  return -safe
}
