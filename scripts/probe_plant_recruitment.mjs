import { writeFileSync } from 'node:fs'
import { createWorld, introduceLife, simulateStep } from '../src/sim/ecosystem.ts'
import { plantStage } from '../src/sim/life.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'

const report = []
for (const kind of ['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed']) {
  for (const cycling of [false, true]) for (const rich of [false, true]) {
    let world = { ...createWorld(2217), plants: [], creatures: [] }
    world = { ...world, climate: { temperatureC: 22, rainfall: rich ? 0.7 : 0 },
      light: kind === 'fern' || kind === 'moss' ? 0.42 : 0.8,
      soil: world.soil.map((patch) => ({ ...patch, water: 70, nutrients: rich ? 80 : patch.nutrients })),
      pond: { ...world.pond, water: rich ? 85 : 60, nutrients: rich ? 30 : 5 } }
    if (cycling) world = beginDaylitWorld(world)
    const aquatic = kind === 'lily' || kind === 'reed'
    world = introduceLife(world, kind, aquatic ? -1.1 : 1.7, aquatic ? 0.72 : -1.7)
    let death = null
    const samples = []
    const id = world.plants[0].id
    for (let elapsed = 0; elapsed <= 168; elapsed++) {
      const plant = world.plants.find((p) => p.id === id)
      if (!plant) { death = { elapsed, tick: world.tick }; break }
      if ([0, 6, 12, 24, 48, 96, 168].includes(elapsed)) samples.push({ elapsed, stage: plantStage(plant), biomass: plant.biomass, development: plant.development })
      world = simulateStep(world).world
    }
    report.push({ kind, cycling, rich, death, samples })
  }
}
writeFileSync('artifacts/plant-recruitment-probe.json', JSON.stringify(report, null, 2))
console.log(report.map(({ kind, cycling, rich, death, samples }) => ({ kind, cycling, rich, death, last: samples.at(-1) })))
