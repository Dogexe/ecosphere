import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, creatureCounts, introduceLife, intervene, interveneAt, isLand, nearestSoil, placementIssue, removeLife, stepWorld, vitality } from '../src/sim/ecosystem.ts'

const advance = (world, steps) => Array.from({ length: steps }).reduce(stepWorld, world)
const mean = (patches, key) => patches.reduce((sum, patch) => sum + patch[key], 0) / patches.length
const withSoil = (world, edit) => {
  const soil = world.soil.map((patch) => edit({ ...patch }))
  return { ...world, soil, water: mean(soil, 'water'), nutrients: mean(soil, 'nutrients'), organic: mean(soil, 'organic') }
}

test('the same seed and actions produce the same world', () => {
  const run = () => advance(intervene(createWorld(147), { type: 'compost' }), 200)
  assert.deepEqual(run(), run())
  assert.notDeepEqual(createWorld(147).plants, createWorld(148).plants)
})

test('water and compost add real stocks; decomposition releases nutrients', () => {
  const initial = createWorld()
  const watered = intervene(initial, { type: 'water' })
  const composted = intervene(initial, { type: 'compost' })
  assert.equal(watered.water, initial.water + 18)
  assert.equal(composted.organic, initial.organic + 16)
  assert.ok(watered.soil.every((patch, index) => patch.water === initial.soil[index].water + 18))
  assert.ok(composted.soil.every((patch, index) => patch.organic === initial.soil[index].organic + 16))
  assert.ok(stepWorld(composted).nutrients > stepWorld(initial).nutrients)
  assert.ok(vitality(advance(composted, 45)) > vitality(advance(initial, 45)))
})

test('local tending changes one patch and one quarter of the world summary', () => {
  const initial = createWorld()
  const watered = interveneAt(initial, 'water', 0)
  const composted = interveneAt(initial, 'compost', 2)
  assert.equal(watered.soil[0].water, initial.soil[0].water + 18)
  assert.equal(composted.soil[2].organic, initial.soil[2].organic + 16)
  assert.ok(watered.soil.every((patch, index) => index === 0 || patch.water === initial.soil[index].water))
  assert.ok(composted.soil.every((patch, index) => index === 2 || patch.organic === initial.soil[index].organic))
  assert.equal(watered.water, initial.water + 18 / 4)
  assert.equal(composted.organic, initial.organic + 16 / 4)
  assert.equal(initial.soil[0].water, 54)
})

test('light and moisture change plant growth rather than only display color', () => {
  const healthy = advance({ ...createWorld(), creatures: [] }, 35)
  const dry = withSoil({ ...createWorld(), creatures: [] }, (patch) => ({ ...patch, water: 4 }))
  const stressed = advance(intervene(dry, { type: 'light', value: 0.18 }), 35)
  assert.ok(vitality(stressed) < vitality(dry))
  assert.ok(vitality(healthy) > vitality(stressed))
})

test('grazers move toward food and remove plant biomass when feeding', () => {
  const start = createWorld()
  const result = advance(start, 35)
  assert.ok(result.grazed > 0)
  assert.ok(result.creatures.some((creature, index) => creature.x !== start.creatures[index].x || creature.z !== start.creatures[index].z))
  assert.ok(result.organic > 0)
})

test('a birth requires food and reserve energy and splits the parent reserve', () => {
  const initial = createWorld()
  const parent = { ...initial.creatures[0], x: initial.plants[0].x, z: initial.plants[0].z, energy: 95 }
  const prepared = { ...initial, creatures: [parent] }
  const born = stepWorld(prepared)
  assert.equal(born.creatures.length, 2)
  assert.ok(born.plants[0].biomass < initial.plants[0].biomass - 0.3)
  assert.ok(born.creatures[0].energy + born.creatures[1].energy < 95.864)
  assert.ok(born.creatures[0].energy + born.creatures[1].energy > 94.58)
  assert.equal(stepWorld({ ...prepared, creatures: [{ ...parent, energy: 40 }] }).creatures.length, 1)
  assert.equal(stepWorld({ ...prepared, plants: initial.plants.map((plant) => ({ ...plant, biomass: 0.35 })) }).creatures.length, 1)
})

