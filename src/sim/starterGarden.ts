import { introduceLife } from './ecosystem.ts'
import type { PlantKind, World } from './ecosystem.ts'

/*
 * The first jar a new player sees, planted toward concept image 12
 * (owner's main target, 2026-11-06): a Calathea standing behind the pond,
 * violets and grass at the back, lily pads on the water. Only a brand new
 * world gets it; saved worlds and habitat starters keep their own plants.
 * Each plant goes in through the normal placement rules, so a spot that is
 * taken or on the wrong side of the shore is simply skipped.
 */
const garden: [PlantKind, number, number][] = [
  ['tree', 0.85, -0.95],
  ['bloom', -0.95, -1.15],
  ['grass', 2.35, -0.55],
  ['grass', 1.75, 0.55],
  ['clover', -2.0, -1.6],
  ['fern', 1.6, -2.3],
  ['clover', 2.6, -1.3],
  ['bloom', 0.0, -0.3],
  // Fuller planting (Codex review against image 12): violets in drifts, clover down to the shore.
  ['bloom', -1.6, -0.6],
  ['bloom', -0.3, -1.6],
  ['bloom', 1.2, -1.7],
  ['clover', 0.4, 1.0],
  ['clover', 1.0, 0.0],
  ['lily', -1.45, 1.25],
  ['lily', -0.45, 2.2],
  ['lily', -2.15, 2.05],
]

/** The pond's clean-up crew the owner picked (2026-11-06): ramshorn snails (design r1) and cherry shrimp (design B). */
const pondCrew: ['snail' | 'shrimp', number, number][] = [
  ['shrimp', -0.75, 1.55],
  ['shrimp', -1.35, 2.05],
  ['snail', -1.2, 1.35],
  ['snail', -0.6, 2.15],
]

export function withStarterGarden(world: World): World {
  let planted = world
  for (const [kind, x, z] of garden) {
    const next = introduceLife(planted, kind, x, z)
    if (next === planted) continue
    // Already established when the player first looks in, not seedlings.
    const plant = next.plants[next.plants.length - 1]
    planted = { ...next, plants: [...next.plants.slice(0, -1), { ...plant, biomass: plant.capacity * (plant.kind === 'tree' ? 0.55 : 0.85), age: 90, development: 90 }] }
  }
  for (const [kind, x, z] of pondCrew) planted = introduceLife(planted, kind, x, z)
  return planted
}
