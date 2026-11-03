import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, introduceLife, plantOutlook, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { plantStage } from '../src/sim/life.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const kinds = ['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed']
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
function start(kind, seed = 2217) {
  let world = createWorld(seed)
  world = beginDaylitWorld({ ...world, plants: [], creatures: [],
    light: kind === 'fern' || kind === 'moss' ? 0.42 : 0.85,
    climate: { temperatureC: 22, rainfall: 0.55 },
    pond: { ...world.pond, water: 85, nutrients: 30 },
    soil: world.soil.map((patch) => ({ ...patch, water: 65, nutrients: 80, organic: 0, fungi: 0 })) })
  return introduceLife(world, kind, kind === 'lily' || kind === 'reed' ? -1.1 : 1.7, kind === 'lily' || kind === 'reed' ? 0.72 : 1.7)
}

test('each funded nursery propagule can establish through repeated nights under suitable conditions', () => {
  for (const kind of kinds) for (const seed of [17, 183, 2217]) {
    const initial = start(kind, seed)
    let world = initial
    const id = initial.plants[0].id
    for (let elapsed = 0; elapsed < 168; elapsed++) {
      const parent = world.plants.find((plant) => plant.id === id)
      assert.ok(parent, `${kind} seed${seed} died after${elapsed}h`)
      const next = simulateStep(world)
      assert.ok(!next.events.some((event) => event.type === 'death' && event.id === id))
      if (elapsed % 24 === 0) assert.deepEqual(simulateStep(parseSave(serializeSave(world))), next)
      world = next.world
    }
    const grown = world.plants.find((plant) => plant.id === id)
    assert.ok(grown.biomass > initial.plants[0].biomass * 2, `${kind} failed to accumulate biomass`)
    assert.ok(['growing', 'mature'].includes(plantStage(grown)), `${kind} did not establish`)
    assert.equal(initial.plants[0].biomass, 0.55)
    assert.equal(initial.plants[0].development, 0)
  }
})

test('nighttime seedling upkeep is paid from existing mass and returned locally, with no root uptake', () => {
  const initial = start('clover')
  const plant = { ...initial.plants[0], development: 12, age: 12 }
  const world = { ...initial, tick: 20, climate: { ...initial.climate, rainfall: 0 }, plants: [plant] }
  const outlook = plantOutlook(world, plant)
  const established = { ...plant, biomass: plant.capacity * 0.22 }
  const fullCost = plantOutlook({ ...world, plants: [established] }, established).loss
  near(outlook.loss / fullCost, plant.biomass / (plant.capacity * 0.22))
  assert.ok(outlook.loss > 0)
  assert.equal(outlook.growth, 0)
  const next = stepWorld(world)
  near(plant.biomass - next.plants[0].biomass, outlook.loss)
  near(next.soil[3].organic, outlook.loss * 0.42)
  near(next.soil[3].nutrients, world.soil[3].nutrients)
  near(next.pond.nutrients, stepWorld({ ...world, plants: [] }).pond.nutrients)
})

test('shade tolerance cannot create photosynthetic growth at zero incident light', () => {
  for (const kind of kinds) for (const cycling of [false, true]) {
    let world = start(kind)
    world = { ...world, tick: 12, light: 0, climate: { ...world.climate, photoperiod: cycling },
      plants: [{ ...world.plants[0], age: 90, development: 90, biomass: world.plants[0].capacity * 0.8 }] }
    const outlook = plantOutlook(world, world.plants[0])
    assert.equal(outlook.growth, 0, `${kind} grew with zero light`)
    assert.equal(outlook.fit, 0)
    assert.equal(outlook.limiting, 'light')
    assert.ok(stepWorld(world).plants[0].biomass < world.plants[0].biomass)
  }
})

test('lack of water or nutrients still prevents seedling establishment and death returns residual material', () => {
  for (const kind of ['clover', 'fern', 'moss', 'lily', 'reed']) {
    let world = start(kind)
    world = { ...world, climate: { ...world.climate, rainfall: 0 },
      soil: world.soil.map((patch) => ({ ...patch, water: 0, nutrients: 0 })),
      pond: { ...world.pond, water: 0, nutrients: 0, organic: 0, algae: 0, oxygen: 0 } }
    let died = false
    for (let elapsed = 0; elapsed < 168; elapsed++) {
      const result = simulateStep(world)
      died ||= result.events.some((event) => event.type === 'death' && event.id === world.plants[0]?.id)
      world = result.world
    }
    assert.equal(world.plants.length, 0, `${kind} established without water`)
    assert.ok(died)
    assert.ok(world.remains.length > 0)
  }
})
