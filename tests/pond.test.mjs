import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, creatureCounts, introduceLife, intervene, isLand, placementIssue, plantOutlook, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { defaultClimate, defaultPond, isAquatic, isPondPosition, isSwimmingPosition, lifespan, maturity, pondCenter, stepPond, swimmingClearance } from '../src/sim/pond.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
const animal = (id, kind, x, z, energy = 55) => ({ id, kind, x, z, energy, heading: 0, age: maturity[kind], stage: 'adult', materialReserve: 0 })

test('v1 migration preserves organisms/soil and initializes the documented separate reservoirs', () => {
  const original = createWorld(183)
  const old = structuredClone(original)
  delete old.climate; delete old.pond
  old.creatures.forEach((creature) => { delete creature.age; delete creature.stage; delete creature.materialReserve })
  const restored = parseSave(JSON.stringify({ version: 1, world: old }))
  assert.deepEqual(restored.soil, original.soil)
  assert.deepEqual(restored.plants, original.plants)
  assert.deepEqual(creatureCounts(restored.creatures), creatureCounts(original.creatures))
  assert.deepEqual(restored.climate, defaultClimate())
  assert.deepEqual(restored.pond, defaultPond())
  assert.ok(restored.creatures.every((creature) => creature.stage === 'adult'))
})

test('v2 validates physical stocks/stages and resumes the same aquatic future', () => {
  let world = createHabitatWorld('wetland', 17)
  for (let i = 0; i < 50; i += 1) world = stepWorld(world)
  const encoded = serializeSave(world)
  assert.equal(JSON.parse(encoded).version, 3)
  assert.deepEqual(parseSave(encoded), world)
  assert.deepEqual(simulateStep(parseSave(encoded)), simulateStep(world))
  for (const edit of [save => { save.world.pond.oxygen = 101 }, save => { save.world.pond.water = -1 }, save => { save.world.climate.temperatureC = '22' }, save => { save.world.climate.rainfall = 2 }, save => { save.world.creatures[0].age = -1 }, save => { save.world.creatures[0].stage = 'egg' }, save => { save.world.creatures[0].materialReserve = -1 }]) {
    const save = JSON.parse(encoded); edit(save); assert.throws(() => parseSave(JSON.stringify(save)))
  }
})

test('aquatic placement and movement use water; terrestrial organisms keep land boundaries', () => {
  const base = createWorld()
  assert.ok(placementIssue(base, 'fish', 1.7, -1.7))
  assert.equal(placementIssue(base, 'fish', -1.1, 0.72), null)
  assert.ok(placementIssue(base, 'grazer', -1.1, 0.72))
  assert.equal(introduceLife(base, 'fish', 1.7, -1.7), base)
  let world = createHabitatWorld('wetland')
  for (let tick = 0; tick < 500; tick += 1) {
    world = stepWorld(world)
    for (const organism of [...world.plants, ...world.creatures]) assert.ok(isAquatic(organism.kind) ? isPondPosition(organism.x, organism.z) : isLand(organism.x, organism.z))
    assert.ok(world.pond.oxygen >= 0 && world.pond.oxygen <= world.pond.water)
  }
})

test('new aquatic animals need whole-body clearance while aquatic plants retain their shoreline domain', () => {
  const base = { ...createWorld(), plants: [], creatures: [] }
  for (const kind of ['fish', 'flea']) {
    const radius = pondCenter.radius - swimmingClearance(kind)
    for (let angle = 0; angle < 24; angle++) {
      const x = pondCenter.x + Math.cos(angle) * radius
      const z = pondCenter.z + Math.sin(angle) * radius
      assert.equal(placementIssue(base, kind, x, z), null)
      const shoreX = x + Math.cos(angle) * 0.01
      const shoreZ = z + Math.sin(angle) * 0.01
      assert.match(placementIssue(base, kind, shoreX, shoreZ), /whole animal clears the bank/)
      assert.equal(introduceLife(base, kind, shoreX, shoreZ), base)
    }
    assert.equal(isSwimmingPosition(kind, NaN, 0), false)
  }
  assert.equal(placementIssue(base, 'lily', pondCenter.x + 0.9, pondCenter.z), null)
})

