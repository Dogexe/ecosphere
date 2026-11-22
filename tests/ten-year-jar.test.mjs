import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, stepWorld } from '../src/sim/ecosystem.ts'
import { hatchRestingEggs, layRestingEggs } from '../src/sim/dormancy.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

/*
 * Ten-year jar (owner's pick, 2026-11-22): a pond whose lilies all died back regrows one from the
 * rhizome in its mud, paid from the pond's organic matter, so its snails and shrimp keep a food plant.
 */
test('a dead lily leaves a rhizome that regrows in a bare pond and is paid from the mud', () => {
  const base = createWorld(17)
  const bank = layRestingEggs(undefined, [{ type: 'death', id: 1, kind: 'lily', reason: 'decline' }])
  assert.equal(bank.lily, 1)
  const bare = { ...base, plants: base.plants.filter((plant) => plant.kind !== 'lily'), dormant: bank, tick: 24 * 7 + 12, pond: { ...base.pond, water: 60, organic: 4 } }
  const grown = hatchRestingEggs(bare)
  assert.equal(grown.events[0]?.kind, 'lily')
  assert.equal(grown.world.plants.filter((plant) => plant.kind === 'lily').length, 1)
  assert.ok(Math.abs(bare.pond.organic - grown.world.pond.organic - 0.55) < 1e-9)
  assert.equal(grown.world.dormant.lily, 0)
  const mudless = { ...bare, pond: { ...bare.pond, organic: 0.5 } }
  assert.equal(hatchRestingEggs(mudless).events.length, 0, 'no shoot without mud to feed it')
  assert.equal(parseSave(serializeSave(stepWorld(grown.world))).dormant.lily, 0)
})
