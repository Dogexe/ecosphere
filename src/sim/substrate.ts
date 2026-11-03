/*
 * The jar's built substrate: gravel, charcoal and soil poured in at the start.
 *
 * A height field over the jar floor, one value per layer per cell, relaxed
 * like a sand pile: wherever the top material is steeper than it can stand,
 * some slides to the lower neighbour. How steep it can stand depends on the
 * material and, for soil, on how wet and how loose it is:
 *
 * - Gravel ~40°, loose dry earth ~28-30°, coal/charcoal ~24-30°
 *   (Engineering ToolBox, "Angle of repose").
 * - A little water makes grains cling (liquid bridges): the angle rises
 *   sharply with the first drops and then levels off; grains fully under
 *   water slump back to about the dry angle (Samadani & Kudrolli, "Angle of
 *   repose and segregation in cohesive granular matter",
 *   https://arxiv.org/abs/cond-mat/0106572). So damp soil can be heaped into
 *   hills and soaked soil runs like mud.
 * - Fresh potting mix is loose and settles over the first two or three
 *   waterings, then stays put (https://www.bloomingexpert.com/tips/container-gardens/potting-mix-settling-and-topping-up/).
 *   Here each full wetting firms it by half and it sinks by up to 10% of its
 *   depth (an estimate; no source gives a number for a fresh fill).
 * - Water the soil cannot hold drains to the gravel: soil holds about half its
 *   volume (NC State substrate guide: porosity 65-85%, air space 10-20%),
 *   gravel pores are about 35% of its volume.
 * - Water lands on the surface first and soaks in at a limited rate. Pour
 *   faster than that and it puddles in the low spots; once the gravel below
 *   is full there is nowhere left to drain and the jar floods. Real soils take
 *   in roughly 1-5 mm/h (clay) to over 30 mm/h (sand) (FAO, Irrigation Water
 *   Management, "basic infiltration rate"); here it is sped up so a puddle
 *   soaks into fresh mix in seconds, firm soil about half as fast.
 *
 * Pure and deterministic: no randomness, no clock. The grains you see falling
 * live in the scene; they call deposit() where they land.
 */

export const substrateSize = 40
export const jarRadius = 3.77
const N = substrateSize
const R = jarRadius
export const substrateCell = (2 * R) / (N - 1)
export const layerNames = ['gravel', 'charcoal', 'soil'] as const
export type Layer = typeof layerNames[number]
export type Pourable = Layer | 'water'
export type DecorKind = 'stone' | 'log'
export type Decor = { kind: DecorKind; x: number; z: number; size: number; turn: number }

export type Substrate = {
  gravel: Float32Array; charcoal: Float32Array; soil: Float32Array
  /** Water held in the soil of each cell, in the same units as soil depth. */
  water: Float32Array
  /** 1 = freshly poured and loose, 0 = settled and firm. */
  loose: Float32Array
  /** Standing water on top of each cell (puddles), in units of depth. */
  pool: Float32Array
  /** Height of drained water standing in the gravel. */
  table: number
  decor: Decor[]
}

export const holding = 0.5
export const gravelPores = 0.35
/** Fraction of its depth fully loose soil loses as it settles. */
export const settling = 0.1
const tanDegrees = (value: number) => Math.tan(value * Math.PI / 180) * substrateCell

export const index = (i: number, j: number) => j * N + i
export const cellX = (i: number) => -R + i * substrateCell
export const inside = new Uint8Array(N * N)
for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) inside[index(i, j)] = Math.hypot(cellX(i), cellX(j)) <= R - substrateCell * 0.5 ? 1 : 0

export function emptySubstrate(): Substrate {
  return { gravel: new Float32Array(N * N), charcoal: new Float32Array(N * N), soil: new Float32Array(N * N), water: new Float32Array(N * N), loose: new Float32Array(N * N), pool: new Float32Array(N * N), table: 0, decor: [] }
}

export const topAt = (state: Substrate, k: number) => state.gravel[k] + state.charcoal[k] + state.soil[k]
export const topLayer = (state: Substrate, k: number): Layer | null => state.soil[k] > 1e-4 ? 'soil' : state.charcoal[k] > 1e-4 ? 'charcoal' : state.gravel[k] > 1e-4 ? 'gravel' : null
/** How full of water the soil in a cell is: 0 dry, 1 holding all it can. */
export const wetness = (state: Substrate, k: number) => state.soil[k] > 1e-4 ? Math.min(1, state.water[k] / (state.soil[k] * holding)) : 0

