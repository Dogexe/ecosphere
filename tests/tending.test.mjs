import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWorld, humidAir, plantOutlook, simulateStep } from '../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { setPondShape } from '../src/sim/pond.ts'
import { withStarterGarden } from '../src/sim/starterGarden.ts'
import { sealWorld } from '../src/sim/seal.ts'
import { canFeed, canTakeCutting, canTrim, feed, mist, mistHours, takeCutting, trimPlant } from '../src/sim/tending.ts'

// Hands-on care verbs (systems pass item 4, 2026-11-20).
function starter() {
  const jar = JSON.parse(readFileSync(new URL('../src/sim/defaultJar.json', import.meta.url)))
  const world = adoptPouredJar(beginDaylitWorld(createWorld()), jar)
  setPondShape(world.substrate)
  return withStarterGarden(world)
}
const run = (world, hours) => { for (let i = 0; i < hours; i++) world = simulateStep(world).world; return world }
const organic = (world) => world.soil.reduce((sum, patch) => sum + patch.organic, 0) + world.pond.organic
const biomass = (world) => world.plants.reduce((sum, plant) => sum + plant.biomass, 0)

test('misting wets the surface a little and keeps the air humid for a few hours, which moss drinks', () => {
  const dry = run(starter(), 10 * 24)
  const misted = mist(dry)
  assert.ok(misted.water > dry.water && misted.water - dry.water <= 4.01)
  assert.ok(humidAir(misted) && !humidAir(dry))
  const moss = dry.plants.find((plant) => plant.kind === 'moss')
  assert.ok(plantOutlook(misted, moss).fit >= plantOutlook(dry, moss).fit)
  const later = run(misted, mistHours + 1)
  assert.equal(humidAir(later), false, 'the humidity passes')
  assert.equal(run(misted, 2).mistUntil, misted.mistUntil, 'the step keeps the mist timer')
})

test('trimming cuts back leaves and leaves the clippings as litter; nothing is lost', () => {
  const world = run(starter(), 5 * 24)
  const plant = world.plants.find((item) => item.kind === 'clover' && canTrim(item))
  assert.ok(plant)
  const trimmed = trimPlant(world, plant.id)
  const after = trimmed.plants.find((item) => item.id === plant.id)
  assert.ok(Math.abs(after.biomass - plant.biomass * 0.6) < 1e-9)
  assert.ok(Math.abs((organic(trimmed) - organic(world)) - plant.biomass * 0.4 * 0.42) < 1e-9)
})

test('a cutting moves part of a healthy plant into a rooted young plant of the same kind nearby', () => {
  const grown = run(starter(), 5 * 24)
  const parent = grown.plants.find((item) => !['moss', 'lily', 'reed'].includes(item.kind) && canTakeCutting(item))
  assert.ok(parent)
  assert.equal(takeCutting(grown, parent.id).plants.length, grown.plants.length, 'a full jar (32 plants) has no room')
  const world = { ...grown, plants: grown.plants.filter((item, n) => item.id === parent.id || n < 20) }
  const next = takeCutting(world, parent.id)
  assert.equal(next.plants.length, world.plants.length + 1)
  const cutting = next.plants[next.plants.length - 1]
  assert.equal(cutting.kind, parent.kind)
  assert.equal(cutting.parentId, parent.id)
  assert.ok(Math.abs(biomass(next) - biomass(world)) < 1e-9, 'biomass only moves')
  assert.ok(Math.hypot(cutting.x - parent.x, cutting.z - parent.z) < 2)
  // It roots: a day later it is alive.
  assert.ok(run(next, 24).plants.some((plant) => plant.id === cutting.id))
})

test('feeding drops food where recyclers and the pond crew can find it, not for grazers', () => {
  const world = starter()
  const woodlouse = world.creatures.find((item) => item.kind === 'woodlouse')
  const shrimp = world.creatures.find((item) => item.kind === 'shrimp' || item.kind === 'snail')
  const grazer = world.creatures.find((item) => item.kind === 'grazer')
  assert.ok(organic(feed(world, woodlouse.id)) > organic(world))
  assert.ok(feed(world, shrimp.id).pond.organic > world.pond.organic)
  if (grazer) { assert.equal(canFeed(grazer), false); assert.equal(feed(world, grazer.id), world) }
})

test('none of the hands-on verbs reach through a sealed lid', () => {
  const sealed = sealWorld(run(starter(), 5 * 24), 30)
  const plant = sealed.plants.find((item) => canTrim(item))
  assert.equal(mist(sealed), sealed)
  assert.equal(trimPlant(sealed, plant.id), sealed)
  assert.equal(takeCutting(sealed, plant.id), sealed)
  assert.equal(feed(sealed, sealed.creatures[0].id), sealed)
})