test('starvation removes grazers and returns body material to the organic pool', () => {
  const initial = createWorld()
  const empty = withSoil({ ...initial, plants: [], creatures: [{ ...initial.creatures[0], energy: 0.1 }] }, (patch) => ({ ...patch, water: 0, organic: 0, fungi: 0 }))
  const result = stepWorld(empty)
  assert.equal(result.creatures.length, 0)
  assert.equal(result.organic * empty.soil.length + result.remains.reduce((sum, item) => sum + item.material, 0), 0.42)
  assert.equal(result.plants.reduce((sum, plant) => sum + plant.biomass, 0), empty.plants.reduce((sum, plant) => sum + plant.biomass, 0))
})

test('grazer population responds to abundance and depletion', () => {
  const abundant = advance(createWorld(), 75)
  const depleted = advance(withSoil({ ...createWorld(), light: 0.18, plants: createWorld().plants.map((plant) => ({ ...plant, biomass: 0.35 })) }, (patch) => ({ ...patch, water: 0 })), 250)
  assert.ok(creatureCounts(abundant.creatures).grazer > 3)
  assert.equal(depleted.creatures.length, 0)
})

test('local soil summaries stay synchronized and resource stocks stay nonnegative', () => {
  let world = createWorld(89)
  for (let tick = 0; tick < 800; tick += 1) {
    if (tick % 39 === 0) world = intervene(world, { type: 'water' })
    if (tick % 57 === 0) world = intervene(world, { type: 'compost' })
    world = stepWorld(world)
    for (const key of ['water', 'nutrients', 'organic']) {
      assert.ok(Math.abs(world[key] - mean(world.soil, key)) < 1e-9)
      assert.ok(world.soil.every((patch) => patch[key] >= 0))
    }
    assert.ok(world.soil.every((patch) => patch.fungi >= 0))
  }
})

test('wet substrate supports fungi, while dry soil cannot decompose it', () => {
  const initial = withSoil({ ...createWorld(), plants: [], creatures: [] }, (patch) => ({ ...patch, water: 75, organic: 30, fungi: 2 }))
  const dry = withSoil(initial, (patch) => ({ ...patch, water: 0 }))
  const wetResult = advance(initial, 50)
  const dryResult = advance(dry, 50)
  assert.ok(wetResult.soil[0].fungi > initial.soil[0].fungi)
  assert.ok(dryResult.soil[0].fungi < dry.soil[0].fungi)
  assert.ok(wetResult.nutrients > initial.nutrients)
  assert.equal(dryResult.nutrients, dry.nutrients)
  assert.ok(wetResult.organic < initial.organic)
})

test('decomposition recycles tracked dry material with an open respiration loss', () => {
  let world = { ...createWorld(), plants: [], creatures: [] }
  const stock = (patch) => patch.organic + patch.nutrients + patch.fungi
  for (let tick = 0; tick < 100; tick += 1) {
    const next = stepWorld(world)
    for (let index = 0; index < world.soil.length; index += 1) {
      assert.ok(stock(next.soil[index]) <= stock(world.soil[index]) + 1e-9)
      assert.ok(stock(next.soil[index]) > 0)
    }
    world = next
  }
})

test('four plants have distinct habitat and food roles', () => {
  const base = createWorld()
  const plants = ['clover', 'fern', 'bloom', 'moss'].map((kind, id) => ({ id, kind, x: -1.7, z: 1.7, biomass: 2, capacity: 8 }))
  const habitat = (water, nutrients, light) => withSoil({ ...base, light, plants, creatures: [] }, (patch) => ({ ...patch, water, nutrients }))
  const vigor = (world, kind) => advance(world, 40).plants.find((plant) => plant.kind === kind)?.biomass ?? 0
  const shadedWet = habitat(75, 60, 0.35)
  const drySun = habitat(27, 60, 0.95)
  const fertileSun = habitat(65, 95, 0.95)
  assert.ok(vigor(shadedWet, 'fern') > vigor(shadedWet, 'bloom'))
  assert.ok(vigor(shadedWet, 'moss') > vigor(drySun, 'moss'))
  assert.ok(vigor(drySun, 'clover') > vigor(drySun, 'fern'))
  assert.ok(vigor(fertileSun, 'bloom') > vigor(fertileSun, 'moss'))
  assert.equal(nearestSoil(base.soil, -2, 2).id, 2)
})

