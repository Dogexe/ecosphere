import test from 'node:test'
import assert from 'node:assert/strict'
import { createHabitatWorld, habitatStarts } from '../src/sim/habitats.ts'
import { createWorld, creatureCounts, intervene, isLand, placementIssue, plantOutlook, stepWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { isAquatic, isPondPosition } from '../src/sim/pond.ts'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('starters preserve the mixed default and establish valid independent communities across seeds', () => {
  for (const seed of [0, 17, 183, 2217, 4294967295]) {
    assert.deepEqual(createHabitatWorld('garden', seed), createWorld(seed))
    for (const { id } of habitatStarts) {
      const world = createHabitatWorld(id, seed)
      assert.deepEqual(world, createHabitatWorld(id, seed))
      assert.equal(world.tick, 0)
      assert.equal(world.grazed, 0)
      assert.equal(creatureCounts(world.creatures).beetle, 0)
      for (const plant of world.plants) {
        assert.ok(isAquatic(plant.kind) ? isPondPosition(plant.x, plant.z) : isLand(plant.x, plant.z))
        assert.equal(placementIssue({ ...world, plants: world.plants.filter((other) => other.id !== plant.id) }, plant.kind, plant.x, plant.z), null)
      }
      for (const creature of world.creatures) {
        assert.ok(isAquatic(creature.kind) ? isPondPosition(creature.x, creature.z) : isLand(creature.x, creature.z))
        assert.equal(placementIssue({ ...world, creatures: world.creatures.filter((other) => other.id !== creature.id) }, creature.kind, creature.x, creature.z), null)
      }
      for (const key of ['water', 'nutrients', 'organic']) near(world[key], world.soil.reduce((sum, patch) => sum + patch[key], 0) / 4)
      const copy = createHabitatWorld(id, seed)
      if (copy.plants.length) copy.plants[0].biomass = 0
      copy.soil[0].water = 0
      if (copy.creatures.length) copy.creatures[0].energy = 0
      assert.ok(world.soil[0].water > 0)
      if (world.plants.length) assert.ok(world.plants[0].biomass > 0)
      if (world.creatures.length) assert.ok(world.creatures[0].energy > 0)
    }
  }
})

test('starter saves use the existing envelope and continue identically without habitat metadata', () => {
  for (const { id } of habitatStarts) {
    const world = advance(createHabitatWorld(id, 183), 48)
    const encoded = serializeSave(world)
    assert.deepEqual(Object.keys(JSON.parse(encoded)).sort(), ['version', 'world'])
    assert.deepEqual(Object.keys(world).sort(), Object.keys(createWorld()).sort())
    assert.deepEqual(advance(parseSave(encoded), 100), advance(world, 100))
  }
})

function commonPlants(water, light, nutrients = 100) {
  const base = createWorld(17)
  return {
    ...base, light, water, nutrients, creatures: [],
    plants: base.plants.slice(0, 4).map((plant, index) => ({ ...plant, kind: ['clover', 'fern', 'bloom', 'moss'][index], biomass: 2, capacity: 8 })),
    soil: base.soil.map((patch) => ({ ...patch, water, nutrients, fungi: 0 })),
  }
}

test('identical plants change their competitive ranking with moisture and light alone', () => {
  const shaded = advance(commonPlants(80, 0.42), 40)
  const sunny = advance(commonPlants(50, 0.92), 40)
  const biomass = (world, kind) => world.plants.find((plant) => plant.kind === kind)?.biomass ?? 0
  assert.ok(biomass(shaded, 'fern') > biomass(shaded, 'bloom'))
  assert.ok(biomass(shaded, 'moss') > biomass(shaded, 'clover'))
  assert.ok(biomass(sunny, 'bloom') > biomass(sunny, 'fern'))
  assert.ok(biomass(sunny, 'clover') > biomass(sunny, 'moss'))
  assert.ok(biomass(shaded, 'moss') > biomass(sunny, 'moss'))
  assert.ok(biomass(sunny, 'bloom') > biomass(shaded, 'bloom'))
})

test('plant outlook uses the actual growth equation and identifies real constraints', () => {
  for (const [water, light, nutrients, factor] of [[3, 0.75, 100, 'water'], [45, 0.18, 100, 'light'], [45, 0.75, 0.1, 'nutrients']]) {
    const base = commonPlants(water, light, nutrients)
    const world = { ...base, plants: [base.plants[0]] }
    const original = structuredClone(world)
    const outlook = plantOutlook(world, world.plants[0])
    assert.equal(outlook.limiting, factor)
    assert.deepEqual(world, original)
    const next = stepWorld(world)
    near(next.plants[0].biomass - world.plants[0].biomass, outlook.change)
  }
  const healthy = commonPlants(45, 0.75)
  assert.ok(plantOutlook(healthy, healthy.plants[0]).change > 0)
  const stressed = commonPlants(3, 0.18)
  assert.ok(plantOutlook(stressed, stressed.plants[0]).change < 0)
})

test('starter food webs diverge under a defined common tending policy without special solver rules', () => {
  for (const seed of [17, 183, 2217]) {
    const run = (id) => {
      let world = createHabitatWorld(id, seed)
      for (let tick = 0; tick < 240; tick += 1) {
        if (world.water < 45) world = intervene(world, { type: 'water' })
        world = stepWorld(world)
      }
      return world
    }
    const woodland = run('woodland')
    const meadow = run('meadow')
    assert.notDeepEqual(woodland.soil.map((patch) => patch.fungi), meadow.soil.map((patch) => patch.fungi))
    assert.ok(meadow.grazed > woodland.grazed * 2)
    assert.ok(meadow.plants.reduce((sum, plant) => sum + plant.biomass, 0) > woodland.plants.reduce((sum, plant) => sum + plant.biomass, 0))
    assert.ok(woodland.creatures.some((creature) => creature.kind === 'woodlouse'))
    assert.deepEqual(woodland, run('woodland'))
    assert.deepEqual(parseSave(serializeSave(meadow)), meadow)
  }
})
