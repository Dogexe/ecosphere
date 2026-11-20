import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWorld, simulateStep } from '../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { setPondShape } from '../src/sim/pond.ts'
import { withStarterGarden } from '../src/sim/starterGarden.ts'
import { decodeNotebook, emptyNotebook, encodeNotebook } from '../src/sim/notebook.ts'
import { decodeGoals, goals, openGoals, reachGoals, unlockedGlass, unlockedObjects } from '../src/sim/goals.ts'
import { dryingFactor, loadSubstrate, saveSubstrate } from '../src/sim/substrate.ts'

// Field goals and their unlocks (systems pass item 3, 2026-11-20).
function starter() {
  const jar = JSON.parse(readFileSync(new URL('../src/sim/defaultJar.json', import.meta.url)))
  const world = adoptPouredJar(beginDaylitWorld(createWorld()), jar)
  setPondShape(world.substrate)
  return withStarterGarden(world)
}
const run = (world, hours) => { for (let i = 0; i < hours; i++) world = simulateStep(world).world; return world }

test('a new keeper starts with stones and wood, the squat jar, and the first goal open', () => {
  assert.deepEqual(unlockedObjects({}), ['stone', 'log'])
  assert.deepEqual(unlockedGlass({}), ['squat'])
  assert.equal(openGoals({}, 1)[0].id, 'first-week')
  assert.equal(new Set(goals.map((goal) => goal.id)).size, goals.length)
  assert.equal(new Set(goals.map((goal) => goal.unlock.id)).size, goals.length, 'every goal unlocks something different')
})

test('goals are reached from what the notebook saw and the jar did, once each', () => {
  const notebook = { ...emptyNotebook(), found: { pairing: { tick: 5, at: 1, away: false }, flowering: { tick: 9, at: 2, away: false } } }
  const young = starter()
  const first = reachGoals({}, notebook, young, 100)
  assert.deepEqual(first.reached.map((goal) => goal.id), ['pairing', 'flowering'])
  assert.deepEqual(unlockedObjects(first.log), ['stone', 'log', 'shell'])
  assert.deepEqual(unlockedGlass(first.log), ['squat', 'globe'])
  const again = reachGoals(first.log, notebook, young, 200)
  assert.equal(again.log, first.log, 'nothing new: the same log comes back')
  const week = reachGoals(first.log, notebook, { ...young, tick: 7 * 24 }, 300)
  assert.deepEqual(week.reached.map((goal) => goal.id), ['first-week'])
})

test('reached goals are stored with the notebook and survive a round trip; unknown ids are dropped on read', () => {
  const notebook = { ...emptyNotebook(), goals: { 'first-week': { at: 10, tick: 170 }, bogus: { at: 1, tick: 1 } } }
  const back = decodeNotebook(encodeNotebook(notebook))
  assert.deepEqual(back.goals, notebook.goals)
  assert.deepEqual(decodeGoals(back.goals), { 'first-week': { at: 10, tick: 170 } })
})

test('odd objects and the glass shape are saved with the jar, and a bad shape is rejected', () => {
  const jar = starter().substrate
  const state = loadSubstrate({ ...jar, glass: 'globe', decor: [...jar.decor, { kind: 'marble', x: 1, z: 1, size: 0.42, turn: 0 }] })
  const saved = saveSubstrate(state)
  assert.equal(saved.glass, 'globe')
  assert.ok(saved.decor.some((item) => item.kind === 'marble'))
  assert.throws(() => loadSubstrate({ ...jar, glass: 'teapot' }))
  assert.throws(() => loadSubstrate({ ...jar, decor: [{ kind: 'teapot', x: 0, z: 0, size: 1, turn: 0 }] }))
})

test('an open jar with a narrow neck stays damp longer; a wide bowl dries faster', () => {
  assert.ok(dryingFactor('globe') < dryingFactor('apothecary') && dryingFactor('apothecary') < dryingFactor(undefined) && dryingFactor(undefined) < dryingFactor('wide'))
  const base = starter()
  const water = (glass) => run({ ...base, substrate: { ...base.substrate, glass } }, 8 * 24).water
  const squat = water(undefined), globe = water('globe'), wide = water('wide')
  assert.ok(globe > squat + 5, `globe ${globe.toFixed(1)} vs squat ${squat.toFixed(1)}`)
  assert.ok(wide < squat, `wide ${wide.toFixed(1)} vs squat ${squat.toFixed(1)}`)
})
