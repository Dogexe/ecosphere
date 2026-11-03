import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, creatureCounts, creatureIsFeeding, introduceLife, intervene, isLand, predatorThreat, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const animal = (id, kind, x, z, energy = 55) => ({ id, kind, x, z, heading: 0, energy })
// Litter left after one hour of bacterial decay in an empty habitat; capture
// and death deposits arrive after decay, so they add to this baseline.
const decayedLitter = () => simulateStep(habitat([])).world.soil[1].organic

function habitat(creatures, plants = []) {
  const base = createWorld(17)
  return { ...base, creatures, plants, soil: base.soil.map((patch) => ({ ...patch, water: 75, organic: 10, fungi: 0 })), water: 75, organic: 10 }
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('hungry hunters close distance, flee responses stop grazing, and catching requires contact', () => {
  const prey = animal(0, 'grazer', 1.7, -1.7)
  const hunter = animal(1, 'beetle', 0.7, -1.7)
  const plant = { id: 0, kind: 'clover', x: prey.x, z: prey.z, biomass: 5, capacity: 8.8 }
  const initial = habitat([prey, hunter], [plant])
  const { world, events } = simulateStep(initial)
  assert.ok(world.creatures[0].x > prey.x)
  assert.ok(world.creatures[1].x > hunter.x)
  assert.ok(world.creatures[0].x - world.creatures[1].x < prey.x - hunter.x)
  assert.equal(events.some((event) => event.type === 'feeding' || event.type === 'predation'), false)
  assert.equal(world.grazed, 0)
  assert.ok(predatorThreat(initial, prey))
  assert.equal(creatureIsFeeding(initial, prey), false)
  assert.ok(stepWorld({ ...initial, creatures: [prey] }).grazed > 0)
})

test('fed beetles rest and do not kill nearby prey; hunting does not have unlimited perception', () => {
  const initial = habitat([animal(0, 'grazer', 1.7, -1.7), animal(1, 'beetle', 1.65, -1.7, 78)])
  const resting = simulateStep(initial)
  assert.equal(resting.world.creatures.length, 2)
  assert.equal(resting.world.creatures[1].x, 1.65)
  assert.equal(resting.events.some((event) => event.type === 'predation'), false)
  const far = habitat([animal(0, 'grazer', -2.5, -1), animal(1, 'beetle', 2.5, -1)])
  const wandering = stepWorld(far)
  // With no perceived target, heading follows seeded exploration, not distant prey.
  assert.ok(wandering.creatures[1].z > -1)
  assert.ok(wandering.creatures[1].energy < 55 - 0.32)
})

test('one capture partitions the prey body and cannot duplicate a corpse or feed two hunters', () => {
  const initial = habitat([animal(0, 'grazer', 1.7, -1.7), animal(1, 'beetle', 1.65, -1.7), animal(2, 'beetle', 1.7, -1.65)])
  const result = simulateStep(initial)
  const catches = result.events.filter((event) => event.type === 'predation')
  assert.equal(catches.length, 1)
  assert.equal(result.world.creatures.some((creature) => creature.id === 0), false)
  assert.equal(result.events.some((event) => event.type === 'death' && event.id === 0), false)
  const caught = catches[0]
  near(caught.preyMaterial, caught.offspringMaterial + caught.litter + caught.metabolized)
  near(result.world.soil[1].organic - decayedLitter(), caught.litter)
  assert.ok(result.world.creatures.find((creature) => creature.id === caught.predatorId).energy > 55)
  assert.equal(creatureIsFeeding(result.world, result.world.creatures[0], []), false)
  assert.equal(creatureIsFeeding(result.world, result.world.creatures.find((creature) => creature.id === caught.predatorId), result.events), true)
})

test('energy death precedes capture and captured parents cannot reproduce', () => {
  const dying = simulateStep(habitat([animal(0, 'grazer', 1.7, -1.7, 0.1), animal(1, 'beetle', 1.65, -1.7)]))
  assert.equal(dying.events.filter((event) => event.type === 'death').length, 1)
  assert.equal(dying.events.some((event) => event.type === 'predation'), false)
  near(dying.world.soil[1].organic + dying.world.remains.reduce((sum, item) => sum + item.material, 0), decayedLitter() + 0.42)
  const captured = simulateStep(habitat([animal(0, 'grazer', 1.7, -1.7, 95), animal(1, 'beetle', 1.65, -1.7)], [{ id: 0, kind: 'clover', x: 1.7, z: -1.7, biomass: 5, capacity: 8.8 }]))
  assert.equal(captured.events.some((event) => event.type === 'predation'), true)
  assert.equal(captured.events.some((event) => event.type === 'birth'), false)
})

test('predator young require sufficient catch material and split the existing reserve', () => {
  const brood = [animal(0, 'grazer', 1.7, -1.7), animal(1, 'grazer', 0, -2.5), animal(2, 'woodlouse', -2.5, -1), animal(3, 'woodlouse', 0.4, 2.5), animal(4, 'beetle', 1.65, -1.7, 95)]
  const result = simulateStep(habitat(brood))
  assert.equal(creatureCounts(result.world.creatures).beetle, 2)
  const catchEvent = result.events.find((event) => event.type === 'predation')
  const birth = result.events.find((event) => event.type === 'birth' && event.kind === 'beetle')
  assert.ok(birth)
  near(catchEvent.offspringMaterial, 0.34)
  near(catchEvent.preyMaterial, catchEvent.offspringMaterial + catchEvent.litter + catchEvent.metabolized)
  near(result.world.creatures.filter((creature) => creature.kind === 'beetle').reduce((sum, creature) => sum + creature.energy, 0), 95 - 0.32 + (0.42 - 0.34) * 60)
  assert.equal(result.world.creatures.some((creature) => creature.id === 0), false)
  const tinyCatch = simulateStep(habitat(brood.map((creature) => creature.id === 0 ? { ...creature, kind: 'woodlouse' } : creature)))
  assert.equal(creatureCounts(tinyCatch.world.creatures).beetle, 1)
  assert.equal(tinyCatch.events.find((event) => event.type === 'predation').offspringMaterial, 0)
  assert.ok(result.world.creatures.every((creature) => isLand(creature.x, creature.z)))
})

test('carnivorous beetles cannot live on plants, litter, or one another', () => {
  const base = createWorld()
  let world = habitat([animal(0, 'beetle', 1.7, -1.7), animal(1, 'beetle', 1.65, -1.7)], base.plants)
  assert.deepEqual(stepWorld(world).plants, stepWorld({ ...world, creatures: [] }).plants)
  let catches = 0
  for (let tick = 0; tick < 240; tick += 1) {
    const result = simulateStep(world)
    world = result.world
    catches += result.events.filter((event) => event.type === 'predation').length
    assert.ok(world.creatures.every((creature) => isLand(creature.x, creature.z)))
  }
  assert.equal(world.creatures.length, 0)
  assert.equal(catches, 0)
  assert.equal(world.grazed, 0)
  const dying = stepWorld(habitat([animal(0, 'beetle', 1.7, -1.7, 0.1)]))
  near(dying.soil[1].organic + dying.remains.reduce((sum, item) => sum + item.material, 0), decayedLitter() + 0.34)
})

test('predator state/events replay deterministically and old World-only stepping stays equivalent', () => {
  let initial = introduceLife(createWorld(183), 'beetle', 0.4, -0.5)
  const original = structuredClone(initial)
  simulateStep(initial)
  assert.deepEqual(initial, original)
  let branch = structuredClone(initial)
  for (let tick = 0; tick < 300; tick += 1) {
    const a = simulateStep(initial)
    const b = simulateStep(branch)
    assert.deepEqual(a, b)
    assert.deepEqual(a.world, stepWorld(initial))
    assert.ok(a.world.creatures.every((creature) => isLand(creature.x, creature.z)))
    assert.ok(a.world.soil.every((patch) => patch.organic >= 0 && patch.nutrients >= 0 && patch.water >= 0))
    assert.ok(creatureCounts(a.world.creatures).beetle <= 2)
    initial = a.world
    branch = b.world
  }
  assert.deepEqual(original, introduceLife(createWorld(183), 'beetle', 0.4, -0.5))
})

test('predators use the approved species extension in snapshots, with strict caps and transient events', () => {
  const world = introduceLife(introduceLife(createWorld(), 'beetle', 0.4, -0.5), 'beetle', 2.5, 1.2)
  assert.equal(introduceLife(world, 'beetle', 0, -1.5), world)
  const encoded = serializeSave(world)
  const restored = parseSave(encoded)
  assert.equal(creatureCounts(restored.creatures).beetle, 2)
  assert.deepEqual(simulateStep(restored), simulateStep(world))
  assert.equal(encoded.includes('events'), false)
  const invalid = JSON.parse(encoded)
  invalid.world.creatures.push({ ...world.creatures.at(-1), id: 999 })
  assert.throws(() => parseSave(JSON.stringify(invalid)), /damaged/)
})

test('a controlled predator addition changes herbivory and producer recovery without a scripted bonus', () => {
  const run = (predators) => {
    let world = createWorld(17)
    for (const [x, z] of [[0.3, -0.6], [-2.8, 0.3], [2.4, -0.3]]) world = introduceLife(world, 'grazer', x, z)
    for (const [x, z] of [[0.7, 0.9], [0, -2]].slice(0, predators)) world = introduceLife(world, 'beetle', x, z)
    let catches = 0
    for (let tick = 0; tick < 360; tick += 1) {
      if (world.water < 45) world = intervene(world, { type: 'water' })
      if (tick % 72 === 0) world = intervene(world, { type: 'compost' })
      const result = simulateStep(world)
      world = result.world
      catches += result.events.filter((event) => event.type === 'predation').length
    }
    return { world, catches }
  }
  const control = run(0)
  const experiment = run(1)
  assert.ok(experiment.catches > 0)
  assert.ok(experiment.world.grazed < control.world.grazed)
  assert.ok(experiment.world.plants.reduce((sum, plant) => sum + plant.biomass, 0) > control.world.plants.reduce((sum, plant) => sum + plant.biomass, 0))
})
