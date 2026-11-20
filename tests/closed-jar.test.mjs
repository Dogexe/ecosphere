import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWorld, simulateStep } from '../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { setPondShape } from '../src/sim/pond.ts'
import { withStarterGarden } from '../src/sim/starterGarden.ts'
import { sealWorld } from '../src/sim/seal.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

/*
 * Closed-jar pass (owner, 2026-11-20: "make the sealed system sustainable and add
 * more kinds of life"). The untouched starter jar, sealed, must keep every kind it
 * started with for three model years. Before this pass the moss was gone in a week,
 * the pond crew in two months and the ants within a year.
 */
function sealedStarter() {
  const jar = JSON.parse(readFileSync(new URL('../src/sim/defaultJar.json', import.meta.url)))
  const world = adoptPouredJar(beginDaylitWorld(createWorld()), jar)
  setPondShape(world.substrate)
  return sealWorld(withStarterGarden(world), 60)
}

test('a sealed starter jar keeps every kind of plant and animal it began with for three years', () => {
  let world = sealedStarter()
  const kinds = new Set([...world.plants.map((plant) => plant.kind), ...world.creatures.map((creature) => creature.kind)])
  assert.ok(kinds.has('springtail') && kinds.has('flea'), 'the starter jar has its micro-fauna')
  let colonyDays = 0
  for (let day = 1; day <= 3 * 365; day += 1) {
    while (world.tick < day * 24 + 8) world = simulateStep(world).world
    if (world.colony?.queen) colonyDays = day
    if (day === 400) assert.deepEqual(parseSave(serializeSave(world)), world, 'resting eggs and seed bank save and load')
  }
  const present = new Set([...world.plants.map((plant) => plant.kind), ...world.creatures.map((creature) => creature.kind)])
  for (const kind of kinds) assert.ok(present.has(kind), `${kind} is still in the jar after three years`)
  assert.ok(colonyDays >= 2 * 365, `the ant colony lasted ${colonyDays} days`)
  assert.ok(world.pond.algae > 0.1 && world.pond.algae < 3, 'the pond neither starves nor turns to green soup')
})
