import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { beginDaylitWorld, environmentAt, scheduledRest } from '../src/sim/climate.ts'
import { createWorld, introduceLife, intervene, isLand, lightAt, plantOutlook, predatorThreat, simulateStep, stepWorld, creatureCounts, creatureLimits } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { defaultPond, isAquatic, isPondPosition, rateAt, stepPond } from '../src/sim/pond.ts'
import { woodlouseLife } from '../src/sim/life.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
const phase = (world, tick) => ({ ...world, tick, climate: { ...world.climate, photoperiod: true } })
function isolated(kind = 'fern') {
  const base = createWorld(17)
  const soil = base.soil.map((s) => ({ ...s, water: 72, nutrients: 80, organic: 0, fungi: 0 }))
  return { ...base, water: 72, nutrients: 80, organic: 0, soil, creatures: [], plants: [{ id: 0, kind, x: 1.7, z: 1.7, biomass: 2, capacity: 8, age: 90, development: 90, parentId: null, lastReproduction: -1 }] }
}

test('solar forcing repeats, has an exact daily integral and lagged bounded temperature without drift', () => {
  const base = phase(createWorld(), 0)
  const hours = Array.from({ length: 24 }, (_, tick) => environmentAt({ ...base, tick }))
  near(hours.reduce((sum, h) => sum + h.photosynthesis, 0), 24)
  for (const hour of [0, 5, 6, 18, 20, 23]) assert.equal(hours[hour].light, 0)
  near(hours[12].light, base.light)
  assert.equal(hours[5].phase, 'dawn'); assert.equal(hours[17].phase, 'sunset'); assert.equal(hours[21].phase, 'night')
  assert.equal(hours[15].temperatureC, 25); assert.equal(hours[3].temperatureC, 19)
  for (const tick of [0, 7, 12, 19]) assert.deepEqual(environmentAt({ ...base, tick }), environmentAt({ ...base, tick: tick + 24 }))
  let world = { ...base, plants: [], creatures: [] }
  for (let tick = 0; tick < 240; tick++) world = stepWorld(world)
  assert.equal(world.climate.temperatureC, 22)
  assert.ok(environmentAt({ ...base, climate: { ...base.climate, temperatureC: 40 }, tick: 15 }).temperatureC <= 40)
})

test('constant mode retains the twelve explicit living-jar-correction trajectories', () => {
  const cases = JSON.parse(readFileSync(new URL('./fixtures/living-jar-trajectories.json', import.meta.url)))
  for (const item of cases) {
    // Original, recruitment-only and contact hashes remain in their historical
    // files. The 2026-11-03 living-jar correction (bacterial litter decay,
    // perennial plant and real woodlouse/springtail lifespans) changes paths.
    // Soft contact changes actual woodlouse positions and subsequent ecological
    // paths; stock-flow/contact tests validate the cause independently.
    let world = createHabitatWorld(item.habitat, item.seed)
    for (let i = 0; i < 240; i++) world = stepWorld(world)
    assert.equal(createHash('sha256').update(JSON.stringify(world)).digest('hex'), item.sha256)
  }
})

test('old v2 snapshots retain constant forcing; new cycles save and continue without changing envelope or clock', () => {
  const old = createWorld(183)
  const saved = parseSave(serializeSave(old))
  assert.equal(saved.climate.photoperiod, undefined)
  assert.equal(environmentAt(saved).phase, 'constant')
  const current = beginDaylitWorld(old)
  assert.equal(current.tick, 8); assert.equal(old.tick, 0)
  const encoded = serializeSave(current)
  assert.equal(JSON.parse(encoded).version, 3)
  assert.deepEqual(parseSave(encoded), current)
  assert.deepEqual(simulateStep(parseSave(encoded)), simulateStep(current))
  const disabled = intervene(current, { type: 'day-night', value: 0 })
  assert.equal(disabled.tick, current.tick)
  assert.equal(disabled.seed, current.seed)
  assert.deepEqual(disabled.plants, current.plants)
  assert.equal(environmentAt(disabled).light, old.light)
  assert.equal(intervene(current, { type: 'day-night', value: NaN }), current)
  for (const invalid of ['true', 0, null, {}]) {
    const data = JSON.parse(encoded); data.world.climate.photoperiod = invalid
    assert.throws(() => parseSave(JSON.stringify(data)))
  }
})

