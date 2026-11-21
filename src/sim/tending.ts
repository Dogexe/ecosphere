import { isLand, nearestSoil, placementIssue, type Creature, type Plant, type World } from './ecosystem.ts'
import { defaultPond, isAquatic, isPondPosition } from './pond.ts'
import { plantStage } from './life.ts'

/**
 * Hands-on care (systems pass item 4, 2026-11-20). Beyond watering and compost,
 * a terrarium keeper mists, moves the jar along the sill, trims, feeds and
 * takes cuttings. Each verb here moves material the way the real act does,
 * and none works through a sealed lid.
 */

/** A fine spray wets the surface a little and leaves the air humid for a few hours. */
export const mistWater = 4
export const mistHours = 8
/** Spots along the sill, as light levels: shady corner, bright window (indirect), sunny sill. */
export const sillSpots = [
  { id: 'shade', label: 'Shady corner', light: 0.3 },
  { id: 'window', label: 'Bright window', light: 0.55 },
  { id: 'sun', label: 'Sunny sill', light: 0.85 },
] as const
/** Trimming takes this share of the leaves; the clippings stay as mulch, like leaf fall (0.42 of tissue becomes litter). */
export const trimShare = 0.4
export const litterShare = 0.42
/** A cutting carries this share of the parent and starts as a rooted seedling. */
export const cuttingShare = 0.25
/** A pinch of food (dry leaf for land animals, flakes for the pond), in organic units. */
export const feedLand = 4
export const feedPond = 3

export function mist(world: World): World {
  if (world.sealed || !world.soil.length) return world
  const soil = world.soil.map((patch) => ({ ...patch, water: Math.min(100, patch.water + mistWater) }))
  return { ...world, soil, water: soil.reduce((sum, patch) => sum + patch.water, 0) / soil.length, mistUntil: world.tick + mistHours }
}

export const canTrim = (plant: Plant) => plant.biomass >= plant.capacity * 0.5 && !['seed', 'germinating', 'seedling'].includes(plantStage(plant))

/** Cut a plant back: it stays alive and regrows; its clippings feed the litter where it stands. */
export function trimPlant(world: World, id: number): World {
  const plant = world.plants.find((item) => item.id === id)
  if (world.sealed || !plant || !canTrim(plant)) return world
  const cut = plant.biomass * trimShare
  const plants = world.plants.map((item) => item.id === id ? { ...item, biomass: item.biomass - cut } : item)
  if (isAquatic(plant.kind)) {
    const pond = world.pond ?? defaultPond()
    return { ...world, plants, pond: { ...pond, organic: pond.organic + cut * litterShare } }
  }
  if (!world.soil.length) return { ...world, plants }
  const patch = nearestSoil(world.soil, plant.x, plant.z)
  const soil = world.soil.map((item) => item.id === patch.id ? { ...item, organic: item.organic + cut * litterShare } : item)
  return { ...world, plants, soil, organic: soil.reduce((sum, item) => sum + item.organic, 0) / soil.length }
}

export const canTakeCutting = (plant: Plant) => plant.biomass >= plant.capacity * 0.6 && ['growing', 'mature'].includes(plantStage(plant))

/** Where a cutting from this plant could go: the nearest open spot a little way off. */
export function cuttingSpot(world: World, plant: Plant): { x: number; z: number } | null {
  for (let ring = 0; ring < 4; ring += 1) {
    const reach = 0.7 + ring * 0.35
    for (let n = 0; n < 12; n += 1) {
      const angle = n * Math.PI / 6 + plant.id * 0.7 + ring * 0.26
      const x = plant.x + Math.cos(angle) * reach, z = plant.z + Math.sin(angle) * reach
      if (Math.hypot(x, z) > 3.3) continue
      if (isAquatic(plant.kind) ? !isPondPosition(x, z) : !isLand(x, z)) continue
      if (world.plants.some((other) => Math.hypot(other.x - x, other.z - z) < 0.45)) continue
      if (!placementIssue(world, plant.kind, x, z)) return { x, z }
    }
  }
  return null
}

/** Propagate by cutting: part of the parent becomes a rooted young plant of the same kind nearby. */
export function takeCutting(world: World, id: number): World {
  const parent = world.plants.find((item) => item.id === id)
  if (world.sealed || !parent || !canTakeCutting(parent)) return world
  const spot = cuttingSpot(world, parent)
  if (!spot) return world
  const taken = parent.biomass * cuttingShare
  const nextId = Math.max(world.nextPlantId ?? 0, world.plants.reduce((highest, plant) => Math.max(highest, plant.id), -1) + 1)
  const cutting: Plant = { id: nextId, kind: parent.kind, x: spot.x, z: spot.z, biomass: taken, capacity: parent.capacity, age: 24, development: 24, parentId: parent.id, lastReproduction: -1 }
  return { ...world, nextPlantId: nextId + 1, plants: [...world.plants.map((item) => item.id === id ? { ...item, biomass: item.biomass - taken } : item), cutting] }
}

/** Who a pinch of food helps: recyclers and the pond crew eat what settles. Grazers and hunters find their own. */
export const canFeed = (creature: Creature) => ['woodlouse', 'springtail', 'worm', 'snail', 'shrimp', 'fish', 'flea'].includes(creature.kind)

export function feed(world: World, id: number): World {
  const creature = world.creatures.find((item) => item.id === id)
  if (world.sealed || !creature || !canFeed(creature)) return world
  if (isAquatic(creature.kind)) {
    const pond = world.pond ?? defaultPond()
    return { ...world, pond: { ...pond, organic: pond.organic + feedPond } }
  }
  if (!world.soil.length) return world
  const patch = nearestSoil(world.soil, creature.x, creature.z)
  const soil = world.soil.map((item) => item.id === patch.id ? { ...item, organic: item.organic + feedLand } : item)
  return { ...world, soil, organic: soil.reduce((sum, item) => sum + item.organic, 0) / soil.length }
}
