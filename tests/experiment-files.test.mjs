import test from 'node:test'
import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import { readWorldFile, maxWorldFileBytes } from '../src/experimentFiles.ts'
import { createWorld, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { serializeSave, parseSave } from '../src/sim/saves.ts'

test('a native world file retains funded brood, daylight and the exact next ecological step', async () => {
  let world = beginDaylitWorld(createHabitatWorld('woodland', 2217))
  // Save mid-gestation, whenever the first brood is being carried.
  while (world.tick < 200 && !world.creatures.some((c) => c.life?.brood > 0)) world = stepWorld(world)
  assert.ok(world.creatures.some((c) => c.life?.brood > 0))
  const file = new File([serializeSave(world)], 'brood.json', { type: 'application/json' })
  const loaded = await readWorldFile(file)
  assert.deepEqual(loaded, world)
  assert.deepEqual(simulateStep(loaded), simulateStep(world))
  assert.equal(loaded.climate.photoperiod, true)
})

test('native file input accepts original v1 JSON without adding a new envelope', async () => {
  const old = createWorld(183)
  delete old.climate; delete old.pond; delete old.remains
  const encoded = JSON.stringify({ version: 1, world: old })
  const loaded = await readWorldFile(new File([encoded], 'legacy.json'))
  assert.deepEqual(loaded, parseSave(encoded))
  assert.equal(JSON.parse(serializeSave(loaded)).version, 3)
  assert.deepEqual(simulateStep(loaded), simulateStep(parseSave(encoded)))
})

test('oversized files are rejected before reading and invalid worlds never become a result', async () => {
  let read = false
  await assert.rejects(() => readWorldFile({ size: maxWorldFileBytes + 1, async text() { read = true; return '{}' } }), /too large/)
  assert.equal(read, false)
  const world = createWorld()
  const invalid = JSON.stringify({ version: 2, world: { ...world, pond: { ...world.pond, oxygen: 500 } } })
  for (const text of ['', '{', '{"version":3,"world":{}}', invalid]) {
    await assert.rejects(() => readWorldFile(new File([text], 'invalid.json')))
  }
})

test('file read failures propagate without returning a partial world', async () => {
  await assert.rejects(() => readWorldFile({ size: 10, async text() { throw new Error('File unavailable') } }), /File unavailable/)
})