/** The steepest step, in height per cell, the top material of a cell can stand. */
export function reposeStep(state: Substrate, k: number, layer: Layer) {
  if (layer === 'gravel') return tanDegrees(40)
  if (layer === 'charcoal') return tanDegrees(30)
  const wet = wetness(state, k)
  // Saturated soil is mud and runs at about the dry angle whether loose or not.
  if (wet >= 0.98) return tanDegrees(24)
  const looseAngle = 30 + 15 * Math.min(1, wet / 0.25)
  // Settled, damp soil holds a near-vertical cut (you can dig a hole in it).
  const firmAngle = 75
  return tanDegrees(firmAngle + (looseAngle - firmAngle) * state.loose[k])
}

const cellOf = (x: number, z: number) => [Math.round((x + R) / substrateCell), Math.round((z + R) / substrateCell)] as const

/** Drop `amount` (in units of depth over one cell) of a material in a soft disc around (x, z). */
export function deposit(state: Substrate, material: Pourable, x: number, z: number, amount: number) {
  const [ci, cj] = cellOf(x, z)
  const spread = 2
  let weight = 0
  // Weigh only cells inside the jar: what lands against the glass stays in the jar.
  for (let dj = -spread; dj <= spread; dj += 1) for (let di = -spread; di <= spread; di += 1) {
    const i = ci + di, j = cj + dj
    if (i >= 0 && j >= 0 && i < N && j < N && inside[index(i, j)]) weight += Math.exp(-(di * di + dj * dj) / 2.5)
  }
  if (weight === 0) return
  for (let dj = -spread; dj <= spread; dj += 1) for (let di = -spread; di <= spread; di += 1) {
    const i = ci + di, j = cj + dj
    if (i < 0 || j < 0 || i >= N || j >= N || !inside[index(i, j)]) continue
    const share = amount * Math.exp(-(di * di + dj * dj) / 2.5) / weight
    const k = index(i, j)
    if (material === 'water') state.pool[k] += share
    else if (material === 'soil') {
      // Fresh soil is loose; it mixes into whatever loose fraction is there.
      state.loose[k] = (state.loose[k] * state.soil[k] + share) / (state.soil[k] + share)
      state.soil[k] += share
    } else state[material][k] += share
  }
}

const insideCount = inside.reduce((sum, value) => sum + value, 0)

/** Mean gravel depth: the drained water table can rise this high before the gravel is full. */
function gravelTop(state: Substrate) {
  let sum = 0
  for (let k = 0; k < state.gravel.length; k += 1) if (inside[k]) sum += state.gravel[k]
  return sum / insideCount
}

/** Sends water down into the gravel; returns what did not fit because the gravel is already full. */
function drain(state: Substrate, amount: number) {
  const room = Math.max(0, gravelTop(state) - state.table) * insideCount * gravelPores
  const taken = Math.min(room, amount)
  state.table += taken / (insideCount * gravelPores)
  return amount - taken
}

/**
 * Water soaks into the soil up to what it can hold; the rest drains to the
 * gravel. Wetting loose soil collapses its air pockets: it firms up and sinks.
 * Whatever the gravel cannot take either stays on top as a puddle.
 */
export function soak(state: Substrate, k: number, amount: number) {
  if (state.soil[k] > 1e-4) {
    const before = state.loose[k]
    const firmed = Math.min(before, amount / (state.soil[k] * holding) * 0.5)
    state.loose[k] = before - firmed
    const sink = state.soil[k] * settling * firmed
    state.soil[k] -= sink
  }
  const room = Math.max(0, state.soil[k] * holding - state.water[k])
  const kept = Math.min(room, amount)
  state.water[k] += kept
  // When the soil is already full, the extra stays in it briefly as mud before draining.
  const overflow = amount - kept
  const muddy = Math.min(overflow, Math.max(0, state.soil[k] * holding * 1.1 - state.water[k]))
  state.water[k] += muddy
  state.pool[k] += drain(state, overflow - muddy)
}

/** Depth of standing water a cell lets soak in per settle step (one frame while building). */
export const infiltration = { looseSoil: 0.004, firmSoil: 0.002, bare: 0.05 }
/** A film this thin (about 0.6 mm) clings to the rough surface instead of running off. */
const detention = 0.03

