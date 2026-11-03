import test from 'node:test'
import assert from 'node:assert/strict'
import { antFixture } from '../scripts/probe_ant_colony.mjs'
import { advanceInNest, antContactRadius, antMaterialError, antPosition, nestContains, resolveAntContacts, stepAntColony } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const actors = (colony) => [colony.queen, ...colony.workers].filter(Boolean)

test('coincident nest workers separate physically with bounded contact and unchanged material/queen', () => {
  const source = antFixture().colony
  source.workers.forEach((ant) => { ant.location = { kind: 'nest', from: 3, to: 3, progress: 0 } })
  const original = structuredClone(source)
  let colony = source
  for (let i = 0; i < 20; i++) {
    const next = resolveAntContacts(colony)
    for (const ant of actors(next)) {
      const before = actors(colony).find((item) => item.id === ant.id)
      assert.ok(distance(antPosition(next, ant), antPosition(colony, before)) <= 0.04000001)
      assert.ok(nestContains(next, antPosition(next, ant), antContactRadius(ant)))
      const { location: _a, ...state } = ant, { location: _b, ...prior } = before
      assert.deepEqual(state, prior)
    }
    assert.deepEqual(next.queen, original.queen)
    assert.equal(next.ledger, source.ledger)
    assert.equal(antMaterialError(next), antMaterialError(source))
    colony = next
  }
  for (let i = 0; i < colony.workers.length; i++) for (let j = i + 1; j < colony.workers.length; j++) {
    assert.ok(distance(antPosition(colony, colony.workers[i]), antPosition(colony, colony.workers[j])) > 0.075)
  }
  const reversed = resolveAntContacts({ ...source, workers: [...source.workers].reverse() })
  const forward = resolveAntContacts(source)
  for (const ant of reversed.workers) assert.deepEqual(antPosition(reversed, ant), antPosition(forward, forward.workers.find((item) => item.id === ant.id)))
  assert.deepEqual(source, original)
})

test('physical contact offsets cost departure distance and native continuation is exact', () => {
  let world = antFixture()
  const ant = world.colony.workers[0]
  ant.location = { kind: 'nest', from: 3, to: 3, progress: 0, offset: { x: 0, y: 0.04, z: 0 } }
  const start = antPosition(world.colony, ant)
  assert.equal(advanceInNest(world.colony, ant, 4, 0.02), 0.02)
  assert.equal(ant.location.from, 3); assert.equal(ant.location.to, 3)
  assert.ok(Math.abs(distance(start, antPosition(world.colony, ant)) - 0.02) < 1e-9)
  assert.deepEqual(parseSave(serializeSave(world)), world)
  const bad = structuredClone(world)
  bad.colony.workers[0].location.offset.y = 0.4
  assert.throws(() => parseSave(serializeSave(bad)))
  for (let i = 0; i < 500; i++) {
    const result = stepAntColony(world)
    for (const next of result.world.colony.workers) {
      const before = world.colony.workers.find((item) => item.id === next.id)
      if (before) assert.ok(distance(antPosition(world.colony, before), antPosition(result.world.colony, next)) <= 0.14000001)
    }
    if (i % 11 === 0) assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
    world = { ...result.world, tick: world.tick + 1 }
  }
})

test('an offset cannot borrow a neighboring tunnel and cut through solid soil on departure', () => {
  let world = antFixture()
  const ant = world.colony.workers[0]
  ant.location = { kind: 'nest', from: 2, to: 4, progress: 0.3295800983905792,
    offset: { x: 0.01776295862160623, y: 0.17368409933522344, z: 0.002897342504002154 } }
  assert.ok(nestContains(world.colony, antPosition(world.colony, ant), antContactRadius(ant)), 'repro starts in another valid tunnel')
  assert.throws(() => parseSave(serializeSave(world)))
  ant.location.offset = { x: 0.01, y: 0.02, z: 0.01 }
  assert.doesNotThrow(() => parseSave(serializeSave(world)))
  for (let i = 0; i < 20; i++) {
    const result = stepAntColony(world)
    assert.doesNotThrow(() => parseSave(serializeSave(result.world)))
    world = { ...result.world, tick: world.tick + 1 }
  }
})