test('night stops photosynthesis/root uptake while turnover continues; daylight pays gross fluxes', () => {
  for (const hour of [0, 12]) {
    const world = phase(isolated(), hour)
    const outlook = plantOutlook(world, world.plants[0])
    const next = stepWorld(world)
    const s = next.soil[3]
    near(next.plants[0].biomass - world.plants[0].biomass, outlook.growth - outlook.loss)
    near(80 - s.nutrients, outlook.growth * 0.65)
    near(s.organic, outlook.loss * 0.42)
    const env = environmentAt(world)
    near(72 - s.water, outlook.growth * 0.12 + (0.08 + env.light * 0.1) * rateAt(env.temperatureC))
    if (hour === 0) { assert.equal(outlook.growth, 0); assert.equal(outlook.dark, true); assert.equal(outlook.localLight, 0) }
    else assert.ok(outlook.growth > 0)
  }
  const noon = phase(isolated(), 12)
  const unfed = { ...noon, soil: noon.soil.map((s) => ({ ...s, nutrients: 0 })), nutrients: 0 }
  assert.equal(plantOutlook(unfed, unfed.plants[0]).growth, 0)
  assert.equal(lightAt(phase(noon, 0), 1.7, 1.7), 0)
})

test('pond algae stop photosynthesis at night while oxygen use and decay continue', () => {
  const pond = { ...defaultPond(), water: 80, oxygen: 72, organic: 0, nutrients: 20, algae: 8 }
  const run = (hour) => {
    const world = phase(createWorld(), hour), env = environmentAt(world)
    return stepPond(pond, [], env.light, { ...world.climate, temperatureC: env.temperatureC }, 17, 0, hour).pond
  }
  const night = run(0), day = run(12)
  assert.ok(night.algae < pond.algae && night.oxygen < pond.oxygen)
  assert.ok(day.algae > pond.algae && day.oxygen > night.oxygen)
})

test('accepted small-capacity plants cannot consume resources for biomass discarded by the capacity cap', () => {
  let world = phase(isolated('bloom'), 12)
  world = { ...world, light: 0.92, plants: [{ ...world.plants[0], biomass: 0.1, capacity: 0.5 }] }
  world = parseSave(serializeSave(world))
  const outlook = plantOutlook(world, world.plants[0])
  const next = stepWorld(world)
  assert.ok(outlook.growth <= 0.4 + outlook.loss + 1e-9)
  near(next.plants[0].biomass, Math.min(0.5, 0.1 + outlook.growth - outlook.loss))
  near(80 - next.soil[3].nutrients, outlook.growth * 0.65)
})

test('diurnal grazers and beetles rest at night but severe hunger and threats override rest', () => {
  let base = isolated('clover')
  base = introduceLife(base, 'grazer', 1.7, 1.7)
  const grazer = base.creatures[0]
  const night = simulateStep(phase(base, 0))
  near(night.world.creatures[0].x, grazer.x)
  assert.ok(night.world.creatures[0].energy < grazer.energy)
  assert.equal(night.events.some((event) => event.type === 'feeding'), false)
  assert.ok(simulateStep(phase(base, 12)).events.some((event) => event.type === 'feeding'))
  assert.ok(simulateStep(phase({ ...base, creatures: [{ ...grazer, energy: 20 }] }, 0)).events.some((event) => event.type === 'feeding'))
  let predator = introduceLife({ ...createWorld(), plants: [], creatures: [] }, 'beetle', 1.7, 1.7).creatures[0]
  const prey = { ...grazer, id: 999, x: 1.85, z: 1.7 }
  const closed = phase({ ...base, plants: [], creatures: [predator, prey] }, 0)
  assert.equal(predatorThreat(closed, prey), null)
  assert.equal(simulateStep(closed).events.some((event) => event.type === 'predation'), false)
  predator = { ...predator, energy: 20 }
  const hungry = { ...closed, creatures: [predator, prey] }
  assert.ok(predatorThreat(hungry, prey))
  assert.ok(simulateStep(hungry).events.some((event) => event.type === 'predation'))
})

test('nocturnal woodlice rest without suspending digestion, gestation or aging; thirst wakes them', () => {
  let world = introduceLife({ ...isolated(), plants: [] }, 'woodlouse', 1.7, 1.7)
  const parent = world.creatures[0]
  parent.life = { ...woodlouseLife(parent), sex: 'female', gut: 0.08, brood: 0.055, gestation: 5 }
  world = phase(world, 12)
  const next = simulateStep(world)
  const animal = next.world.creatures[0]
  near(animal.x, parent.x); near(animal.z, parent.z)
  assert.ok(animal.life.gut < parent.life.gut)
  assert.equal(animal.life.gestation, 4)
  assert.equal(animal.life.activity, 'resting')
  assert.equal(animal.age, parent.age + 1)
  assert.equal(next.events.some((event) => event.type === 'feeding'), false)
  assert.equal(scheduledRest(world, { ...parent, life: { ...parent.life, hydration: 20 } }), false)
  assert.equal(scheduledRest(phase(world, 0), parent), false)
})

