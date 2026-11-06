import test from 'node:test'
import assert from 'node:assert/strict'
import defaultJar from '../src/sim/defaultJar.json' with { type: 'json' }
import { createWorld } from '../src/sim/ecosystem.ts'
import { isPondPosition } from '../src/sim/pond.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { withStarterGarden } from '../src/sim/starterGarden.ts'

test('a new poured jar is planted toward concept image 12, with every plant on its own side of the shore', () => {
  const bare = adoptPouredJar(createWorld(), defaultJar)
  const planted = withStarterGarden(bare)
  const added = planted.plants.slice(bare.plants.length)
  assert.deepEqual(added.map((plant) => plant.kind), ['tree', 'bloom', 'grass', 'grass', 'clover', 'fern', 'clover', 'bloom', 'lily', 'lily', 'lily'])
  for (const plant of added) {
    assert.equal(isPondPosition(plant.x, plant.z), plant.kind === 'lily', `${plant.kind} at ${plant.x},${plant.z}`)
    assert.ok(plant.age > 0 && plant.biomass > plant.capacity * 0.8, 'starts established, not as a seedling')
  }
  assert.equal(new Set(planted.plants.map((plant) => plant.id)).size, planted.plants.length)
})