test('legacy shore fish remain loadable and recover even while resting without a stock or ID grant', () => {
  const base = { ...createWorld(), tick: 0, plants: [], climate: { ...defaultClimate(), photoperiod: true }, creatures: [animal(5, 'fish', pondCenter.x + 0.92, pondCenter.z, 90)], nextCreatureId: 6 }
  const before = structuredClone(base)
  assert.deepEqual(parseSave(serializeSave(base)), base)
  const shore = simulateStep(base)
  const center = simulateStep({ ...base, creatures: [{ ...base.creatures[0], x: pondCenter.x }] })
  assert.deepEqual(base, before)
  assert.ok(isSwimmingPosition('fish', shore.world.creatures[0].x, shore.world.creatures[0].z))
  assert.deepEqual({ ...shore, world: { ...shore.world, creatures: shore.world.creatures.map((c) => ({ ...c, x: pondCenter.x })) } }, center)
  assert.deepEqual(simulateStep(parseSave(serializeSave(shore.world))), simulateStep(shore.world))
})

test('swimming, fleeing, hunting and funded birth retain finite bodies inside water', () => {
  for (let angle = 0; angle < 24; angle++) {
    const x = pondCenter.x + Math.cos(angle) * 0.92
    const z = pondCenter.z + Math.sin(angle) * 0.92
    let animals = [animal(0, 'flea', x, z), { ...animal(1, 'fish', x, z, 95), materialReserve: 0.24 }]
    let pond = { ...defaultPond(), algae: 8 }
    let nextId = 2, seed = 17, births = 0
    for (let tick = 0; tick < 100; tick++) {
      const result = stepPond(pond, animals, 0.8, defaultClimate(), seed, nextId, tick)
      for (const c of result.creatures) assert.ok(isSwimmingPosition(c.kind, c.x, c.z))
      births += result.events.filter((e) => e.type === 'birth').length
      ;({ pond, creatures: animals, nextId, seed } = result)
    }
    assert.ok(births > 0, 'funded fish birth exercised')
  }
})

test('the fish nose can still reach shoreline prey without extending capture range or crossing the bank', () => {
  const fish = animal(1, 'fish', pondCenter.x + 0.69, pondCenter.z, 50)
  const flea = animal(0, 'flea', pondCenter.x + 0.86, pondCenter.z)
  const result = stepPond(defaultPond(), [flea, fish], 0.8, defaultClimate(), 17, 2)
  assert.equal(result.events.some((e) => e.type === 'predation'), true)
  assert.equal(result.creatures.length, 1)
  assert.ok(result.creatures.every((c) => isSwimmingPosition(c.kind, c.x, c.z)))
  assert.ok(result.creatures.find((c) => c.kind === 'fish').energy > fish.energy)
})

test('rain is a retained/outflow external water input and temperature changes real evaporation', () => {
  const base = { ...createWorld(), plants: [], creatures: [] }
  const wet = simulateStep(intervene(base, { type: 'rain', value: 1 }))
  const rain = wet.events.find((event) => event.type === 'rain')
  near(rain.retained + rain.outflow, 1.5)
  assert.ok(wet.world.water > stepWorld(base).water)
  assert.ok(wet.world.pond.water > stepWorld(base).pond.water)
  const hot = stepWorld(intervene(base, { type: 'temperature', value: 35 }))
  const cool = stepWorld(intervene(base, { type: 'temperature', value: 10 }))
  assert.ok(hot.water < cool.water && hot.pond.water < cool.pond.water)
})

test('organic loading consumes oxygen and harms aquatic animals under the same light and weather', () => {
  const run = (organic) => {
    let world = createHabitatWorld('wetland', 17)
    world = { ...world, light: 0.18, pond: { ...world.pond, organic } }
    for (let i = 0; i < 120; i += 1) world = stepWorld(world)
    return world
  }
  const clean = run(0)
  const loaded = run(120)
  assert.ok(loaded.pond.oxygen < clean.pond.oxygen / 3)
  assert.ok(loaded.pond.nutrients > clean.pond.nutrients)
  assert.ok(loaded.creatures.filter((animal) => isAquatic(animal.kind)).length < clean.creatures.filter((animal) => isAquatic(animal.kind)).length)
})

