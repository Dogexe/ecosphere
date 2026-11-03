import type { Creature, PlantLimit, World } from './ecosystem'
import { bodyStock, woodlouseLife } from './life.ts'
import { antMaterial } from './colony.ts'

/**
 * Seal Mode: a closed jar. Matter cannot be added or removed by the player and
 * rain stops; light and heat still pass through the glass. Water that leaves
 * soil, pond or bodies for the air is held as vapour and condenses back, so
 * free water is conserved while sealed. Matter is closed too: every material
 * unit is split into a mineral share and a carbon share. Minerals the open
 * solver would lose are mineralised back into the soil; carbon is respired
 * into the jar air as CO2 and must be fixed again by photosynthesis, which
 * releases the matching O2. See ECOLOGY.md for the scale of these units.
 */
export type Seal = { since: number; goalDays: number; vapor: number; co2: number; o2: number; airings: number }

export const sealGoals = [10, 30, 60] as const
/** Fraction of jar vapour that condenses and runs back each model hour. */
export const condensationRate = 0.5

/** Mineral share of one material unit; plants and algae take ~0.6-0.65 nutrient per unit grown. */
export const mineralShare = 0.65
export const carbonShare = 1 - mineralShare
/** Jar O2 at sealing, in carbon-equivalent units. Small next to the soil's organic carbon, as in a real jar. */
export const startingO2 = 60
/** Ambient CO2 for that air (O2:CO2 by volume is ~500:1). Also the half-saturation of photosynthesis. */
export const startingCO2 = startingO2 / 500
export const o2Percent = (o2: number) => 20.9 * o2 / startingO2
export const co2Ppm = (co2: number) => 420 * co2 / startingCO2
/** Light that reaches the jar also warms it: degrees C at full light. */
export const greenhouseGain = 10

export const isSealed = (world: Pick<World, 'sealed'>) => !!world.sealed

export function sealWorld(world: World, goalDays: number): World {
  if (world.sealed || !Number.isInteger(goalDays) || goalDays < 1 || goalDays > 365) return world
  return { ...world, climate: { ...world.climate, rainfall: 0 }, sealed: { since: world.tick, goalDays, vapor: 0, co2: startingCO2, o2: startingO2, airings: 0 } }
}

/**
 * Lift the lid for a moment, as terrarium keepers do to let in fresh CO2 or
 * dry a fogged jar: the jar air is swapped for room air and half the vapour
 * escapes. The seal stays; the report counts each airing.
 */
export function airJar(world: World): World {
  if (!world.sealed) return world
  return { ...world, sealed: { ...world.sealed, co2: startingCO2, o2: startingO2, vapor: world.sealed.vapor / 2, airings: world.sealed.airings + 1 } }
}

export function unsealWorld(world: World): World {
  if (!world.sealed) return world
  const { sealed: _sealed, ...open } = world
  return open
}

/** Water held in soil pockets, the pond and living bodies, in model units. */
export function heldWater(world: World): number {
  const soil = world.soil.reduce((sum, patch) => sum + patch.water, 0)
  const bodies = world.creatures.reduce((sum, creature) => {
    if (creature.kind !== 'woodlouse') return sum
    const life = creature.life ?? woodlouseLife(creature)
    return sum + life.hydration / 100 * life.mass * 0.8
  }, 0)
  const ants = world.colony ? [world.colony.queen, ...world.colony.workers].reduce((sum, ant) => ant ? sum + ant.hydration / 100 * ant.body * 0.4 : sum, 0) : 0
  return soil + world.pond.water + bodies + ants
}

/** Water inside the jar: held water plus vapour. Constant while sealed. */
export const jarWater = (world: World) => heldWater(world) + (world.sealed?.vapor ?? 0)

const creatureBody: Record<string, number> = { grazer: 0.42, woodlouse: 0.22, beetle: 0.34, springtail: 0.08, flea: 0.04, fish: 0.24 }

/** Matter held in soil, pond, living things, remains and an ant colony, split into minerals and carbon. */
export function jarMatter(world: World): { minerals: number; carbon: number } {
  const free = world.soil.reduce((sum, patch) => sum + patch.nutrients, 0) + world.pond.nutrients
  const bound = world.soil.reduce((sum, patch) => sum + patch.organic + patch.fungi, 0)
    + world.pond.organic + world.pond.algae
    + world.plants.reduce((sum, plant) => sum + plant.biomass, 0)
    + (world.remains ?? []).reduce((sum, item) => sum + item.material, 0)
    + world.creatures.reduce((sum, creature: Creature) => sum + bodyStock(creature, creatureBody[creature.kind] ?? 0), 0)
    + (world.colony ? antMaterial(world.colony) : 0)
  return { minerals: free + bound * mineralShare, carbon: bound * carbonShare }
}

