import { introduceLife } from './ecosystem.ts'
import { chamberSpread, introduceColony, nestChamberRadius } from './colony.ts'
import { isLand, isLandSegment, soilRim } from './land.ts'
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
  ['clover', 1.0, 0.0],
  // Image 12 round 2 (2026-11-07): a fern on the front bank beside the pond.
  ['fern', 2.2, 1.55],
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

const microFauna: ['springtail' | 'flea' | 'worm' | 'beetle', number, number][] = [
  // One tiger beetle, the jar's land predator, so hunts can be watched from the start (owner's pick, 2026-11-27).
  ['beetle', 1.9, -0.4],
  // Two red earthworms (owner's pick, 2026-11-21): they pair to lay cocoons.
  ['worm', 2.7, -0.6],
  ['worm', 2.4, 1.2],
  ['springtail', -1.9, -0.9],
  ['springtail', 1.3, -1.2],
  ['springtail', 2.3, 0.2],
  ['flea', -1.0, 1.7],
  ['flea', -1.6, 1.6],
  ['flea', -0.8, 2.0],
]

/** Bright indirect light, as terrarium growers recommend for a jar on a windowsill (2026-11-20). */
export const starterLight = 0.55

export function withStarterGarden(world: World): World {
  let planted: World = { ...world, light: starterLight }
  // Plants bought for a jar are of mixed ages, so they do not all reach the end of life on the same day (2026-11-20).
  for (const [index, [kind, x, z]] of garden.entries()) {
    const next = introduceLife(planted, kind, x, z)
    if (next === planted) continue
    // Already established when the player first looks in, not seedlings.
    const plant = next.plants[next.plants.length - 1]
    planted = { ...next, plants: [...next.plants.slice(0, -1), { ...plant, biomass: plant.capacity * (plant.kind === 'tree' ? 0.8 : 0.85), age: 90 + (index * 7 % 16) * 24 * 9, development: 90 }] }
  }
  for (const [kind, x, z] of pondCrew) planted = introduceLife(planted, kind, x, z)
  // Soil and water micro-fauna that keep a closed jar cycling (closed-jar pass, 2026-11-20):
  // springtails graze the soil fungi; water fleas graze algae and feed nothing bigger here.
  // A tiny animal goes in at the nearest free spot around its mark, so all of them arrive.
  for (const [kind, x, z] of microFauna) {
    search: for (let ring = 0; ring < 5; ring += 1) {
      for (let n = 0; n < (ring ? 8 : 1); n += 1) {
        const next = introduceLife(planted, kind, x + Math.cos(n * Math.PI / 4) * ring * 0.18, z + Math.sin(n * Math.PI / 4) * ring * 0.18)
        if (next !== planted) { planted = next; break search }
      }
    }
  }
  // A seed-harvester colony on the front-right bank (owner's reference, 2026-11-07): its nest is shown in cutaway
  // through the glass in the natural look. Placed through the normal rules, so it is skipped if the spot is unsuitable.
  planted = introduceColony(planted, 1.97, 2.19)
  // Its founding chambers were dug against the glass, the way a keeper sets up a colony to watch it:
  // the chambers sit where the glass cuts through them and the shaft slants out to them from the
  // entrance (2026-11-22, owner: show the nest realistically, only where it touches the glass).
  const colony = planted.colony
  if (colony) {
    // Each chamber and the junction below the shaft are moved straight out at their own bearing.
    const nodes = colony.nodes.map((node) => {
      if (node.role === 'entrance' || node.id === 1) return node
      const length = Math.hypot(node.x, node.z) || 1, out = soilRim + 0.02 - (node.role === 'junction' ? 0.2 : nestChamberRadius(node) * chamberSpread)
      return { ...node, x: node.x / length * out, z: node.z / length * out }
    })
    const moved = { ...colony, nodes }
    if (nodes.every((node) => isLand(node.x, node.z, 0.12, node.role === 'entrance' ? 3.15 : soilRim)) && colony.edges.every(([a, b]) => isLandSegment(nodes[a].x, nodes[a].z, nodes[b].x, nodes[b].z, 0.12, soilRim))) planted = { ...planted, colony: moved }
  }
  return planted
}
