import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld } from '../src/sim/ecosystem.ts'
import { advanceInNest, antMaterial, antMaterialError, antPosition, colonyPlacementIssue, introduceColony, nestRoute } from '../src/sim/colony.ts'

test('one explicit colony imports accounted material without changing existing organisms or stocks', () => {
  const original = createWorld(2217), copy = structuredClone(original)
  const world = introduceColony(original, 1.7, 1.7)
  assert.ok(world.colony)
  assert.equal(world.colony.workers.length, 4)
  assert.equal(world.colony.brood.length, 0)
  assert.ok(antMaterial(world.colony) > 0)
  assert.ok(Math.abs(antMaterialError(world.colony)) < 1e-12)
  assert.equal(world.creatures, original.creatures)
  assert.equal(world.plants, original.plants)
  assert.equal(world.soil, original.soil)
  assert.deepEqual(original, copy)
  assert.ok(colonyPlacementIssue(world, 1.7, -1.7))
  assert.equal(introduceColony(world, 1.7, -1.7), world)
  assert.equal(introduceColony(original, -1.1, 0.72), original)
  const extinct = structuredClone(world)
  const lost = extinct.colony.workers.reduce((sum, ant) => sum + ant.body + ant.gut, 0) + extinct.colony.queen.body + extinct.colony.queen.gut
  extinct.colony.workers = []; extinct.colony.queen = null
  extinct.colony.ledger.remains += lost
  assert.ok(extinct.colony.food > 0)
  assert.equal(introduceColony(extinct, 1.7, -1.7), extinct, 'an extinct colony still owns its stored material')
})

test('ants traverse actual connected tunnel lengths and positions rather than teleport between chambers', () => {
  const colony = introduceColony(createWorld(), 1.7, 1.7).colony
  const ant = structuredClone(colony.workers[0])
  const original = structuredClone(colony)
  assert.deepEqual(nestRoute(colony, 3, 5), [3, 2, 4, 5])
  const start = antPosition(colony, ant)
  assert.equal(advanceInNest(colony, ant, 5, 0.1), 0.1)
  const moving = antPosition(colony, ant)
  assert.ok(Math.abs(Math.hypot(moving.x - start.x, moving.y - start.y, moving.z - start.z) - 0.1) < 1e-9)
  assert.notEqual(ant.location.from, ant.location.to)
  const left = advanceInNest(colony, ant, 5, 10)
  assert.ok(left > 0.5 && left < 1.2)
  assert.deepEqual(ant.location, { kind: 'nest', from: 5, to: 5, progress: 0 })
  assert.deepEqual(antPosition(colony, ant), { x: colony.nodes[5].x, y: colony.nodes[5].y, z: colony.nodes[5].z })
  assert.equal(advanceInNest(colony, ant, 5, 1), 0)
  assert.deepEqual(colony, original)
})
