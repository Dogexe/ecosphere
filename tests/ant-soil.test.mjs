import test from 'node:test'
import assert from 'node:assert/strict'
import { antFixture } from '../scripts/probe_ant_colony.mjs'
import { antMaterial, antMaterialError, antSoilAt, introduceColony, stepAntColony } from '../src/sim/colony.ts'
import { excavationSite, planExcavation, workExcavation } from '../src/sim/excavation.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

function boundaryWorld() {
  const world = antFixture(), colony = world.colony
  colony.nodes = colony.nodes.map((node) => ({ ...node, x: node.x - 1.5, z: node.z + 0.3 }))
  colony.entrance = { x: 0.2, z: 2 }
  colony.patchId = antSoilAt(world.soil, colony.entrance).id
  world.soil.forEach((patch) => { patch.water = 55 })
  world.water = 55
  return world
}
const roomSoil = (world, role) => antSoilAt(world.soil, world.colony.nodes.find((node) => node.role === role))
function noAdults(world) {
  const colony = world.colony
  colony.ledger.exported += antMaterial(colony) - colony.food - colony.brood.reduce((sum, cohort) => sum + cohort.material, 0)
  colony.queen = null; colony.workers = []
}
function addCohort(world, stage, age, material) {
  const colony = world.colony
  colony.brood = [{ id: 0, count: 1, parentId: 0, stage, age, material }]
  colony.nextBroodId = 1; colony.ledger.introduced += material
}

test('nursery moisture, not entrance moisture, controls development across connected soil columns', () => {
  for (const [entranceWater, nurseryWater, develops] of [[80, 5, false], [5, 70, true]]) {
    const world = boundaryWorld()
    addCohort(world, 'egg', 2, 0.004)
    antSoilAt(world.soil, world.colony.entrance).water = entranceWater
    roomSoil(world, 'brood').water = nurseryWater
    const original = structuredClone(world), result = stepAntColony(world)
    assert.equal(result.world.colony.brood[0].age > 2, develops)
    assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
    assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
    assert.deepEqual(world, original)
  }
})

test('an emerged worker withdraws its entire body water from the nursery column exactly once', () => {
  const world = boundaryWorld()
  noAdults(world); addCohort(world, 'pupa', 30, 0.04)
  antSoilAt(world.soil, world.colony.entrance).water = 5
  roomSoil(world, 'brood').water = 70
  const original = structuredClone(world), result = stepAntColony(world), newborn = result.world.colony.workers[0]
  assert.ok(newborn && result.events.some((event) => event.action === 'birth'))
  assert.ok(Math.abs(newborn.hydration - 70) < 1e-12)
  const waterUsed = newborn.hydration / 100 * newborn.body * 0.4
  for (const patch of world.soil) {
    const next = result.world.soil.find((item) => item.id === patch.id)
    assert.ok(Math.abs(patch.water - next.water - (patch.id === roomSoil(world, 'brood').id ? waterUsed : 0)) < 1e-12)
  }
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(world, original)
})

test('brood maintenance and granary spoilage return material to their own soil columns', () => {
  const control = boundaryWorld()
  noAdults(control)
  roomSoil(control, 'food').water = 80; roomSoil(control, 'brood').water = 5
  const world = structuredClone(control)
  addCohort(world, 'egg', 2, 0.004)
  const base = stepAntColony(control).world, result = stepAntColony(world).world
  const nursery = roomSoil(world, 'brood').id
  const broodLoss = 0.004 - result.colony.brood[0].material
  for (const patch of result.soil) {
    const previous = base.soil.find((item) => item.id === patch.id)
    assert.ok(Math.abs(patch.organic - previous.organic - (patch.id === nursery ? broodLoss * 0.2 : 0)) < 1e-12)
  }
  const spoiled = control.colony.food - base.colony.food
  assert.ok(spoiled > 0)
  assert.ok(Math.abs(roomSoil(base, 'food').organic - roomSoil(control, 'food').organic - spoiled) < 1e-12)
  assert.ok(Math.abs(antMaterialError(result.colony)) < 1e-10)
})

test('queen egg costs and real nurse deliveries are returned beside their respective chambers', () => {
  const world = boundaryWorld(), colony = world.colony
  colony.queen.age = 125
  const control = structuredClone(world); control.colony.queen.age = 124
  const result = stepAntColony(world), base = stepAntColony(control)
  assert.ok(result.events.some((event) => event.action === 'egg'))
  for (const patch of result.world.soil) {
    const previous = base.world.soil.find((item) => item.id === patch.id)
    assert.ok(Math.abs(patch.organic - previous.organic - (patch.id === roomSoil(world, 'queen').id ? 0.00075 : 0)) < 1e-12)
  }
  const nursing = boundaryWorld(), c = nursing.colony, ant = c.workers[0]
  addCohort(nursing, 'larva', 25, 0.02)
  c.food -= 0.012; ant.carried = 0.012; ant.activity = 'nursing'
  ant.location = { kind: 'nest', from: 4, to: 4, progress: 0 }; ant.goal = { kind: 'chamber', id: 4 }
  const noDelivery = structuredClone(nursing); noDelivery.colony.workers[0].activity = 'carrying'
  const fed = stepAntColony(nursing), unfed = stepAntColony(noDelivery)
  const amount = fed.events.filter((event) => event.action === 'nursing').reduce((sum, event) => sum + event.amount, 0)
  assert.ok(amount > 0)
  const nurseryGain = roomSoil(fed.world, 'brood').nutrients - roomSoil(unfed.world, 'brood').nutrients
  assert.ok(Math.abs(nurseryGain - amount * 0.2 * 0.25) < 1e-12)
  assert.ok(Math.abs(antMaterialError(fed.world.colony)) < 1e-10)
})

test('the real advancing excavation face uses its local soil after crossing a column boundary', () => {
  const world = boundaryWorld(); delete world.colony
  world.seed = 2217
  world.colony = introduceColony(world, 0.02, 2).colony
  const colony = world.colony
  colony.ledger.introduced += 2 - colony.food; colony.food = 2
  planExcavation(colony, 55, world.seed)
  assert.ok(colony.construction.job)
  const ant = colony.workers[1], job = colony.construction.job
  ant.location = { kind: 'nest', from: job.from, to: job.from, progress: 0 }
  for (let i = 0; i < 30 && antSoilAt(world.soil, excavationSite(colony)).id === colony.patchId; i++) {
    ant.energy = 90
    workExcavation(colony, ant, 55, 1, 0.14)
  }
  const local = antSoilAt(world.soil, excavationSite(colony))
  assert.notEqual(local.id, colony.patchId)
  ant.energy = 90; ant.age = 200
  for (const water of [5, 95]) {
    const dry = structuredClone(world)
    dry.soil.find((patch) => patch.id === local.id).water = water
    const result = stepAntColony(dry)
    assert.equal(result.world.colony.construction.job.work, job.work)
    assert.ok(!result.events.some((event) => event.action === 'excavation'))
    assert.deepEqual(stepAntColony(parseSave(serializeSave(dry))), result)
  }
  const wet = stepAntColony(world)
  assert.ok(wet.world.colony.construction.job.work > job.work)
  assert.ok(Math.abs(antMaterialError(wet.world.colony)) < 1e-10)
})
