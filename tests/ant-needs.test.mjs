import test from 'node:test'
import assert from 'node:assert/strict'
import { antFixture } from '../scripts/probe_ant_colony.mjs'
import { antFoodSources, antMaterialError, stepAntColony } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

test('a low-reserve worker digests its actual meal in the granary before resuming work', () => {
  const setup = () => {
    const world = antFixture(), ant = world.colony.workers[0]
    world.colony.ledger.introduced += 0.008 - ant.gut
    ant.energy = 28; ant.gut = 0.008; ant.carried = 0; ant.activity = 'feeding'
    ant.location = { kind: 'nest', from: 3, to: 3, progress: 0 }; ant.goal = { kind: 'chamber', id: 3 }
    return world
  }
  const world = setup(), original = structuredClone(world), result = stepAntColony(world)
  const ant = result.world.colony.workers[0]
  assert.equal(ant.activity, 'resting')
  assert.deepEqual(ant.location, world.colony.workers[0].location)
  assert.equal(ant.goal, null)
  assert.ok(ant.gut < world.colony.workers[0].gut && ant.energy > world.colony.workers[0].energy)
  assert.equal(ant.body, world.colony.workers[0].body)
  assert.ok(result.world.colony.ledger.metabolized > world.colony.ledger.metabolized)
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(world, original)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
  let fed = result.world
  for (let i = 0; i < 80 && fed.colony.workers[0].energy < 35; i++) fed = stepAntColony(fed).world
  assert.ok(fed.colony.workers[0].energy >= 35)
  assert.notEqual(fed.colony.workers[0].activity, 'resting')
  for (const condition of ['empty_gut', 'recovered', 'carrying', 'away']) {
    const negative = setup(), actor = negative.colony.workers[0]
    if (condition === 'empty_gut') { negative.colony.ledger.exported += actor.gut + negative.colony.food; actor.gut = 0; negative.colony.food = 0 }
    if (condition === 'recovered') actor.energy = 50
    if (condition === 'carrying') { actor.carried = 0.012; negative.colony.ledger.introduced += actor.carried }
    if (condition === 'away') actor.location = { kind: 'nest', from: 2, to: 2, progress: 0 }
    const stepped = stepAntColony(negative)
    assert.notEqual(stepped.world.colony.workers[0].activity, 'resting', condition)
    assert.ok(Math.abs(antMaterialError(stepped.world.colony)) < 1e-10)
  }
  const empty = setup()
  empty.colony.ledger.exported += empty.colony.food; empty.colony.food = 0
  let hungry = empty
  for (let i = 0; i < 24; i++) hungry = stepAntColony(hungry).world
  assert.notEqual(hungry.colony.workers[0].activity, 'resting')
  assert.ok(hungry.colony.workers[0].energy < 35)
})

test('empty stores do not recall an unloaded adult for an unfunded care trip', () => {
  const setup = () => {
    const world = antFixture(), colony = world.colony
    colony.ledger.exported += colony.food + colony.queen.gut
    colony.food = 0; colony.queen.gut = 0; colony.queen.energy = 45
    const ant = colony.workers[0]
    ant.location = { kind: 'surface', x: 1.9, z: 1.7, heading: 0 }
    ant.activity = 'foraging'; ant.goal = { kind: 'plant', id: 1 }
    return world
  }
  const world = setup(), original = structuredClone(world), result = stepAntColony(world)
  assert.equal(result.world.colony.workers[0].activity, 'foraging')
  assert.equal(result.world.colony.workers[0].goal.kind, 'plant')
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(world, original)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
  const stocked = setup()
  stocked.colony.food = 0.01; stocked.colony.ledger.introduced += 0.01
  assert.equal(stepAntColony(stocked).world.colony.workers[0].activity, 'entering')
})

test('a well-fed queen can fund one replacement egg when food is physically being carried', () => {
  const setup = () => {
    const world = antFixture(), colony = world.colony
    colony.queen.age = 125; colony.queen.energy = 80
    colony.ledger.exported += colony.queen.gut - 0.018; colony.queen.gut = 0.018
    colony.ledger.exported += colony.food - 0.013; colony.food = 0.001
    const carrier = colony.workers[3]
    carrier.carried = 0.012; carrier.activity = 'carrying'
    carrier.location = { kind: 'surface', x: 1.9, z: 1.7, heading: 0 }
    return world
  }
  const world = setup(), original = structuredClone(world), result = stepAntColony(world)
  const egg = result.world.colony.brood.find((cohort) => cohort.stage === 'egg')
  assert.ok(egg && egg.material === 0.004)
  assert.ok(result.events.some((event) => event.action === 'egg'))
  assert.ok(!result.events.some((event) => event.action === 'birth'))
  assert.ok(result.world.colony.queen.gut < world.colony.queen.gut - 0.005)
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(world, original)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
  for (const condition of ['empty', 'hungry', 'low_gut', 'too_few', 'brood']) {
    const negative = setup(), colony = negative.colony
    if (condition === 'empty') { colony.ledger.exported += colony.food + colony.workers[3].carried; colony.food = 0; colony.workers[3].carried = 0 }
    if (condition === 'hungry') colony.queen.energy = 60
    if (condition === 'low_gut') { colony.ledger.exported += colony.queen.gut - 0.01; colony.queen.gut = 0.01 }
    if (condition === 'too_few') for (const ant of colony.workers.slice(1)) ant.energy = 20
    if (condition === 'brood') { colony.brood = [{ id: 0, count: 1, parentId: 0, stage: 'larva', age: 3, material: 0.004 }]; colony.nextBroodId = 1; colony.ledger.introduced += 0.004 }
    const stepped = stepAntColony(negative)
    assert.ok(!stepped.events.some((event) => event.action === 'egg'), condition)
    assert.ok(Math.abs(antMaterialError(stepped.world.colony)) < 1e-10, condition)
  }
})

