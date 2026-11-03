import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, intervene, stepWorld, vitality } from '../src/sim/ecosystem.ts'
import { metrics, projectWorld, recordSample, sampleWorld } from '../src/sim/observatory.ts'

const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('a sample reads the world without changing it', () => {
  const world = advance(createWorld(31), 12)
  const before = structuredClone(world)
  const sample = sampleWorld(world)
  assert.deepEqual(world, before)
  assert.equal(sample.tick, world.tick)
  assert.equal(sample.plants, world.plants.length)
  assert.equal(sample.leafCover, vitality(world) * 100)
  assert.equal(sample.soilWater, world.water)
  assert.equal(sample.grazer, world.creatures.filter((creature) => creature.kind === 'grazer').length)
  for (const metric of metrics) assert.ok(Number.isFinite(sample[metric.key]), metric.key)
})

test('history keeps one sample per hour, restarts when time goes back, and is capped', () => {
  let world = createWorld(5)
  let history = recordSample([], world)
  world = stepWorld(world)
  history = recordSample(history, world)
  assert.deepEqual(history.map((sample) => sample.tick), [0, 1])
  const watered = intervene(world, { type: 'water' })
  history = recordSample(history, watered)
  assert.equal(history.length, 2)
  assert.equal(history[1].soilWater, watered.water)
  history = recordSample(history, createWorld(5))
  assert.deepEqual(history.map((sample) => sample.tick), [0])
  let capped = []
  for (let tick = 0; tick < 10; tick += 1) capped = recordSample(capped, { ...world, tick }, 4)
  assert.deepEqual(capped.map((sample) => sample.tick), [6, 7, 8, 9])
})

test('a projection replays the unchanged solver, is deterministic and leaves its source intact', () => {
  const source = advance(createWorld(77), 30)
  const before = structuredClone(source)
  const projected = projectWorld(source, 48)
  assert.deepEqual(source, before)
  assert.equal(projected.length, 49)
  assert.deepEqual(projected[0], sampleWorld(source))
  assert.deepEqual(projected[48], sampleWorld(advance(source, 48)))
  assert.deepEqual(projectWorld(source, 48), projected)
})
