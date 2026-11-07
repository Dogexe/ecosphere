import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { environmentScale } from './scale'

/*
 * Leafy moss tufts on the moss blanket (Codex moss loop round 2, 2026-11-07: the target is "dense
 * cushions of pointed, leafy moss": tapered lance leaves about 4:1, radiating from tuft centres, deep
 * olive -> moss green -> yellow-green, each tuft lit on its own). One instanced mesh: each tuft is
 * seven tapered blades fanning out and up from a point, a few millimetres across, set close together
 * wherever the moss blanket grows. Visual only.
 */
const fract = (v: number) => v - Math.floor(v)
/** Hoskins' hash12, the same as MossCarpet's shader. */
const hash = (x: number, y: number) => {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031)
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += d; b += d; c += d
  return fract((a + b) * c)
}
export const mossNoise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy
}
/** Same coverage rule as the blanket's shader (MossCarpet). */
export function mossCover(x: number, y: number, z: number, ny: number) {
  const patchMask = mossNoise(x * 0.8, z * 0.8) * 0.7 + mossNoise(x * 2.1, z * 2.1) * 0.3
  const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
  return smooth(0.2, 0.52, patchMask) * smooth(environmentScale.pondSurfaceY + 0.02, environmentScale.pondSurfaceY + 0.14, y) * smooth(0.7, 0.86, ny) * (1 - smooth(3.68, 3.8, Math.hypot(x, z)))
}

/**
 * A moss tuft as four fern-like sprigs (Codex moss loop, asked every round: short stems carrying
 * paired narrow leaflets, spreading outward and curving down): each sprig is a thin stem with four
 * pairs of pointed leaflets, smaller toward the tip, deep olive at the base to yellow-green tips.
 */
function tuftGeometry() {
  const base = new Color('#455c13'), body = new Color('#849d16'), tip = new Color('#bfd02c'), c = new Color()
  const positions: number[] = [], colours: number[] = []
  const tri = (a: Vector3, b: Vector3, d: Vector3, t: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z)
    c.copy(t < 0.5 ? base : body).lerp(t < 0.5 ? body : tip, t < 0.5 ? t * 2 : (t - 0.5) * 2)
    for (let k = 0; k < 3; k += 1) colours.push(c.r, c.g, c.b)
  }
  // A sprig in its own plane (x across, y along), arched: it rises then curls outward and down.
  const along = (t: number) => new Vector3(0, Math.sin(t * 1.9) * 0.62, t * 0.75)
  for (let sprig = 0; sprig < 4; sprig += 1) {
    const yaw = sprig / 4 * Math.PI * 2 + 0.3, rotate = (v: Vector3) => v.applyAxisAngle(new Vector3(0, 1, 0), yaw)
    for (let k = 0; k < 4; k += 1) {
      const t0 = k / 4, t1 = (k + 1) / 4, p0 = along(t0), p1 = along(t1)
      // Stem segment (a thin sliver).
      tri(rotate(p0.clone().add(new Vector3(-0.02, 0, 0))), rotate(p1.clone()), rotate(p0.clone().add(new Vector3(0.02, 0, 0))), t0)
      // A pair of pointed leaflets angled forward and up.
      const size = 0.3 * (1 - t0 * 0.55), mid = along((t0 + t1) / 2)
      for (const side of [-1, 1]) {
        const leafTip = mid.clone().add(new Vector3(side * size, size * 0.35, size * 0.45))
        tri(rotate(mid.clone().add(new Vector3(0, 0, -0.04))), rotate(leafTip), rotate(mid.clone().add(new Vector3(0, 0.03, 0.06))), t1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3))
  // Lit as a little dome, so each tuft has its own light and shade.
  const normals = new Float32Array(positions.length), n = new Vector3()
  for (let v = 0; v < positions.length; v += 3) { n.set(positions[v], positions[v + 1] + 0.3, positions[v + 2]).normalize(); normals.set([n.x, n.y, n.z], v) }
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  return geometry
}

let shared: { geometry: BufferGeometry; material: MeshStandardMaterial } | null = null
const assets = () => shared ??= { geometry: tuftGeometry(), material: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 }) }

export function MossTufts({ surface, floor, lift, crownsOnly = false }: { surface: BufferGeometry; floor: number; lift: (x: number, y: number, z: number, ny: number) => number; crownsOnly?: boolean }) {
  const { geometry, material } = assets()
  const capacity = 16000
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  // After the ground has been written (the parent's layout effect), seat a tuft every few millimetres.
  useEffect(() => {
    const target = mesh.current
    if (!target) return
    const position = surface.getAttribute('position'), normal = surface.getAttribute('normal')
    let n = 0
    for (let v = 0; v < position.count && n < capacity; v += 1) {
      const x = position.getX(v), y = position.getY(v), z = position.getZ(v), ny = normal.getY(v)
      if (v % 3 === 1) continue
      for (let k = 0; k < 1 && n < capacity; k += 1) {
        const jx = x + (hash(v, k) - 0.5) * 0.06, jz = z + (hash(k, v) - 0.5) * 0.06
        const cover = mossCover(jx, y + floor, jz, ny)
        if (cover < 0.2) continue
        // On the fur mounds only the crowns carry sprigs, so the mounds keep their soft rounded outline.
        if (crownsOnly && (lift(jx, y + floor, jz, ny) < 0.12 || hash(v, 23 + k) > 0.6)) continue
        dummy.position.set(jx, y + lift(jx, y + floor, jz, ny) - 0.015, jz)
        dummy.rotation.set((hash(v, 11 + k) - 0.5) * 0.4, hash(v, 13 + k) * Math.PI * 2, (hash(v, 17 + k) - 0.5) * 0.4)
        const s = (0.15 + hash(v, 19 + k) * 0.08) * (0.75 + cover * 0.25)
        dummy.scale.set(s * 1.8, s, s * 1.8)
        dummy.updateMatrix()
        target.setMatrixAt(n, dummy.matrix)
        n += 1
      }
    }
    // Drape (Codex moss loop): where moss reaches the glass, tufts hang down the soil face in an
    // irregular fringe, 2-4 tufts deep, with gaps.
    for (let step = 0; step < 900 && n < capacity; step += 1) {
      const angle = step / 900 * Math.PI * 2, r = 3.66, x = Math.cos(angle) * r, z = Math.sin(angle) * r
      let best = -1, bestDistance = Infinity
      for (let v = 0; v < position.count; v += 37) { const d = Math.hypot(position.getX(v) - x, position.getZ(v) - z); if (d < bestDistance) { bestDistance = d; best = v } }
      if (best < 0 || bestDistance > 0.4) continue
      const top = position.getY(best), cover = mossCover(x, top + floor, z, 0.9)
      if (cover < 0.3 || hash(step, 47) < 0.2) continue
      const depth = 1 + Math.floor(hash(step, 41) * 1.6 * cover)
      for (let k = 0; k < depth && n < capacity; k += 1) {
        dummy.position.set(Math.cos(angle) * (r + 0.02), top - 0.03 - k * 0.07 - hash(step, k) * 0.04, Math.sin(angle) * (r + 0.02))
        dummy.rotation.set(Math.PI * 0.8, -angle + Math.PI / 2, (hash(k, step) - 0.5) * 0.6)
        const s = (0.2 + hash(step, 43 + k) * 0.06) * (1 - k * 0.15)
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        target.setMatrixAt(n, dummy.matrix)
        n += 1
      }
    }
    target.count = n
    target.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, capacity]} frustumCulled={false} raycast={() => undefined} receiveShadow />
}
