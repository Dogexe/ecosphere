import type { World } from './ecosystem'
import { woodlouseLife } from './life.ts'

/**
 * Seal Mode: a closed jar. Matter cannot be added or removed by the player and
 * rain stops; light and heat still pass through the glass. Water that leaves
 * soil, pond or bodies for the air is held as vapour and condenses back, so
 * free water is conserved while sealed. Nutrient and carbon pools are still
 * the open game approximations (see ECOLOGY.md); only water is closed here.
 */
export type Seal = { since: number; goalDays: number; vapor: number }

export const sealGoals = [10, 30, 60] as const
/** Fraction of jar vapour that condenses and runs back each model hour. */
export const condensationRate = 0.5

export const isSealed = (world: Pick<World, 'sealed'>) => !!world.sealed

export function sealWorld(world: World, goalDays: number): World {
  if (world.sealed || !Number.isInteger(goalDays) || goalDays < 1 || goalDays > 365) return world
  return { ...world, climate: { ...world.climate, rainfall: 0 }, sealed: { since: world.tick, goalDays, vapor: 0 } }
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

export type SealOutcome = {
  status: 'running' | 'survived' | 'collapsed'
  day: number
  goalDays: number
  /** The plants' most common limiting factor now, or what ran out at collapse. */
  limiting: 'water' | 'light' | 'nutrients' | 'temperature' | null
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
