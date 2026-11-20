import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWorld, intervene, simulateStep } from '../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { setPondShape } from '../src/sim/pond.ts'
import { withStarterGarden } from '../src/sim/starterGarden.ts'
import { sealWorld } from '../src/sim/seal.ts'
import { careForecast } from '../src/sim/care.ts'

// Early warnings (systems pass item 2, 2026-11-20): the forecast looks ahead on a copy
// and names what would fail, why, and the action that answers it.
function starter() {
  const jar = JSON.parse(readFileSync(new URL('../src/sim/defaultJar.json', import.meta.url)))
  const world = adoptPouredJar(beginDaylitWorld(createWorld()), jar)
  setPondShape(world.substrate)
  return withStarterGarden(world)
}
const run = (world, hours) => { for (let i = 0; i < hours; i++) world = simulateStep(world).world; return world }

test('a fresh starter jar, open or sealed, needs nothing for the next two days', () => {
  const world = starter()
  assert.deepEqual(careForecast(world), [])
  assert.deepEqual(careForecast(sealWorld(world, 60)), [])
})

test('the forecast never changes the world it reads', () => {
  const world = run(starter(), 12 * 24)
  const before = JSON.stringify(world)
  careForecast(world)
  assert.equal(JSON.stringify(world), before)
})

test('an untended open jar warns of drying soil before plants die, and water answers it', () => {
  const world = run(starter(), 12 * 24)
  const dry = careForecast(world).find((alert) => alert.id === 'dry')
  assert.ok(dry, 'drying soil is reported')
  assert.equal(dry.advice, 'water')
  assert.equal(dry.severity, 'urgent')
  let watered = world
  for (let i = 0; i < 3; i++) watered = intervene(watered, { type: 'water' })
  assert.equal(careForecast(watered).some((alert) => alert.id === 'dry'), false, 'watering clears the warning')
})

test('a sealed jar under full sun warns of heat and too much light, and advises shade', () => {
  const alerts = careForecast(run(intervene(sealWorld(starter(), 60), { type: 'light', value: 1 }), 48))
  assert.ok(alerts.some((alert) => alert.id === 'hot' && alert.advice === 'shade'))
  assert.ok(alerts.some((alert) => alert.id === 'bright' && alert.advice === 'shade' && alert.plants.length > 0))
})

test('deep shade warns that plants lack light', () => {
  const dim = careForecast(run(intervene(starter(), { type: 'light', value: 0.18 }), 24)).find((alert) => alert.id === 'dim')
  assert.ok(dim && dim.advice === 'brighten' && dim.plants.length >= 3)
})

test('matter cannot enter a sealed jar, so a dry sealed jar is told to open the seal', () => {
  let world = sealWorld(starter(), 60)
  world = { ...world, soil: world.soil.map((patch) => ({ ...patch, water: 8 })), water: 8 }
  const dry = careForecast(world).find((alert) => alert.id === 'dry')
  assert.ok(dry)
  assert.equal(dry.advice, 'unseal')
})
