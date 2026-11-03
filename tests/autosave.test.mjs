import test from 'node:test'
import assert from 'node:assert/strict'
import { stepWorld } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { recordSample, historyLimit } from '../src/sim/observatory.ts'
import { sealWorld } from '../src/sim/seal.ts'
import { serializeSave } from '../src/sim/saves.ts'
import { autosaveKey, clearAutosave, decodeAutosave, encodeAutosave, readAutosave, writeAutosave } from '../src/sim/autosave.ts'

const same = (a, b) => assert.deepEqual(JSON.parse(serializeSave(a)), JSON.parse(serializeSave(b)))

function run(world, hours) {
  let history = []
  for (let hour = 0; hour < hours; hour += 1) {
    history = recordSample(history, world)
    world = stepWorld(world)
  }
  return { world, history: recordSample(history, world) }
}

function memoryStore() {
  const items = new Map()
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => { items.set(key, String(value)) }, removeItem: (key) => { items.delete(key) } }
}

test('autosave brings back the same world and its Observatory history', () => {
  const { world, history } = run(sealWorld(beginDaylitWorld(createHabitatWorld('woodland', 7)), 30), 60)
  const back = decodeAutosave(encodeAutosave(world, history, 1234))
  assert.equal(back.savedAt, 1234)
  same(back.world, world)
  assert.equal(back.history.length, history.length)
  for (const [index, sample] of history.entries()) {
    for (const [key, value] of Object.entries(sample)) assert.ok(Math.abs(back.history[index][key] - value) <= 0.005, `${key} at ${index}`)
  }
})

test('a restored world continues exactly as if it had never been saved', () => {
  const { world } = run(beginDaylitWorld(createHabitatWorld('wetland', 3)), 24)
  const restored = decodeAutosave(encodeAutosave(world, [])).world
  same(run(restored, 48).world, run(world, 48).world)
})

test('autosave keeps at most the Observatory history limit and fits browser storage', () => {
  const { world } = run(beginDaylitWorld(createHabitatWorld('woodland', 7)), 2)
  const history = Array.from({ length: historyLimit + 50 }, (_, tick) => ({ ...recordSample([], world)[0], tick }))
  const text = encodeAutosave({ ...world, tick: history.length }, history)
  assert.ok(text.length < 1_000_000, `${text.length} characters`)
  assert.equal(decodeAutosave(text).history.length, historyLimit)
})

test('a damaged history is dropped but the world is still restored', () => {
  const { world, history } = run(beginDaylitWorld(createHabitatWorld('woodland', 7)), 10)
  const saved = JSON.parse(encodeAutosave(world, history))
  saved.history[3][0] = saved.history[2][0]
  const back = decodeAutosave(JSON.stringify(saved))
  assert.equal(back.history.length, 0)
  assert.equal(back.world.tick, world.tick)
  const future = JSON.parse(encodeAutosave(world, history))
  future.history[future.history.length - 1][0] = world.tick + 5
  assert.equal(decodeAutosave(JSON.stringify(future)).history.length, 0)
})

test('history saved before jar air was measured fills in room air', () => {
  const { world, history } = run(beginDaylitWorld(createHabitatWorld('woodland', 7)), 5)
  const saved = JSON.parse(encodeAutosave(world, history))
  const keep = saved.keys.map((key, index) => [key, index]).filter(([key]) => key !== 'jarOxygen' && key !== 'jarCO2')
  saved.keys = keep.map(([key]) => key)
  saved.history = saved.history.map((row) => [row[0], ...keep.map(([, index]) => row[index + 1])])
  const back = decodeAutosave(JSON.stringify(saved))
  assert.equal(back.history.length, history.length)
  assert.equal(back.history[0].jarOxygen, 20.9)
  assert.equal(back.history[0].jarCO2, 420)
})

test('storage that is missing, blocked, full or damaged never breaks the game', () => {
  const { world, history } = run(beginDaylitWorld(createHabitatWorld('woodland', 7)), 5)
  assert.equal(writeAutosave(null, world, history), false)
  assert.equal(readAutosave(null), null)
  const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(writeAutosave(blocked, world, history), false)
  assert.equal(readAutosave(blocked), null)
  clearAutosave(blocked)

  const store = memoryStore()
  store.items.set(autosaveKey, '{not json')
  assert.equal(readAutosave(store), null)
  assert.equal(store.items.get(autosaveKey), '{not json', 'a damaged save is left for the owner, not deleted')

  // Too full for the history: the world alone is kept.
  const tight = memoryStore()
  const limit = encodeAutosave(world, []).length + 10
  tight.setItem = (key, value) => { if (String(value).length > limit) throw new Error('QuotaExceededError'); tight.items.set(key, String(value)) }
  assert.equal(writeAutosave(tight, world, history), true)
  const back = readAutosave(tight)
  assert.equal(back.world.tick, world.tick)
  assert.equal(back.history.length, 0)
})

test('autosave never touches the A/B experiment slots', () => {
  const { world, history } = run(beginDaylitWorld(createHabitatWorld('woodland', 7)), 5)
  const store = memoryStore()
  store.items.set('ecosphere.experiment.a', 'A')
  store.items.set('ecosphere.experiment.b', 'B')
  writeAutosave(store, world, history)
  clearAutosave(store)
  assert.equal(store.items.get('ecosphere.experiment.a'), 'A')
  assert.equal(store.items.get('ecosphere.experiment.b'), 'B')
  assert.equal(store.items.has(autosaveKey), false)
})
