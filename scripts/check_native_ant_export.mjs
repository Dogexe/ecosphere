import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseSave } from '../src/sim/saves.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { antMaterialError, antPosition } from '../src/sim/colony.ts'

const bytes = readFileSync('artifacts/ant-native-contact-v3.json', 'utf8')
assert.equal(JSON.parse(bytes).version, 3)
const native = parseSave(bytes)
let expected = parseSave(readFileSync('artifacts/ant-live-birth-before.json', 'utf8'))
const from = expected.tick
while (expected.tick < native.tick) expected = simulateStep(expected).world
assert.deepEqual(native, expected)
assert.deepEqual(simulateStep(native), simulateStep(expected))
assert.equal(native.colony.workers.length, 5)
const child = native.colony.workers.find((ant) => ant.id === 5)
assert.equal(child.stage, 'teneral')
const position = antPosition(native.colony, child)
const nearest = Math.min(...native.colony.workers.filter((ant) => ant.id !== child.id).map((ant) => {
  const other = antPosition(native.colony, ant)
  return Math.hypot(position.x - other.x, position.y - other.y, position.z - other.z)
}))
assert.ok(nearest > 0.075)
assert.ok(Math.abs(antMaterialError(native.colony)) < 1e-8)
const report = { bytes: bytes.length, from, tick: native.tick, steps: native.tick - from, workers: native.colony.workers.length, childAge: child.age, childStage: child.stage, nearestWorker: nearest, materialError: antMaterialError(native.colony), exactWorldAndNextStep: true }
writeFileSync('artifacts/ant-native-contact-report.json', JSON.stringify(report, null, 2))
console.log(report)
