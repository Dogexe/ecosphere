import test from 'node:test'
import assert from 'node:assert/strict'
import { applySoilInput, createWorld, intervene, interveneAt, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
const total = (world, key) => world.soil.reduce((sum, patch) => sum + patch[key], 0)
const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('mixed inputs transfer only requested stocks into the selected pocket without mutation', () => {
  const world = createWorld()
  const original = structuredClone(world)
  const input = { water: 8, organic: 7, nutrients: 6 }
  const result = applySoilInput(world, input, 2)
  assert.deepEqual(world, original)
  assert.deepEqual(result.receipt, { ...input, waterOutflow: 0 })
  for (const key of ['water', 'organic', 'nutrients']) {
    near(total(result.world, key) - total(world, key), input[key])
    near(result.world[key] - world[key], input[key] / 4)
  }
  for (const patch of world.soil) if (patch.id !== 2) assert.equal(result.world.soil.find((next) => next.id === patch.id), patch)
  assert.deepEqual(result.world.plants, world.plants)
  assert.deepEqual(result.world.creatures, world.creatures)
  assert.equal(result.world.tick, world.tick)
  assert.equal(result.world.seed, world.seed)
})

test('global doses account for all four imports, retained water and explicit outflow', () => {
  const base = createWorld()
  const soil = base.soil.map((patch, index) => ({ ...patch, water: [99, 100, 95.5, 70][index] }))
  const world = { ...base, soil, water: total({ soil }, 'water') / 4 }
  const dose = { water: 18, organic: 16, nutrients: 10 }
  const { world: next, receipt } = applySoilInput(world, dose)
  near(receipt.water, 23.5)
  near(receipt.water + receipt.waterOutflow, 4 * dose.water)
  near(total(next, 'water') - total(world, 'water'), receipt.water)
  near(total(next, 'organic') - total(world, 'organic'), receipt.organic)
  near(total(next, 'nutrients') - total(world, 'nutrients'), receipt.nutrients)
  near(receipt.organic, 64)
  near(receipt.nutrients, 40)
  assert.ok(next.soil.every((patch) => patch.water <= 100))
  const local = applySoilInput(world, dose, 0)
  near(local.receipt.water, 1)
  near(local.receipt.waterOutflow, 17)
  assert.equal(local.world.soil[1], world.soil[1])
})

test('invalid or empty recipes and invalid targets are immutable no-ops', () => {
  const world = createWorld()
  for (const input of [null, {}, { water: '8', organic: 0, nutrients: 0 }, ...[-1, 21, NaN, Infinity].map((water) => ({ water, organic: 0, nutrients: 0 })), { water: 0, organic: 0, nutrients: 0 }]) {
    const result = applySoilInput(world, input)
    assert.equal(result.world, world)
    assert.deepEqual(result.receipt, { water: 0, organic: 0, nutrients: 0, waterOutflow: 0 })
  }
  for (const id of [-1, 99, NaN, '0']) assert.equal(applySoilInput(world, { water: 8, organic: 8, nutrients: 1 }, id).world, world)
})

test('existing quick actions retain their exact global and local doses', () => {
  const world = createWorld()
  assert.deepEqual(intervene(world, { type: 'water' }), applySoilInput(world, { water: 18, organic: 0, nutrients: 0 }).world)
  assert.deepEqual(intervene(world, { type: 'compost' }), applySoilInput(world, { water: 0, organic: 16, nutrients: 0 }).world)
  for (let id = 0; id < 4; id += 1) {
    assert.deepEqual(interveneAt(world, 'water', id), applySoilInput(world, { water: 18, organic: 0, nutrients: 0 }, id).world)
    assert.deepEqual(interveneAt(world, 'compost', id), applySoilInput(world, { water: 0, organic: 16, nutrients: 0 }, id).world)
  }
})

function depleted() {
  const base = createWorld(17)
  return { ...base, plants: [], creatures: [], water: 72, organic: 0, nutrients: 0, soil: base.soil.map((patch) => ({ ...patch, water: 72, organic: 0, nutrients: 0, fungi: 2 })) }
}

test('organic substrate feeds decomposition; mineral imports do not create fungal food', () => {
  const base = depleted()
  const organic = applySoilInput(base, { water: 0, organic: 16, nutrients: 0 }).world
  const mineral = applySoilInput(base, { water: 0, organic: 0, nutrients: 10 }).world
  assert.equal(organic.nutrients, 0)
  assert.equal(mineral.nutrients, 10)
  const decomposed = stepWorld(organic)
  const unfed = stepWorld(mineral)
  assert.ok(decomposed.nutrients > organic.nutrients)
  assert.ok(total(decomposed, 'fungi') > total(unfed, 'fungi'))
  assert.equal(decomposed.creatures.length, 0)
  assert.equal(decomposed.plants.length, 0)
  assert.equal(unfed.creatures.length, 0)
  assert.equal(unfed.plants.length, 0)
})

test('nutrients help nutrient-limited plants directly while litter supplies detritivore meals', () => {
  const base = depleted()
  const plant = { id: 0, kind: 'clover', x: 1.7, z: -1.7, biomass: 2, capacity: 8.8 }
  const bare = { ...base, plants: [plant], soil: base.soil.map((patch) => ({ ...patch, fungi: 0 })) }
  const fertilized = applySoilInput(bare, { water: 0, organic: 0, nutrients: 10 }).world
  assert.ok(stepWorld(fertilized).plants[0].biomass > stepWorld(bare).plants[0].biomass)
  const animal = { id: 0, kind: 'woodlouse', x: 1.7, z: -1.7, energy: 40, heading: 0 }
  const consumers = { ...bare, plants: [], creatures: [animal] }
  const litter = advance(applySoilInput(consumers, { water: 0, organic: 16, nutrients: 0 }).world, 30)
  const minerals = advance(applySoilInput(consumers, { water: 0, organic: 0, nutrients: 10 }).world, 30)
  assert.ok(litter.creatures[0].energy > minerals.creatures[0].energy + 15)
  assert.ok(litter.nutrients > consumers.nutrients)
})

test('mixture sequences and snapshot continuation preserve deterministic world-only state', () => {
  const run = () => {
    let world = createWorld(183)
    for (let tick = 0; tick < 180; tick += 1) {
      if (tick % 31 === 0) world = applySoilInput(world, { water: 12, organic: 5, nutrients: 3 }, tick % 4).world
      world = stepWorld(world)
    }
    return world
  }
  const world = run()
  assert.deepEqual(world, run())
  assert.deepEqual(Object.keys(world).sort(), Object.keys(createWorld()).sort())
  assert.deepEqual(simulateStep(world), simulateStep(parseSave(serializeSave(world))))
})
