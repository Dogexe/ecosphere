import test from 'node:test'
import assert from 'node:assert/strict'
import { antFixture } from '../scripts/probe_ant_colony.mjs'
import { antMaterialError, antPosition, stepAntColony } from '../src/sim/colony.ts'
import { addRemains, decayRemains } from '../src/sim/life.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

test('tiny recorded ant bodies retain fractional decay instead of disappearing at the first wet step', () => {
  const world = dyingWorker(), remains = []
  addRemains(remains, 'ant', 1.7, 1.7, 0.00019, 3, { sourceId: 2, form: 'larva', count: 1, body: 0.00019, y: -0.44 })
  const original = structuredClone(remains), wet = world.soil.map((patch) => ({ ...patch, water: 55 })), dry = wet.map((patch) => ({ ...patch, water: 0 }))
  const dryResult = decayRemains(remains, dry, world.pond, 22)
  assert.equal(dryResult.remains[0].material, 0.00019)
  let result = decayRemains(remains, wet, world.pond, 22)
  assert.equal(result.remains.length, 1)
  assert.ok(result.remains[0].material > 0 && result.remains[0].material < 0.00019)
  const startOrganic = wet.reduce((sum, patch) => sum + patch.organic, 0)
  let steps = 1
  while (result.remains.length && steps < 500) {
    assert.deepEqual(result.remains[0].ant, original[0].ant)
    assert.ok(Math.abs(result.soil.reduce((sum, patch) => sum + patch.organic, 0) - startOrganic + result.remains[0].material - 0.00019) < 1e-11)
    result = decayRemains(result.remains, result.soil, result.pond, 22); steps++
  }
  assert.ok(steps > 20 && steps < 500)
  assert.equal(result.remains.length, 0)
  assert.ok(Math.abs(result.soil.reduce((sum, patch) => sum + patch.organic, 0) - startOrganic - 0.00019) < 1e-11)
  assert.deepEqual(remains, original)
  for (const kind of ['ant', 'grass']) {
    const old = [{ ...original[0], kind }]; delete old[0].ant
    assert.equal(decayRemains(old, wet, world.pond, 22).remains.length, 0, 'unrecorded historical cleanup remains unchanged')
  }
})

function dyingWorker() {
  const world = antFixture(), ant = world.colony.workers[0]
  ant.age = 1199; ant.location = { kind: 'nest', from: 4, to: 5, progress: 0.4 }
  return world
}

test('an actual death retains its source anatomy, funded body and true3D depth exactly once', () => {
  const world = dyingWorker(), ant = world.colony.workers[0], p = antPosition(world.colony, ant), original = structuredClone(world)
  const result = stepAntColony(world), remains = result.world.remains.find((r) => r.ant?.sourceId === ant.id)
  assert.ok(remains)
  assert.deepEqual(remains.ant, { sourceId: ant.id, form: 'worker', count: 1, body: ant.body, y: p.y })
  assert.equal(remains.x, p.x); assert.equal(remains.z, p.z)
  assert.ok(!result.world.colony.workers.some((a) => a.id === ant.id))
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(parseSave(serializeSave(result.world)), result.world)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
  assert.deepEqual(world, original)
})

test('decaying recorded carcasses fund local soil and retain provenance without rewriting old remains', () => {
  const world = stepAntColony(dyingWorker()).world, original = structuredClone(world)
  let remains = world.remains, soil = world.soil, pond = world.pond
  const mass = remains.reduce((s, r) => s + r.material, 0), organic = soil.reduce((s, p) => s + p.organic, 0)
  for (let i = 0; i < 240; i++) {
    const next = decayRemains(remains, soil, pond, 22)
    if (next.remains[0]) assert.deepEqual(next.remains[0].ant, remains[0].ant)
    remains = next.remains; soil = next.soil; pond = next.pond
  }
  assert.equal(remains.length, 0)
  assert.ok(Math.abs(soil.reduce((s, p) => s + p.organic, 0) - organic - mass) < 1e-9)
  assert.deepEqual(world, original)
  const old = structuredClone(world); old.remains.forEach((r) => { delete r.ant })
  assert.deepEqual(parseSave(serializeSave(old)), old)
})

test('ant-only death metadata is bounded and cannot be attached to unrelated pools', () => {
  const encoded = JSON.parse(serializeSave(stepAntColony(dyingWorker()).world))
  for (const mutate of [r => r.ant.y = -9, r => r.ant.form = 'dragon', r => r.ant.count = 5, r => r.ant.sourceId = -1, r => r.ant.body = 1, r => r.kind = 'clover']) {
    const copy = structuredClone(encoded); mutate(copy.world.remains[0]); assert.throws(() => parseSave(JSON.stringify(copy)))
  }
})

test('bounded pool aggregation preserves stock and drops misleading individual attribution', () => {
  const world = dyingWorker(), remains = []
  addRemains(remains, 'ant', 1.7, 1.7, 0.04, 3, { sourceId: 1, form: 'worker', count: 1, body: 0.04, y: -0.4 })
  for (let i = 1; i < 256; i++) addRemains(remains, 'grass', 1.7, 1.7, 0.02, 3)
  const before = remains.reduce((s, r) => s + r.material, 0)
  addRemains(remains, 'ant', 1.8, 1.7, 0.05, 3, { sourceId: 2, form: 'worker', count: 1, body: 0.04, y: -0.5 })
  assert.equal(remains.length, 256); assert.equal(remains[0].ant, undefined)
  assert.ok(Math.abs(remains.reduce((s, r) => s + r.material, 0) - before - 0.05) < 1e-10)
  world.remains = remains
  assert.doesNotThrow(() => parseSave(serializeSave(world)))
})
