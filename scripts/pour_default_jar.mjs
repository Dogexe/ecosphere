// Pours the default jar the same way a player would in the jar builder:
// gravel, a thin charcoal layer, soil heaped into a gentle rise at the back,
// a hollow scooped out by hand for the pond, a watering that settles the
// fresh soil, and water poured into the hollow until it stands as a pond. Writes
// src/sim/defaultJar.json, which the paper look uses for every jar that the
// player did not build themselves.
// Run: node --experimental-strip-types scripts/pour_default_jar.mjs
import { writeFileSync } from 'node:fs'
import { cellX, deposit, emptySubstrate, index, inside, layerDepths, puddles, saveSubstrate, settle, substrateSize } from '../src/sim/substrate.ts'
import { maskShape } from '../src/sim/pondShape.ts'
import { pondCenter } from '../src/sim/pondShape.ts'

const state = emptySubstrate()
// A spiral of pour points covering the floor, like moving a scoop around.
const spiral = Array.from({ length: 60 }, (_, i) => { const r = 3.6 * Math.sqrt((i + 0.5) / 60), a = i * 2.39996; return [Math.cos(a) * r, Math.sin(a) * r] })
const pour = (material, target, amount, points, done = () => false) => {
  for (let n = 0; ; n += 1) {
    const [x, z] = points[n % points.length]
    deposit(state, material, x, z, amount)
    settle(state, 6)
    if (done() || n > 20000) break
  }
}
const depth = (layer) => layerDepths(state)[layer]
// Shallower than the old 30/5/52 mm so the jar reads fat and squat like the
// owner's target picture (concept round 3, image 12, 2026-11-06): about 19 mm
// of gravel, 4 mm of charcoal and 36 mm of soil; thinned again the same day to
// about 14 mm gravel and 22 mm soil (Codex review round 1: the brown wall was
// the biggest gap), the pond hollow dug down to the charcoal.
pour('gravel', 0.6, 3, spiral, () => depth('gravel') >= 0.6)
pour('charcoal', 0.12, 1, spiral, () => depth('charcoal') >= 0.12)
// Concept image 12 (owner's pick, 2026-11-06; thread "Match jar visuals to image 12", 2026-11-07):
// the substrate is only about a third of the jar's height. A low planted bank (about 33 mm
// above the base at the front, rising to about 55 mm at the back) and a pond dug right
// down to the gravel that runs out to the front glass, so the water and its pebble bed are
// seen side-on. The soil is placed by hand to these heights, then watered and allowed to slump.
const N = substrateSize
const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const wobble = (x, z) => 0.06 * Math.sin(x * 1.7 + z * 0.9) + 0.05 * Math.sin(z * 2.3 - x * 1.1 + 1.2) + 0.03 * Math.sin(x * 3.9 + 2.0)
// The hollow: an egg shape from the sim's pond centre forward to the glass, dug to the gravel in the middle.
const hollow = (x, z) => {
  const cx = pondCenter.x - 0.1, cz = pondCenter.z + 1.15
  const dx = (x - cx) / 1.6, dz = (z - cz) / (z > cz ? 2.6 : 1.75)
  const angle = Math.atan2(dz, dx)
  return Math.hypot(dx, dz) / (1 + 0.07 * Math.sin(2 * angle + 1) + 0.05 * Math.sin(3 * angle + 2.2))
}
for (let k = 0; k < N * N; k += 1) {
  if (!inside[k]) continue
  const x = cellX(k % N), z = cellX(Math.floor(k / N))
  const base = state.gravel[k] + state.charcoal[k]
  const land = 2.15 + 0.85 * smoothstep(1.6, -3.2, z) + 0.25 * smoothstep(-1, 2.5, x) * smoothstep(1.5, -2, z) + wobble(x, z)
  const t = smoothstep(0.62, 1.08, hollow(x, z))
  const bed = base - (t < 0.15 ? state.charcoal[k] : 0)
  if (t < 0.15) state.charcoal[k] = 0
  const top = bed + (land + base - bed) * t
  const soil = Math.max(0, top - bed)
  state.soil[k] = soil; state.loose[k] = 0.35
}
for (let pass = 0; pass < 300; pass += 1) settle(state, 6)
// Scrape the slumped soil back off the middle of the hollow so the water stands on bare gravel at the glass.
for (let k = 0; k < N * N; k += 1) {
  if (!inside[k]) continue
  const x = cellX(k % N), z = cellX(Math.floor(k / N)), h = hollow(x, z)
  if (h < 0.95) { state.soil[k] *= Math.max(0, (h - 0.7) / 0.25) ** 2; if (h < 0.85) state.charcoal[k] = 0 }
}
// A gentle watering: enough to settle and firm the top, not to leave puddles.
for (let n = 0; n < 700; n += 1) { const [x, z] = spiral[n % spiral.length]; deposit(state, 'water', x, z, 2); settle(state, 4) }
for (let pass = 0; pass < 1500; pass += 1) settle(state, 4)
// Fill the hollow: water poured at its middle runs out to the shore by itself.
// It only stays once the soil under it and the gravel below are full, as in a
// real jar, so keep pouring and waiting until the pond holds its size.
const shape = () => maskShape(saveSubstrate(state))
let held = 0
for (let round = 0; round < 3000; round += 1) {
  // Pour fast until water starts to stand, then slowly so the pond stops near its size.
  const batch = held < 0.3 ? 40 : 6
  for (let n = 0; n < batch; n += 1) { deposit(state, 'water', pondCenter.x + Math.sin(n) * 0.3, pondCenter.z + Math.cos(n * 1.7) * 0.3, 2); settle(state, 2) }
  for (let pass = 0; pass < 150; pass += 1) settle(state, 2)
  const volume = shape().volume ?? 0
  held = volume
  if (round % 50 === 0) console.log('round', round, 'pond volume', volume.toFixed(2), 'table', state.table.toFixed(2))
  if (volume > +(process.env.POND_VOLUME ?? 11)) break
}
// Against the front glass the pond bed is cleared to the gravel (soil slumped there while it was
// watered), so the water is seen standing on stones; the water keeps its level.
for (let k = 0; k < N * N; k += 1) {
  if (!inside[k] || state.pool[k] < 0.3) continue
  const x = cellX(k % N), z = cellX(Math.floor(k / N))
  const near = smoothstep(2.4, 3.3, Math.hypot(x, z)) * smoothstep(0, 1.2, z) * smoothstep(1.1, 0.8, hollow(x, z))
  if (near <= 0) continue
  const take = (state.soil[k] + state.charcoal[k]) * near
  const soilTake = Math.min(state.soil[k], take)
  state.soil[k] -= soilTake; state.charcoal[k] -= take - soilTake; state.pool[k] += take
}
const pond = shape()
let farthest = 0
for (let k = 0; k < N * N; k += 1) if (pond.cells[k]) farthest = Math.max(farthest, Math.hypot(cellX(k % N) - pondCenter.x, cellX(Math.floor(k / N)) - pondCenter.z))
console.log('pond volume', pond.volume?.toFixed(2), 'inner', pond.inner.toFixed(2), 'farthest cell', farthest.toFixed(2), 'cells', pond.cells.reduce((a, b) => a + b, 0))
const saved = { ...saveSubstrate(state), preset: 'default' }
writeFileSync(new URL('../src/sim/defaultJar.json', import.meta.url), JSON.stringify(saved) + '\n')
console.log('depths', layerDepths(state), 'puddles', puddles(state), 'table', state.table.toFixed(2))
