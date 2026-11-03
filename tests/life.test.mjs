import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, introduceLife, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { bodyStock, decayRemains, plantFlowering, plantLifetime, plantStage, woodlouseLife } from '../src/sim/life.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { lifespan } from '../src/sim/pond.ts'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
function habitat() {
  const world = createWorld(17)
  return { ...world, plants: [], creatures: [], climate: { temperatureC: 22, rainfall: 0.6 },
    soil: world.soil.map((patch) => ({ ...patch, water: 70, organic: 30, fungi: 0 })) }
}
function animal(id, changes = {}) {
  const creature = { id, kind: 'woodlouse', x: -1.4 + id * 0.15, z: 2.5, heading: 0, energy: 76, age: 60, stage: 'adult', materialReserve: 0, ...changes }
  return { ...creature, life: woodlouseLife(creature) }
}
const advance = (world, n) => Array.from({ length: n }).reduce(stepWorld, world)

test('introduced propagules germinate under suitable conditions and dry seeds fail to develop', () => {
  const initial = introduceLife(habitat(), 'clover', 1.7, -1.7)
  assert.equal(plantStage(initial.plants[0]), 'seed')
  const wet = advance(initial, 24)
  assert.ok(wet.plants[0].development > 6)
  assert.ok(wet.plants[0].biomass > initial.plants[0].biomass)
  const dry = advance({ ...initial, climate: { ...initial.climate, rainfall: 0 }, soil: initial.soil.map((p) => ({ ...p, water: 0 })) }, 24)
  assert.ok(dry.plants.length === 0 || dry.plants[0].development < wet.plants[0].development / 5)
  assert.equal(initial.plants[0].development, 0)
})

test('loss of foliage does not reverse ontogeny, while flowers still need sufficient living cover', () => {
  for (const kind of ['lily', 'reed', 'bloom']) {
    const grown = { id: 0, kind, x: 0, z: 0, age: 100, development: 90, biomass: 8, capacity: 10 }
    assert.equal(plantStage(grown), 'mature')
    assert.equal(plantFlowering(grown), true)
    const damaged = { ...grown, age: 101, biomass: 0.8 }
    assert.equal(plantStage(damaged), 'mature')
    assert.equal(plantFlowering(damaged), false)
    assert.equal(plantFlowering({ ...damaged, biomass: 7 }), true)
    assert.equal(plantFlowering({ ...grown, age: 20, development: 20 }), false)
    assert.equal(plantStage({ ...damaged, age: plantLifetime[kind] * 0.8 }), 'senescent')
  }
})

test('senescence ends in material-backed remains which decay gradually in the same pocket', () => {
  const base = createWorld()
  const plant = { ...base.plants[0], age: plantLifetime[base.plants[0].kind] - 1 }
  assert.equal(plantStage(plant), 'senescent')
  const result = simulateStep({ ...base, plants: [plant], creatures: [] })
  assert.equal(result.world.plants.length, 0)
  assert.ok(result.events.some((e) => e.type === 'death' && e.reason === 'age'))
  const remains = result.world.remains
  assert.equal(remains.length, 1)
  assert.equal(remains[0].age, 0)
  const decay = decayRemains(remains, result.world.soil, result.world.pond, 22)
  const patch = remains[0].patchId
  assert.ok(decay.remains[0].material < remains[0].material)
  near(decay.soil[patch].organic - result.world.soil[patch].organic, remains[0].material - decay.remains[0].material)
  for (const other of decay.soil.filter((p) => p.id !== patch)) assert.deepEqual(other, result.world.soil[other.id])
  const dry = decayRemains(remains, result.world.soil.map((p) => ({ ...p, water: 0 })), result.world.pond, 22)
  near(dry.remains[0].material, remains[0].material)
})

test('woodlouse digestion partitions one meal into gut loss, feces, nutrients and juvenile growth', () => {
  const base = habitat()
  const juvenile = animal(0, { age: 10, stage: 'juvenile', energy: 50 })
  juvenile.life = { ...juvenile.life, mass: 0.1, gut: 0.1 }
  const result = stepWorld({ ...base, creatures: [juvenile] })
  const control = stepWorld({ ...base, creatures: [] })
  const child = result.creatures[0]
  const digested = 0.04
  near(child.life.mass - juvenile.life.mass, digested * 0.15)
  near(result.soil[2].nutrients - control.soil[2].nutrients, digested * 0.35)
  // Remove new ingestion from the observed litter difference.
  const ingested = child.life.gut - juvenile.life.gut + digested
  near(result.soil[2].organic - control.soil[2].organic + ingested, digested * 0.4)
  assert.ok(child.energy > juvenile.energy)
  assert.equal(child.stage, 'juvenile')
  const tinyOld = animal(0, { age: 90, stage: 'juvenile' }); tinyOld.life.mass = 0.06
  assert.equal(stepWorld({ ...base, creatures: [tinyOld] }).creatures[0].stage, 'juvenile')
  const full = animal(0, { energy: 100 }); full.life.gut = 0.1
  const resting = stepWorld({ ...base, creatures: [full] })
  assert.ok(resting.creatures[0].energy <= 100)
  assert.doesNotThrow(() => parseSave(serializeSave(resting)))
})

