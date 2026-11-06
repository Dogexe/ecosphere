import test from 'node:test'
import assert from 'node:assert/strict'
import defaultJar from '../src/sim/defaultJar.json' with { type: 'json' }
import { createWorld, creatureCounts, introduceLife, simulateStep } from '../src/sim/ecosystem.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { isSwimmingPosition } from '../src/sim/pond.ts'
import { withStarterGarden } from '../src/sim/starterGarden.ts'

test('the starter jar has the picked pond crew: two ramshorn snails and two cherry shrimp', () => {
  const world = withStarterGarden(adoptPouredJar(createWorld(), defaultJar))
  const counts = creatureCounts(world.creatures)
  assert.equal(counts.snail, 2)
  assert.equal(counts.shrimp, 2)
})

test('snails and shrimp stay in the water and live on algae and detritus', () => {
  const bare = adoptPouredJar(createWorld(), defaultJar)
  let world = { ...bare, creatures: [] }
  world = introduceLife(world, 'snail', -1.2, 1.35)
  world = introduceLife(world, 'shrimp', -0.75, 1.55)
  assert.equal(world.creatures.length, 2)
  world = { ...world, pond: { ...world.pond, algae: 4, organic: 4 } }
  const fed = new Set()
  for (let hour = 0; hour < 72; hour += 1) {
    const step = simulateStep(world)
    world = step.world
    for (const event of step.events) if (event.type === 'feeding') fed.add(event.kind)
    for (const animal of world.creatures) assert.ok(isSwimmingPosition(animal.kind, animal.x, animal.z), `${animal.kind} left the water at hour ${hour}`)
  }
  assert.deepEqual([...fed].sort(), ['shrimp', 'snail'])
  assert.ok(world.creatures.every((animal) => animal.energy > 40))
})

test('a lone snail or shrimp does not breed', () => {
  let world = { ...adoptPouredJar(createWorld(), defaultJar), creatures: [] }
  world = introduceLife(world, 'shrimp', -0.75, 1.55)
  world = { ...world, creatures: world.creatures.map((animal) => ({ ...animal, energy: 99 })), pond: { ...world.pond, algae: 6, organic: 6 } }
  for (let hour = 0; hour < 48; hour += 1) world = simulateStep(world).world
  assert.equal(creatureCounts(world.creatures).shrimp, 1)
})
