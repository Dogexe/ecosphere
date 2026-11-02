import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { simulateStep, interveneAt } from '../src/sim/ecosystem.ts'
import { antMaterialError, antPosition, introduceColony, seedMaterialAvailable } from '../src/sim/colony.ts'

const rows = []
for (const site of [[1.7, 1.7], [-1.7, -1.7], [0.7, -1.7]]) {
  let world = beginDaylitWorld(createHabitatWorld('meadow', 2217))
  world = { ...world, creatures: world.creatures.filter((animal) => animal.kind !== 'grazer') }
  world = introduceColony(world, ...site)
  let bounce = 0, maxError = 0, queenDeath = null
  const counts = {}, examples = [], samples = []
  for (let i = 0; i < 1440; i++) {
    if (i % 48 === 0) for (const patch of world.soil) {
      if (patch.water < 40) world = interveneAt(world, 'water', patch.id)
      if (patch.nutrients < 20) world = interveneAt(world, 'compost', patch.id)
    }
    const before = world, result = simulateStep(world)
    world = result.world
    for (const event of result.events) if (event.type === 'ant') counts[event.action] = (counts[event.action] ?? 0) + 1
    for (const ant of before.colony.workers) {
      const next = world.colony.workers.find((item) => item.id === ant.id)
      if (before.colony.food <= 0.002 && ant.carried === 0 && ant.energy > 25 && ant.location.kind === 'surface' && next?.activity === 'entering') {
        bounce++
        if (examples.length < 4) examples.push({ tick: before.tick, worker: ant.id, position: antPosition(before.colony, ant), queen: before.colony.queen?.energy, food: before.colony.food, age: ant.age })
      }
    }
    if (!world.colony.queen && !queenDeath) queenDeath = { tick: world.tick, priorReserve: before.colony.queen?.energy, priorHydration: before.colony.queen?.hydration, food: before.colony.food,
      available: before.plants.reduce((sum, plant) => sum + seedMaterialAvailable(plant), 0), workers: before.colony.workers.map((ant) => ({ id: ant.id, reserve: ant.energy, activity: ant.activity, carried: ant.carried, gut: ant.gut, location: ant.location })) }
    maxError = Math.max(maxError, Math.abs(antMaterialError(world.colony)))
    if (i % 120 === 0) samples.push({ tick: world.tick, queen: world.colony.queen?.energy, workers: world.colony.workers.length, food: world.colony.food,
      sources: world.plants.reduce((sum, plant) => sum + seedMaterialAvailable(plant), 0) })
  }
  rows.push({ site, bounce, examples, queenDeath, counts, maxError, workers: world.colony.workers.length, samples })
}
const name = process.argv[2] ?? 'current'
writeFileSync(`artifacts/ant-empty-care-${name}.json`, JSON.stringify(rows, null, 2))
console.log(rows.map(({ site, bounce, queenDeath, counts, maxError, workers }) => ({ site, bounce, queenDeath: queenDeath?.tick, counts, maxError, workers })))
