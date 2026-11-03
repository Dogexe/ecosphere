import test from 'node:test'
import assert from 'node:assert/strict'
import { antFixture } from '../scripts/probe_ant_colony.mjs'
import { antMaterial, antMaterialError, antPosition, exportColony, seedMaterialAvailable, stepAntColony } from '../src/sim/colony.ts'
import { isLandSegment, walkOnLand } from '../src/sim/land.ts'
import { removeLife, simulateStep } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

function step(world) { const result = stepAntColony(world); return { ...result, world: { ...result.world, tick: world.tick + 1 } } }
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('ant harvest transfers actual reproductive biomass, respects maturity/diet and does not duplicate a delivery', () => {
  const world = antFixture(), ant = world.colony.workers[0], plant = world.plants[0]
  ant.location = { kind: 'surface', x: plant.x, z: plant.z, heading: 0 }
  ant.goal = { kind: 'plant', id: plant.id }
  const original = structuredClone(world)
  let result = step(world)
  near(world.plants[0].biomass - result.world.plants[0].biomass, 0.012)
  near(result.world.colony.workers[0].carried, 0.012)
  near(result.world.colony.ledger.harvested, 0.012)
  assert.equal(result.world.seed, world.seed)
  assert.deepEqual(world, original)
  for (const kind of ['moss', 'fern', 'tree', 'lily', 'reed']) assert.equal(seedMaterialAvailable({ ...plant, kind }), 0)
  assert.equal(seedMaterialAvailable({ ...plant, development: 2 }), 0)
  assert.equal(seedMaterialAvailable({ ...plant, biomass: plant.capacity * 0.7 }), 0)
  let deliveries = 0
  for (let i = 0; i < 20; i++) {
    const before = result.world
    result = step(before)
    for (const ant of result.world.colony.workers) {
      const prior = before.colony.workers.find((item) => item.id === ant.id)
      if (!prior) continue
      const a = antPosition(before.colony, prior), b = antPosition(result.world.colony, ant)
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 0.140001)
    }
    for (const event of result.events) if (event.action === 'delivery' && event.id === 1) { deliveries++; near(event.amount, 0.012) }
    near(antMaterialError(result.world.colony), 0)
  }
  assert.equal(deliveries, 1)
})

test('transport-funded nursing produces larvae, pupae and a fixed-body teneral worker with exact material flows', () => {
  let world = antFixture()
  const starting = structuredClone(world), events = new Set(), bodies = new Map()
  const startingSoil = world.soil.reduce((sum, patch) => sum + patch.organic + patch.nutrients, 0)
  for (let i = 0; i < 720; i++) {
    const result = step(world)
    world = result.world
    for (const event of result.events) {
      events.add(event.action)
      if (event.action === 'birth') {
        const newborn = world.colony.workers.find((ant) => ant.id === event.id)
        assert.equal(newborn.age, 0); assert.equal(newborn.stage, 'teneral')
        assert.ok(newborn.body > 0.03 && newborn.body <= 0.04)
        bodies.set(newborn.id, newborn.body)
      }
    }
    for (const ant of world.colony.workers) if (bodies.has(ant.id)) near(ant.body, bodies.get(ant.id))
    near(antMaterialError(world.colony), 0)
    near(starting.plants.reduce((sum, plant) => sum + plant.biomass, 0) - world.plants.reduce((sum, plant) => sum + plant.biomass, 0), world.colony.ledger.harvested)
    near(world.soil.reduce((sum, patch) => sum + patch.organic + patch.nutrients, 0) - startingSoil, world.colony.ledger.soilReturn)
    if (i % 48 === 0) assert.deepEqual(parseSave(serializeSave(world)), world)
  }
  for (const action of ['harvest', 'delivery', 'nursing', 'egg', 'hatch', 'pupate', 'birth']) assert.ok(events.has(action), action)
  assert.ok(world.colony.workers.some((ant) => bodies.has(ant.id) && ant.stage === 'adult'))
  assert.deepEqual(starting, antFixture())
})

test('absent edible food and absent nurses cannot create new workers; death exports remaining material exactly', () => {
  let poor = antFixture()
  poor.plants = []
  const exported = poor.colony.food + poor.colony.queen.gut + poor.colony.workers.reduce((sum, ant) => sum + ant.gut, 0)
  poor.colony.ledger.exported += exported; poor.colony.food = 0; poor.colony.queen.gut = 0
  poor.colony.workers.forEach((ant) => { ant.gut = 0 })
  const nextId = poor.colony.nextAntId
  for (let i = 0; i < 1300; i++) {
    const result = step(poor); poor = result.world
    assert.ok(!result.events.some((event) => event.action === 'birth'))
    near(antMaterialError(poor.colony), 0)
  }
  assert.equal(poor.colony.queen, null)
  assert.equal(poor.colony.workers.length, 0)
  assert.equal(poor.colony.nextAntId, nextId)
  near(poor.remains.reduce((sum, item) => sum + item.material, 0), poor.colony.ledger.remains)

  let unattended = antFixture()
  const workers = unattended.colony.workers.reduce((sum, ant) => sum + ant.body + ant.gut, 0)
  unattended.colony.workers = []; unattended.colony.ledger.exported += workers
  for (let i = 0; i < 400; i++) { const result = step(unattended); unattended = result.world; assert.ok(!result.events.some((event) => event.action === 'birth')); near(antMaterialError(unattended.colony), 0) }
})

