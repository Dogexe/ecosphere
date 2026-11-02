import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, stepWorld } from '../src/sim/ecosystem.ts'
import { introduceColony, antMaterialError } from '../src/sim/colony.ts'
import { addRemains } from '../src/sim/life.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

test('v3 writes explicit absent colony while v1/v2 migrate without unsolicited ants or changed empty futures', () => {
  const world = createWorld()
  const native = JSON.parse(serializeSave(world))
  assert.equal(native.version, 3)
  assert.equal(native.world.colony, null)
  assert.deepEqual(parseSave(JSON.stringify(native)), world)
  for (const version of [1, 2]) {
    const legacy = { version, world: structuredClone(world) }
    const restored = parseSave(JSON.stringify(legacy))
    assert.equal(restored.colony, undefined)
    assert.deepEqual(stepWorld(restored), stepWorld(world))
  }
})

test('v3 retains funded brood, carried food and real graph transit without altering other organisms', () => {
  const world = introduceColony(createWorld(), 1.7, 1.7)
  const colony = world.colony
  colony.workers[0].carried = 0.01
  colony.workers[0].activity = 'carrying'
  colony.workers[0].location = { kind: 'nest', from: 3, to: 2, progress: 0.4 }
  colony.workers[0].goal = { kind: 'chamber', id: 4 }
  colony.workers[1].age = 1
  colony.workers[1].stage = 'teneral'
  colony.brood = [{ id: 0, count: 1, stage: 'larva', age: 9.5, material: 0.02, parentId: 0 }]
  colony.nextBroodId = 1
  colony.food -= 0.03
  assert.ok(Math.abs(antMaterialError(colony)) < 1e-12)
  const restored = parseSave(serializeSave(world))
  assert.deepEqual(restored, world)
  assert.notEqual(restored.colony.nodes, colony.nodes)
  assert.notEqual(restored.colony.workers[0].location, colony.workers[0].location)
  for (const version of [1, 2]) assert.throws(() => parseSave(JSON.stringify({ version, world })))
})

test('v3 rejects damaged graph, actor references, unbounded populations and unbalanced material', () => {
  const native = JSON.parse(serializeSave(introduceColony(createWorld(), 1.7, 1.7)))
  const edits = [
    (c) => { c.nodes[2].id = c.nodes[1].id },
    (c) => { c.edges.pop() },
    (c) => { c.edges.push([0, 1]) },
    (c) => { c.edges[0] = [0, 999] },
    (c) => { c.nodes[2].x = -1.1; c.nodes[2].z = 0.72 },
    (c) => { c.nodes[1].y = 0 },
    (c) => { c.patchId = 0 },
    (c) => { c.workers[0].location = { kind: 'nest', from: 0, to: 5, progress: 0.5 } },
    (c) => { c.workers[0].goal = { kind: 'plant', id: 999999 } },
    (c) => { c.workers[1].id = c.workers[0].id },
    (c) => { c.workers[0].carried = 5 },
    (c) => { c.workers[0].stage = 'teneral' },
    (c) => { c.queen.location = { kind: 'surface', x: 1.7, z: 1.7, heading: 0 } },
    (c) => { c.brood = Array.from({ length: 5 }, (_, id) => ({ id, count: 4, stage: 'egg', age: 0, material: 0.016, parentId: 0 })) },
    (c) => { c.food = -1 },
    (c) => { c.nextAntId = 2 },
    (c) => { c.ledger.introduced += 0.05 },
  ]
  for (const edit of edits) {
    const save = structuredClone(native)
    edit(save.world.colony)
    assert.throws(() => parseSave(JSON.stringify(save)), edit.toString())
  }
  const missing = structuredClone(native); delete missing.world.colony
  assert.throws(() => parseSave(JSON.stringify(missing)))
})

test('ant remains transfer out of the colony once and decompose through existing local pools', () => {
  const world = introduceColony(createWorld(), 1.7, 1.7), colony = world.colony
  const worker = colony.workers.pop()
  const material = worker.body + worker.gut + worker.carried
  colony.ledger.remains += material
  addRemains(world.remains, 'ant', colony.entrance.x, colony.entrance.z, material, colony.patchId)
  const restored = parseSave(serializeSave(world))
  assert.ok(Math.abs(antMaterialError(restored.colony)) < 1e-12)
  assert.equal(restored.remains[0].kind, 'ant')
  const next = stepWorld(restored)
  assert.ok(next.remains[0].material < material)
  assert.equal(next.colony.ledger.remains, material)
  assert.ok(Math.abs(antMaterialError(next.colony)) < 1e-12)
  assert.throws(() => parseSave(JSON.stringify({ version: 2, world })))
})

test('v3 rejects a tunnel crossing the bank between sample points', () => {
  const world = introduceColony(createWorld(), 0.7, 1.7), colony = world.colony
  colony.nodes.push({ id: 6, x: 0.029, y: -0.3, z: 0.06375, role: 'junction' },
    { id: 7, x: 0.029, y: -0.3, z: 1.56375, role: 'junction' })
  colony.edges.push([0, 7], [6, 7])
  colony.workers[0].location = { kind: 'nest', from: 6, to: 7, progress: 0.4375 }
  assert.throws(() => parseSave(serializeSave(world)))
})

test('every accepted nest placement produces a saveable connected graph without crossing water', () => {
  const world = createWorld()
  let accepted = 0
  for (let x = -3; x <= 3; x += 0.25) for (let z = -3; z <= 3; z += 0.25) {
    const result = introduceColony(world, x, z)
    if (result === world) continue
    assert.deepEqual(parseSave(serializeSave(result)), result)
    accepted++
  }
  assert.ok(accepted > 100)
})
