import test from 'node:test'
import assert from 'node:assert/strict'
import { cellX, deposit, puddles, runoff, emptySubstrate, heightAt, holding, index, inside, layerDepths, loadSubstrate, pocketWetness, saveSubstrate, settle, settling, soak, substrateCell, substrateSize, topAt } from '../src/sim/substrate.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { stepWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const centre = index((substrateSize - 1) / 2 | 0, (substrateSize - 1) / 2 | 0)
const total = (state, layer) => state[layer].reduce((sum, value) => sum + value, 0)

/** Pour one heap at the centre and let it relax; returns the steepest slope near the top in degrees. */
function heap(material, prepare = () => {}, amount = 3) {
  const state = emptySubstrate()
  for (let pour = 0; pour < 60; pour += 1) { deposit(state, material, 0, 0, amount / 6); prepare(state); settle(state, 20) }
  for (let pass = 0; pass < 200; pass += 1) settle(state, 20)
  const c = (substrateSize - 1) / 2 | 0
  // The flank: compare heights two and five cells out from the peak.
  const slope = (topAt(state, index(c + 2, c)) - topAt(state, index(c + 5, c))) / (3 * substrateCell)
  return { state, angle: Math.atan(slope) * 180 / Math.PI }
}

test('a dry soil heap stands at loose earth angle and conserves every grain', () => {
  const { state, angle } = heap('soil')
  assert.ok(angle > 22 && angle < 32, `dry soil ${angle.toFixed(1)}°`)
  assert.ok(Math.abs(total(state, 'soil') - 30) < 1e-3)
})

test('gravel stands steeper than dry soil; charcoal near the coal range', () => {
  assert.ok(heap('gravel').angle > heap('soil').angle + 5)
  const charcoal = heap('charcoal').angle
  assert.ok(charcoal > 22 && charcoal < 32)
})

test('a little water lets soil hold a steeper heap; soaked soil runs flat like mud', () => {
  const damp = heap('soil', (state) => { for (let k = 0; k < state.soil.length; k += 1) state.water[k] = state.soil[k] * holding * 0.3 }).angle
  const mud = heap('soil', (state) => { for (let k = 0; k < state.soil.length; k += 1) state.water[k] = state.soil[k] * holding }).angle
  const dry = heap('soil').angle
  assert.ok(damp > dry + 8, `damp ${damp.toFixed(1)}° vs dry ${dry.toFixed(1)}°`)
  assert.ok(mud < dry, `mud ${mud.toFixed(1)}° vs dry ${dry.toFixed(1)}°`)
})

test('watering fresh soil settles it once: it sinks and firms, then stays put', () => {
  const state = emptySubstrate()
  for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) { state.soil[k] = 2.9; state.loose[k] = 1 }
  const wetting = () => { for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) soak(state, k, state.soil[k] * holding) }
  wetting(); wetting()
  const after = layerDepths(state)
  assert.ok(after.loose < 0.05)
  assert.ok(after.soil < 2.9 && after.soil > 2.9 * (1 - settling) - 1e-6)
  const settled = after.soil
  wetting()
  assert.ok(settled - layerDepths(state).soil < 1e-3)
})

test('firm soil holds a cut the loose soil could not', () => {
  const state = emptySubstrate()
  const c = (substrateSize - 1) / 2 | 0
  for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) { state.soil[k] = cellX(k % substrateSize) < 0 ? 3 : 1; state.water[k] = state.soil[k] * holding * 0.5; state.loose[k] = 0 }
  const before = topAt(state, index(c - 1, c))
  settle(state, 30)
  assert.equal(topAt(state, index(c - 1, c)), before)
  for (let k = 0; k < state.loose.length; k += 1) state.loose[k] = 1
  settle(state, 30)
  assert.ok(topAt(state, index(c - 1, c)) < before)
})

test('water the soil cannot hold drains into the gravel', () => {
  const state = emptySubstrate()
  for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) { state.gravel[k] = 1.6; state.soil[k] = 1 }
  for (let pour = 0; pour < 400; pour += 1) { deposit(state, 'water', 0, 0, 2); settle(state) }
  for (let pass = 0; pass < 600; pass += 1) settle(state)
  assert.ok(state.table > 0)
  assert.ok(pocketWetness(state).every((value) => value >= 0 && value <= 100))
})

