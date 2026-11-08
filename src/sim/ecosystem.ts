import { algaeGrowth, defaultClimate, defaultPond, isAquatic, isPondPosition, isSwimmingPosition, lifespan, maturity, pondShape, rateAt, setPondShape, stepPond } from './pond.ts'
import type { Climate, Pond } from './pond'
import { addRemains, bodyStock, decayRemains, developmentRate, plantLifetime, plantStage, woodlouseLife, woodlouseMate } from './life.ts'
import type { Remains, WoodlouseLife } from './life'
import { environmentAt, scheduledRest } from './climate.ts'
import { isLand, walkOnLand } from './land.ts'
import type { AntColony } from './colony'
import { clearMissingAntGoals, stepAntColony } from './colony.ts'
import type { AntEvent } from './colony'
import { carbonFit, carbonShare, closeJar, mineralShare, oxygenFit } from './seal.ts'
import type { SavedSubstrate } from './substrate.ts'
import type { Seal } from './seal'
export { isLand } from './land.ts'
export type PlantKind = 'clover' | 'fern' | 'bloom' | 'moss' | 'grass' | 'tree' | 'lily' | 'reed'
export type CreatureKind = 'grazer' | 'woodlouse' | 'beetle' | 'springtail' | 'flea' | 'fish' | 'snail' | 'shrimp'
export type Lifeform = PlantKind | CreatureKind

export interface SoilPatch {
  id: number
  x: number
  z: number
  water: number
  nutrients: number
  organic: number
  fungi: number
}

export interface Plant {
  id: number
  kind: PlantKind
  x: number
  z: number
  biomass: number
  capacity: number
  age?: number
  development?: number
  parentId?: number | null
  lastReproduction?: number
}

export interface Creature {
  id: number
  kind: CreatureKind
  x: number
  z: number
  heading: number
  energy: number
  age?: number
  stage?: 'juvenile' | 'adult'
  materialReserve?: number
  life?: WoodlouseLife
}

export interface World {
  colony?: AntColony | null
  /** Present only while Seal Mode is on; see seal.ts. */
  sealed?: Seal | null
  /** The layers and decorations the player poured in when building the jar (2026-11-03). Shape only; the sim's soil pockets hold the water. */
  substrate?: SavedSubstrate
  tick: number
  seed: number
  water: number
  nutrients: number
  organic: number
  light: number
  grazed: number
  soil: SoilPatch[]
  plants: Plant[]
  creatures: Creature[]
  climate: Climate
  pond: Pond
  remains: Remains[]
  nextCreatureId?: number
  nextPlantId?: number
}

export type Intervention = { type: 'water' } | { type: 'compost' } | { type: 'light' | 'temperature' | 'rain' | 'day-night'; value: number } | { type: 'pond-water' | 'pond-organic' | 'pond-nutrients' }
export type SoilInput = Pick<SoilPatch, 'water' | 'organic' | 'nutrients'>

// Ephemeral evidence of a fixed step, never part of a saved World.
export type SimulationEvent =
  | AntEvent
  | { type: 'feeding'; id: number; kind: CreatureKind; source: 'plant' | 'litter' | 'fungi' | 'algae'; amount: number }
  | { type: 'birth'; id: number; kind: Lifeform; parentId: number }
  | { type: 'death'; id: number; kind: Lifeform; reason: 'energy' | 'decline' | 'age' | 'desiccation' }
  | { type: 'mating'; kind: 'woodlouse'; motherId: number; fatherId: number }
  | { type: 'predation'; predatorKind: 'beetle' | 'fish'; predatorId: number; preyId: number; preyKind: CreatureKind; x: number; z: number; preyMaterial: number; offspringMaterial: number; storedMaterial: number; litter: number; metabolized: number }
  | { type: 'rain'; retained: number; outflow: number }

export type StepResult = { world: World; events: SimulationEvent[] }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
export const creatureLimits = { grazer: 7, woodlouse: 4, beetle: 2, springtail: 6, flea: 6, fish: 2, snail: 4, shrimp: 4 } as const
/** Fraction of soil litter that bacteria mineralise per model hour at full moisture and 22 C. */
export const bacterialDecay = 0.0008
/**
 * Waterlogged soil in a sealed jar, where the water cannot escape, rots
 * land plants' roots: extra hourly loss above 85% soil water.
 */
export const rotLoss = (plant: Plant, patch: SoilPatch) => isAquatic(plant.kind) ? 0 : 0.03 * clamp((patch.water - 85) / 15, 0, 1)
const bodyMaterial = { grazer: 0.42, woodlouse: 0.22, beetle: 0.34, springtail: 0.08, flea: 0.04, fish: 0.24, snail: 0.12, shrimp: 0.1 }
const plantCapacity: Record<PlantKind, number> = { clover: 8.8, fern: 7.6, bloom: 8.8, moss: 4.5, grass: 6.5, tree: 18, lily: 5.2, reed: 7.2 }

export function isCreatureKind(kind: string): kind is CreatureKind {
  return kind === 'grazer' || kind === 'woodlouse' || kind === 'beetle' || kind === 'springtail' || kind === 'flea' || kind === 'fish' || kind === 'snail' || kind === 'shrimp'
}

export function creatureKind(creature: Creature): CreatureKind {
  return creature.kind ?? 'grazer'
}

export function creatureCounts(creatures: Creature[]): Record<CreatureKind, number> {
  const counts = { grazer: 0, woodlouse: 0, beetle: 0, springtail: 0, flea: 0, fish: 0, snail: 0, shrimp: 0 }
  for (const creature of creatures) counts[creatureKind(creature)] += 1
  return counts
}

export function placementIssue(world: World, kind: Lifeform, x: number, z: number): string | null {
  setPondShape(world.substrate)
  if (world.sealed) return 'This world is sealed. Open the seal to add life.'
  if (isAquatic(kind) ? !isPondPosition(x, z) || (world.pond ?? defaultPond()).water < 8 : !isLand(x, z)) return isAquatic(kind) ? 'Choose water inside the pond. Refill a dry pond first.' : 'Choose dry ground inside the rim.'
  if ((kind === 'fish' || kind === 'flea' || kind === 'snail' || kind === 'shrimp') && !isSwimmingPosition(kind, x, z)) return 'Choose deeper inside the pond so the whole animal clears the bank.'
  if (isCreatureKind(kind)) {
    if (creatureCounts(world.creatures)[kind] >= creatureLimits[kind]) return `This small world has room for ${creatureLimits[kind]} ${kind === 'woodlouse' ? 'woodlice' : kind === 'beetle' ? 'beetles' : kind === 'springtail' ? 'springtails' : kind === 'flea' ? 'water fleas' : kind === 'fish' ? 'fish' : kind === 'snail' ? 'ramshorn snails' : kind === 'shrimp' ? 'cherry shrimp' : 'grazers'}.`
    if (world.creatures.some((creature) => Math.hypot(x - creature.x, z - creature.z) < (isAquatic(kind) ? 0.18 : 0.4))) return 'Give this creature a little more room.'
  } else {
    if (world.plants.length >= 32) return 'The terrarium has room for 32 plants.'
    if (world.plants.some((plant) => Math.hypot(x - plant.x, z - plant.z) < (isAquatic(kind) ? 0.4 : 0.68))) return 'Leave a little room between plants.'
  }
  return null
}