/** Puddles soak in at the surface's rate, and the water left on top runs downhill and levels out. */
export function runoff(state: Substrate) {
  for (let k = 0; k < state.pool.length; k += 1) {
    if (!inside[k] || state.pool[k] <= 1e-6) continue
    const rate = state.soil[k] > 1e-4 ? infiltration.firmSoil + (infiltration.looseSoil - infiltration.firmSoil) * state.loose[k] : infiltration.bare
    const amount = Math.min(state.pool[k], rate)
    state.pool[k] -= amount
    soak(state, k, amount)
  }
  // Water levels out much faster than soil slides: keep passing until it has nearly stopped moving.
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = 0
    for (let j = 1; j < N - 1; j += 1) for (let i = 1; i < N - 1; i += 1) {
      const k = index(i, j)
      if (!inside[k]) continue
      for (const m of [index(i + 1, j), index(i, j + 1)]) {
        if (!inside[m]) continue
        const difference = (topAt(state, k) + state.pool[k]) - (topAt(state, m) + state.pool[m])
        const flow = difference > 0 ? Math.min(Math.max(0, state.pool[k] - detention), difference * 0.25) : -Math.min(Math.max(0, state.pool[m] - detention), -difference * 0.25)
        state.pool[k] -= flow; state.pool[m] += flow
        moved = Math.max(moved, Math.abs(flow))
      }
    }
    if (pass >= 2 && moved < 0.002) break
  }
}

/** One relaxation pass; returns how much material moved. */
export function slump(state: Substrate) {
  let moved = 0
  for (let j = 1; j < N - 1; j += 1) for (let i = 1; i < N - 1; i += 1) {
    const k = index(i, j)
    if (!inside[k]) continue
    const layer = topLayer(state, k)
    if (!layer) continue
    const limit = reposeStep(state, k, layer)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = index(i + di, j + dj)
      if (!inside[n]) continue
      const drop = topAt(state, k) - topAt(state, n) - limit
      if (drop <= 0) continue
      const flow = Math.min(drop * 0.4, state[layer][k])
      if (flow <= 0) continue
      if (layer === 'soil') {
        // Soil carries its water and looseness with it; what slides is loose again.
        const water = state.water[k] * flow / state.soil[k]
        state.water[k] -= water; state.water[n] += water
        state.loose[n] = (state.loose[n] * state.soil[n] + Math.max(state.loose[k], 0.6) * flow) / (state.soil[n] + flow)
      }
      state[layer][k] -= flow; state[layer][n] += flow
      moved += flow
    }
  }
  return moved
}

/** Soil water creeps sideways from wetter to drier cells; mud drains its extra to the gravel. */
export function wick(state: Substrate) {
  for (let j = 1; j < N - 1; j += 1) for (let i = 1; i < N - 1; i += 1) {
    const k = index(i, j)
    if (!inside[k] || state.soil[k] <= 1e-4) continue
    for (const m of [index(i + 1, j), index(i, j + 1)]) {
      if (!inside[m] || state.soil[m] <= 1e-4) continue
      const flow = (wetness(state, k) - wetness(state, m)) * 0.03 * Math.min(state.soil[k], state.soil[m]) * holding
      state.water[k] -= flow; state.water[m] += flow
    }
    const extra = state.water[k] - state.soil[k] * holding
    if (extra > 0) {
      const drained = extra * 0.05
      state.water[k] -= drained
      state.pool[k] += drain(state, drained)
    }
  }
}

/** Let the pile settle: up to `passes` relaxation passes, then one step of water movement. */
export function settle(state: Substrate, passes = 8) {
  for (let pass = 0; pass < passes; pass += 1) if (slump(state) < 1e-5) break
  runoff(state)
  wick(state)
}

/** Mean depth of standing water over the jar, and how much of the floor it covers (0-1). */
export function puddles(state: Substrate) {
  let depth = 0, wet = 0
  for (let k = 0; k < state.pool.length; k += 1) if (inside[k]) { depth += state.pool[k]; if (state.pool[k] > 0.01) wet += 1 }
  return { depth: depth / insideCount, cover: wet / insideCount }
}

/** Ground height at a point, smoothly interpolated between cells. */
export function heightAt(state: Substrate, x: number, z: number) {
  const fx = Math.min(N - 1.001, Math.max(0, (x + R) / substrateCell)), fz = Math.min(N - 1.001, Math.max(0, (z + R) / substrateCell))
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
  const h = (a: number, b: number) => { const k = index(a, b); return inside[k] ? topAt(state, k) : NaN }
  const corners = [[h(i, j), (1 - u) * (1 - v)], [h(i + 1, j), u * (1 - v)], [h(i, j + 1), (1 - u) * v], [h(i + 1, j + 1), u * v]].filter(([value]) => !Number.isNaN(value))
  const total = corners.reduce((sum, [, weight]) => sum + weight, 0)
  return total > 0 ? corners.reduce((sum, [value, weight]) => sum + value * weight, 0) / total : 0
}

