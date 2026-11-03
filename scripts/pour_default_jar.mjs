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
pour('gravel', 1.6, 3, spiral, () => depth('gravel') >= 1.6)
pour('charcoal', 0.25, 1, spiral, () => depth('charcoal') >= 0.25)
pour('soil', 2.75, 3, spiral, () => depth('soil') >= 2.75)
// Extra soil towards the back, away from the pond, for a slope to plant on.
const away = (x, z) => Math.hypot(x - pondCenter.x, z - pondCenter.z) > pondCenter.radius + 0.6
const back = spiral.filter(([x, z]) => z < -0.4 && x > -0.2 && away(x, z))
pour('soil', 3.0, 3, back, () => depth('soil') >= 3.0)
// And a little along the front glass, so the pond keeps to its hollow instead of reaching the glass.
const front = spiral.filter(([x, z]) => z > 1.6 && Math.hypot(x - pondCenter.x, z - pondCenter.z) > pondCenter.radius + 0.35)
pour('soil', 3.15, 3, front, () => depth('soil') >= 3.15)
for (let pass = 0; pass < 200; pass += 1) settle(state, 6)
// Top up the low spots, as you would by eye before planting, so water only stands where the pond is dug.
const tops = () => { const t = []; for (let k = 0; k < substrateSize ** 2; k += 1) if (inside[k]) t.push([k, state.gravel[k] + state.charcoal[k] + state.soil[k]]); return t }
for (let round = 0; round < 3000; round += 1) {
  const all = tops(), mean = all.reduce((sum, [, top]) => sum + top, 0) / all.length
  const [k, low] = all.reduce((best, item) => item[1] < best[1] ? item : best)
  if (low > mean - 0.15) break
  deposit(state, 'soil', cellX(k % substrateSize), cellX(Math.floor(k / substrateSize)), 1)
  settle(state, 4)
}
// Scoop a hollow for the pond, a little uneven like a hand would leave it, and
// spread the scooped soil over the rest. The soil then slumps to its own angle.
const N = substrateSize
const reach = (angle) => 1.22 + 0.14 * Math.sin(2 * angle + 1) + 0.08 * Math.sin(3 * angle + 2.2) + 0.05 * Math.sin(5 * angle + 0.4)
let scooped = 0
for (let k = 0; k < N * N; k += 1) {
  if (!inside[k]) continue
  const dx = cellX(k % N) - pondCenter.x, dz = cellX(Math.floor(k / N)) - pondCenter.z
  const t = 1 - Math.hypot(dx, dz) / reach(Math.atan2(dz, dx))
  if (t <= 0) continue
  const take = Math.min(state.soil[k] - 0.4, 1.6 * Math.min(1, t * 2.2) ** 1.4)
  state.soil[k] -= take; scooped += take
}
// Most of it banks up around the hollow, the way soil piles beside a hole you dig.
const rim = Array.from({ length: 48 }, (_, n) => { const a = n / 48 * Math.PI * 2, r = reach(a) + 0.45; return [pondCenter.x + Math.cos(a) * r, pondCenter.z + Math.sin(a) * r] }).filter(([x, z]) => Math.hypot(x, z) < 3.4)
for (let n = 0; n < 240; n += 1) { const [x, z] = rim[n % rim.length]; deposit(state, 'soil', x, z, scooped / 240) }
for (let pass = 0; pass < 300; pass += 1) settle(state, 6)
// A gentle watering: enough to settle and firm the top, not to leave puddles.
for (let n = 0; n < 700; n += 1) { const [x, z] = spiral[n % spiral.length]; deposit(state, 'water', x, z, 2); settle(state, 4) }
for (let pass = 0; pass < 1500; pass += 1) settle(state, 4)
// Fill the hollow: water poured at its middle runs out to the shore by itself.
// It only stays once the soil under it and the gravel below are full, as in a
// real jar, so keep pouring and waiting until the pond holds its size.
const shape = () => maskShape(saveSubstrate(state))
for (let round = 0; round < 1500; round += 1) {
  const batch = state.table < 1.5 ? 40 : 12
  for (let n = 0; n < batch; n += 1) { deposit(state, 'water', pondCenter.x + Math.sin(n) * 0.3, pondCenter.z + Math.cos(n * 1.7) * 0.3, 2); settle(state, 2) }
  for (let pass = 0; pass < 150; pass += 1) settle(state, 2)
  const volume = shape().volume ?? 0
  if (round % 50 === 0) console.log('round', round, 'pond volume', volume.toFixed(2), 'table', state.table.toFixed(2))
  if (volume > 3.2) break
}
const pond = shape()
let farthest = 0
for (let k = 0; k < N * N; k += 1) if (pond.cells[k]) farthest = Math.max(farthest, Math.hypot(cellX(k % N) - pondCenter.x, cellX(Math.floor(k / N)) - pondCenter.z))
console.log('pond volume', pond.volume?.toFixed(2), 'inner', pond.inner.toFixed(2), 'farthest cell', farthest.toFixed(2), 'cells', pond.cells.reduce((a, b) => a + b, 0))
const saved = { ...saveSubstrate(state), preset: 'default' }
writeFileSync(new URL('../src/sim/defaultJar.json', import.meta.url), JSON.stringify(saved) + '\n')
console.log('depths', layerDepths(state), 'puddles', puddles(state), 'table', state.table.toFixed(2))