export function introduceLife(world: World, kind: Lifeform, x: number, z: number): World {
  if (placementIssue(world, kind, x, z)) return world
  if (isCreatureKind(kind)) {
    const id = Math.max(world.nextCreatureId ?? 0, world.creatures.reduce((highest, creature) => Math.max(highest, creature.id), -1) + 1)
    const creature: Creature = { id, kind, x, z, heading: id * 2.4, energy: 58, age: maturity[kind], stage: 'adult', materialReserve: 0 }
    if (kind === 'woodlouse') creature.life = woodlouseLife(creature)
    return { ...world, nextCreatureId: id + 1, creatures: [...world.creatures, creature] }
  }
  const id = Math.max(world.nextPlantId ?? 0, world.plants.reduce((highest, plant) => Math.max(highest, plant.id), -1) + 1)
  const capacity = plantCapacity[kind]
  // The player imports a living seedling and its biomass from outside the tray.
  return { ...world, nextPlantId: id + 1, plants: [...world.plants, { id, kind, x, z, biomass: 0.55, capacity, age: 0, development: 0, parentId: null, lastReproduction: -1 }] }
}

export function removeLife(world: World, kind: 'plant' | 'creature', id: number): World {
  if (world.sealed) return world
  // Removal exports living material; it is not also counted as detritus.
  const next = kind === 'plant'
    ? { ...world, plants: world.plants.filter((plant) => plant.id !== id) }
    : { ...world, creatures: world.creatures.filter((creature) => creature.id !== id) }
  return next.colony ? { ...next, colony: clearMissingAntGoals(next.colony, next.plants) } : next
}

// Overdamped soft contact, independent from art/picking. No active locomotion,
// energy/material transfer or RNG is represented by this positional repair.
export function resolveWoodlouseContacts(creatures: Creature[]): Creature[] {
  const actors = creatures.filter((creature) => creature.kind === 'woodlouse')
    .map((creature) => ({ ...creature })).sort((a, b) => a.id - b.id)
  if (actors.length < 2) return creatures
  const budget = new Map(actors.map((creature) => [creature.id, 0.08]))
  const radius = (creature: Creature) => 0.16 * Math.cbrt(woodlouseLife(creature).mass / 0.22)
  for (let sweep = 0; sweep < 6; sweep++) {
    for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i], b = actors[j]
      const distance = Math.hypot(b.x - a.x, b.z - a.z)
      const courting = a.life?.activity === 'courting' && b.life?.activity === 'courting'
        && a.life.partnerId === b.id && b.life.partnerId === a.id
      const clearance = courting ? Math.min(0.28, radius(a) + radius(b)) : radius(a) + radius(b)
      const overlap = clearance - distance
      if (overlap < 0.00001) continue
      // A deterministic pair direction resolves exact coincidence without
      // consuming the ecological RNG or depending on array/render order.
      const angle = ((a.id * 37 + b.id * 17) % 6283) / 1000
      const dx = distance > 1e-9 ? (b.x - a.x) / distance : Math.cos(angle)
      const dz = distance > 1e-9 ? (b.z - a.z) / distance : Math.sin(angle)
      for (const [actor, other, sign] of [[a, b, -1], [b, a, 1]] as const) {
        const shift = Math.min(overlap / 2, budget.get(actor.id)!)
        if (shift < 0.000001) continue
        const moved = walkOnLand(actor, actor.x + dx * sign, actor.z + dz * sign, shift)
        const before = Math.hypot(actor.x - other.x, actor.z - other.z)
        if (!isLand(moved.x, moved.z) || moved.distance > budget.get(actor.id)! + 1e-9
          || Math.hypot(moved.x - other.x, moved.z - other.z) <= before + 1e-9) continue
        actor.x = moved.x; actor.z = moved.z
        budget.set(actor.id, Math.max(0, budget.get(actor.id)! - moved.distance))
      }
    }
  }
  const resolved = new Map(actors.map((creature) => [creature.id, creature]))
  return creatures.map((creature) => resolved.get(creature.id) ?? creature)
}

// Stylized ecological niches. Values are relative model units, not measured
// species parameters; the shared resource equations below remain the same.
const plantTraits: Record<PlantKind, {
  moisture: number
  moistureRange: number
  light: number
  lightRange: number
  nutrientNeed: number
  growth: number
  palatability: number
  dispersal: number
  spread: number
}> = {
  clover: { moisture: 0.45, moistureRange: 0.7, light: 0.75, lightRange: 0.8, nutrientNeed: 45, growth: 0.21, palatability: 1, dispersal: 1.1, spread: 0.035 },
  fern: { moisture: 0.72, moistureRange: 0.75, light: 0.52, lightRange: 0.75, nutrientNeed: 58, growth: 0.22, palatability: 0.18, dispersal: 1.35, spread: 0.015 },
  bloom: { moisture: 0.62, moistureRange: 0.7, light: 0.92, lightRange: 0.72, nutrientNeed: 72, growth: 0.29, palatability: 0.72, dispersal: 1.65, spread: 0.025 },
  moss: { moisture: 0.82, moistureRange: 0.57, light: 0.38, lightRange: 0.68, nutrientNeed: 24, growth: 0.13, palatability: 0.04, dispersal: 0.85, spread: 0.025 },
  grass: { moisture: 0.5, moistureRange: 0.68, light: 0.88, lightRange: 0.66, nutrientNeed: 38, growth: 0.25, palatability: 0.94, dispersal: 0.95, spread: 0.045 },
  tree: { moisture: 0.64, moistureRange: 0.75, light: 0.78, lightRange: 0.85, nutrientNeed: 64, growth: 0.18, palatability: 0.015, dispersal: 1.75, spread: 0.008 },
  lily: { moisture: 0.85, moistureRange: 0.8, light: 0.8, lightRange: 0.8, nutrientNeed: 10, growth: 0.15, palatability: 0.02, dispersal: 0.8, spread: 0.012 },
  reed: { moisture: 0.85, moistureRange: 0.8, light: 0.85, lightRange: 0.8, nutrientNeed: 14, growth: 0.19, palatability: 0.04, dispersal: 0.85, spread: 0.018 },
}

// Pocket 2 sat at (-1.7, 1.7) until the pond grew over it; its litter
// heart is now on the far bank so woodlice and springtails can reach it.
export const soilCenters = [[-1.7, -1.7], [1.7, -1.7], [-1.6, 2.45], [1.7, 1.7]] as const

function soilFor(world: World): SoilPatch[] {
  // A world kept alive through Vite hot reload may predate spatial soil.
  return world.soil ?? soilCenters.map(([x, z], id) => ({
    id, x, z, water: world.water, nutrients: world.nutrients,
    organic: world.organic, fungi: 1.2,
  }))
}

export function nearestSoil(soil: SoilPatch[], x: number, z: number): SoilPatch {
  return soil.reduce((nearest, patch) =>
    (patch.x - x) ** 2 + (patch.z - z) ** 2 < (nearest.x - x) ** 2 + (nearest.z - z) ** 2 ? patch : nearest)
}

function soilMean(soil: SoilPatch[], key: 'water' | 'nutrients' | 'organic'): number {
  return soil.reduce((sum, patch) => sum + patch[key], 0) / soil.length
}

function withSoil(world: World, soil: SoilPatch[]): World {
  return { ...world, soil, water: soilMean(soil, 'water'), nutrients: soilMean(soil, 'nutrients'), organic: soilMean(soil, 'organic') }
}

const suitability = (value: number, preferred: number, range: number) => clamp(1 - Math.abs(value - preferred) / range, 0, 1)

