import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, isLand, resolveWoodlouseContacts, simulateStep } from '../src/sim/ecosystem.ts'
import { woodlouseLife } from '../src/sim/life.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

function actor(id, x = 1.7, z = 1.7, mass = 0.22) {
  const creature = { id, kind: 'woodlouse', x, z, heading: id, energy: 60, age: 90, stage: mass < 0.2 ? 'juvenile' : 'adult' }
  return { ...creature, life: { ...woodlouseLife(creature), mass } }
}
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const stockFields = ({ x, z, ...rest }) => rest

test('coincident mixed-mass woodlice separate gradually without changing funded state or input', () => {
  const original = [actor(2), actor(19, 1.7, 1.7, 0.055), { id: 30, kind: 'springtail', x: 1.7, z: 1.7 }]
  const copy = structuredClone(original)
  let current = original
  for (let step = 0; step < 8; step++) {
    const next = resolveWoodlouseContacts(current)
    for (let i = 0; i < next.length; i++) {
      assert.ok(apart(current[i], next[i]) <= 0.080001)
      assert.deepEqual(stockFields(next[i]), stockFields(original[i]))
      assert.ok(isLand(next[i].x, next[i].z))
    }
    current = next
  }
  assert.ok(apart(current[0], current[1]) > 0.25)
  assert.equal(current[2], original[2])
  assert.deepEqual(original, copy)
  const reordered = resolveWoodlouseContacts([...original].reverse()).reverse()
  assert.deepEqual(reordered, resolveWoodlouseContacts(original))
})

test('crowded actors at banks and the island edge remain on land with bounded corrections', () => {
  for (const [x, z] of [[1.7, 1.7], [3.14, 0], [-2.16, 0.72]]) {
    assert.ok(isLand(x, z), 'fixture must begin on valid land')
    let actors = [2, 5, 8, 11].map((id) => actor(id, x, z))
    for (let step = 0; step < 20; step++) {
      const next = resolveWoodlouseContacts(actors)
      for (let i = 0; i < next.length; i++) {
        assert.ok(isLand(next[i].x, next[i].z))
        assert.ok(apart(actors[i], next[i]) <= 0.080001)
      }
      actors = next
    }
    for (let a = 0; a < actors.length; a++) for (let b = a + 1; b < actors.length; b++) assert.ok(apart(actors[a], actors[b]) > 0.25)
  }
})

test('courtship retains close contact and repeated save continuation does not consume extra randomness', () => {
  const original = [actor(2), actor(3)]
  original.forEach((creature, index) => { creature.life.activity = 'courting'; creature.life.partnerId = original[1 - index].id })
  let actors = original
  for (let step = 0; step < 8; step++) actors = resolveWoodlouseContacts(actors)
  assert.ok(apart(actors[0], actors[1]) >= 0.2799 && apart(actors[0], actors[1]) <= 0.3)
  let world = { ...createWorld(17), creatures: original }
  const snapshot = structuredClone(world)
  for (let i = 0; i < 120; i++) {
    const next = simulateStep(world)
    assert.deepEqual(simulateStep(parseSave(serializeSave(world))), next)
    world = next.world
  }
  assert.deepEqual(snapshot.creatures, original)
})

test('a real litter community still feeds, pairs, produces funded young and grows while avoiding severe overlap', () => {
  let world = beginDaylitWorld(createHabitatWorld('woodland', 2217))
  let birth = null, mating = false, feeding = 0, severe = 0
  for (let i = 0; i < 300; i++) {
    const result = simulateStep(world)
    world = result.world
    for (const event of result.events) if (event.kind === 'woodlouse') {
      if (event.type === 'birth') { birth = event.id; assert.equal(world.creatures.find((creature) => creature.id === birth).life.mass, 0.055) }
      if (event.type === 'mating') mating = true
      if (event.type === 'feeding') feeding++
    }
    const actors = world.creatures.filter((creature) => creature.kind === 'woodlouse')
    if (actors.some((a, index) => actors.slice(index + 1).some((b) => apart(a, b) < 0.1))) severe++
  }
  assert.ok(mating && birth !== null && feeding > 20)
  const grown = world.creatures.find((creature) => creature.id === birth)
  assert.equal(grown.stage, 'adult')
  assert.ok(grown.life.mass >= 0.2)
  assert.ok(severe < 5, `${severe} severe overlap steps`)
})
