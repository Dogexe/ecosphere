import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { parseSave } from '../src/sim/saves.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { antMaterialError } from '../src/sim/colony.ts'

let world = parseSave(readFileSync('artifacts/nest-3d-dig-before.json', 'utf8'))
const actual = parseSave(readFileSync('artifacts/nest-native-grown-v3.json', 'utf8'))
while (world.tick < actual.tick) world = simulateStep(world).world
assert.deepEqual(world, actual)
assert.deepEqual(simulateStep(world), simulateStep(actual))
const report = {
  tick: actual.tick, nodes: actual.colony.nodes.length,
  rooms: actual.colony.nodes.filter((node) => node.role === 'rest').length,
  removed: actual.colony.construction.removed, workers: actual.colony.workers.length,
  materialError: antMaterialError(actual.colony), exactNativeReplay: true,
}
writeFileSync('artifacts/nest-native-replay-report.json', JSON.stringify(report, null, 2))
console.log(report)
