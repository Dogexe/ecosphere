import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { applySoilInput, introduceLife, simulateStep } from '../src/sim/ecosystem.ts'
import { antMaterialError, introduceColony, seedMaterialAvailable } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const horizon = Number(process.argv[3] ?? 1440)
if (!Number.isInteger(horizon) || horizon < 1 || horizon > 10000) throw new Error('Choose a horizon between 1 and 10000 model hours.')
const rows = []
for (const seed of [17, 183, 2217]) for (const site of [[1.7, 1.7], [0.7, -1.7]]) for (const fertility of [false, true]) {
  let world = beginDaylitWorld(createHabitatWorld('bare', seed))
  for (const [dx, dz, kind] of [[-0.6, 0, 'clover'], [0.6, 0, 'grass'], [0, -0.6, 'clover'], [0, 0.6, 'grass']]) world = introduceLife(world, kind, site[0] + dx, site[1] + dz)
  assert.equal(world.plants.length, 4)
  // Explicitly imported established plants, never free within-step growth.
  world = { ...world, plants: world.plants.map((plant) => ({ ...plant, age: 90, development: 90, biomass: plant.capacity * 0.82 })) }
  world = introduceColony(world, ...site)
  let death = null, maxError = 0, noFood = 0, urgentLoadedStocked = 0, fedDeparture = 0
  const fedDepartureExamples = []
  const counts = {}, samples = [], milestones = [], urgentExamples = [], inputs = { water: 0, nutrients: 0 }
  let windowHarvest = 0, windowQueenMeals = 0
  for (let i = 0; i < horizon; i++) {
    if (i % 24 === 0) for (const patch of world.soil) {
      const input = { water: patch.water < 40 ? 18 : 0, nutrients: fertility && patch.nutrients < 45 ? 12 : 0, organic: 0 }
      if (input.water || input.nutrients) {
        const result = applySoilInput(world, input, patch.id)
        world = result.world; inputs.water += result.receipt.water; inputs.nutrients += result.receipt.nutrients
      }
    }
    const before = world, queen = before.colony.queen
    if (queen && queen.energy < 35 && queen.gut < 0.004 && before.colony.food > 0.002) for (const ant of before.colony.workers) {
      if (ant.location.kind === 'nest' && ant.activity !== 'nursing' && ant.carried > 0 && ant.stage === 'adult' && ant.energy >= 35 && ant.hydration >= 35) {
        urgentLoadedStocked++
        if (urgentExamples.length < 3) urgentExamples.push({ tick: before.tick, ant: ant.id, carried: ant.carried, queenReserve: queen.energy, food: before.colony.food })
      }
    }
    const result = simulateStep(world)
    world = result.world
    for (const ant of before.colony.workers) {
      const granary = before.colony.nodes.find((node) => node.role === 'food').id
      const next = world.colony.workers.find((item) => item.id === ant.id)
      if (ant.energy < 35 && ant.gut > 0.004 && ant.carried === 0 && ant.location.kind === 'nest' && ant.location.from === granary && ant.location.to === granary && next?.activity === 'foraging') {
        fedDeparture++
        if (fedDepartureExamples.length < 3) fedDepartureExamples.push({ tick: before.tick, id: ant.id, energy: ant.energy, gut: ant.gut, stores: before.colony.food, nextEnergy: next.energy })
      }
    }
    for (const event of result.events) if (event.type === 'ant') {
      counts[event.action] = (counts[event.action] ?? 0) + 1
      if (event.action === 'harvest') windowHarvest += event.amount
      if (event.action === 'feeding' && event.id === 0) windowQueenMeals += event.amount
      if (['egg', 'birth', 'death'].includes(event.action)) milestones.push({ tick: world.tick, action: event.action, id: event.id, queenReserve: world.colony.queen?.energy, workers: world.colony.workers.length, food: world.colony.food })
    }
    const sources = world.plants.reduce((sum, plant) => sum + seedMaterialAvailable(plant), 0)
    if (!sources) noFood++
    if (!world.colony.queen && death === null) death = { tick: world.tick, sources, food: before.colony.food, queenReserve: before.colony.queen?.energy }
    maxError = Math.max(maxError, Math.abs(antMaterialError(world.colony)))
    if (i % 120 === 0) {
      assert.deepEqual(simulateStep(parseSave(serializeSave(world))), simulateStep(world))
      samples.push({ tick: world.tick, food: world.colony.food, queenReserve: world.colony.queen?.energy, queenGut: world.colony.queen?.gut, workers: world.colony.workers.length, plants: world.plants.length, sources,
        water: world.water, nutrients: world.nutrients, queenAge: world.colony.queen?.age, workerAges: world.colony.workers.map((ant) => ant.age), brood: world.colony.brood.map((cohort) => [cohort.stage, cohort.material]),
        nearbyStock: world.plants.filter((plant) => Math.hypot(plant.x - site[0], plant.z - site[1]) <= 2.8).reduce((sum, plant) => sum + seedMaterialAvailable(plant), 0),
        workerStates: world.colony.workers.map(({ id, activity, location, energy, hydration, carried, gut }) => ({ id, activity, location: location.kind, energy, hydration, carried, gut })), windowHarvest, windowQueenMeals })
      windowHarvest = 0; windowQueenMeals = 0
    }
  }
  rows.push({ seed, site, fertility, counts, death, maxError, inputs, noFood, urgentLoadedStocked, urgentExamples, fedDeparture, fedDepartureExamples, workers: world.colony.workers.length, queen: !!world.colony.queen, milestones, samples })
}
const name = process.argv[2] ?? 'current'
writeFileSync(`artifacts/ant-food-capacity-${name}.json`, JSON.stringify(rows, null, 2))
console.log(rows.map(({ seed, site, fertility, counts, death, inputs, noFood, workers, queen }) => ({ seed, site, fertility, harvest: counts.harvest, births: counts.birth, death: death?.tick, inputs, noFood, workers, queen })))
