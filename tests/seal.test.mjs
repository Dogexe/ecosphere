import test from 'node:test'
import assert from 'node:assert/strict'
import { applySoilInput, createWorld, dominantLimit, introduceLife, intervene, interveneAt, removeLife, simulateStep, stepWorld } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { exportColony, introduceColony } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { airJar, carbonFit, co2Ppm, fogLevel, heldWater, jarMatter, jarWater, o2Percent, oxygenFit, sealOutcome, sealWorld, startingCO2, startingO2, unsealWorld } from '../src/sim/seal.ts'
import { beginDaylitWorld, environmentAt } from '../src/sim/climate.ts'
import { placementIssue, plantOutlook } from '../src/sim/ecosystem.ts'

const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)

test('sealing stops rain and keeps the open world unchanged until then', () => {
  const open = intervene(createWorld(9), { type: 'rain', value: 0.6 })
  const sealed = sealWorld(open, 30)
  assert.equal(sealed.climate.rainfall, 0)
  assert.deepEqual(sealed.sealed, { since: open.tick, goalDays: 30, vapor: 0, co2: startingCO2, o2: startingO2, airings: 0 })
  assert.equal(Math.round(co2Ppm(startingCO2)), 420)
  assert.equal(o2Percent(startingO2), 20.9)
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
  const earlier = JSON.parse(serializeSave(sealed))
  for (const key of ['co2', 'o2', 'airings']) delete earlier.world.sealed[key]
  assert.deepEqual(parseSave(JSON.stringify(earlier)).sealed, { ...sealed.sealed, co2: startingCO2, o2: startingO2, airings: 0 })
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

const plantKinds = new Set(['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed'])
const daylitJar = (habitat, days = 365) => sealWorld(beginDaylitWorld(createHabitatWorld(habitat)), days)

test('minerals and carbon inside a sealed jar are conserved, with respired carbon held as CO2', () => {
  for (const start of [daylitJar('garden'), daylitJar('woodland'), daylitJar('wetland'), sealWorld(introduceColony(createWorld(), 0.3, -1.7), 30)]) {
    let world = start
    const opening = jarMatter(world)
    const carbon = opening.carbon + world.sealed.co2
    for (let hour = 0; hour < 60 * 24; hour += 1) {
      world = stepWorld(world)
      const now = jarMatter(world)
      assert.ok(Math.abs(now.minerals - opening.minerals) < 1e-8 * opening.minerals, `minerals drifted at hour ${hour}`)
      assert.ok(Math.abs(now.carbon + world.sealed.co2 - carbon) < 1e-8 * carbon, `carbon drifted at hour ${hour}`)
      assert.ok(world.sealed.co2 > -1e-6, 'photosynthesis fixed more CO2 than the jar air held')
    }
    // O2 falls exactly as CO2 rises: one respired carbon unit uses one O2 unit.
    assert.ok(Math.abs((world.sealed.o2 - start.sealed.o2) + (world.sealed.co2 - start.sealed.co2)) < 1e-8 * start.sealed.o2)
  }
})

test('the open world still loses matter to the air, so the cycle only closes under the seal', () => {
  const start = beginDaylitWorld(createHabitatWorld('woodland'))
  const open = advance(start, 30 * 24)
  assert.ok(jarMatter(open).minerals < jarMatter(start).minerals * 0.99)
})

test('seedlings still establish inside a sealed jar; only the player is locked out', () => {
  let world = daylitJar('woodland')
  assert.ok(placementIssue(world, 'moss', 0, 0))
  let births = 0
  for (let hour = 0; hour < 60 * 24 && births === 0; hour += 1) {
    const result = simulateStep(world)
    world = result.world
    births += result.events.filter((event) => event.type === 'birth' && plantKinds.has(event.kind)).length
  }
  assert.ok(births > 0)
})

test('CO2 limits sealed photosynthesis and bright light heats the jar', () => {
  const open = beginDaylitWorld(createHabitatWorld('meadow'))
  const sealed = sealWorld(open, 30)
  assert.equal(carbonFit(open), 1)
  assert.ok(Math.abs(carbonFit(sealed) - 0.5) < 1e-12)
  const starved = { ...sealed, sealed: { ...sealed.sealed, co2: 0 } }
  const step = stepWorld({ ...starved, tick: 12 })
  for (const plant of starved.plants) {
    const after = step.plants.find((item) => item.id === plant.id)
    if (after) assert.ok(after.biomass <= plant.biomass + 1e-12)
  }
  const noon = (world) => environmentAt({ ...world, tick: 12 }).temperatureC
  assert.ok(noon(sealed) > noon(open) + 8)
  assert.equal(noon({ ...sealed, light: 0.3 }) < noon(sealed), true)
  assert.equal(environmentAt({ ...sealed, tick: 0 }).temperatureC, environmentAt({ ...open, tick: 0 }).temperatureC)
})

test('thin jar air stresses animals and slows decay; waterlogged sealed soil rots roots', () => {
  const sealed = daylitJar('woodland', 30)
  const thin = { ...sealed, sealed: { ...sealed.sealed, o2: startingO2 * 10 / 20.9 } }
  assert.equal(oxygenFit(sealed), 1)
  assert.ok(oxygenFit(thin) < 0.3)
  const energy = (world) => stepWorld(world).creatures.filter((creature) => creature.kind === 'woodlouse').reduce((sum, creature) => sum + creature.energy, 0)
  assert.ok(energy(thin) < energy(sealed))
  const litter = (world) => stepWorld(world).soil.reduce((sum, patch) => sum + patch.organic, 0)
  assert.ok(litter(thin) > litter(sealed))
  const soaked = { ...sealed, soil: sealed.soil.map((patch) => ({ ...patch, water: 100 })) }
  const land = soaked.plants.find((plant) => plant.kind === 'fern')
  assert.equal(plantOutlook(soaked, land).limiting, 'rot')
  assert.ok(plantOutlook(soaked, land).loss > plantOutlook({ ...soaked, sealed: null }, land).loss)
})

test('airing swaps in room air, lets some vapour out and is counted', () => {
  let world = advance(daylitJar('woodland', 30), 48)
  assert.ok(world.sealed.co2 !== startingCO2)
  assert.ok(fogLevel(world) >= 0 && fogLevel(world) <= 1)
  const aired = airJar(world)
  assert.equal(aired.sealed.co2, startingCO2)
  assert.equal(aired.sealed.o2, startingO2)
  assert.equal(aired.sealed.vapor, world.sealed.vapor / 2)
  assert.equal(aired.sealed.airings, 1)
  assert.equal(aired.sealed.since, world.sealed.since)
  assert.equal(airJar(createWorld()).sealed, undefined)
})

test('benchmark: a moss and fern jar in soft light lives a year untouched, as real sealed jars do', () => {
  let world = { ...createHabitatWorld('bare'), light: 0.45 }
  const kinds = ['moss', 'fern']
  let index = 0
  for (let x = -2.2; x <= 2.2; x += 0.75) for (let z = -2.2; z <= 2.2; z += 0.75) {
    const kind = kinds[index % 2]
    if (!placementIssue(world, kind, x, z)) { world = introduceLife(world, kind, x, z); index += 1 }
  }
  world = { ...world, plants: world.plants.map((plant) => ({ ...plant, age: 90, development: 90, biomass: plant.capacity * 0.6 })) }
  world = advance(sealWorld(beginDaylitWorld(world), 365), 365 * 24)
  assert.equal(sealOutcome(world, dominantLimit).status, 'survived')
  assert.ok(world.plants.length >= 10)
  assert.equal(world.sealed.airings, 0)
})