function peakLightAt(world: World, x: number, z: number, excludeId = -1): number {
  let shade = 0
  for (const tree of world.plants) {
    if (tree.kind !== 'tree' || tree.id === excludeId) continue
    const vigor = tree.biomass / tree.capacity
    const radius = 1.15 + vigor * 0.8
    shade += Math.max(0, 1 - Math.hypot(x - tree.x, z - tree.z) / radius) * vigor * 0.84
  }
  return world.light * (1 - Math.min(0.88, shade))
}

export const lightAt = (world: World, x: number, z: number, excludeId = -1) => peakLightAt(world, x, z, excludeId) * environmentAt(world).solar
const plantLight = (world: World, plant: Plant) => plant.kind === 'tree' ? world.light : peakLightAt(world, plant.x, plant.z, plant.id)

function pondPatch(pond: Pond): SoilPatch { return { id: 4, x: pondShape().center.x, z: pondShape().center.z, fungi: 0, water: pond.water, nutrients: pond.nutrients, organic: pond.organic } }
const plantPatch = (world: World, plant: Plant) => isAquatic(plant.kind) ? pondPatch(world.pond ?? defaultPond()) : nearestSoil(soilFor(world), plant.x, plant.z)

/** How well a soil water level suits a plant kind (0..1): the moisture term of its habitat fit. Read-only. */
export function plantMoisture(kind: PlantKind, water: number) {
  const traits = plantTraits[kind]
  return clamp((water - 2) / 20, 0, 1) * suitability(water / 100, traits.moisture, traits.moistureRange)
}

function plantConditions(plant: Plant, patch: SoilPatch, light: number) {
  const traits = plantTraits[plant.kind]
  return {
    moisture: plantMoisture(plant.kind, patch.water),
    sunlight: Math.min(1, Math.max(0, light) / traits.light) * suitability(light, traits.light, traits.lightRange),
    fertility: clamp(patch.nutrients / traits.nutrientNeed, 0, 1),
  }
}

export function habitatFit(world: World, plant: Plant): number {
  const { moisture, sunlight, fertility } = plantConditions(plant, plantPatch(world, plant), plantLight(world, plant))
  return moisture * sunlight * fertility * Math.max(0, 1 - Math.abs(environmentAt(world).temperatureC - 22) / 24)
}

function plantFlux(plant: Plant, patch: SoilPatch, light: number, temperature = 22, photosynthesis = 1, cycling = false, carbon = 1, sealed = false) {
  const { moisture, sunlight, fertility } = plantConditions(plant, patch, light)
  const stage = plantStage(plant)
  let growth = stage === 'seed' || stage === 'germinating' ? 0 : Math.min(plantTraits[plant.kind].growth * moisture * sunlight * fertility * (1 - plant.biomass / plant.capacity) * Math.max(0, 1 - Math.abs(temperature - 22) / 24) * photosynthesis * carbon, patch.water / 0.12, patch.nutrients / 0.65)
  // Small seedlings cannot pay a full established canopy's absolute upkeep.
  // Ramp existing turnover with living mass up to the seedling boundary;
  // this is a coarse size surrogate, not calibrated respiratory chemistry.
  const leafCost = Math.min(1, plant.biomass / (plant.capacity * 0.22))
  const loss = stage === 'seed' || stage === 'germinating' ? 0.002 : (0.014 + 0.045 * (1 - moisture) + 0.035 * (1 - sunlight) + (stage === 'senescent' ? 0.08 : 0)) * leafCost + (sealed ? rotLoss(plant, patch) : 0)
  if (cycling) growth = Math.min(growth, Math.max(0, plant.capacity - plant.biomass + loss))
  return { growth, loss }
}

export type PlantLimit = 'water' | 'light' | 'nutrients' | 'temperature' | 'co2' | 'rot'

export function plantOutlook(world: World, plant: Plant) {
  const patch = plantPatch(world, plant)
  const localLight = plantLight(world, plant)
  const environment = environmentAt(world)
  const { moisture, sunlight, fertility } = plantConditions(plant, patch, localLight)
  const air = carbonFit(world)
  const { growth, loss } = plantFlux(plant, patch, localLight, environment.temperatureC, environment.photosynthesis, environment.cycling, air, !!world.sealed)
  const temperature = Math.max(0, 1 - Math.abs(environment.temperatureC - 22) / 24)
  const soilLimit = temperature < Math.min(moisture, sunlight, fertility) ? 'temperature' : moisture <= sunlight && moisture <= fertility ? 'water' : sunlight <= fertility ? 'light' : 'nutrients'
  const limiting: PlantLimit = world.sealed && rotLoss(plant, patch) > 0 ? 'rot' : air < Math.min(moisture, sunlight, fertility, temperature) ? 'co2' : soilLimit
  return { change: clamp(plant.biomass + growth - loss, 0, plant.capacity) - plant.biomass, growth, loss, dark: environment.cycling && environment.solar <= 0, limiting, fit: moisture * sunlight * fertility * temperature * air, localLight: localLight * environment.solar }
}

const litterMoisture = (patch: SoilPatch) => clamp((patch.water - 10) / 55, 0, 1)

function litterTarget(soil: SoilPatch[], creature: Creature): SoilPatch | null {
  let best: SoilPatch | null = null
  let bestScore = 0
  for (const patch of soil) {
    if (patch.organic < 0.08) continue
    const score = litterMoisture(patch) * patch.organic / (patch.organic + 4) / (0.35 + Math.hypot(patch.x - creature.x, patch.z - creature.z))
    if (score > bestScore) { best = patch; bestScore = score }
  }
  return best
}

function fungusTarget(soil: SoilPatch[], creature: Creature): SoilPatch | null {
  let best: SoilPatch | null = null
  let score = 0
  for (const patch of soil) {
    if (patch.fungi < 0.025) continue
    const next = litterMoisture(patch) * patch.fungi / (patch.fungi + 0.4) / (0.3 + Math.hypot(patch.x - creature.x, patch.z - creature.z))
    if (next > score) { best = patch; score = next }
  }
  return best
}

function grazerTarget(plants: Plant[], creature: Creature): Plant | null {
  return plants.filter((plant) => plant.biomass > 0.55 && !isAquatic(plant.kind)).reduce<Plant | null>((nearest, plant) => {
    if (!nearest) return plant
    const distance = ((plant.x - creature.x) ** 2 + (plant.z - creature.z) ** 2) / plantTraits[plant.kind].palatability
    const previous = ((nearest.x - creature.x) ** 2 + (nearest.z - creature.z) ** 2) / plantTraits[nearest.kind].palatability
    return distance < previous ? plant : nearest
  }, null)
}

export function predatorThreat(world: World, creature: Creature): Creature | null {
  if (creatureKind(creature) === 'beetle' || isAquatic(creatureKind(creature))) return null
  const radius = creatureKind(creature) === 'woodlouse' ? 0.85 : creatureKind(creature) === 'springtail' ? 0.65 : 1.05
  let nearest: Creature | null = null
  let distance = radius
  for (const hunter of world.creatures) {
    if (creatureKind(hunter) !== 'beetle') continue
    // Hunters pay basal maintenance before deciding to wake. Prey must see
    // that same upcoming hunger threshold, not an earlier reserve value.
    const intentEnergy = world.climate?.photoperiod ? hunter.energy - 0.32 * rateAt(environmentAt(world).temperatureC) : hunter.energy
    if (intentEnergy <= (world.climate?.photoperiod ? 0 : 0.32) || scheduledRest(world, { ...hunter, energy: intentEnergy })) continue
    const next = Math.hypot(hunter.x - creature.x, hunter.z - creature.z)
    if (next < distance) { nearest = hunter; distance = next }
  }
  return nearest
}