test('plants sharing one patch compete for local nutrients', () => {
  const base = withSoil({ ...createWorld(), creatures: [], light: 0.8 }, (patch) => ({ ...patch, water: 48, nutrients: 20, organic: 0, fungi: 0 }))
  const first = { id: 0, kind: 'clover', x: -1.7, z: -1.7, biomass: 2, capacity: 8 }
  const shared = advance({ ...base, plants: [first, { ...first, id: 1, x: -1.6, z: -1.6 }] }, 80)
  const separate = advance({ ...base, plants: [first, { ...first, id: 1, x: 1.7, z: 1.7 }] }, 80)
  assert.ok(separate.plants[1].biomass > shared.plants[1].biomass + 0.08)
  assert.ok(shared.soil[0].nutrients < separate.soil[0].nutrients)
})

test('grazers receive more food from clover than moss', () => {
  const base = createWorld()
  const grazer = { ...base.creatures[0], x: -1.7, z: -1.7, energy: 50 }
  const plant = { id: 0, kind: 'clover', x: -1.7, z: -1.7, biomass: 5, capacity: 8 }
  const clover = advance({ ...base, creatures: [grazer], plants: [plant] }, 12)
  const moss = advance({ ...base, creatures: [grazer], plants: [{ ...plant, kind: 'moss' }] }, 12)
  assert.ok(clover.grazed > moss.grazed * 10)
  assert.ok(clover.creatures[0].energy > moss.creatures[0].energy)
})

test('a world from before local soil can resume after hot reload', () => {
  const oldWorld = { ...createWorld() }
  delete oldWorld.soil
  assert.equal(stepWorld(oldWorld).soil.length, 4)
  assert.equal(intervene(oldWorld, { type: 'compost' }).organic, oldWorld.organic + 16)
})

test('introduced life joins the ecology without mutating the original world', () => {
  const initial = { ...createWorld(), plants: [], creatures: [] }
  const snapshot = structuredClone(initial)
  const planted = introduceLife(initial, 'clover', 0.5, -0.5)
  const grown = advance(planted, 20)
  assert.equal(planted.plants.length, 1)
  assert.ok(grown.plants[0].biomass > planted.plants[0].biomass)
  const occupied = introduceLife(planted, 'grazer', 0.5, -0.5)
  assert.ok(advance(occupied, 20).grazed > 0)
  assert.deepEqual(initial, snapshot)
  assert.equal(introduceLife(planted, 'fern', 0.5, -0.5), planted)
})

test('placement respects the pond, rim, space, population limits, and IDs', () => {
  const initial = createWorld()
  for (const [x, z] of [[-1.1, 0.72], [4, 0], [NaN, 0]]) {
    assert.ok(placementIssue(initial, 'moss', x, z))
    assert.equal(introduceLife(initial, 'moss', x, z), initial)
  }
  assert.ok(placementIssue(initial, 'clover', initial.plants[0].x, initial.plants[0].z))
  const planted = introduceLife(initial, 'moss', 0.5, -0.5)
  assert.equal(new Set(planted.plants.map((plant) => plant.id)).size, planted.plants.length)
  assert.ok(placementIssue({ ...initial, plants: Array(32).fill(initial.plants[0]) }, 'fern', 0.5, -0.5))
  assert.ok(placementIssue({ ...initial, creatures: Array(7).fill(initial.creatures[0]) }, 'grazer', 0.5, -0.5))
})

test('moving an organism out exports it without also creating litter', () => {
  const initial = createWorld()
  const noPlant = removeLife(initial, 'plant', initial.plants[0].id)
  const noGrazer = removeLife(initial, 'creature', initial.creatures[0].id)
  assert.equal(noPlant.plants.length, initial.plants.length - 1)
  assert.equal(noGrazer.creatures.length, initial.creatures.length - 1)
  assert.deepEqual(noPlant.soil, initial.soil)
  assert.deepEqual(noGrazer.soil, initial.soil)
  assert.equal(vitality({ ...initial, plants: [] }), 0)
})