/** Mean depth of each layer over the cells inside the jar. */
export function layerDepths(state: Substrate) {
  const count = inside.reduce((sum, value) => sum + value, 0)
  const mean = (values: Float32Array) => values.reduce((sum, value, k) => sum + (inside[k] ? value : 0), 0) / count
  return { gravel: mean(state.gravel), charcoal: mean(state.charcoal), soil: mean(state.soil), loose: mean(state.loose) }
}

/** Mean soil wetness (0-100) in each of the sim's four soil pockets (quadrants, ordered as in createWorld). */
export function pocketWetness(state: Substrate) {
  const sums = [0, 0, 0, 0], counts = [0, 0, 0, 0]
  for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
    const k = index(i, j)
    if (!inside[k] || state.soil[k] <= 1e-4) continue
    const pocket = (cellX(i) < 0 ? 0 : 1) + (cellX(j) < 0 ? 0 : 2)
    sums[pocket] += wetness(state, k) * 100; counts[pocket] += 1
  }
  return sums.map((sum, pocket) => counts[pocket] ? sum / counts[pocket] : 0)
}

// ---- Saving ----------------------------------------------------------------

/** What a save stores: heights to 0.01 units (0.2 mm), looseness to 0.01. Soil water lives in the sim's soil pockets once the game starts; standing puddles are kept here (only when there are any). */
export type SavedSubstrate = { size: number; gravel: number[]; charcoal: number[]; soil: number[]; loose: number[]; table: number; decor: Decor[]; pool?: number[]; preset?: 'default' }
const round = (value: number) => Math.round(value * 100) / 100

export function saveSubstrate(state: Substrate): SavedSubstrate {
  const pack = (values: Float32Array) => Array.from(values, (value, k) => inside[k] ? round(value) : 0)
  const saved: SavedSubstrate = { size: N, gravel: pack(state.gravel), charcoal: pack(state.charcoal), soil: pack(state.soil), loose: pack(state.loose), table: round(state.table), decor: state.decor.map((item) => ({ ...item, x: round(item.x), z: round(item.z), size: round(item.size), turn: round(item.turn) })) }
  // Always stored since the pond follows the standing water; jars built before that have none and keep the round pond.
  saved.pool = pack(state.pool)
  return saved
}

const damaged = () => new Error('This experiment file is damaged.')
const finite = (value: unknown, low: number, high: number) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high

/** Whether a saved substrate is the default poured jar (dressed with moss and stones) rather than one the player built. */
export const isPresetJar = (saved: SavedSubstrate) => saved.preset === 'default'

/** Rebuilds a substrate from a save, rejecting anything out of physical bounds. */
export function loadSubstrate(source: unknown): Substrate {
  if (!source || typeof source !== 'object') throw damaged()
  const saved = source as Record<string, unknown>
  if (saved.size !== N) throw damaged()
  const state = emptySubstrate()
  for (const key of ['gravel', 'charcoal', 'soil', 'loose'] as const) {
    const values = saved[key]
    if (!Array.isArray(values) || values.length !== N * N) throw damaged()
    values.forEach((value, k) => { if (!finite(value, 0, key === 'loose' ? 1 : 12)) throw damaged(); state[key][k] = inside[k] ? value as number : 0 })
  }
  if (saved.pool !== undefined) {
    if (!Array.isArray(saved.pool) || saved.pool.length !== N * N) throw damaged()
    saved.pool.forEach((value, k) => { if (!finite(value, 0, 12)) throw damaged(); state.pool[k] = inside[k] ? value as number : 0 })
  }
  if (saved.preset !== undefined && saved.preset !== 'default') throw damaged()
  if (!finite(saved.table, 0, 12)) throw damaged()
  state.table = saved.table as number
  if (!Array.isArray(saved.decor) || saved.decor.length > 24) throw damaged()
  state.decor = saved.decor.map((value) => {
    const item = value as Record<string, unknown>
    if (!item || (item.kind !== 'stone' && item.kind !== 'log') || !finite(item.x, -R, R) || !finite(item.z, -R, R) || !finite(item.size, 0.1, 3) || !finite(item.turn, -10, 10)) throw damaged()
    return { kind: item.kind, x: item.x as number, z: item.z as number, size: item.size as number, turn: item.turn as number }
  })
  return state
}