test('prey detect a night hunter that wakes after paying basal maintenance', () => {
  const world = phase({ ...createWorld(), plants: [], creatures: [
    { id: 1, kind: 'beetle', x: 1.6, z: 1.3, heading: 0, energy: 25.2, age: 100, stage: 'adult', materialReserve: 0 },
    { id: 2, kind: 'grazer', x: 1.98, z: 1.3, heading: 0, energy: 58, age: 100, stage: 'adult', materialReserve: 0 },
  ] }, 0)
  assert.ok(predatorThreat(world, world.creatures[1]))
  const next = simulateStep(world)
  assert.ok(next.world.creatures.find((c) => c.id === 2).x > 1.98)
  assert.equal(next.events.some((e) => e.type === 'predation'), false)
})

test('springtails forage at night and fish rest while water fleas continue grazing', () => {
  let world = { ...isolated(), plants: [], soil: isolated().soil.map((s) => ({ ...s, fungi: 2 })) }
  world = introduceLife(world, 'springtail', 1.7, 1.7)
  assert.equal(simulateStep(phase(world, 12)).events.some((e) => e.type === 'feeding'), false)
  assert.ok(simulateStep(phase(world, 0)).events.some((e) => e.type === 'feeding'))
  const pond = { ...defaultPond(), algae: 8 }
  const fish = { id: 1, kind: 'fish', energy: 58, x: -1.1, z: 0.72, heading: 0, stage: 'adult', age: 100, materialReserve: 0 }
  const flea = { ...fish, kind: 'flea', id: 2, x: -1.55 }
  const next = stepPond(pond, [fish, flea], 0, { temperatureC: 22, rainfall: 0, photoperiod: true }, 17, 3, 0)
  assert.equal(next.creatures.find((c) => c.id === 1).x, fish.x)
  assert.ok(next.events.some((e) => e.type === 'feeding' && e.id === 2))
  assert.equal(next.events.some((e) => e.type === 'predation'), false)
})

test('rest still costs reserve and a natural cycling woodland can brood young that grow into adults', () => {
  const empty = phase({ ...createWorld(), plants: [], creatures: [{ id: 0, kind: 'grazer', x: 1.7, z: 1.7, heading: 0, energy: 58, age: 100, stage: 'adult', materialReserve: 0 }] }, 0)
  const resting = stepWorld(empty).creatures[0]
  near(58 - resting.energy, 0.42 * rateAt(environmentAt(empty).temperatureC) * 0.5)
  let world = beginDaylitWorld(createHabitatWorld('woodland', 2217))
  let childId = null, paired = false
  for (let step = 0; step < 360; step++) {
    const next = simulateStep(world); world = next.world
    paired ||= next.events.some((e) => e.type === 'mating')
    const born = next.events.find((e) => e.type === 'birth' && e.kind === 'woodlouse')
    if (born) childId = born.id
  }
  assert.ok(paired && childId !== null)
  const child = world.creatures.find((c) => c.id === childId)
  assert.equal(child.kind, 'woodlouse'); assert.equal(child.stage, 'adult')
  assert.ok(child.life.mass >= 0.2 && child.life.parentId !== null)
  assert.ok(world.plants.length > 0)
})

test('multiple seeded day/night communities remain bounded and snapshots continue the same future', () => {
  for (const habitat of ['garden', 'woodland', 'meadow', 'wetland']) for (const seed of [17, 183, 2217]) {
    let world = beginDaylitWorld(createHabitatWorld(habitat, seed))
    for (let step = 0; step < 360; step++) {
      if (world.water < 35) world = intervene(world, { type: 'water' })
      if (step % 96 === 0) world = intervene(world, { type: 'compost' })
      world = stepWorld(world)
      for (const soil of [...world.soil, world.pond]) for (const key of ['water', 'nutrients', 'organic']) assert.ok(Number.isFinite(soil[key]) && soil[key] >= 0)
      assert.ok(world.pond.oxygen >= 0 && world.pond.oxygen <= world.pond.water)
      const counts = creatureCounts(world.creatures)
      for (const kind in creatureLimits) assert.ok(counts[kind] <= creatureLimits[kind])
      for (const life of [...world.plants, ...world.creatures]) assert.ok(isAquatic(life.kind) ? isPondPosition(life.x, life.z) : isLand(life.x, life.z))
      if (step % 48 === 0) assert.deepEqual(simulateStep(parseSave(serializeSave(world))), simulateStep(world))
    }
  }
})