test('grazers follow the shore to food and remain on land', () => {
  const initial = createWorld()
  let world = { ...initial,
    plants: [{ ...initial.plants[2], x: 0.5, z: 0.72, biomass: 20, capacity: 25 }],
    creatures: [{ ...initial.creatures[0], x: -2.65, z: 0.72, energy: 100 }],
  }
  for (let tick = 0; tick < 120; tick += 1) {
    world = stepWorld(world)
    for (const creature of world.creatures) assert.ok(isLand(creature.x, creature.z), `water crossing at tick ${tick}: ${creature.x}, ${creature.z}`)
  }
  assert.ok(world.grazed > 0)
  assert.ok(world.creatures.some((creature) => Math.hypot(creature.x - 0.5, creature.z - 0.72) < 0.3))
})

test('declining plants can die and return residual material to their local soil', () => {
  const initial = createWorld()
  const weak = withSoil({ ...initial, light: 0.18, creatures: [], plants: [{ ...initial.plants[0], biomass: 0.37 }] }, (patch) => ({ ...patch, water: 0, nutrients: 0, organic: 0, fungi: 0 }))
  let result = weak
  for (let step = 0; step < 4 && result.plants.length; step++) result = stepWorld(result)
  assert.equal(result.plants.length, 0)
  const local = nearestSoil(result.soil, weak.plants[0].x, weak.plants[0].z)
  assert.ok(Math.abs(local.organic + result.remains.reduce((sum, item) => sum + item.material, 0) - 0.37 * 0.42) < 1e-9)
  assert.equal(result.soil.filter((patch) => patch.id !== local.id).reduce((sum, patch) => sum + patch.organic, 0), 0)
  const drought = withSoil({ ...initial, light: 0.18, creatures: [] }, (patch) => ({ ...patch, water: 0 }))
  assert.equal(advance(drought, 220).plants.length, 0)
})

test('mature plants establish seeded offspring by transferring parent biomass', () => {
  const initial = createWorld(183)
  let world = withSoil({ ...initial, light: 0.75, creatures: [], plants: [{ ...initial.plants[2], x: -0.1, z: -1.4, biomass: 8 }] }, (patch) => ({ ...patch, water: 48, nutrients: 90, organic: 0, fungi: 0 }))
  let recruited = false
  for (let tick = 0; tick < 180; tick += 1) {
    if (world.water < 40) world = intervene(world, { type: 'water' })
    const next = stepWorld(world)
    if (next.plants.length > 1) {
      const withoutRecruitment = stepWorld({ ...world, seed: 0 })
      assert.equal(withoutRecruitment.plants.length, 1)
      const mass = (state) => state.plants.reduce((sum, plant) => sum + plant.biomass, 0)
      assert.ok(Math.abs(mass(next) - mass(withoutRecruitment)) < 1e-9)
      assert.ok(next.plants.every((plant) => isLand(plant.x, plant.z)))
      assert.equal(new Set(next.plants.map((plant) => plant.id)).size, next.plants.length)
      assert.ok(Math.hypot(next.plants[0].x - next.plants[1].x, next.plants[0].z - next.plants[1].z) >= 0.68)
      recruited = true
      break
    }
    world = next
  }
  assert.ok(recruited, 'a well-supported parent should establish a seedling')
})

test('water and compost can sustain plants and grazers through later days', () => {
  let tended = createWorld()
  for (let tick = 0; tick < 480; tick += 1) {
    if (tick > 0 && tick % 48 === 0) tended = intervene(tended, { type: 'water' })
    if (tick > 0 && tick % 72 === 0) tended = intervene(tended, { type: 'compost' })
    tended = stepWorld(tended)
  }
  const neglected = advance(createWorld(), 480)
  assert.ok(vitality(tended) > vitality(neglected))
  assert.ok(creatureCounts(tended.creatures).grazer > creatureCounts(neglected.creatures).grazer)
})
