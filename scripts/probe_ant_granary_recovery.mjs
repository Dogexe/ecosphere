import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { antMaterialError } from '../src/sim/colony.ts'

let world = parseSave(readFileSync('artifacts/ant-remains-live-before.json', 'utf8'))
const records = []
for (let i = 0; i < 320; i++) {
  const previous = world
  world = simulateStep(world).world
  for (const ant of world.colony.workers) {
    const before = previous.colony.workers.find((item) => item.id === ant.id)
    const food = world.colony.nodes.find((node) => node.role === 'food').id
    if (before && ant.stage === 'adult' && ant.activity === 'resting' && ant.energy < 35 && ant.gut > 0 && ant.location.kind === 'nest' && ant.location.from === food && ant.location.to === food && before.activity !== 'resting') {
      records.push({ tick: world.tick, id: ant.id, before: { activity: before.activity, energy: before.energy, gut: before.gut }, after: { activity: ant.activity, energy: ant.energy, gut: ant.gut }, granary: world.colony.food })
      assert.deepEqual(simulateStep(parseSave(serializeSave(world))), simulateStep(world))
    }
  }
  assert.ok(Math.abs(antMaterialError(world.colony)) < 1e-10)
}
writeFileSync('artifacts/ant-granary-recovery-native-targets.json', JSON.stringify(records, null, 2))
console.log(records.slice(0, 8))
