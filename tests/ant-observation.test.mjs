import test from 'node:test'
import assert from 'node:assert/strict'
import { antFixture } from '../scripts/probe_ant_colony.mjs'
import { antMaterial, antMaterialError, stepAntColony } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

test('a real funded cohort identifies each emerged worker transiently without changing native material or continuation', () => {
  const world = antFixture(), colony = world.colony
  colony.brood = [{ id: 7, count: 2, stage: 'pupa', age: 24, material: 0.08, parentId: 0 }]
  colony.nextBroodId = 8
  colony.ledger.introduced = antMaterial(colony)
  const original = structuredClone(world)
  const result = stepAntColony(world)
  const births = result.events.filter((event) => event.action === 'birth')
  assert.equal(births.length, 2)
  assert.ok(births.every((event) => event.broodId === 7 && event.amount > 0 && event.amount <= 0.04))
  assert.equal(new Set(births.map((event) => event.id)).size, 2)
  for (const birth of births) {
    const ant = result.world.colony.workers.find((item) => item.id === birth.id)
    assert.equal(ant.stage, 'teneral'); assert.equal(ant.age, 0); assert.equal(ant.body, birth.amount)
  }
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  const encoded = serializeSave(result.world)
  assert.ok(!encoded.includes('broodId'), 'event provenance is transient, not a saved worker lineage claim')
  assert.deepEqual(parseSave(encoded), result.world)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
  assert.deepEqual(world, original)
})
