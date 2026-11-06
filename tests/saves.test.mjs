import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, creatureCounts, interveneAt, stepWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('a saved snapshot resumes the same deterministic future', () => {
  const world = advance(interveneAt(createWorld(183), 'compost', 2), 75)
  const restored = parseSave(serializeSave(world))
  assert.deepEqual(restored, world)
  assert.deepEqual(advance(restored, 120), advance(world, 120))
  assert.notEqual(restored.soil, world.soil)
  assert.notEqual(restored.plants[0], world.plants[0])
})

test('a loaded branch does not change its saved snapshot', () => {
  const encoded = serializeSave(createWorld())
  const snapshot = parseSave(encoded)
  const before = structuredClone(snapshot)
  const branch = advance(snapshot, 150)
  assert.notEqual(branch.tick, snapshot.tick)
  assert.deepEqual(snapshot, before)
})

test('corrupt, unsupported, and unsafe states are rejected', () => {
  assert.throws(() => parseSave('{incomplete'))
  const base = JSON.parse(serializeSave(createWorld()))
  const invalid = [
    (save) => { save.version = 4 },
    (save) => { save.world.plants[0].kind = 'unknown' },
    (save) => { save.world.plants[0].kind = ['moss'] },
    (save) => { save.world.plants[0].kind = { name: 'fern' } },
    (save) => { save.world.soil[0].water = null },
    (save) => { save.world.light = '1' },
    (save) => { save.world.seed = 4294967296 },
    (save) => { save.world.creatures[0].energy = -1 },
    (save) => { save.world.creatures[0].kind = 'unknown' },
    (save) => { save.world.creatures[0].kind = ['woodlouse'] },
    (save) => { save.world.creatures[0].kind = null },
    (save) => { save.world.plants[0].capacity = 0 },
    (save) => { save.world.creatures[0].x = -1.1; save.world.creatures[0].z = 0.72 },
    (save) => { save.world.plants.push(save.world.plants[0]) },
    (save) => { save.world.creatures.push(save.world.creatures[0]) },
    (save) => { save.world.plants = Array(33).fill(save.world.plants[0]) },
    (save) => { delete save.world.soil },
    (save) => { save.world.soil = [] },
    (save) => { save.world.soil[1].id = save.world.soil[0].id },
  ]
  for (const edit of invalid) {
    const save = structuredClone(base)
    edit(save)
    assert.throws(() => parseSave(JSON.stringify(save)))
  }
  assert.equal(creatureCounts(base.world.creatures).grazer, 3)
})

test('legacy animals migrate to grazers without adding new organisms', () => {
  const save = JSON.parse(serializeSave(createWorld()))
  save.version = 1
  delete save.world.colony
  save.world.creatures = save.world.creatures.filter((creature) => creature.kind === 'grazer')
  for (const creature of save.world.creatures) delete creature.kind
  const restored = parseSave(JSON.stringify(save))
  assert.deepEqual(creatureCounts(restored.creatures), { grazer: 3, woodlouse: 0, beetle: 0, springtail: 0, flea: 0, fish: 0, snail: 0, shrimp: 0 })
  assert.deepEqual(stepWorld(restored), stepWorld(save.world))
})

test('animal population limits are enforced for each role on load', () => {
  const save = JSON.parse(serializeSave(createWorld()))
  save.world.creatures = Array.from({ length: 8 }, (_, id) => ({ ...save.world.creatures[0], id }))
  assert.throws(() => parseSave(JSON.stringify(save)))
  save.world.creatures = Array.from({ length: 5 }, (_, id) => ({ ...save.world.creatures[0], kind: 'woodlouse', id }))
  assert.throws(() => parseSave(JSON.stringify(save)))
})

test('world summaries are derived from validated local soil on load', () => {
  const save = JSON.parse(serializeSave(createWorld()))
  save.world.water = 12
  assert.equal(parseSave(JSON.stringify(save)).water, 58)
})
