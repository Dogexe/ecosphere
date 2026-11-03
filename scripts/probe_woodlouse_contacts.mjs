import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'

let world = beginDaylitWorld(createHabitatWorld('woodland', 2217))
let minDistance = Infinity, severelyOverlappingSteps = 0
const events = { birth: 0, death: 0, mating: 0 }
for (let step = 0; step < 300; step++) {
  const result = simulateStep(world)
  for (const event of result.events) if (event.type in events && event.kind === 'woodlouse') events[event.type]++
  world = result.world
  const actors = world.creatures.filter((creature) => creature.kind === 'woodlouse')
  let severe = false
  for (let a = 0; a < actors.length; a++) for (let b = a + 1; b < actors.length; b++) {
    const distance = Math.hypot(actors[a].x - actors[b].x, actors[a].z - actors[b].z)
    minDistance = Math.min(minDistance, distance)
    if (distance < 0.1) severe = true
  }
  severelyOverlappingSteps += Number(severe)
}
const report = { steps: 300, seed: 2217, habitat: 'woodland', cycling: true, minDistance, severelyOverlappingSteps, events,
  final: world.creatures.filter((creature) => creature.kind === 'woodlouse').map((creature) => ({ id: creature.id, x: creature.x, z: creature.z, stage: creature.stage, mass: creature.life.mass, energy: creature.energy })) }
const suffix = process.argv.includes('--before') ? 'before' : 'after'
writeFileSync(`artifacts/woodlouse-contacts-${suffix}.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
