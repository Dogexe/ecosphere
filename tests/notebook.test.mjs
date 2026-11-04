import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { sealWorld } from '../src/sim/seal.ts'
import { serializeSave } from '../src/sim/saves.ts'
import { catchUp, liveAway, startReport } from '../src/sim/away.ts'
import { decodeNotebook, emptyNotebook, encodeNotebook, eventLine, journalLimit, observe, pageById, pages, pagesShown, progress, readNotebook, writeEntry, writeNotebook } from '../src/sim/notebook.ts'

const memoryStore = () => { const data = new Map(); return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), data } }

test('every page has a title, a hint, a note and at least one https source', () => {
  assert.equal(new Set(pages.map((page) => page.id)).size, pages.length)
  for (const page of pages) {
    assert.ok(page.title && page.hint && page.note, page.id)
    assert.ok(page.sources.length > 0 && page.sources.every((source) => source.url.startsWith('https://') && source.label), page.id)
  }
})

test('species pages fill from what is actually in the jar', () => {
  const world = beginDaylitWorld(createHabitatWorld('woodland', 7))
  const shown = pagesShown(world, [])
  for (const plant of world.plants) assert.ok(shown.includes(plant.kind))
  for (const creature of world.creatures) assert.ok(shown.includes(creature.kind ?? 'grazer'))
  assert.ok(!shown.includes('ants'))
  assert.ok(!shown.includes('fish') || world.creatures.some((creature) => creature.kind === 'fish'))
})

test('behaviour pages come from solver events, nothing else', () => {
  const world = createHabitatWorld('bare', 1)
  const ids = (events) => pagesShown({ ...world, plants: [], creatures: [] }, events)
  assert.ok(ids([{ type: 'feeding', id: 1, kind: 'woodlouse', source: 'litter', amount: 0.1 }]).includes('shredding'))
  assert.ok(ids([{ type: 'feeding', id: 1, kind: 'flea', source: 'algae', amount: 0.1 }]).includes('filter-feeding'))
  assert.ok(ids([{ type: 'mating', kind: 'woodlouse', motherId: 1, fatherId: 2 }]).includes('pairing'))
  assert.ok(ids([{ type: 'birth', id: 3, kind: 'woodlouse', parentId: 1 }]).includes('brood-pouch'))
  assert.ok(ids([{ type: 'birth', id: 3, kind: 'clover', parentId: 1 }]).includes('seedling'))
  assert.ok(ids([{ type: 'death', id: 3, kind: 'woodlouse', reason: 'desiccation' }]).includes('dried-out'))
  assert.ok(ids([{ type: 'ant', action: 'chamber', id: 4, amount: 0 }]).includes('new-chamber'))
  assert.ok(!ids([]).includes('beetle-hunt'))
})

test('observing reads the world without changing it, and a page fills only once', () => {
  const world = beginDaylitWorld(createHabitatWorld('woodland', 7))
  const before = serializeSave(world)
  const first = observe(emptyNotebook(), world, [], 1000)
  assert.equal(serializeSave(world), before)
  assert.ok(first.found.length > 0)
  assert.equal(first.notebook.journal.filter((entry) => entry.kind === 'found').length, first.found.length)
  const again = observe(first.notebook, world, [], 2000)
  assert.equal(again.notebook, first.notebook, 'nothing new returns the same notebook')
  assert.deepEqual(again.found, [])
  assert.equal(first.notebook.found[first.found[0]].at, 1000)
})

test('watching a woodland jar for a week fills behaviour pages from real events', () => {
  let world = beginDaylitWorld(createHabitatWorld('woodland', 7))
  let notebook = emptyNotebook()
  for (let hour = 0; hour < 24 * 7; hour += 1) {
    const step = simulateStep(world)
    world = step.world
    notebook = observe(notebook, world, step.events, hour).notebook
  }
  assert.ok(notebook.found.night, 'a night passed')
  assert.ok(progress(notebook, 'behaviour').found > 0)
  assert.ok(notebook.journal.length <= journalLimit)
})

test('time away writes first finds, marked away, without one line per event', () => {
  const start = beginDaylitWorld(createHabitatWorld('woodland', 7))
  let notebook = observe(emptyNotebook(), start, [], 0).notebook
  const known = Object.keys(notebook.found).length
  const report = startReport(start, false)
  const lived = liveAway(start, [], 72, report, (world, events) => { notebook = observe(notebook, world, events, 5, true).notebook })
  const plain = catchUp(start, [], 72)
  assert.equal(serializeSave(lived.world), serializeSave(plain.world), 'the observer cannot change the jar')
  const fresh = Object.entries(notebook.found).filter(([, found]) => found.away)
  assert.equal(Object.keys(notebook.found).length, known + fresh.length)
  assert.ok(notebook.journal.every((entry) => entry.kind === 'found'))
})

test('the sealed goal page needs a living jar that reached its goal', () => {
  const sealed = sealWorld(beginDaylitWorld(createHabitatWorld('woodland', 7)), 1)
  assert.ok(!pagesShown(sealed, []).includes('sealed-goal'))
  assert.ok(pagesShown({ ...sealed, tick: sealed.tick + 24 }, []).includes('sealed-goal'))
  assert.ok(!pagesShown({ ...sealed, tick: sealed.tick + 24, plants: [], pond: { ...sealed.pond, algae: 0 } }, []).includes('sealed-goal'))
})

test('journal lines: hunts, births, notes; empty notes are ignored; journal is capped', () => {
  assert.equal(eventLine({ type: 'predation', predatorKind: 'beetle', predatorId: 1, preyId: 2, preyKind: 'woodlouse' }), 'A tiger beetle caught a woodlouse.')
  assert.equal(eventLine({ type: 'feeding', id: 1, kind: 'grazer', source: 'plant', amount: 1 }), null)
  let notebook = writeEntry(emptyNotebook(), { tick: 30 }, 'note', '  Mist this morning.  ', 9)
  assert.deepEqual(notebook.journal, [{ at: 9, tick: 30, kind: 'note', text: 'Mist this morning.' }])
  assert.equal(writeEntry(notebook, { tick: 31 }, 'note', '   '), notebook)
  for (let i = 0; i < journalLimit + 20; i += 1) notebook = writeEntry(notebook, { tick: i }, 'note', `line ${i}`, i)
  assert.equal(notebook.journal.length, journalLimit)
  assert.equal(notebook.journal.at(-1).text, `line ${journalLimit + 19}`)
})

test('the notebook survives storage; damage drops only the damaged parts', () => {
  const store = memoryStore()
  const notebook = writeEntry(observe(emptyNotebook(), createHabitatWorld('woodland', 7), [], 4).notebook, { tick: 2 }, 'note', 'hello', 5)
  assert.ok(writeNotebook(store, notebook))
  assert.deepEqual(readNotebook(store), notebook)
  assert.deepEqual(readNotebook(memoryStore()), emptyNotebook())
  assert.deepEqual(decodeNotebook('{nope'), emptyNotebook())
  const raw = JSON.parse(encodeNotebook(notebook))
  raw.found.unicorn = { tick: 1, at: 1, away: false }
  raw.journal.push({ at: 'x', tick: 1, kind: 'note', text: 'bad' })
  const decoded = decodeNotebook(JSON.stringify(raw))
  assert.ok(!decoded.found.unicorn)
  assert.deepEqual(decoded.journal, notebook.journal)
  assert.ok(pageById.get('woodlouse').latin)
  const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
  assert.deepEqual(readNotebook(blocked), emptyNotebook())
  assert.equal(writeNotebook(blocked, notebook), false)
})
