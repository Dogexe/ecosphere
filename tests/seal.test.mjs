import test from 'node:test'
import assert from 'node:assert/strict'
import { applySoilInput, createWorld, dominantLimit, introduceLife, intervene, interveneAt, removeLife, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { exportColony, introduceColony } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { heldWater, jarWater, sealOutcome, sealWorld, unsealWorld } from '../src/sim/seal.ts'

const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('sealing stops rain and keeps the open world unchanged until then', () => {
  const open = intervene(createWorld(9), { type: 'rain', value: 0.6 })
  const sealed = sealWorld(open, 30)
  assert.equal(sealed.climate.rainfall, 0)
  assert.deepEqual(sealed.sealed, { since: open.tick, goalDays: 30, vapor: 0 })
  assert.equal(open.sealed, undefined)
  assert.equal(sealWorld(sealed, 10), sealed)
  assert.deepEqual(unsealWorld(sealed).sealed, undefined)
})

test('a sealed world refuses every matter input or removal but still takes light and heat', () => {
  const base = introduceColony(advance(createHabitatWorld('wetland'), 4), 0.3, -1.7)
  assert.ok(base.colony)
  const sealed = sealWorld(base, 10)
  for (const type of ['water', 'compost', 'pond-water', 'pond-organic', 'pond-nutrients']) assert.equal(intervene(sealed, { type }), sealed, type)
  assert.equal(intervene(sealed, { type: 'rain', value: 1 }), sealed)
  assert.equal(interveneAt(sealed, 'water', 0), sealed)
  assert.equal(applySoilInput(sealed, { water: 10, organic: 5, nutrients: 5 }).world, sealed)
  assert.equal(introduceLife(sealed, 'clover', 1.2, -0.4), sealed)
  assert.equal(removeLife(sealed, 'plant', sealed.plants[0].id), sealed)
  assert.equal(removeLife(sealed, 'creature', sealed.creatures[0].id), sealed)
  assert.equal(exportColony(sealed).world, sealed)
  const sealedWithoutColony = sealWorld(exportColony(base).world, 10)
  assert.equal(introduceColony(sealedWithoutColony, 0.3, -1.7), sealedWithoutColony)
  assert.equal(intervene(sealed, { type: 'light', value: 0.4 }).light, 0.4)
  assert.equal(intervene(sealed, { type: 'temperature', value: 18 }).climate.temperatureC, 18)
})

test('water inside a sealed jar is conserved for 30 days across habitats, bodies and a colony', () => {
  const starts = [createHabitatWorld('garden'), createHabitatWorld('woodland'), createHabitatWorld('meadow'), createHabitatWorld('wetland'), introduceColony(createWorld(), 0.3, -1.7)]
  for (const start of starts) {
    let world = sealWorld(start, 30)
    const initial = jarWater(world)
    let worst = 0
    for (let hour = 0; hour < 30 * 24; hour += 1) {
      world = stepWorld(world)
      worst = Math.max(worst, Math.abs(jarWater(world) - initial))
      assert.ok(world.sealed.vapor > -1e-9, `vapour went negative at hour ${hour}`)
      for (const patch of world.soil) assert.ok(patch.water >= 0 && patch.water <= 100)
    }
    assert.ok(worst / initial < 1e-9, `water drifted ${worst} of ${initial}`)
  }
})

test('the open world keeps losing water to the air, so sealing changes the outcome', () => {
  const start = createHabitatWorld('meadow')
  const open = advance(start, 10 * 24)
  const sealed = advance(sealWorld(start, 10), 10 * 24)
  assert.ok(heldWater(open) < heldWater(start) * 0.8)
  assert.ok(heldWater(sealed) > heldWater(open))
})

test('sealed runs are deterministic and survive a save round trip mid-run', () => {
  const sealed = advance(sealWorld(createHabitatWorld('woodland'), 10), 50)
  const restored = parseSave(serializeSave(sealed))
  assert.deepEqual(restored.sealed, sealed.sealed)
  assert.deepEqual(advance(restored, 40), advance(sealed, 40))
  assert.equal(parseSave(serializeSave(createWorld())).sealed, undefined)
  const raining = JSON.parse(serializeSave(sealed))
  raining.world.climate.rainfall = 0.4
  assert.throws(() => parseSave(JSON.stringify(raining)))
  const future = JSON.parse(serializeSave(sealed))
  future.world.sealed.since = future.world.tick + 1
  assert.throws(() => parseSave(JSON.stringify(future)))
})

test('outcome reports running, survived at the goal, and collapse when producers are gone', () => {
  const sealed = sealWorld(createHabitatWorld('woodland'), 1)
  assert.equal(sealOutcome(createWorld(), dominantLimit), null)
  assert.equal(sealOutcome(sealed, dominantLimit).status, 'running')
  assert.equal(sealOutcome(advance(sealed, 24), dominantLimit).status, 'survived')
  const barren = sealWorld({ ...createHabitatWorld('bare'), pond: { ...createWorld().pond, algae: 0 } }, 10)
  const outcome = sealOutcome(barren, dominantLimit)
  assert.equal(outcome.status, 'collapsed')
  assert.equal(outcome.day, 0)
  assert.equal(simulateStep(barren).world.sealed.goalDays, 10)
})