test('algae growth needs nutrients; fleas graze algae and cannot live on mineral stock alone', () => {
  const pond = { ...defaultPond(), algae: 2, organic: 0, nutrients: 0 }
  const empty = stepPond(pond, [], 0.8, defaultClimate(), 17, 1)
  const enriched = stepPond({ ...pond, nutrients: 10 }, [], 0.8, defaultClimate(), 17, 1)
  assert.ok(enriched.pond.algae > empty.pond.algae)
  const flea = animal(0, 'flea', -1.1, 0.72)
  const fed = stepPond({ ...pond, algae: 5 }, [flea], 0.8, defaultClimate(), 17, 1)
  const starved = stepPond({ ...pond, algae: 0, nutrients: 100 }, [flea], 0.8, defaultClimate(), 17, 1)
  assert.ok(fed.creatures[0].energy > starved.creatures[0].energy)
  assert.ok(fed.events.some((event) => event.type === 'feeding' && event.source === 'algae'))
})

test('fish catches partition material once and stored material can fund young', () => {
  const fish = animal(1, 'fish', -1.1, 0.72)
  const flea = animal(0, 'flea', -1.1, 0.72)
  const result = stepPond(defaultPond(), [flea, fish, { ...fish, id: 2 }], 0.8, defaultClimate(), 17, 3)
  const catches = result.events.filter((event) => event.type === 'predation')
  assert.equal(catches.length, 1)
  const meal = catches[0]
  near(meal.preyMaterial, meal.litter + meal.metabolized + meal.storedMaterial + meal.offspringMaterial)
  near(result.creatures.find((animal) => animal.id === 1).materialReserve, meal.storedMaterial)
  const mature = { ...fish, energy: 95, materialReserve: 0.24 }
  const brood = stepPond(defaultPond(), [mature], 0.8, defaultClimate(), 17, 3)
  assert.equal(brood.creatures.length, 2)
  near(brood.creatures.reduce((sum, animal) => sum + (animal.materialReserve ?? 0), 0), 0)
  assert.ok(brood.creatures.some((animal) => animal.stage === 'juvenile' && animal.age === 0))
})

test('juveniles mature before reproducing; age death returns body material and preserves ID uniqueness', () => {
  const base = createWorld()
  const grazer = { ...base.creatures[0], energy: 95, x: base.plants[0].x, z: base.plants[0].z, age: 0, stage: 'juvenile' }
  assert.equal(simulateStep({ ...base, creatures: [grazer] }).events.some((event) => event.type === 'birth'), false)
  const mature = simulateStep({ ...base, creatures: [{ ...grazer, age: maturity.grazer - 1 }] })
  assert.equal(mature.world.creatures[0].stage, 'adult')
  assert.ok(mature.events.some((event) => event.type === 'birth'))
  const aged = simulateStep({ ...base, creatures: [{ ...grazer, age: lifespan.grazer - 1, stage: 'adult' }] })
  assert.equal(aged.world.creatures.length, 0)
  assert.ok(aged.events.some((event) => event.type === 'death' && event.reason === 'age'))
})

test('oxygen caps aerobic processing and imported reserves match modeled reservoirs', () => {
  const pond = { ...defaultPond(), organic: 1000, algae: 0, oxygen: 1 }
  const next = stepPond(pond, [], 0.8, defaultClimate(), 17, 1)
  assert.ok(pond.organic - next.pond.organic <= pond.oxygen / 2.5 + 1e-9)
  const save = JSON.parse(serializeSave(createWorld()))
  save.world.creatures[0].materialReserve = 1
  assert.throws(() => parseSave(JSON.stringify(save)))
  save.world.creatures[0] = animal(0, 'fish', -1.1, 0.72)
  save.world.creatures[0].materialReserve = 0.49
  assert.throws(() => parseSave(JSON.stringify(save)))
})

test('plant diagnosis includes the thermal factor actually limiting growth', () => {
  const world = createWorld()
  const plant = { id: 0, kind: 'clover', x: 1.7, z: -1.7, biomass: 7.5, capacity: 8.8 }
  const hot = { ...world, plants: [plant], light: 0.75, climate: { temperatureC: 40, rainfall: 0 }, soil: world.soil.map(patch => ({ ...patch, water: 45, nutrients: 100 })) }
  assert.equal(plantOutlook(hot, plant).limiting, 'temperature')
  assert.ok(plantOutlook(hot, plant).fit < 0.65)
  assert.ok(plantOutlook(hot, plant).change < 0)
})
