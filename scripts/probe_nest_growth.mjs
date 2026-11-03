import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { antFixture } from './probe_ant_colony.mjs'
import { introduceColony } from '../src/sim/colony.ts'
import { serializeSave } from '../src/sim/saves.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'

// A clearly funded QA experiment, using the full ecology and actual rainfall.
// Additional imported stores are paid in the colony's introduced-material ledger.
const base = antFixture()
delete base.colony
let world = introduceColony(base, 1.7, 1.7)
world.climate.rainfall = 0.55
world.colony.ledger.introduced += 2 - world.colony.food
world.colony.food = 2
writeFileSync('artifacts/nest-3d-start.json', serializeSave(world))
const counts = {}
let firstExcavationTick = null
for (let i = 0; i < 360; i++) {
  const before = world, result = simulateStep(world)
  world = result.world
  for (const event of result.events) {
    if (event.type !== 'ant') continue
    counts[event.action] = (counts[event.action] ?? 0) + 1
    if (event.action === 'excavation' && firstExcavationTick === null) {
      writeFileSync('artifacts/nest-3d-dig-before.json', serializeSave(before))
      writeFileSync('artifacts/nest-3d-dig-after.json', serializeSave(world))
      firstExcavationTick = world.tick
    }
    if (event.action === 'chamber') {
      writeFileSync('artifacts/nest-3d-complete-before.json', serializeSave(before))
      writeFileSync('artifacts/nest-3d-complete-after.json', serializeSave(world))
      console.log({ counts, firstExcavationTick, tick: world.tick, removed: world.colony.construction.removed, nodes: world.colony.nodes.length })
      process.exit(0)
    }
  }
}
assert.fail(`No chamber completed in the funded QA scenario: ${JSON.stringify(counts)}`)
