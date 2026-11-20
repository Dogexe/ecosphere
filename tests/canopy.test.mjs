import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, creatureCounts, creatureLimits, fungalRegrowth, introduceLife, lightAt, placementIssue, simulateStep, springtailYield, stepWorld } from '../src/sim/ecosystem.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
function habitat() {
  const world = createWorld(17)
  return { ...world, plants: [], creatures: [], light: 0.9, water: 80, nutrients: 100, organic: 12, soil: world.soil.map((patch) => ({ ...patch, water: 80, nutrients: 100, organic: 12, fungi: 2 })) }
}
const tree = { id: 10, kind: 'tree', x: 1.7, z: -1.7, biomass: 16, capacity: 18 }
const springtail = { id: 0, kind: 'springtail', x: 1.7, z: -1.7, energy: 55, heading: 0 }

test('canopy light follows tree biomass/distance, leaves old worlds unchanged and conserves water', () => {
  const empty = habitat()
  near(lightAt(empty, 1.7, -1.7), empty.light)
  const shaded = { ...empty, plants: [tree] }
  assert.ok(lightAt(shaded, 1.7, -1.7) < lightAt(shaded, 0.7, -1.7))
  assert.ok(lightAt({ ...shaded, plants: [{ ...tree, biomass: 4 }] }, 1.7, -1.7) > lightAt(shaded, 1.7, -1.7))
  near(lightAt(shaded, -2.5, 1.7), empty.light)
  const fullTree = { ...shaded, plants: [{ ...tree, biomass: 18 }] }
  assert.ok(stepWorld(fullTree).soil[1].water > stepWorld(empty).soil[1].water)
  assert.ok(stepWorld(fullTree).soil[1].water <= fullTree.soil[1].water)
})

test('a real canopy favors shade specialists and suppresses a sun-loving grass', () => {
  for (const kind of ['moss', 'grass']) {
    const base = habitat()
    const plant = { id: 0, kind, x: 0.9, z: -1.7, biomass: 2, capacity: 6.5 }
    const open = stepWorld({ ...base, plants: [plant] }).plants[0].biomass
    const shaded = stepWorld({ ...base, plants: [plant, tree] }).plants[0].biomass
    assert.ok(kind === 'moss' ? shaded > open : shaded < open)
  }
})

test('springtails consume fungi, not plants or litter; bites partition fungal material', () => {
  const base = { ...habitat(), plants: [tree] }
  const control = stepWorld(base)
  const result = simulateStep({ ...base, creatures: [springtail] })
  const bite = result.events.find((event) => event.type === 'feeding')
  assert.equal(bite.source, 'fungi')
  assert.deepEqual(result.world.plants, control.plants)
  // Grazed mycelium regrows part of the bite at once from the litter it sits in (2026-11-20).
  const regrowth = bite.amount * fungalRegrowth
  near(control.soil[1].fungi - result.world.soil[1].fungi, bite.amount - regrowth)
  near(result.world.soil[1].organic - control.soil[1].organic, bite.amount * 0.25 - regrowth)
  // The respired 45% keeps its minerals, which return evenly to the four pockets (2026-11-20),
  // along with a little of the springtail's own upkeep, so the local gain is a bounded range.
  const released = result.world.soil[1].nutrients - control.soil[1].nutrients
  assert.ok(released >= bite.amount * 0.3 - 1e-9 && released <= bite.amount * (0.3 + 0.45 * 0.65) + 1e-9)
  near(bite.amount, bite.amount * 0.25 + bite.amount * 0.3 + bite.amount * 0.45)
})

test('springtail births fund body material from fungi and split reserves', () => {
  const initial = { ...habitat(), creatures: [{ ...springtail, energy: 95 }] }
  const result = simulateStep(initial)
  const control = stepWorld({ ...initial, creatures: [] })
  const bite = result.events.find((event) => event.type === 'feeding')
  assert.equal(result.world.creatures.length, 2)
  near(control.soil[1].fungi - result.world.soil[1].fungi, bite.amount * (1 - fungalRegrowth) + 0.08)
  near(result.world.creatures.reduce((sum, animal) => sum + animal.energy, 0), 95 - 0.08 + bite.amount * springtailYield)
  assert.ok(result.events.some((event) => event.type === 'birth' && event.kind === 'springtail'))
})

test('dryness/absent fungi cannot sustain springtails and deaths return local body material', () => {
  const base = habitat()
  const dry = { ...base, water: 0, soil: base.soil.map((patch) => ({ ...patch, water: 0, fungi: 0 })), creatures: [{ ...springtail, energy: 0.1 }] }
  const next = stepWorld(dry)
  assert.equal(next.creatures.length, 0)
  near(next.soil[1].organic - dry.soil[1].organic + next.remains.reduce((sum, item) => sum + item.material, 0), 0.08)
  let richLitter = { ...base, creatures: [springtail], soil: base.soil.map((patch) => ({ ...patch, fungi: 0, organic: 100 })) }
  for (let i = 0; i < 400; i += 1) richLitter = stepWorld(richLitter)
  assert.equal(richLitter.creatures.length, 0)
})

test('springtails have their own cap and can enter the predator food web', () => {
  let world = habitat()
  for (let x = -2.5; x <= 2.5; x += 0.5) for (let z = -2.5; z <= 2.5; z += 0.5) world = introduceLife(world, 'springtail', x, z)
  assert.equal(creatureCounts(world.creatures).springtail, creatureLimits.springtail)
  assert.match(placementIssue(world, 'springtail', 0, -1), new RegExp(`${creatureLimits.springtail} springtails`))
  const caught = simulateStep({ ...habitat(), creatures: [springtail, { id: 1, kind: 'beetle', x: 1.65, z: -1.7, heading: 0, energy: 55 }] })
  const meal = caught.events.find((event) => event.type === 'predation')
  assert.equal(meal.preyKind, 'springtail')
  near(meal.preyMaterial, 0.08)
  near(meal.offspringMaterial, 0)
})

test('new identities continue deterministically through snapshots without unsolicited organisms', () => {
  let world = { ...habitat(), plants: [tree], creatures: [springtail] }
  world = introduceLife(world, 'grass', 0, -2)
  for (let i = 0; i < 60; i += 1) world = stepWorld(world)
  assert.deepEqual(simulateStep(world), simulateStep(parseSave(serializeSave(world))))
  assert.equal(creatureCounts(parseSave(serializeSave(createWorld())).creatures).springtail, 0)
})
