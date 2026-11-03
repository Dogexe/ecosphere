/**
 * Where the open water is.
 *
 * The classic jar has a round pond 6 cm across (radius 1.58 units at about
 * 19 mm per unit) and about 2 cm deep. It grew from 3.5 cm on 2026-11-03;
 * see widePond.ts for how older saves are moved onto the bank.
 *
 * A jar whose substrate was poured (2026-11-03) has no drawn pond. Its pond
 * is wherever poured water stands: the water ran downhill and levelled out in
 * the hollows, so the shore follows the ground and can take any shape.
 *
 * The rest of the sim asks the active shape: `signedDistance` is negative in
 * the water and positive on land, in units. Kept in its own module so land.ts
 * can read it without an import cycle.
 */

export const pondCenter = { x: -1.1, z: 0.72, radius: 1.58 }

/** Standing water at least this deep (about 1.5 mm) counts as open water. */
export const pondDepth = 0.08
/** Smaller patches of standing water (under about 1 cm²) are only puddles. */
const pondCells = 8

type SavedPool = { size: number; pool?: number[]; gravel?: number[]; charcoal?: number[]; soil?: number[] }

export type PondShape = {
  kind: 'circle' | 'mask'
  /** Negative inside the water, positive on land: distance to the shore in units. */
  signedDistance: (x: number, z: number) => number
  /** Deepest point inside the shore, used as the pond's centre. */
  center: { x: number; z: number }
  /** Distance from the centre to the nearest shore. */
  inner: number
  /** Which grid cells hold the pond (mask only), and the water level in substrate heights. */
  cells?: Uint8Array
  level?: number
  /** Water volume in substrate units (depth × cell area). */
  volume?: number
}

const circle: PondShape = {
  kind: 'circle',
  signedDistance: (x, z) => Math.hypot(x - pondCenter.x, z - pondCenter.z) - pondCenter.radius,
  center: { x: pondCenter.x, z: pondCenter.z },
  inner: pondCenter.radius,
}

let active: PondShape = circle
const cache = new WeakMap<object, PondShape>()

/** The pond shape the sim and scene use right now. */
export const pondShape = () => active

/**
 * Sets the pond from a world's poured substrate, or the round pond when it has
 * none. Called at the start of every sim step and validation, so the shape
 * always matches the world being worked on.
 */
export function setPondShape(substrate?: SavedPool | null) {
  if (!substrate || !Array.isArray(substrate.pool)) { active = circle; return active }
  let shape = cache.get(substrate)
  if (!shape) { shape = maskShape(substrate); cache.set(substrate, shape) }
  active = shape
  return active
}

/** Builds the pond shape from the standing water of a poured substrate. */
export function maskShape(substrate: SavedPool, ground?: ArrayLike<number>): PondShape {
  const N = substrate.size, R = 3.77, cell = 2 * R / (N - 1)
  const at = (i: number) => -R + i * cell
  const pool = substrate.pool ?? []
  const floor = ground ?? (substrate.soil ? substrate.soil.map((value, k) => value + (substrate.gravel?.[k] ?? 0) + (substrate.charcoal?.[k] ?? 0)) : undefined)
  const wet = new Uint8Array(N * N)
  for (let k = 0; k < N * N; k += 1) if ((pool[k] ?? 0) > pondDepth && Math.hypot(at(k % N), at(Math.floor(k / N))) <= R - cell * 0.5) wet[k] = 1
  // Keep only connected patches big enough to be a pond.
  const cells = new Uint8Array(N * N), seen = new Uint8Array(N * N)
  for (let start = 0; start < N * N; start += 1) {
    if (!wet[start] || seen[start]) continue
    const patch = [start]; seen[start] = 1
    for (let n = 0; n < patch.length; n += 1) {
      const k = patch[n], i = k % N, j = Math.floor(k / N)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj, m = b * N + a
        if (a < 0 || b < 0 || a >= N || b >= N || !wet[m] || seen[m]) continue
        seen[m] = 1; patch.push(m)
      }
    }
    if (patch.length >= pondCells) for (const k of patch) cells[k] = 1
  }
  const water: number[] = [], land: number[] = []
  for (let k = 0; k < N * N; k += 1) (cells[k] ? water : land).push(k)
  if (!water.length) return { kind: 'mask', signedDistance: () => 9, center: { x: 0, z: 0 }, inner: 0, cells, level: 0, volume: 0 }
  // Signed distance at every cell centre: to the nearest cell of the other kind, less half a cell.
  const field = new Float32Array(N * N)
  for (let k = 0; k < N * N; k += 1) {
    const x = at(k % N), z = at(Math.floor(k / N)), others = cells[k] ? land : water
    let best = Infinity
    for (const m of others) { const d = (at(m % N) - x) ** 2 + (at(Math.floor(m / N)) - z) ** 2; if (d < best) best = d }
    field[k] = cells[k] ? -(Math.sqrt(best) - cell / 2) : Math.sqrt(best) - cell / 2
  }
  const signedDistance = (x: number, z: number) => {
    const fx = (x + R) / cell, fz = (z + R) / cell
    if (fx < 0 || fz < 0 || fx > N - 1 || fz > N - 1) return 9
    const i = Math.min(N - 2, Math.floor(fx)), j = Math.min(N - 2, Math.floor(fz)), u = fx - i, v = fz - j
    const f = (a: number, b: number) => field[b * N + a]
    return f(i, j) * (1 - u) * (1 - v) + f(i + 1, j) * u * (1 - v) + f(i, j + 1) * (1 - u) * v + f(i + 1, j + 1) * u * v
  }
  let deepest = water[0]
  for (const k of water) if (field[k] < field[deepest]) deepest = k
  let volume = 0, level = 0
  for (const k of water) { volume += (pool[k] ?? 0) * cell * cell; level += (floor ? floor[k] : 0) + (pool[k] ?? 0) }
  return { kind: 'mask', signedDistance, center: { x: at(deepest % N), z: at(Math.floor(deepest / N)) }, inner: -field[deepest], cells, level: level / water.length, volume }
}

/** Outward direction (from water to land) at a point, from the slope of the distance field. */
export function shoreNormal(x: number, z: number) {
  const d = active.signedDistance, h = 0.05
  const gx = d(x + h, z) - d(x - h, z), gz = d(x, z + h) - d(x, z - h)
  const length = Math.hypot(gx, gz)
  if (length < 1e-9) { const dx = x - active.center.x, dz = z - active.center.z, r = Math.hypot(dx, dz) || 1; return { x: dx / r, z: dz / r } }
  return { x: gx / length, z: gz / length }
}

/** Moves a point along the distance field until it is `margin` inside the water (margin > 0) or out on land (margin < 0). */
export function pushToShore(x: number, z: number, target: number) {
  let px = x, pz = z
  for (let step = 0; step < 12; step += 1) {
    const error = active.signedDistance(px, pz) - target
    if (Math.abs(error) < 0.004) break
    const normal = shoreNormal(px, pz)
    px -= normal.x * error; pz -= normal.z * error
  }
  return { x: px, z: pz }
}