function larvalWorld() {
  const world = antFixture(), colony = world.colony
  colony.ledger.exported += colony.queen.gut
  colony.queen.gut = 0; colony.queen.energy = 80
  colony.brood = [{ id: 0, stage: 'larva', count: 1, age: 25, material: 0.02, parentId: 0 }]
  colony.nextBroodId = 1; colony.ledger.introduced += 0.02
  const ant = colony.workers[0]
  colony.food -= 0.012; ant.carried = 0.012; ant.activity = 'nursing'
  ant.goal = { kind: 'chamber', id: 4 }
  ant.location = { kind: 'nest', from: 4, to: 4, progress: 0 }
  return world
}

test('a nursery delivery feeds actual larvae instead of oscillating toward a well-reserved queen', () => {
  const world = larvalWorld(), original = structuredClone(world)
  const result = stepAntColony(world), colony = result.world.colony
  assert.ok(colony.brood[0].material > world.colony.brood[0].material)
  assert.equal(colony.workers[0].goal.id, 4)
  assert.ok(result.events.some((e) => e.action === 'nursing' && e.amount > 0))
  assert.ok(Math.abs(antMaterialError(colony)) < 1e-10)
  assert.deepEqual(world, original)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
})

test('a critically hungry queen takes priority and care trips retain their actual destination', () => {
  const world = larvalWorld()
  world.colony.queen.energy = 30
  const urgent = stepAntColony(world).world.colony
  assert.equal(urgent.workers[0].goal.id, 5)
  const committed = larvalWorld(), ant = committed.colony.workers[0]
  ant.goal.id = 5; ant.location = { kind: 'nest', from: 4, to: 5, progress: 0.1 }
  assert.equal(stepAntColony(committed).world.colony.workers[0].goal.id, 5)
})

test('a returning ready carrier can provision a needy queen from its real load when stores are empty', () => {
  const world = larvalWorld(), colony = world.colony, ant = colony.workers[0]
  colony.ledger.exported += colony.food; colony.food = 0
  colony.queen.energy = 30; ant.activity = 'carrying'; ant.goal = { kind: 'chamber', id: 3 }
  ant.location = { kind: 'nest', from: 5, to: 5, progress: 0 }
  const original = structuredClone(world), result = stepAntColony(world)
  assert.ok(result.events.some((event) => event.action === 'feeding' && event.id === 0))
  assert.ok(result.world.colony.queen.gut > 0)
  assert.ok(result.world.colony.workers[0].carried < ant.carried)
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(world, original)
  assert.deepEqual(stepAntColony(parseSave(serializeSave(world))), result)
  const traveling = structuredClone(world)
  traveling.colony.workers[0].location = { kind: 'nest', from: 0, to: 0, progress: 0 }
  const journey = stepAntColony(traveling)
  assert.equal(journey.world.colony.workers[0].goal.id, 5)
  assert.equal(journey.world.colony.queen.gut, 0, 'care still requires real arrival, not a remote transfer')
})

test('ready carriers bring actual material to hungry larvae without trapping protected adults in care', () => {
  const setup = () => {
    const world = larvalWorld(), colony = world.colony, ant = colony.workers[0]
    colony.ledger.exported += colony.food; colony.food = 0
    colony.queen.gut = 0.02; colony.ledger.introduced += 0.02
    ant.activity = 'carrying'; ant.goal = { kind: 'chamber', id: 3 }
    return world
  }
  const world = setup(), result = stepAntColony(world)
  assert.ok(result.world.colony.brood[0].material > world.colony.brood[0].material)
  assert.ok(result.events.some((event) => event.action === 'nursing'))
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  for (const condition of ['hungry', 'teneral', 'stocked']) {
    const protectedWorld = setup(), ant = protectedWorld.colony.workers[0]
    if (condition === 'hungry') ant.energy = 20
    if (condition === 'teneral') { ant.stage = 'teneral'; ant.age = 2 }
    if (condition === 'stocked') { protectedWorld.colony.food = 0.02; protectedWorld.colony.ledger.introduced += 0.02 }
    assert.ok(!stepAntColony(protectedWorld).events.some((event) => event.action === 'nursing'), condition)
  }
})