test('courtship requires a pair, gestation delays birth, and offspring carry funded mass and parent identity', () => {
  const initial = { ...habitat(), creatures: [animal(0), animal(1)] }
  const snapshot = structuredClone(initial)
  let world = initial
  for (let i = 0; i < 4; i++) world = stepWorld(world)
  assert.equal(world.creatures.length, 2)
  const mother = world.creatures.find((c) => c.life.sex === 'female')
  near(mother.life.brood, 0.11)
  assert.equal(mother.life.gestation, 24)
  assert.ok(mother.energy < initial.creatures[0].energy - 8)
  const beforeBirth = advance(world, 23)
  assert.equal(beforeBirth.creatures.length, 2)
  const result = simulateStep(beforeBirth)
  const children = result.world.creatures.filter((c) => c.life.parentId === mother.id)
  assert.equal(children.length, 2)
  for (const child of children) { assert.equal(child.age, 0); assert.equal(child.stage, 'juvenile'); near(child.life.mass, 0.055) }
  near(result.world.creatures[0].life.brood + children.reduce((n, c) => n + c.life.mass, 0), mother.life.brood)
  assert.ok(result.events.filter((e) => e.type === 'birth').length === 2)
  assert.equal(advance({ ...initial, creatures: [animal(0)] }, 80).creatures.length, 1)
  assert.deepEqual(initial, snapshot)
})

test('the playable forest start supports an observable brooded generation growing into adulthood', () => {
  let world = createHabitatWorld('woodland', 2217)
  let childId = null
  for (let i = 0; i < 70; i++) {
    const result = simulateStep(world)
    const birth = result.events.find((event) => event.type === 'birth' && event.kind === 'woodlouse')
    if (birth) { childId = birth.id; assert.equal(result.world.creatures.find((c) => c.id === childId).stage, 'juvenile') }
    world = result.world
  }
  assert.notEqual(childId, null)
  const young = world.creatures.find((c) => c.id === childId)
  assert.ok(young.life.mass < 0.2)
  const adult = advance(world, 170).creatures.find((c) => c.id === childId)
  assert.equal(adult.stage, 'adult')
  assert.ok(adult.life.mass > young.life.mass)
  assert.notEqual(adult.life.parentId, null)
})

test('fleeing does not suspend gestation or hydration and death retains body, brood and undigested food', () => {
  const parent = animal(0)
  parent.life = { ...parent.life, brood: 0.11, gestation: 10, gut: 0.1, hydration: 30 }
  const hunter = { id: 7, kind: 'beetle', x: -0.9, z: 2.5, heading: 0, energy: 40, age: 72, stage: 'adult' }
  const fled = stepWorld({ ...habitat(), creatures: [parent, hunter] }).creatures.find((c) => c.id === 0)
  assert.equal(fled.life.activity, 'fleeing')
  assert.equal(fled.life.gestation, 9)
  assert.ok(fled.life.hydration > 30)
  const almostAdult = { ...parent, age: 90, stage: 'juvenile', life: { ...parent.life, mass: 0.199, gut: 0.04 } }
  const matureWhileFleeing = stepWorld({ ...habitat(), creatures: [almostAdult, hunter] })
  assert.equal(matureWhileFleeing.creatures.find((c) => c.id === 0).stage, 'adult')
  assert.doesNotThrow(() => parseSave(serializeSave(matureWhileFleeing)))
  const dead = { ...parent, age: lifespan.woodlouse - 1 }
  const result = stepWorld({ ...habitat(), creatures: [dead] })
  assert.equal(result.creatures.length, 0)
  near(result.remains[0].material, bodyStock(dead, 0.22))
})

test('life pools, remains and persistent family IDs survive snapshots; malformed additions are rejected', () => {
  const world = advance({ ...habitat(), creatures: [animal(0), animal(1)] }, 35)
  const loaded = parseSave(serializeSave(world))
  assert.deepEqual(advance(loaded, 60), advance(world, 60))
  for (const mutate of [
    (w) => { w.creatures[0].life.gut = -1 },
    (w) => { w.creatures[0].life.mass = 1 },
    (w) => { w.creatures[1].life.brood = 0.1 },
    (w) => { w.nextCreatureId = 0 },
  ]) { const envelope = JSON.parse(serializeSave(world)); mutate(envelope.world); assert.throws(() => parseSave(JSON.stringify(envelope))) }
  const emptied = { ...world, creatures: [] }
  const introduced = introduceLife(emptied, 'woodlouse', 1.7, -1.7)
  assert.ok(introduced.creatures[0].id >= world.nextCreatureId)
})