export function beetleIsHunting(world: World, creature: Creature): boolean {
  if (scheduledRest(world, creature)) return false
  return creature.energy <= 66 || (creature.stage !== 'juvenile' && creature.energy >= 82 && creatureCounts(world.creatures).beetle < creatureLimits.beetle && world.creatures.filter((prey) => creatureKind(prey) !== 'beetle' && !isAquatic(creatureKind(prey)) && prey.energy > 0).length >= 4)
}

function preyTarget(prey: Creature[], hunter: Creature): Creature | null {
  let best: Creature | null = null
  let score = Infinity
  for (const creature of prey) {
    const kind = creatureKind(creature)
    if (kind === 'beetle' || isAquatic(kind) || creature.energy <= 0) continue
    const distance = Math.hypot(creature.x - hunter.x, creature.z - hunter.z)
    if (distance > 2.6) continue
    const next = distance ** 2 / bodyStock(creature, bodyMaterial[kind])
    if (next < score) { best = creature; score = next }
  }
  return best
}

export function creatureIsFeeding(world: World, creature: Creature, events?: SimulationEvent[]): boolean {
  if (events) return events.some((event) => event.type === 'feeding' ? event.id === creature.id : event.type === 'predation' && event.predatorId === creature.id)
  if (creatureKind(creature) === 'beetle' || isAquatic(creatureKind(creature)) || predatorThreat(world, creature) || scheduledRest(world, creature)) return false
  const target = creatureKind(creature) === 'woodlouse' ? litterTarget(soilFor(world), creature) : creatureKind(creature) === 'springtail' ? fungusTarget(soilFor(world), creature) : grazerTarget(world.plants, creature)
  return target !== null && Math.hypot(target.x - creature.x, target.z - creature.z) <= 0.24
}

function random(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return [next, next / 4294967296]
}

const locations = [
  [-2.45, -0.85], [-1.36, -2.15], [0.28, -2.42], [1.85, -1.58],
  [2.48, 0.45], [1.15, 1.98], [0.25, 2.6], [-2.8, -0.05],
] as const

export function createWorld(seed = 2217): World {
  let nextSeed = seed >>> 0
  const plants = locations.map(([x, z], id): Plant => {
    let value: number
    ;[nextSeed, value] = random(nextSeed)
    const kind: PlantKind = id >= 6 ? 'moss' : id % 3 === 0 ? 'bloom' : id % 3 === 1 ? 'fern' : 'clover'
    const capacity = plantCapacity[kind]
    return {
      id, kind,
      x: x + (value - 0.5) * 0.18,
      z: z + (value - 0.5) * 0.13,
      biomass: capacity * (0.54 + value * 0.08),
      capacity,
    }
  })

  const creatures: Creature[] = [
    { id: 0, kind: 'grazer', x: -2.05, z: -0.75, heading: 0.5, energy: 58 },
    { id: 1, kind: 'grazer', x: 1.7, z: -1.2, heading: 2.5, energy: 62 },
    { id: 2, kind: 'grazer', x: 0.95, z: 1.62, heading: 4.1, energy: 55 },
    { id: 3, kind: 'woodlouse', x: -2.5, z: -1.5, heading: 0.8, energy: 56 },
    { id: 4, kind: 'woodlouse', x: 1.85, z: 1.35, heading: 2.2, energy: 52 },
  ]

  const soil = soilCenters.map(([x, z], id): SoilPatch => ({
    id, x, z,
    water: [54, 48, 70, 60][id],
    nutrients: [40, 46, 42, 40][id],
    organic: [14, 14, 20, 16][id],
    fungi: [1.2, 0.9, 1.9, 1.3][id],
  }))
  return withSoil({ tick: 0, seed: nextSeed, water: 58, nutrients: 42, organic: 16, light: 0.78, grazed: 0, soil, plants: plants.map((plant) => ({ ...plant, age: 90, development: 90, parentId: null, lastReproduction: -1 })), creatures: creatures.map((creature) => ({ ...creature, age: maturity[creature.kind], stage: 'adult', materialReserve: 0, ...(creature.kind === 'woodlouse' ? { life: woodlouseLife(creature) } : {}) })), climate: defaultClimate(), pond: defaultPond(), remains: [], nextCreatureId: creatures.length, nextPlantId: plants.length }, soil)
}

export function applySoilInput(world: World, input: SoilInput, patchId?: number) {
  // Receipts are transient totals across targeted equal-area pockets. They are
  // imports/outflow, not additional stocks and never enter a saved world.
  const receipt = { water: 0, organic: 0, nutrients: 0, waterOutflow: 0 }
  const current = soilFor(world)
  if (!input || (['water', 'organic', 'nutrients'] as const).some((key) => !Number.isFinite(input[key]) || input[key] < 0 || input[key] > 20)
    || (patchId !== undefined && !current.some((patch) => patch.id === patchId))
    || input.water + input.organic + input.nutrients === 0 || world.sealed) return { world, receipt }
  const soil = current.map((patch) => {
    if (patchId !== undefined && patch.id !== patchId) return patch
    const water = Math.min(input.water, Math.max(0, 100 - patch.water))
    receipt.water += water
    receipt.waterOutflow += input.water - water
    receipt.organic += input.organic
    receipt.nutrients += input.nutrients
    return { ...patch, water: patch.water + water, organic: patch.organic + input.organic, nutrients: patch.nutrients + input.nutrients }
  })
  return { world: withSoil(world, soil), receipt }
}

export function intervene(world: World, action: Intervention): World {
  // A sealed jar still exchanges light and heat, never matter.
  if (world.sealed && action.type !== 'light' && action.type !== 'temperature' && action.type !== 'day-night') return world
  if (action.type === 'water') return applySoilInput(world, { water: 18, organic: 0, nutrients: 0 }).world
  if (action.type === 'compost') return applySoilInput(world, { water: 0, organic: 16, nutrients: 0 }).world
  if (action.type === 'light') return { ...world, light: clamp(action.value, 0.15, 1) }
  if (action.type === 'day-night') return action.value === 0 || action.value === 1 ? { ...world, climate: { ...(world.climate ?? defaultClimate()), photoperiod: action.value === 1 } } : world
  if (action.type === 'temperature' || action.type === 'rain') {
    if (!Number.isFinite(action.value)) return world
    const climate = { ...(world.climate ?? defaultClimate()) }
    if (action.type === 'temperature') climate.temperatureC = clamp(action.value, 0, 40)
    else climate.rainfall = clamp(action.value, 0, 1)
    return { ...world, climate }
  }
  const pond = { ...(world.pond ?? defaultPond()) }
  if (action.type === 'pond-water') pond.water = Math.min(100, pond.water + 18)
  else if (action.type === 'pond-organic') pond.organic += 12
  else pond.nutrients += 8
  return { ...world, pond }
}

export function interveneAt(world: World, type: 'water' | 'compost', patchId: number): World {
  return applySoilInput(world, { water: type === 'water' ? 18 : 0, organic: type === 'compost' ? 16 : 0, nutrients: 0 }, patchId).world
}

