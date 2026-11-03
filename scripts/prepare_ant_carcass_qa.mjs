import { readFileSync, writeFileSync } from 'node:fs'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { exportColony } from '../src/sim/colony.ts'
const before = parseSave(readFileSync('artifacts/ant-remains-live-before.json', 'utf8'))
before.colony.workers[0].location = { kind: 'surface', x: 1.7, z: 1.7, heading: 0 }
const after = simulateStep(before).world
writeFileSync('artifacts/ant-remains-surface.json', serializeSave(after))
writeFileSync('artifacts/ant-remains-only.json', serializeSave(exportColony(after).world))
console.log('Prepared actual surface death and explicit colony export without touching A/B')
