import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, isLand, stepWorld } from '../src/sim/ecosystem.ts'
import { introduceColony } from '../src/sim/colony.ts'
import { pondCenter } from '../src/sim/pond.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { autosaveKey, readAutosave, unreadableKey } from '../src/sim/autosave.ts'

// Worlds saved before 2026-11-03 had a 0.93 radius pond with land from 1.05.
const oldLand = (x, z) => Math.hypot(x - pondCenter.x, z - pondCenter.z) >= 1.05
const oldSave = (mutate) => { const envelope = JSON.parse(serializeSave(createWorld(5))); mutate(envelope.world); return JSON.stringify(envelope) }

test('the pond is 6 cm across: a 1.58 unit radius at about 19 mm per unit', () => {
  assert.equal(pondCenter.radius, 1.58)
  assert.ok(Math.abs(pondCenter.radius * 2 * 19 - 60) < 1)
  for (const patch of createWorld().soil) assert.ok(isLand(patch.x, patch.z), `pocket ${patch.id} is on land`)
  for (const item of [...createWorld().plants, ...createWorld().creatures]) assert.ok(isLand(item.x, item.z))
})

test('an old save with life on land the pond now covers loads with that life moved onto the bank', () => {
  const text = oldSave((world) => {
    world.plants[0] = { ...world.plants[0], x: pondCenter.x + 1.2, z: pondCenter.z }
    world.creatures[0] = { ...world.creatures[0], x: pondCenter.x, z: pondCenter.z + 1.3 }
    world.soil[2] = { ...world.soil[2], x: -1.7, z: 1.7 }
  })
  const original = JSON.parse(text).world
  assert.ok(oldLand(original.plants[0].x, original.plants[0].z) && !isLand(original.plants[0].x, original.plants[0].z))
  const world = parseSave(text)
  assert.equal(world.plants.length, original.plants.length)
  assert.equal(world.creatures.length, original.creatures.length)
  for (const item of [...world.plants, ...world.creatures]) assert.ok(isLand(item.x, item.z))
  assert.ok(Math.hypot(world.plants[0].x - original.plants[0].x, world.plants[0].z - original.plants[0].z) < 0.6)
  assert.deepEqual([world.soil[2].x, world.soil[2].z], [-1.6, 2.45])
  // Once moved it saves and continues like any other world.
  assert.deepEqual(parseSave(serializeSave(world)), world)
  assert.doesNotThrow(() => stepWorld(world))
})

test('land life that was already in the old pond is still rejected as damaged', () => {
  assert.throws(() => parseSave(oldSave((world) => { world.plants[0] = { ...world.plants[0], x: pondCenter.x + 0.5, z: pondCenter.z } })))
})

test('an old ant nest the pond now floods moves as one piece and stays connected', () => {
  const world = introduceColony(createWorld(5), 1.7, 1.7)
  const envelope = JSON.parse(serializeSave(world))
  // Slide the whole nest toward the pond so its entrance sits on the old bank.
  const dx = -1.5, dz = -0.35
  const shift = (value) => { if (Array.isArray(value)) value.forEach(shift); else if (value && typeof value === 'object') { if (typeof value.x === 'number' && typeof value.z === 'number') { value.x += dx; value.z += dz } for (const [key, item] of Object.entries(value)) if (key !== 'offset') shift(item) } }
  shift(envelope.world.colony)
  const entrance = envelope.world.colony.entrance
  assert.ok(oldLand(entrance.x, entrance.z) && !isLand(entrance.x, entrance.z, 0.08))
  const loaded = parseSave(JSON.stringify(envelope))
  assert.ok(loaded.colony)
  assert.equal(loaded.colony.workers.length, world.colony.workers.length)
  for (const node of loaded.colony.nodes) assert.ok(isLand(node.x, node.z, 0.08))
  const moved = { x: loaded.colony.entrance.x - entrance.x, z: loaded.colony.entrance.z - entrance.z }
  loaded.colony.nodes.forEach((node, index) => {
    const before = envelope.world.colony.nodes[index]
    assert.ok(Math.abs(node.x - before.x - moved.x) < 1e-9 && Math.abs(node.z - before.z - moved.z) < 1e-9)
  })
})

test('an autosave this version cannot read is kept aside instead of being lost', () => {
  const items = new Map([[autosaveKey, '{"version":1,"world":"not a world"}']])
  const store = { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => { items.set(key, value) }, removeItem: (key) => { items.delete(key) } }
  assert.equal(readAutosave(store), null)
  assert.equal(items.get(unreadableKey), '{"version":1,"world":"not a world"}')
  items.set(autosaveKey, 'second bad save')
  readAutosave(store)
  assert.equal(items.get(unreadableKey), '{"version":1,"world":"not a world"}')
})
