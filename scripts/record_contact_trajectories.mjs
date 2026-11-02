// Preserve recruitment/light histories; record the deliberate contact change.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { stepWorld } from '../src/sim/ecosystem.ts'

const previous = JSON.parse(readFileSync('tests/fixtures/recruitment-trajectories.json'))
const current = [], comparison = []
for (const item of previous) {
  let world = createHabitatWorld(item.habitat, item.seed)
  for (let i = 0; i < 240; i++) world = stepWorld(world)
  const sha256 = createHash('sha256').update(JSON.stringify(world)).digest('hex')
  current.push({ habitat: item.habitat, seed: item.seed, sha256 })
  comparison.push({ ...item, current: sha256, changed: sha256 !== item.sha256 })
}
writeFileSync('tests/fixtures/contact-trajectories.json', JSON.stringify(current, null, 2) + '\n')
writeFileSync('artifacts/contact-trajectories-comparison.json', JSON.stringify(comparison, null, 2) + '\n')
console.log({ cases: current.length, changed: comparison.filter((item) => item.changed).length })
