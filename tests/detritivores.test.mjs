import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, creatureCounts, creatureIsFeeding, introduceLife, intervene, isLand, stepWorld } from '../src/sim/ecosystem.ts'

function habitat({ water = 75, organic = 12, energy = 40 } = {}) {
  const base = createWorld()
  return { ...base, plants: [], creatures: [{ id: 0, kind: 'woodlouse', x: -1.7, z: 1.7, heading: 0, energy }],
    soil: base.soil.map((patch) => ({ ...patch, water, organic, fungi: 0 })), water, organic,
  }
}
const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('woodlice ingest local litter into the gut without instant energy or consuming plants', () => {
  const initial = { ...habitat(), plants: createWorld().plants }
  const snapshot = structuredClone(initial)
  const fed = stepWorld(initial)
  const control = stepWorld({ ...initial, creatures: [] })
  const consumed = fed.creatures[0].life.gut
  const litterLoss = control.soil[2].organic - fed.soil[2].organic
  const nutrients = fed.soil[2].nutrients - control.soil[2].nutrients
  assert.ok(consumed > 0)
  assert.ok(Math.abs(litterLoss - consumed) < 1e-9)
  assert.ok(Math.abs(nutrients) < 1e-9)
  assert.ok(fed.creatures[0].energy < initial.creatures[0].energy)
  assert.deepEqual(fed.plants, control.plants)
  assert.equal(fed.grazed, 0)
  assert.deepEqual(fed.soil.filter((patch) => patch.id !== 2), control.soil.filter((patch) => patch.id !== 2))
  assert.deepEqual(initial, snapshot)
  assert.ok(creatureIsFeeding(initial, initial.creatures[0]))
})

test('woodlice navigate to moist litter and stay out of the pond', () => {
  let world = habitat({ energy: 95 })
  world = { ...world, creatures: [{ ...world.creatures[0], x: 1.7, z: -1.7 }], soil: world.soil.map((patch) => ({ ...patch, water: patch.id === 2 ? 75 : 1 })) }
  const initialDistance = Math.hypot(world.creatures[0].x + 1.7, world.creatures[0].z - 1.7)
  for (let tick = 0; tick < 110; tick += 1) {
    world = stepWorld(world)
    assert.ok(world.creatures.every((creature) => isLand(creature.x, creature.z)))
  }
  assert.ok(world.creatures.length > 0)
  assert.ok(Math.hypot(world.creatures[0].x + 1.7, world.creatures[0].z - 1.7) < initialDistance / 3)
  assert.ok(world.soil[2].nutrients > 42)
})

test('a lone detritivore rests when fed and cannot produce unpaired offspring', () => {
  const initial = habitat({ energy: 95 })
  const born = stepWorld(initial)
  assert.equal(creatureCounts(born.creatures).woodlouse, 1)
  assert.ok(born.creatures.every((creature) => creature.kind === 'woodlouse'))
  assert.equal(born.creatures[0].life.brood, 0)
  assert.equal(born.creatures[0].life.activity, 'resting')
  assert.ok(Math.abs(born.creatures[0].energy - 94.88) < 1e-9)
  assert.equal(stepWorld(habitat({ energy: 95, organic: 0.1 })).creatures.length, 1)
})

test('wet litter supports offspring while dryness and absent food cause extinction', () => {
  const pair = habitat({ energy: 75 })
  pair.creatures.push({ ...pair.creatures[0], id: 1, x: -1.5 })
  assert.ok(creatureCounts(advance(pair, 120).creatures).woodlouse > 2)
  assert.equal(advance(habitat({ energy: 60, water: 0 }), 240).creatures.length, 0)
  assert.equal(advance(habitat({ energy: 60, organic: 0 }), 240).creatures.length, 0)
})

test('a tended litter food web can persist after living producers are absent', () => {
  let world = habitat({ energy: 60, organic: 20 })
  world = { ...world, creatures: [...world.creatures, { ...createWorld().creatures[0], energy: 60 }] }
  for (let tick = 0; tick < 240; tick += 1) {
    if (world.water < 55) world = intervene(world, { type: 'water' })
    world = stepWorld(world)
  }
  assert.equal(world.plants.length, 0)
  assert.equal(creatureCounts(world.creatures).grazer, 0)
  assert.ok(creatureCounts(world.creatures).woodlouse > 0)
})

test('each animal role has its own cap', () => {
  const base = habitat()
  const grazers = Array.from({ length: 7 }, (_, id) => ({ id, kind: 'grazer', x: 1, z: -1, energy: 50, heading: 0 }))
  const introduced = introduceLife({ ...base, creatures: grazers }, 'woodlouse', -1.7, 1.7)
  assert.deepEqual(creatureCounts(introduced.creatures), { grazer: 7, woodlouse: 1, beetle: 0, springtail: 0, flea: 0, fish: 0 })
  const full = { ...base, creatures: Array.from({ length: 4 }, (_, id) => ({ ...base.creatures[0], id, energy: 95 })) }
  assert.equal(stepWorld(full).creatures.length, 4)
  assert.equal(introduceLife(full, 'woodlouse', 1.7, -1.7), full)
})

test('a dead woodlouse returns its species-specific body stock locally', () => {
  const world = stepWorld(habitat({ water: 0, organic: 0, energy: 0.1 }))
  assert.equal(world.creatures.length, 0)
  assert.equal(world.soil[2].organic + world.remains.reduce((sum, item) => sum + item.material, 0), 0.22)
  assert.equal(world.remains[0].patchId, 2)
})