test('eggs and pupae cannot consume nursery meals or indefinitely trap carried food', () => {
  for (const stage of ['egg', 'pupa']) {
    const world = larvalWorld()
    world.colony.queen.gut = 0.02; world.colony.ledger.introduced += 0.02
    world.colony.brood[0].stage = stage; world.colony.brood[0].age = 0
    const result = stepAntColony(world)
    assert.equal(result.world.colony.workers[0].goal.id, 3)
    assert.ok(!result.events.some((event) => event.action === 'nursing'))
    assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  }
})

test('hungry adults or an underfed colony can interrupt night rest, while tenerals and heat remain protected', () => {
  const setup = () => {
    const world = antFixture(), colony = world.colony, ant = colony.workers[1]
    world.tick = 0; world.climate.photoperiod = true
    ant.location = { kind: 'surface', x: 1.9, z: 1.7, heading: 0 }
    ant.energy = 80; ant.gut = 0.01
    return world
  }
  assert.equal(stepAntColony(setup()).world.colony.workers[1].activity, 'entering')
  const hungry = setup(); hungry.colony.workers[1].energy = 20
  assert.equal(stepAntColony(hungry).world.colony.workers[1].activity, 'foraging')
  const empty = setup(); empty.colony.ledger.exported += empty.colony.food; empty.colony.food = 0
  assert.equal(stepAntColony(empty).world.colony.workers[1].activity, 'foraging')
  const hot = setup(); hot.climate.temperatureC = 40; hot.colony.workers[1].energy = 20
  assert.equal(stepAntColony(hot).world.colony.workers[1].activity, 'entering')
  const young = setup(); young.colony.workers[1].stage = 'teneral'; young.colony.workers[1].age = 3; young.colony.workers[1].energy = 20
  assert.equal(stepAntColony(young).world.colony.workers[1].activity, 'entering')
})

test('a starving carrier eats its actual load before maintenance rather than dying with usable food', () => {
  const world = larvalWorld(), ant = world.colony.workers[0]
  ant.energy = 0.05; world.colony.ledger.exported += ant.gut; ant.gut = 0
  const original = structuredClone(world), result = stepAntColony(world), next = result.world.colony.workers.find((a) => a.id === ant.id)
  assert.ok(next && next.energy > 0)
  assert.ok(next.carried < ant.carried)
  assert.ok(result.events.some((event) => event.action === 'feeding' && event.id === ant.id && event.amount > 0))
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
  assert.deepEqual(world, original)
})

test('a ready adult retains care while a newly emerged worker meets its own needs', () => {
  const world = antFixture(), colony = world.colony
  colony.ledger.exported += colony.queen.gut; colony.queen.gut = 0; colony.queen.energy = 30
  for (const ant of colony.workers) { colony.ledger.introduced += 0.01 - ant.gut; ant.gut = 0.01 }
  colony.workers.push({ ...structuredClone(colony.workers[0]), id: 5, age: 0, stage: 'teneral', body: 0.04, gut: 0, energy: 24, activity: 'resting', goal: null, location: { kind: 'nest', from: 4, to: 4, progress: 0 } })
  colony.ledger.introduced += 0.04; colony.nextAntId = 6
  const result = stepAntColony(world).world.colony
  assert.equal(result.workers[0].activity, 'nursing')
  assert.ok(result.workers[0].carried > 0)
  assert.equal(result.workers.find((ant) => ant.id === 5).activity, 'feeding')
  assert.ok(Math.abs(antMaterialError(result)) < 1e-10)
})

test('an already full queen cannot supply negative food to a committed visitor', () => {
  const world = larvalWorld(), colony = world.colony, ant = colony.workers[0]
  colony.queen.gut = 0.03; colony.ledger.introduced += 0.03
  ant.goal.id = 5; ant.location = { kind: 'nest', from: 4, to: 5, progress: 0.999 }
  const result = stepAntColony(world)
  assert.ok(result.world.colony.workers[0].carried <= ant.carried)
  assert.ok(!result.events.some((event) => event.amount < 0))
  assert.ok(Math.abs(antMaterialError(result.world.colony)) < 1e-10)
})

test('food inspection uses the same mature stock and detection boundary as foraging', () => {
  const world = antFixture(), original = structuredClone(world)
  assert.deepEqual(antFoodSources(world.plants, 1.7, 1.7).map((plant) => plant.id), [0, 1, 2])
  assert.equal(antFoodSources(world.plants, -3, -3).length, 0)
  assert.equal(antFoodSources(world.plants.map((plant) => ({ ...plant, development: 0 })), 1.7, 1.7).length, 0)
  assert.equal(antFoodSources(world.plants.map((plant) => ({ ...plant, biomass: plant.capacity * 0.7 })), 1.7, 1.7).length, 0)
  assert.deepEqual(world, original)
})