const filled = () => {
  const state = emptySubstrate()
  for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) { state.gravel[k] = 1.6; state.soil[k] = 2; state.loose[k] = 0 }
  return state
}
const water = (state) => state.water.reduce((a, b) => a + b, 0) + state.pool.reduce((a, b) => a + b, 0) + state.table * inside.reduce((a, b) => a + b, 0) * 0.35

test('pouring faster than the soil drinks leaves a puddle that then soaks in', () => {
  const state = filled()
  for (let pour = 0; pour < 30; pour += 1) { deposit(state, 'water', 0, 0, 3); settle(state) }
  assert.ok(puddles(state).depth > 0.01, 'a puddle while pouring')
  for (let pass = 0; pass < 2000; pass += 1) settle(state)
  assert.ok(puddles(state).depth < 1e-3, 'soaked in once the pouring stops')
  assert.ok(Math.abs(water(state) - 90) < 0.5, `no water lost: ${water(state).toFixed(2)}`)
})

test('standing water runs downhill and collects in the hollow', () => {
  const state = filled()
  const c = (substrateSize - 1) / 2 | 0
  // A bowl: soil thinner towards the middle.
  for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) { const i = k % substrateSize, j = (k / substrateSize) | 0; state.soil[k] = 1 + Math.hypot(i - c, j - c) * 0.05; state.water[k] = state.soil[k] * 0.5 }
  state.table = 1.6 // gravel already full: nowhere to drain
  for (let k = 0; k < state.pool.length; k += 1) if (inside[k]) state.pool[k] = 0.05
  for (let pass = 0; pass < 400; pass += 1) runoff(state)
  assert.ok(state.pool[index(c, c)] > 0.3, `deep in the hollow: ${state.pool[index(c, c)].toFixed(2)}`)
  assert.ok(state.pool[index(c + 14, c)] <= 0.031, 'only a film left on the rim')
})

test('once the gravel is full, more water floods the surface instead of vanishing', () => {
  const state = filled()
  for (let pour = 0; pour < 1500; pour += 1) { deposit(state, 'water', Math.sin(pour) * 2, Math.cos(pour * 1.3) * 2, 3); settle(state) }
  for (let pass = 0; pass < 3000; pass += 1) settle(state)
  assert.ok(Math.abs(state.table - 1.6) < 0.01, `gravel full: ${state.table.toFixed(2)}`)
  assert.ok(puddles(state).cover > 0.9, `flooded: ${puddles(state).cover.toFixed(2)}`)
  assert.ok(Math.abs(water(state) - 4500) < 2, `no water lost: ${water(state).toFixed(1)}`)
})

test('a built substrate saves with the world, survives the round trip and stays out of the ecology', () => {
  const state = emptySubstrate()
  for (let k = 0; k < state.soil.length; k += 1) if (inside[k]) { state.gravel[k] = 1.6; state.charcoal[k] = 0.25; state.soil[k] = 2.9; state.loose[k] = 0.4 }
  deposit(state, 'soil', 1, -1, 2); settle(state)
  state.decor.push({ kind: 'stone', x: 2, z: -1, size: 1.2, turn: 0.5 })
  state.pool[index(20, 20)] = 0.3
  const world = { ...createHabitatWorld('bare', 3), substrate: saveSubstrate(state) }
  const text = serializeSave(world)
  assert.ok(text.length < 200_000)
  const loaded = parseSave(text)
  assert.deepEqual(loaded.substrate, world.substrate)
  assert.deepEqual(parseSave(serializeSave(loaded)), loaded)
  assert.ok(Math.abs(heightAt(loadSubstrate(loaded.substrate), 1, -1) - heightAt(state, 1, -1)) < 0.02)
  // The shape is scenery for now: the same world steps the same with or without it.
  const { substrate: _, ...plain } = stepWorld(world)
  assert.deepEqual(plain, stepWorld(createHabitatWorld('bare', 3)))
  assert.deepEqual(stepWorld(world).substrate, world.substrate)
})

test('damaged substrates are rejected', () => {
  const good = saveSubstrate(emptySubstrate())
  for (const bad of [{ ...good, size: 12 }, { ...good, soil: good.soil.slice(1) }, { ...good, soil: good.soil.map(() => -1) }, { ...good, loose: good.loose.map(() => 2) }, { ...good, decor: [{ kind: 'castle', x: 0, z: 0, size: 1, turn: 0 }] }, { ...good, table: Number.NaN }, { ...good, pool: good.soil.map(() => -0.5) }]) {
    const world = { ...createHabitatWorld('bare', 3), substrate: bad }
    assert.throws(() => parseSave(serializeSave(world)))
  }
})
