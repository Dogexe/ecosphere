import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { creatureCounts, creatureLimits, intervene, simulateStep } from '../src/sim/ecosystem.ts'
import { isAquatic, isSwimmingPosition } from '../src/sim/pond.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const report = []
for (const habitat of ['garden', 'woodland', 'meadow', 'bare', 'wetland']) for (const seed of [17, 183, 2217]) {
  let world = beginDaylitWorld(createHabitatWorld(habitat, seed))
  const events = { birth: 0, death: 0, mating: 0, predation: 0 }
  for (let elapsed = 0; elapsed < 720; elapsed++) {
    if (world.water < 35) world = intervene(world, { type: 'water' })
    if (elapsed % 96 === 0) world = intervene(world, { type: 'compost' })
    if (habitat === 'wetland' && elapsed % 48 === 0) {
      if (world.pond.water < 40) world = intervene(world, { type: 'pond-water' })
      if (world.pond.nutrients < 6) world = intervene(world, { type: 'pond-nutrients' })
    }
    const result = simulateStep(world)
    if (elapsed % 96 === 0) assert.deepEqual(simulateStep(parseSave(serializeSave(world))), result)
    result.events.forEach((event) => { if (event.type in events) events[event.type]++ })
    world = result.world
    assert.ok(world.plants.length <= 32)
    const counts = creatureCounts(world.creatures)
    for (const [kind, cap] of Object.entries(creatureLimits)) assert.ok(counts[kind] <= cap)
    for (const patch of world.soil) for (const stock of ['water', 'nutrients', 'organic', 'fungi']) assert.ok(Number.isFinite(patch[stock]) && patch[stock] >= 0)
    for (const value of Object.values(world.pond)) assert.ok(Number.isFinite(value) && value >= 0)
    assert.ok(world.pond.oxygen <= world.pond.water + 1e-9)
    for (const plant of world.plants) assert.ok(plant.biomass > 0 && plant.biomass <= plant.capacity)
    for (const animal of world.creatures) {
      assert.ok(animal.energy > 0 && animal.energy <= 100)
      if (isAquatic(animal.kind)) assert.ok(isSwimmingPosition(animal.kind, animal.x, animal.z))
    }
  }
  report.push({ habitat, seed, steps: 720, plants: world.plants.length,
    kinds: [...new Set(world.plants.map((plant) => plant.kind))], animals: creatureCounts(world.creatures), events })
}
writeFileSync('artifacts/recruitment-scenarios.json', JSON.stringify(report, null, 2) + '\n')
console.log({ steps: report.length * 720, events: report.reduce((sum, row) => {
  for (const key in sum) sum[key] += row.events[key]
  return sum
}, { birth: 0, death: 0, mating: 0, predation: 0 }), remaining: report })