test('the coupled ecosystem continues v3 exactly and removing a seed source clears stale goals before saving', () => {
  let world = antFixture()
  world.climate.photoperiod = true
  for (let i = 0; i < 300; i++) {
    const result = simulateStep(world)
    if (i % 19 === 0) assert.deepEqual(simulateStep(parseSave(serializeSave(world))), result)
    world = result.world
    near(antMaterialError(world.colony), 0)
  }
  const original = antFixture()
  original.colony.workers[0].goal = { kind: 'plant', id: 0 }
  const removed = removeLife(original, 'plant', 0)
  assert.equal(removed.colony.workers[0].goal, null)
  assert.deepEqual(original.colony.workers[0].goal, { kind: 'plant', id: 0 })
  assert.doesNotThrow(() => parseSave(serializeSave(removed)))
  const receipt = exportColony(removed)
  assert.equal(receipt.world.colony, undefined)
  near(receipt.exported, antMaterial(removed.colony))
  near(antMaterialError({ ...removed.colony, queen: null, workers: [], brood: [], food: 0, ledger: receipt.ledger }), 0)
  assert.equal(receipt.world.remains, removed.remains)
})

test('ant surface movement keeps the whole conservative hull path out of the bank and inside the rim', () => {
  let checked = 0
  for (let x = -3; x <= 3; x += 0.2) for (let z = -3; z <= 3; z += 0.2) {
    if (!isLandSegment(x, z, x, z, 0.08)) continue
    for (let direction = 0; direction < 12; direction++) {
      const angle = direction * Math.PI / 6
      const moved = walkOnLand({ id: direction, x, z, heading: angle }, x + Math.sin(angle), z + Math.cos(angle), 0.14, 0.08)
      assert.ok(isLandSegment(x, z, moved.x, moved.z, 0.08))
      assert.ok(moved.distance <= 0.140001)
      checked++
    }
  }
  assert.ok(checked > 1000)
})

test('newly emerged body water is withdrawn from soil and cannot create water through death', () => {
  const world = antFixture(), colony = world.colony
  colony.queen = null; colony.workers = []; colony.food = 0
  colony.brood = [{ id: 0, count: 1, stage: 'pupa', age: 24, material: 0.04, parentId: 0 }]
  colony.nextBroodId = 1
  colony.ledger = { introduced: 0.04, harvested: 0, metabolized: 0, soilReturn: 0, remains: 0, exported: 0 }
  const water = world.soil.reduce((sum, patch) => sum + patch.water, 0)
  const born = step(world).world, child = born.colony.workers[0]
  near(water - born.soil.reduce((sum, patch) => sum + patch.water, 0), child.hydration / 100 * child.body * 0.4)
  child.age = 1199; child.stage = 'adult'
  const dead = step(born).world
  assert.equal(dead.colony.workers.length, 0)
  assert.ok(dead.soil.reduce((sum, patch) => sum + patch.water, 0) <= water)
  near(antMaterialError(dead.colony), 0)
})

test('one remaining worker can nurse a hungry queen using stored food', () => {
  let world = antFixture(), colony = world.colony
  colony.ledger.exported += colony.workers.slice(1).reduce((sum, ant) => sum + ant.body + ant.gut + ant.carried, 0) + colony.queen.gut
  colony.workers = colony.workers.slice(0, 1); colony.queen.gut = 0
  colony.ledger.introduced += 2 - colony.food; colony.food = 2
  let nursing = 0
  for (let i = 0; i < 300; i++) {
    const result = step(world); world = result.world
    nursing += result.events.filter((event) => event.action === 'nursing').length
    near(antMaterialError(world.colony), 0)
  }
  assert.ok(nursing > 0)
  assert.ok(world.colony.queen)
  assert.ok(world.colony.workers.some((ant) => ant.id === 1), 'the original sole nurse must survive; funded offspring may also emerge')
})

test('native saves reject impossible stationary-queen plant goals', () => {
  const world = antFixture()
  world.colony.queen.goal = { kind: 'plant', id: world.plants[0].id }
  assert.throws(() => parseSave(serializeSave(world)))
})

test('photoperiod changes real foraging decisions and tenerals remain inside during daylight', () => {
  const setup = (tick) => {
    const world = antFixture(); world.tick = tick; world.climate.photoperiod = true
    const ant = world.colony.workers[0]
    ant.energy = 90; ant.gut = 0.01
    ant.location = { kind: 'surface', x: 1.8, z: 1.7, heading: 0 }
    return world
  }
  const night = stepAntColony(setup(0)).world.colony.workers[0]
  const day = stepAntColony(setup(12)).world.colony.workers[0]
  assert.equal(night.activity, 'entering')
  assert.equal(day.activity, 'foraging')
  assert.ok(night.location.x < 1.8)
  const young = setup(12), ant = young.colony.workers[0]
  ant.age = 4; ant.stage = 'teneral'; ant.location = { kind: 'nest', from: 4, to: 4, progress: 0 }
  const result = stepAntColony(young).world.colony.workers[0]
  assert.equal(result.location.kind, 'nest')
  assert.equal(result.activity, 'resting')
})
