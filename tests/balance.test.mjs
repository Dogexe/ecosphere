import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWorld, creatureCounts, intervene, simulateStep } from '../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { setPondShape } from '../src/sim/pond.ts'
import { starterLight, withStarterGarden } from '../src/sim/starterGarden.ts'
import { co2Ppm, o2Percent, sealWorld } from '../src/sim/seal.ts'

// Balance targets for the first jar a player sees (systems pass, 2026-11-20). Before it, the
// untouched open starter was dead by day 30 and the sealed one lost its moss in a week,
// its lily pads, pond crew and ants within two months, and never raised a woodlouse.
function starter() {
  const jar = JSON.parse(readFileSync(new URL('../src/sim/defaultJar.json', import.meta.url)))
  const world = adoptPouredJar(beginDaylitWorld(createWorld()), jar)
  setPondShape(world.substrate)
  return withStarterGarden(world)
}

function live(world, days, tend = (w) => w) {
  const births = {}
  while (world.tick / 24 < days) {
    world = tend(world)
    const result = simulateStep(world)
    world = result.world
    for (const event of result.events) if (event.type === 'birth') births[event.kind] = (births[event.kind] ?? 0) + 1
  }
  return { world, births }
}

test('the starter jar opens in bright indirect light', () => {
  assert.equal(starter().light, starterLight)
})

test('a sealed starter jar lives a full year with every layer of its food web', () => {
  const { world, births } = live(sealWorld(starter(), 365), 365)
  const kinds = new Set(world.plants.map((plant) => plant.kind))
  for (const kind of ['moss', 'fern', 'tree', 'lily']) assert.ok(kinds.has(kind), `${kind} survives`)
  const animals = creatureCounts(world.creatures)
  assert.ok(animals.woodlouse >= 2 && births.woodlouse > 0, 'woodlice persist and breed')
  assert.ok(animals.snail > 0 && animals.shrimp > 0, 'the pond crew persists')
  assert.ok(world.colony?.queen && world.colony.workers.length >= 4, 'the ant colony persists')
  assert.ok(co2Ppm(world.sealed.co2) < 40000 && o2Percent(world.sealed.o2) > 17, 'jar air stays breathable')
})

test('an open starter jar watered every four days stays green for four months', () => {
  const { world } = live(starter(), 120, (w) => w.tick % 96 === 12 ? intervene(w, { type: 'water' }) : w)
  assert.ok(world.plants.length >= 20)
  assert.ok(new Set(world.plants.map((plant) => plant.kind)).has('moss'))
})

test('an untouched open jar still dries out, more slowly than a forgotten real pot would kill it', () => {
  const { world } = live(starter(), 30)
  assert.ok(world.water < 10)
})