/** CO2 limit on photosynthesis: Michaelis-Menten with half-saturation at ambient CO2. */
export function carbonFit(world: Pick<World, 'sealed'>): number {
  if (!world.sealed) return 1
  const co2 = Math.max(0, world.sealed.co2)
  return co2 / (co2 + startingCO2)
}

/** Breathing stress for animals and aerobic decay: 1 at normal air, 0 when O2 is gone. */
export function oxygenFit(world: Pick<World, 'sealed'>): number {
  if (!world.sealed) return 1
  return Math.max(0, Math.min(1, (o2Percent(world.sealed.o2) - 8) / 8))
}

/**
 * After one sealed step: water the open solver lost to the air becomes vapour,
 * then part of the vapour condenses evenly onto the four soil pockets and the
 * pond, never above their capacity of 100.
 */
export function closeWaterCycle(before: World, after: World): World {
  if (!before.sealed) return after
  let vapor = before.sealed.vapor + heldWater(before) - heldWater(after)
  const share = Math.max(0, vapor) * condensationRate / 5
  const soil = after.soil.map((patch) => {
    const added = Math.min(share, 100 - patch.water)
    vapor -= added
    return { ...patch, water: patch.water + added }
  })
  const pondAdded = Math.min(share, 100 - after.pond.water)
  vapor -= pondAdded
  const mean = soil.reduce((sum, patch) => sum + patch.water, 0) / soil.length
  return { ...after, soil, water: mean, pond: { ...after.pond, water: after.pond.water + pondAdded }, climate: { ...after.climate, rainfall: 0 }, sealed: { ...before.sealed, vapor } }
}

/**
 * After one sealed step: minerals the open solver lost are mineralised evenly
 * into the four soil pockets; minerals it created are drawn from free
 * nutrients. Carbon that left living and dead matter is CO2 in the jar air and
 * used the same amount of O2; carbon that was fixed did the reverse.
 */
export function closeMatterCycle(before: World, after: World): World {
  if (!before.sealed || !after.sealed) return after
  const opening = jarMatter(before)
  const closing = jarMatter(after)
  let minerals = opening.minerals - closing.minerals
  const soil = after.soil.map((patch) => ({ ...patch }))
  const pond = { ...after.pond }
  if (minerals > 0) for (const patch of soil) patch.nutrients += minerals / soil.length
  else if (minerals < 0) {
    const pools = [...soil, pond]
    const available = pools.reduce((sum, pool) => sum + pool.nutrients, 0)
    const take = Math.min(available, -minerals)
    for (const pool of pools) if (available > 0) pool.nutrients -= take * pool.nutrients / available
    minerals = 0
  }
  const respired = opening.carbon - closing.carbon
  const mean = (key: 'nutrients' | 'organic') => soil.reduce((sum, patch) => sum + patch[key], 0) / soil.length
  return { ...after, soil, pond, nutrients: mean('nutrients'), sealed: { ...after.sealed, co2: after.sealed.co2 + respired, o2: after.sealed.o2 - respired } }
}

/** How fogged the glass is, 0 clear to 1 heavy: vapour condensing on it this hour. */
export const fogLevel = (world: Pick<World, 'sealed'>) => world.sealed ? Math.max(0, Math.min(1, world.sealed.vapor * condensationRate / 1.2)) : 0

/** Close water, then matter, for one sealed step. */
export const closeJar = (before: World, after: World) => closeMatterCycle(before, closeWaterCycle(before, after))

export type SealOutcome = {
  status: 'running' | 'survived' | 'collapsed'
  day: number
  goalDays: number
  /** The plants' most common limiting factor now, or what ran out at collapse. */
  limiting: PlantLimit | null
}

export function producersAlive(world: World) {
  return world.plants.length > 0 || world.pond.algae >= 0.05
}

export function sealOutcome(world: World, limitingNow: (world: World) => SealOutcome['limiting']): SealOutcome | null {
  if (!world.sealed) return null
  const hours = world.tick - world.sealed.since
  const day = Math.floor(hours / 24)
  const limiting = limitingNow(world)
  if (!producersAlive(world)) return { status: 'collapsed', day, goalDays: world.sealed.goalDays, limiting }
  return { status: hours >= world.sealed.goalDays * 24 ? 'survived' : 'running', day, goalDays: world.sealed.goalDays, limiting }
}
