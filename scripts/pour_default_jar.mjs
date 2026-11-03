// Pours the default jar the same way a player would in the jar builder:
// gravel, a thin charcoal layer, soil heaped into a gentle rise at the back,
// then a light watering that settles the fresh soil. Writes
// src/sim/defaultJar.json, which the paper look uses for every jar that the
// player did not build themselves.
// Run: node --experimental-strip-types scripts/pour_default_jar.mjs
import { writeFileSync } from 'node:fs'
import { deposit, emptySubstrate, layerDepths, puddles, saveSubstrate, settle } from '../src/sim/substrate.ts'
import { pondCenter } from '../src/sim/pondShape.ts'

const state = emptySubstrate()
// A spiral of pour points covering the floor, like moving a scoop around.
const spiral = Array.from({ length: 60 }, (_, i) => { const r = 3.1 * Math.sqrt((i + 0.5) / 60), a = i * 2.39996; return [Math.cos(a) * r, Math.sin(a) * r] })
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
pour('soil', 2.5, 3, spiral, () => depth('soil') >= 2.5)
// Extra soil towards the back, away from the pond, for a slope to plant on.
const away = (x, z) => Math.hypot(x - pondCenter.x, z - pondCenter.z) > pondCenter.radius + 0.6
const back = spiral.filter(([x, z]) => z < -0.6 && away(x, z))
pour('soil', 3.1, 3, back, () => depth('soil') >= 3.1)
for (let pass = 0; pass < 200; pass += 1) settle(state, 6)
// A gentle watering: enough to settle and firm the top, not to leave puddles.
for (let n = 0; n < 700; n += 1) { const [x, z] = spiral[n % spiral.length]; deposit(state, 'water', x, z, 2); settle(state, 4) }
for (let pass = 0; pass < 1500; pass += 1) settle(state, 4)
const saved = saveSubstrate(state)
writeFileSync(new URL('../src/sim/defaultJar.json', import.meta.url), JSON.stringify(saved) + '\n')
console.log('depths', layerDepths(state), 'puddles', puddles(state), 'table', state.table.toFixed(2))