/**
 * Soil water creeps sideways by capillary action from wet pockets into dry
 * ones; in potting mix it takes a day or two to even out across a 7 cm jar
 * (about 2% of the difference per hour). Total water is unchanged. Without
 * this, water that condenses onto a pocket with few roots, such as the one
 * under the pond, would stay trapped there while the planted pockets dried.
 */
export const soilWaterSpread = 0.02
/** Dissolved minerals ride along with that water, more slowly, since some stay bound to the soil. */
export const soilNutrientSpread = 0.01
function spreadSoilWater(soil: SoilPatch[]) {
  // Pockets that are already level stay exactly as they are (no rounding drift).
  for (const [key, spread] of [['water', soilWaterSpread], ['nutrients', soilNutrientSpread]] as const) {
    if (soil.every((patch) => patch[key] === soil[0][key])) continue
    const mean = soilMean(soil, key)
    for (const patch of soil) patch[key] += (mean - patch[key]) * spread
  }
}

export function simulateStep(world: World): StepResult {
  setPondShape(world.substrate)
  const opening = world
  let seed = world.seed
  const highestCreatureId = Math.max((world.nextCreatureId ?? 0) - 1, world.creatures.reduce((highest, creature) => Math.max(highest, creature.id), -1))
  const events: SimulationEvent[] = []
  let soil = soilFor(world).map((patch) => ({ ...patch }))
  const climate = world.climate ?? defaultClimate()
  const environment = environmentAt(world)
  const temperature = environment.temperatureC
  let pond = { ...(world.pond ?? defaultPond()) }
  const rate = rateAt(temperature)
  const decay = decayRemains(world.remains ?? [], soil, pond, temperature)
  soil = decay.soil
  pond = decay.pond
  const remains = decay.remains
  spreadSoilWater(soil)
  const depositBody = (creature: Creature, x = creature.x, z = creature.z) => addRemains(remains, creatureKind(creature), x, z, bodyStock(creature, bodyMaterial[creatureKind(creature)]), isAquatic(creature.kind) ? 4 : nearestSoil(soil, x, z).id)
  const ageSurvivors: Creature[] = []
  for (const original of world.creatures) {
    const kind = creatureKind(original)
    const age = (original.age ?? maturity[kind]) + 1
    if (age >= lifespan[kind]) {
      depositBody(original)
      events.push({ type: 'death', id: original.id, kind, reason: 'age' })
    } else ageSurvivors.push({ ...original, kind, age, stage: age >= maturity[kind] && (kind !== 'woodlouse' || woodlouseLife(original).mass >= 0.2) ? 'adult' : 'juvenile', materialReserve: original.materialReserve ?? 0, ...(kind === 'woodlouse' ? { life: woodlouseLife(original) } : {}) })
  }
  world = { ...world, creatures: ageSurvivors, climate, pond }
  if (climate.rainfall > 0) {
    const dose = climate.rainfall * 0.3
    let retained = 0
    for (const patch of [...soil, pond]) { const water = Math.min(dose, 100 - patch.water); patch.water += water; retained += water }
    events.push({ type: 'rain', retained, outflow: dose * 5 - retained })
  }
  const aquaticSoil = pondPatch(pond)
  let grazed = world.grazed

  // Fungi consume local litter. The unrecovered fraction is respiration and
  // untracked gas; these are relative model units, not calibrated carbon mass.
  // Aerobic decay slows as a sealed jar runs out of oxygen.
  const breath = oxygenFit(world)
  for (const patch of soil) {
    const moisture = clamp((patch.water - 8) / 38, 0, 1) * suitability(patch.water / 100, 0.72, 0.85)
    const decomposed = Math.min(patch.organic, 0.055 * patch.fungi * patch.organic / (patch.organic + 8) * moisture * rate * breath)
    patch.organic -= decomposed
    patch.nutrients += decomposed * 0.72
    patch.fungi += decomposed * 0.18
    const maintenance = Math.min(patch.fungi, patch.fungi * (0.003 + (1 - moisture) * 0.006))
    patch.fungi -= maintenance
    patch.organic += maintenance * 0.6
    // Soil bacteria also mineralise litter without fungi: the mineral share
    // stays in the soil, the carbon share is respired.
    const bacterial = Math.min(patch.organic, bacterialDecay * patch.organic * moisture * rate * breath)
    patch.organic -= bacterial
    patch.nutrients += bacterial * mineralShare
  }

  // In a sealed jar photosynthesis is limited by the CO2 in the jar air and
  // can never fix more carbon this hour than the air holds.
  let carbon = 1
  if (world.sealed) {
    const fit = carbonFit(world)
    const potential = carbonShare * (world.plants.reduce((sum, plant) => sum + plantFlux(plant, isAquatic(plant.kind) ? aquaticSoil : nearestSoil(soil, plant.x, plant.z), plantLight(world, plant), temperature, environment.photosynthesis, environment.cycling, fit).growth, 0)
      + algaeGrowth(pond, environment.light, { ...climate, temperatureC: temperature }) * fit)
    carbon = fit * (potential > 0 ? Math.min(1, Math.max(0, world.sealed.co2) / potential) : 1)
  }
  const plants = world.plants.map((plant): Plant | null => {
    const patch = isAquatic(plant.kind) ? aquaticSoil : nearestSoil(soil, plant.x, plant.z)
    const age = (plant.age ?? 90) + 1
    const moisture = plantConditions(plant, patch, plantLight(world, plant)).moisture
    const development = (plant.development ?? 90) + moisture * Math.max(0, 1 - Math.abs(temperature - 22) / 24) * developmentRate[plant.kind]
    const developed = { ...plant, age, development, parentId: plant.parentId ?? null, lastReproduction: plant.lastReproduction ?? -1 }
    const { growth, loss } = plantFlux(developed, patch, plantLight(world, plant), temperature, environment.photosynthesis, environment.cycling, carbon, !!world.sealed)
    const biomass = clamp(plant.biomass + growth - loss, 0, plant.capacity)
    const actualChange = biomass - plant.biomass
    if (environment.cycling) {
      // Pay gross uptake and turnover independently, including dark hours.
      const actualLoss = Math.min(loss, plant.biomass + growth)
      patch.water = Math.max(0, patch.water - growth * 0.12)
      patch.nutrients = Math.max(0, patch.nutrients - growth * 0.65)
      patch.organic += actualLoss * 0.42
      if (isAquatic(plant.kind)) pond.oxygen = Math.max(0, pond.oxygen + growth * 0.8 - actualLoss * 0.58 * 0.8)
    } else if (actualChange > 0) {
      patch.water = Math.max(0, patch.water - actualChange * 0.12)
      patch.nutrients = Math.max(0, patch.nutrients - actualChange * 0.65)
      if (isAquatic(plant.kind)) pond.oxygen += actualChange * 0.8
    } else {
      patch.organic += -actualChange * 0.42
    }
    if (biomass <= 0.35 || age >= plantLifetime[plant.kind]) {
      addRemains(remains, plant.kind, plant.x, plant.z, biomass * 0.42, patch.id)
      events.push({ type: 'death', id: plant.id, kind: plant.kind, reason: age >= plantLifetime[plant.kind] ? 'age' : 'decline' })
      return null
    }
    return { ...developed, biomass }
  }).filter((plant): plant is Plant => plant !== null)

  const creatures: Creature[] = []
  for (const creature of world.creatures) {
    const kind = creatureKind(creature)
    if (kind === 'beetle' || isAquatic(kind)) continue
    const local = nearestSoil(soil, creature.x, creature.z)
    // Thin jar air (low O2) makes every hour costlier to breathe through.
    const maintenance = (kind === 'woodlouse' ? 0.24 + (1 - litterMoisture(local)) * 0.45 : kind === 'springtail' ? 0.2 + (1 - litterMoisture(local)) * 0.65 : 0.42) * rate * (1 + 2 * (1 - breath))
    const resting = scheduledRest(world, { ...creature, energy: creature.energy - maintenance }) && !predatorThreat(world, creature)
    let energy = creature.energy - maintenance * (resting ? 0.5 : 1)
    if (kind === 'woodlouse') {
      const life = woodlouseLife(creature)
      const digested = Math.min(life.gut, 0.04 * rate)
      const growth = energy > 25 ? Math.min(Math.max(0, 0.22 - life.mass), digested * 0.15) : 0
      life.gut -= digested
      local.organic += digested * 0.4
      local.nutrients += digested * 0.35
      life.hydration *= life.mass / (life.mass + growth)
      life.mass += growth
      energy = Math.min(100, energy + digested * 14 - growth * 20)
      const moisture = litterMoisture(local)
      const hydration = clamp(life.hydration + moisture * 5 - (0.2 + (1 - moisture) * 0.6) * rate, 0, 100)
      const absorbed = Math.max(0, hydration - life.hydration) / 100 * life.mass * 0.8
      const actualWater = Math.min(local.water, absorbed)
      local.water -= actualWater
      life.hydration = hydration >= life.hydration ? life.hydration + actualWater / (life.mass * 0.8) * 100 : hydration
      life.gestation = Math.max(0, life.gestation - 1)
      life.activity = life.brood > 0 ? 'brooding' : 'foraging'
      creature.life = life
      creature.stage = (creature.age ?? 60) >= maturity.woodlouse && life.mass >= 0.2 ? 'adult' : 'juvenile'
      if (life.hydration <= 0) { depositBody(creature); events.push({ type: 'death', id: creature.id, kind, reason: 'desiccation' }); continue }
    }
    if (energy <= 0) {
      depositBody(creature)
      events.push({ type: 'death', id: creature.id, kind, reason: 'energy' })
      continue
    }

    const threat = predatorThreat(world, creature)
    if (threat) {
      // Risk costs feeding time as well as movement energy. No plant bonus.
      const coincident = Math.hypot(creature.x - threat.x, creature.z - threat.z) < 1e-9
      const dx = coincident ? Math.sin(creature.heading + 1) : creature.x - threat.x
      const dz = coincident ? Math.cos(creature.heading + 1) : creature.z - threat.z
      const moved = walkOnLand(creature, creature.x + dx, creature.z + dz, (kind === 'woodlouse' ? 0.095 : kind === 'springtail' ? 0.17 : 0.125) * clamp(energy / 30, 0.25, 1))
      energy -= moved.distance * 0.9
      if (energy <= 0) {
        depositBody(creature, moved.x, moved.z)
        events.push({ type: 'death', id: creature.id, kind, reason: 'energy' })
      } else creatures.push({ ...creature, kind, x: moved.x, z: moved.z, heading: moved.heading, energy, ...(kind === 'woodlouse' ? { life: { ...woodlouseLife(creature), activity: 'fleeing' as const } } : {}) })
      continue
    }

    if (scheduledRest(world, { ...creature, energy })) {
      if (creature.life) creature.life.activity = 'resting'
      creatures.push({ ...creature, energy })
      continue
    }

    if (kind === 'springtail') {
      const target = fungusTarget(soil, creature)
      let { x, z, heading } = creature
      if (target && Math.hypot(target.x - x, target.z - z) <= 0.24) {
        heading = Math.atan2(target.x - x, target.z - z)
        const bite = Math.min(target.fungi, 0.025 * litterMoisture(target), (100 - energy) / 22)
        target.fungi -= bite
        target.organic += bite * 0.25
        target.nutrients += bite * 0.3
        energy += bite * 22
        if (bite > 0) events.push({ type: 'feeding', id: creature.id, kind, source: 'fungi', amount: bite })
      } else {
        let turn: number
        ;[seed, turn] = random(seed)
        const destinationX = target?.x ?? x + Math.sin(heading + turn)
        const destinationZ = target?.z ?? z + Math.cos(heading + turn)
        const moved = walkOnLand(creature, destinationX, destinationZ, Math.min(target ? Math.hypot(destinationX - x, destinationZ - z) - 0.2 : 0.04, target ? 0.11 : 0.04))
        ;({ x, z, heading } = moved)
        energy -= moved.distance * 0.5
      }
      if (energy <= 0) {
        depositBody(creature, x, z)
        events.push({ type: 'death', id: creature.id, kind, reason: 'energy' })
      } else creatures.push({ ...creature, kind, x, z, heading, energy })
      continue
    }

    if (kind === 'woodlouse') {
      const life = woodlouseLife(creature)
      const mate = woodlouseMate({ ...world, creatures: world.creatures }, { ...creature, energy, life })
      const waterTarget = life.hydration < 35 ? [...soil].sort((a, b) => b.water - a.water)[0] : null
      const target = waterTarget ?? mate ?? litterTarget(soil, creature)
      let { x, z, heading } = creature
      if (energy > 82 && life.mass >= 0.2 && !mate && !waterTarget) {
        life.activity = life.brood > 0 ? 'brooding' : 'resting'
        energy = Math.min(100, energy + 0.12 * rate) // reduced expenditure while resting
      } else if (target) {
        if (waterTarget) life.activity = 'rehydrating'
        else if (mate) life.activity = 'courting'
        const distance = Math.hypot(target.x - x, target.z - z)
        if (distance > 0.24) {
          const moved = walkOnLand(creature, target.x, target.z, Math.min(0.075 * clamp(energy / 30, 0.25, 1), distance - 0.2))
          ;({ x, z, heading } = moved)
          energy -= moved.distance * 0.6
        } else if (!mate && !waterTarget) {
          const food = target as SoilPatch
          heading = Math.atan2(target.x - x, target.z - z)
          const bite = Math.min(food.organic, 0.065 * litterMoisture(food), Math.max(0, 0.13 - life.gut))
          // Ingestion stores the full meal; later digestion partitions it into
          // feces, nutrients, growth and respiratory loss without double credit.
          food.organic -= bite
          life.gut += bite
          life.activity = 'feeding'
          if (bite > 0) events.push({ type: 'feeding', id: creature.id, kind, source: 'litter', amount: bite })
        }
      } else {
        let turn: number
        ;[seed, turn] = random(seed)
        heading += (turn - 0.5) * 0.7
        const moved = walkOnLand(creature, x + Math.sin(heading), z + Math.cos(heading), 0.025)
        ;({ x, z, heading } = moved)
        energy -= moved.distance * 0.6
      }
      if (energy <= 0) {
        depositBody({ ...creature, life }, x, z)
        events.push({ type: 'death', id: creature.id, kind, reason: 'energy' })
      }
      else creatures.push({ ...creature, kind, x, z, heading, energy, life, stage: (creature.age ?? 60) >= maturity.woodlouse && life.mass >= 0.2 ? 'adult' : 'juvenile' })
      continue
    }

    const target = grazerTarget(plants, creature)

    let { x, z, heading } = creature
    if (target) {
      const dx = target.x - x
      const dz = target.z - z
      const distance = Math.hypot(dx, dz)
      heading = Math.atan2(dx, dz)
      if (distance > 0.24) {
        const stride = Math.min(0.095 * clamp(energy / 35, 0.3, 1), distance - 0.2)
        const moved = walkOnLand(creature, target.x, target.z, stride)
        ;({ x, z, heading } = moved)
        energy -= moved.distance * 0.8
      } else {
        const bite = Math.min(0.072 * plantTraits[target.kind].palatability, target.biomass - 0.48)
        if (bite > 0) {
          target.biomass -= bite
          energy = clamp(energy + bite * 12, 0, 100)
          grazed += bite
          nearestSoil(soil, x, z).organic += bite * 0.12 // waste returns locally
          events.push({ type: 'feeding', id: creature.id, kind, source: 'plant', amount: bite })
        }
      }
    } else {
      let turn: number
      ;[seed, turn] = random(seed)
      heading += (turn - 0.5) * 0.5
      const moved = walkOnLand(creature, x + Math.sin(heading), z + Math.cos(heading), 0.04)
      ;({ x, z, heading } = moved)
      energy -= moved.distance * 0.8
    }
    if (energy <= 0) {
      depositBody(creature, x, z)
      events.push({ type: 'death', id: creature.id, kind, reason: 'energy' })
    } else {
      creatures.push({ ...creature, kind, x, z, heading, energy })
    }
  }

  // Offspring need both parental reserve energy and nearby plant material.
  // Splitting the reserve avoids creating energy through reproduction.
  let nextId = highestCreatureId + 1
  const newborns: Creature[] = []
  const hunters: Creature[] = []
  for (const hunter of world.creatures.filter((creature) => creatureKind(creature) === 'beetle')) {
    const maintenance = 0.32 * rate * (1 + 2 * (1 - breath)) * (scheduledRest(world, { ...hunter, energy: hunter.energy - 0.32 * rate }) ? 0.5 : 1)
    if (hunter.energy > maintenance) hunters.push({ ...hunter, energy: hunter.energy - maintenance })
    else {
      depositBody(hunter)
      events.push({ type: 'death', id: hunter.id, kind: 'beetle', reason: 'energy' })
    }
  }
  const populations = creatureCounts([...creatures, ...hunters])
  const consumed = new Set<number>()
  // Prey forage/flee first, then hunters catch, then surviving parents reproduce.
  // A caught animal cannot also die, feed twice, or reproduce after capture.
  for (const hunter of hunters) {
    const livingPrey = creatures.filter((prey) => !consumed.has(prey.id))
    const active = beetleIsHunting({ ...world, creatures: [...livingPrey, ...hunters.filter((other) => other.energy > 0), ...newborns] }, hunter)
    const target = active ? preyTarget(livingPrey, hunter) : null
    if (target) {
      const distance = Math.hypot(target.x - hunter.x, target.z - hunter.z)
      if (distance > 0.28) {
        const moved = walkOnLand(hunter, target.x, target.z, Math.min(0.145 * clamp(hunter.energy / 30, 0.25, 1), distance - 0.2))
        Object.assign(hunter, { x: moved.x, z: moved.z, heading: moved.heading, energy: hunter.energy - moved.distance * 0.9 })
      } else hunter.heading = Math.atan2(target.x - hunter.x, target.z - hunter.z)
      if (hunter.energy > 0 && Math.hypot(target.x - hunter.x, target.z - hunter.z) <= 0.28) {
        const preyKind = creatureKind(target)
        const preyMaterial = bodyStock(target, bodyMaterial[preyKind])
        const offspringMaterial = hunter.stage !== 'juvenile' && hunter.energy >= 82 && populations.beetle < creatureLimits.beetle && livingPrey.length >= 4 && preyMaterial >= bodyMaterial.beetle ? bodyMaterial.beetle : 0
        const available = preyMaterial - offspringMaterial
        const litter = available * 0.2
        nearestSoil(soil, target.x, target.z).organic += litter
        hunter.energy = clamp(hunter.energy + available * 60, 0, 100)
        consumed.add(target.id)
        populations[preyKind] -= 1
        events.push({ type: 'predation', predatorKind: 'beetle', predatorId: hunter.id, preyId: target.id, preyKind, x: target.x, z: target.z, preyMaterial, offspringMaterial, storedMaterial: 0, litter, metabolized: available - litter })
        if (offspringMaterial > 0) {
          const childEnergy = hunter.energy * 0.42
          hunter.energy -= childEnergy
          let direction: number
          ;[seed, direction] = random(seed)
          const angle = direction * Math.PI * 2
          const position = walkOnLand(hunter, hunter.x + Math.sin(angle), hunter.z + Math.cos(angle), 0.22)
          const child = { id: nextId++, kind: 'beetle' as const, x: position.x, z: position.z, heading: angle, energy: childEnergy, age: 0, stage: 'juvenile' as const, materialReserve: 0 }
          newborns.push(child)
          populations.beetle += 1
          events.push({ type: 'birth', id: child.id, kind: 'beetle', parentId: hunter.id })
        }
      }
    } else if (active) {
      let turn: number
      ;[seed, turn] = random(seed)
      const heading = hunter.heading + (turn - 0.5) * 0.7
      const moved = walkOnLand(hunter, hunter.x + Math.sin(heading), hunter.z + Math.cos(heading), 0.065 * clamp(hunter.energy / 30, 0.25, 1))
      Object.assign(hunter, { x: moved.x, z: moved.z, heading: moved.heading, energy: hunter.energy - moved.distance * 0.9 })
    }
    if (hunter.energy <= 0) {
      depositBody(hunter)
      populations.beetle -= 1
      events.push({ type: 'death', id: hunter.id, kind: 'beetle', reason: 'energy' })
    }
  }
  const survivors = creatures.filter((creature) => !consumed.has(creature.id))
  const paired = new Set<number>()
  for (const mother of survivors.filter((creature) => creature.kind === 'woodlouse' && woodlouseLife(creature).sex === 'female')) {
    const life = mother.life!
    if (life.brood > 0 && life.gestation === 0 && mother.energy > 20) {
      const refuge = nearestSoil(soil, mother.x, mother.z)
      // Brooded young are retained until a moist litter refuge is reached;
      // release does not teleport food to them or grant extra energy.
      if (Math.hypot(refuge.x - mother.x, refuge.z - mother.z) > 0.3 || litterMoisture(refuge) < 0.45 || refuge.organic < 0.2) continue
      while (life.brood >= 0.055 - 1e-9 && populations.woodlouse < creatureLimits.woodlouse && mother.energy > 20) {
        const energy = mother.energy * 0.22
        mother.energy -= energy
        life.brood = Math.max(0, life.brood - 0.055)
        const position = walkOnLand(mother, mother.x + Math.sin(nextId * 2.4), mother.z + Math.cos(nextId * 2.4), 0.18)
        const child: Creature = { id: nextId++, kind: 'woodlouse', x: position.x, z: position.z, heading: position.heading, energy, age: 0, stage: 'juvenile', materialReserve: 0 }
        const hydration = Math.min(70, life.hydration)
        life.hydration = Math.max(0, life.hydration - hydration * 0.055 / life.mass)
        child.life = { ...woodlouseLife(child), mass: 0.055, hydration, parentId: mother.id }
        newborns.push(child)
        populations.woodlouse += 1
        events.push({ type: 'birth', id: child.id, kind: 'woodlouse', parentId: mother.id })
      }
      continue
    }
    if (life.brood > 0 || scheduledRest(world, mother)) continue
    const father = woodlouseMate({ ...world, creatures: survivors.filter((creature) => !paired.has(creature.id)) }, mother)
    if (!father || scheduledRest(world, father) || Math.hypot(father.x - mother.x, father.z - mother.z) > 0.3 || predatorThreat(world, mother)) {
      life.partnerId = null; life.courtship = 0
      continue
    }
    life.courtship = life.partnerId === father.id ? life.courtship + 1 : 1
    life.partnerId = father.id
    life.activity = 'courting'
    father.life!.partnerId = mother.id
    father.life!.courtship = life.courtship
    father.life!.activity = 'courting'
    mother.heading = Math.atan2(father.x - mother.x, father.z - mother.z)
    father.heading = mother.heading + Math.PI
    paired.add(father.id)
    const brood = Math.min(2, creatureLimits.woodlouse - populations.woodlouse) * 0.055
    const nursery = nearestSoil(soil, mother.x, mother.z)
    if (life.courtship >= 4 && brood > 0 && nursery.organic >= brood + 0.05) {
      nursery.organic -= brood
      life.brood = brood
      life.gestation = 24
      life.courtship = 0; life.partnerId = null; life.activity = 'brooding'
      father.life!.courtship = 0; father.life!.partnerId = null; father.life!.activity = 'resting'
      mother.energy -= 8; father.energy -= 8
      events.push({ type: 'mating', kind: 'woodlouse', motherId: mother.id, fatherId: father.id })
    }
  }
  for (const creature of survivors) {
    const kind = creatureKind(creature)
    if (kind === 'woodlouse') continue
    if (populations[kind] >= creatureLimits[kind] || creature.energy < 82 || creature.stage === 'juvenile' || predatorThreat(world, creature) || scheduledRest(world, creature)) continue
    if (kind === 'springtail') {
      const nursery = fungusTarget(soil, creature)
      if (!nursery || litterMoisture(nursery) < 0.6 || nursery.fungi < bodyMaterial.springtail + 0.2 || Math.hypot(nursery.x - creature.x, nursery.z - creature.z) > 0.3) continue
      nursery.fungi -= bodyMaterial.springtail
    } else {
      const nursery = plants.find((plant) => plantTraits[plant.kind].palatability > 0.5 && plant.biomass > 1.35 && Math.hypot(plant.x - creature.x, plant.z - creature.z) < 0.32)
      if (!nursery) continue
      nursery.biomass -= bodyMaterial.grazer
      grazed += bodyMaterial.grazer
    }
    const childEnergy = creature.energy * 0.42
    creature.energy -= childEnergy
    let direction: number
    ;[seed, direction] = random(seed)
    const angle = direction * Math.PI * 2
    const childPosition = walkOnLand(creature, creature.x + Math.sin(angle), creature.z + Math.cos(angle), 0.22)
    newborns.push({
      id: nextId++,
      kind,
      x: childPosition.x,
      z: childPosition.z,
      heading: angle,
      energy: childEnergy,
      age: 0, stage: 'juvenile', materialReserve: 0,
    })
    populations[kind] += 1
    events.push({ type: 'birth', id: nextId - 1, kind, parentId: creature.id })
  }

  const seedlings: Plant[] = []
  let nextPlantId = Math.max(world.nextPlantId ?? 0, world.plants.reduce((highest, plant) => Math.max(highest, plant.id), -1) + 1)
  for (const parent of plants) {
    if (plants.length + seedlings.length >= 32 || parent.biomass / parent.capacity < 0.78 || plantStage(parent) !== 'mature') continue
    const traits = plantTraits[parent.kind]
    const conditions = plantConditions(parent, isAquatic(parent.kind) ? aquaticSoil : nearestSoil(soil, parent.x, parent.z), plantLight(world, parent))
    if (conditions.moisture * conditions.sunlight * conditions.fertility < 0.55) continue
    let chance: number
    ;[seed, chance] = random(seed)
    if (chance > traits.spread) continue
    let direction: number
    let reach: number
    ;[seed, direction] = random(seed)
    ;[seed, reach] = random(seed)
    const radius = 0.72 + reach * (traits.dispersal - 0.72)
    const x = parent.x + Math.sin(direction * Math.PI * 2) * radius
    const z = parent.z + Math.cos(direction * Math.PI * 2) * radius
    // The seal stops the player adding life, not plants spreading inside the jar.
    if (placementIssue({ ...world, sealed: null, plants: [...plants, ...seedlings] }, parent.kind, x, z)) continue
    const destination = plantConditions(parent, isAquatic(parent.kind) ? aquaticSoil : nearestSoil(soil, x, z), parent.kind === 'tree' ? world.light : peakLightAt(world, x, z))
    if (destination.moisture * destination.sunlight * destination.fertility < 0.45) continue
    // Propagule material is transferred from the parent, never created by a timer.
    parent.biomass -= 0.55
    parent.lastReproduction = world.tick + 1
    seedlings.push({ ...parent, id: nextPlantId++, x, z, biomass: 0.55, age: 0, development: 0, parentId: parent.id, lastReproduction: -1 })
    events.push({ type: 'birth', id: nextPlantId - 1, kind: parent.kind, parentId: parent.id })
  }

  // Sun and the open air remove water from every equal-area patch.
  for (const patch of soil) patch.water = Math.max(0, patch.water - (0.08 + lightAt({ ...world, plants }, patch.x, patch.z) * 0.10) * rate)
  pond = { ...pond, water: aquaticSoil.water, nutrients: aquaticSoil.nutrients, organic: aquaticSoil.organic }
  const aquatic = stepPond(pond, world.creatures.filter((creature) => isAquatic(creature.kind)), environment.light, { ...climate, temperatureC: temperature }, seed, nextId, world.tick, carbon, breath)
  events.push(...aquatic.events)
  for (const body of aquatic.bodies) depositBody(body)

  const residents = resolveWoodlouseContacts([...survivors, ...hunters.filter((hunter) => hunter.energy > 0), ...newborns, ...aquatic.creatures])
  const nextWorld = withSoil({ ...world, tick: world.tick + 1, seed: aquatic.seed, pond: aquatic.pond, remains, nextCreatureId: aquatic.nextId, nextPlantId, grazed, plants: [...plants, ...seedlings], creatures: residents }, soil)
  const ants = stepAntColony(nextWorld, environment)
  return { world: closeJar(opening, ants.world), events: [...events, ...ants.events] }
}

export function stepWorld(world: World): World {
  return simulateStep(world).world
}

/** What most limits the plants now; with no plants, the scarcest soil resource. */
export function dominantLimit(world: World): PlantLimit | null {
  if (world.plants.length) {
    const tally = new Map<string, number>()
    for (const plant of world.plants) { const limit = plantOutlook(world, plant).limiting; tally.set(limit, (tally.get(limit) ?? 0) + 1) }
    return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] as PlantLimit
  }
  const scores = { water: world.water / 40, nutrients: world.nutrients / 20, light: world.light / 0.5 }
  const lowest = (Object.entries(scores) as ['water' | 'nutrients' | 'light', number][]).sort((a, b) => a[1] - b[1])[0]
  return lowest[1] < 1 ? lowest[0] : null
}

export function vitality(world: World): number {
  return world.plants.length ? world.plants.reduce((sum, plant) => sum + plant.biomass / plant.capacity, 0) / world.plants.length : 0
}
