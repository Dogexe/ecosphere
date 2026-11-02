// Verify a file obtained through the real compiled game's Download action.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'

let expected = parseSave(readFileSync('artifacts/woodlouse-before-birth.json', 'utf8'))
const raw = readFileSync('artifacts/woodlouse-contact-native-export.json', 'utf8')
assert.equal(JSON.parse(raw).version, 2)
const actual = parseSave(raw)
const steps = actual.tick - expected.tick
assert.ok(steps > 0 && steps < 1000)
for (let i = 0; i < steps; i++) expected = simulateStep(expected).world
assert.deepEqual(actual, parseSave(serializeSave(expected)))
const woodlice = actual.creatures.filter((creature) => creature.kind === 'woodlouse')
let minDistance = Infinity
for (let i = 0; i < woodlice.length; i++) for (let j = i + 1; j < woodlice.length; j++) {
  minDistance = Math.min(minDistance, Math.hypot(woodlice[i].x - woodlice[j].x, woodlice[i].z - woodlice[j].z))
}
assert.ok(minDistance > 0.2)
assert.ok(woodlice.some((creature) => creature.life.parentId === 6 && creature.stage === 'juvenile'))
const report = { nativeBytes: Buffer.byteLength(raw), exactSteps: steps, tick: actual.tick,
  minDistance, snapshotVersion: 2, exactWorldAndNextStep: true }
assert.deepEqual(simulateStep(actual), simulateStep(expected))
writeFileSync('artifacts/woodlouse-contact-native-check.json', JSON.stringify(report, null, 2))
console.log(report)
