// Explicitly record the intentional recruitment/light correction; preserve the
// old pre-photoperiod/shoreline hashes as historical evidence, never overwrite.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'

const original = JSON.parse(readFileSync('tests/fixtures/constant-trajectories.json'))
const current = [], comparison = []
for (const item of original) {
  let world = createHabitatWorld(item.habitat, item.seed)
  const events = { birth: 0, death: 0, mating: 0, predation: 0 }
  for (let elapsed = 0; elapsed < 240; elapsed++) {
    const result = simulateStep(world)
    result.events.forEach((event) => { if (event.type in events) events[event.type]++ })
    world = result.world
  }
  const sha256 = createHash('sha256').update(JSON.stringify(world)).digest('hex')
  current.push({ habitat: item.habitat, seed: item.seed, sha256 })
  comparison.push({ ...item, current: sha256, changed: sha256 !== item.sha256,
    plants: world.plants.length, animals: world.creatures.length, events })
}
writeFileSync('tests/fixtures/recruitment-trajectories.json', JSON.stringify(current, null, 2) + '\n')
writeFileSync('artifacts/recruitment-trajectories-comparison.json', JSON.stringify(comparison, null, 2) + '\n')
console.log(comparison)
