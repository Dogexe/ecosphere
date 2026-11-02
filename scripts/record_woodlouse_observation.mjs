// Disposable QA snapshots from actual solver histories, never browser state
// injection or player snapshots. Open through the game's native file chooser.
import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { serializeSave } from '../src/sim/saves.ts'

let world = beginDaylitWorld(createHabitatWorld('woodland', 2217))
const report = { seed: 2217, habitat: 'woodland', photoperiod: true, interventions: [], events: [] }
let childId = null
for (let step = 0; step < 400; step++) {
  const result = simulateStep(world)
  const mating = result.events.find((event) => event.type === 'mating')
  const birth = result.events.find((event) => event.type === 'birth' && event.kind === 'woodlouse')
  if (mating && !report.events.some((event) => event.type === 'mating')) {
    writeFileSync('artifacts/woodlouse-before-pairing.json', serializeSave(world))
    report.events.push({ type: 'mating', step: step + 1, tick: result.world.tick, event: mating })
  }
  if (birth && childId === null) {
    childId = birth.id
    writeFileSync('artifacts/woodlouse-before-birth.json', serializeSave(world))
    writeFileSync('artifacts/woodlouse-newborn.json', serializeSave(result.world))
    report.events.push({ type: 'birth', step: step + 1, tick: result.world.tick, event: birth,
      child: result.world.creatures.find((creature) => creature.id === childId) })
  }
  world = result.world
  const child = world.creatures.find((creature) => creature.id === childId)
  if (child?.stage === 'adult' && !report.events.some((event) => event.type === 'adult')) {
    writeFileSync('artifacts/woodlouse-grown.json', serializeSave(world))
    report.events.push({ type: 'adult', step: step + 1, tick: world.tick, child })
    break
  }
}
writeFileSync('artifacts/woodlouse-observation-history.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
