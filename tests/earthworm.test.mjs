import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, introduceLife, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { hatchRestingEggs, layRestingEggs } from '../src/sim/dormancy.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

/*
 * Earthworms (owner's pick, 2026-11-21): red wigglers eat damp litter, return minerals in their
 * casts, need a second adult to lay cocoons, and breathe through moist skin.
 */
function soilWorld({ water = 70, organic = 6, worms = [] } = {}) {
  const base = createWorld(17)
  let world = { ...base, plants: [], creatures: [], soil: base.soil.map((patch) => ({ ...patch, water, organic, nutrients: 10, fungi: 0 })) }
  for (const [x, z] of worms) world = introduceLife(world, 'worm', x, z)
  return world
}
const run = (world, hours) => { const events = []; for (let i = 0; i < hours; i += 1) { const step = simulateStep(world); world = step.world; events.push(...step.events) } return { world, events } }
const total = (world, key) => world.soil.reduce((sum, patch) => sum + patch[key], 0)

test('an earthworm eats damp litter and returns its minerals as casts', () => {
  const start = soilWorld({ worms: [[-1.5, -1]] })
  assert.equal(start.creatures.length, 1)
  const withWorm = run(start, 96)
  const without = run(soilWorld(), 96)
  assert.ok(withWorm.events.some((event) => event.type === 'feeding' && event.kind === 'worm' && event.source === 'litter'))
  assert.ok(total(withWorm.world, 'nutrients') > total(without.world, 'nutrients'), 'casts make more nutrients available than litter left alone')
  assert.ok(total(withWorm.world, 'organic') < total(without.world, 'organic'))
  assert.deepEqual(parseSave(serializeSave(withWorm.world)), withWorm.world)
})

test('a lone worm lays no cocoons; a pair breeds in litter-rich soil', () => {
  const births = (world) => run(world, 24 * 20).events.filter((event) => event.type === 'birth' && event.kind === 'worm' && event.parentId >= 0).length
  assert.equal(births(soilWorld({ worms: [[-1.5, -1]] })), 0)
  assert.ok(births(soilWorld({ worms: [[-1.5, -1], [1.2, -1.4]] })) > 0)
})

test('dry soil kills a worm, and the cocoons it left hatch once the soil is damp again', () => {
  const { world, events } = run(soilWorld({ water: 4, worms: [[-1.5, -1]] }), 24 * 6)
  const death = events.find((event) => event.type === 'death' && event.kind === 'worm')
  assert.ok(death, 'the worm dies in dry soil')
  assert.equal(death.reason, 'desiccation')
  const bank = layRestingEggs(undefined, [death])
  assert.equal(bank.worm, 1)
  const dry = { ...world, dormant: bank, tick: 24 * 7 + 12 }
  assert.equal(hatchRestingEggs(dry).events.length, 0, 'no hatching in dry soil')
  const damp = { ...dry, soil: dry.soil.map((patch) => ({ ...patch, water: 70, organic: 4 })) }
  const hatched = hatchRestingEggs(damp)
  assert.equal(hatched.events[0]?.kind, 'worm')
  assert.ok(Math.abs(total(damp, 'organic') - total(hatched.world, 'organic') - 0.3) < 1e-9, 'the hatchling is paid from the litter')
  assert.equal(stepWorld(hatched.world).creatures.filter((creature) => creature.kind === 'worm').length, 1)
})
