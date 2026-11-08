import type { PlantKind } from '../sim/ecosystem'

/*
 * Roots seen through the glass (owner's soil brief, 2026-11-08): sparse, naturally branching root
 * systems under the plants that grow near the jar wall, shaped by species. Pure and deterministic:
 * each plant's id seeds its own branching, and its growth (biomass / capacity) scales the reach.
 * Segments are in the glass's unrolled plane: x = arc length round the wall, y = world height, so
 * the soil shader can draw them with one distance test per segment. Visual only.
 */
export const wallRadius = 3.79
export const maxRootSegments = 48

export interface RootPlant { id: number; kind: PlantKind; x: number; z: number; biomass: number; capacity: number }
export interface RootSegment { ax: number; ay: number; bx: number; by: number; width: number; alpha: number }

/** Root habit per kind: depth reached, main roots, branching, lateral spread, thickness. */
const habit: Partial<Record<PlantKind, { depth: number; mains: number; levels: number; spread: number; width: number }>> = {
  tree: { depth: 0.95, mains: 1, levels: 3, spread: 0.45, width: 0.045 },   // Fittonia: a stronger main root that forks
  bloom: { depth: 0.7, mains: 2, levels: 2, spread: 0.5, width: 0.035 },    // violets: a few fleshy roots
  fern: { depth: 0.45, mains: 4, levels: 1, spread: 0.85, width: 0.024 },   // fibrous, shallow, wide
  clover: { depth: 0.38, mains: 2, levels: 2, spread: 0.9, width: 0.024 },  // shallow, spreading laterals
  grass: { depth: 0.55, mains: 5, levels: 1, spread: 0.6, width: 0.02 },   // fine fibrous bundle
}

function random(seed: number) {
  let s = (seed * 2654435761) >>> 0
  return () => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s >>> 0) / 4294967296 }
}

/**
 * Roots for the plants close enough to the glass to be seen (within `reach` of it). `groundY(x, z)`
 * is the world ground height. Nearer plants are drawn more strongly; the result never exceeds
 * `maxRootSegments`, nearest plants first.
 */
export function buildRoots(plants: RootPlant[], groundY: (x: number, z: number) => number, reach = 3.8): RootSegment[] {
  const near = plants
    .map((plant) => ({ plant, gap: wallRadius - Math.hypot(plant.x, plant.z) }))
    .filter(({ plant, gap }) => habit[plant.kind] && gap < reach && gap > -0.2)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 8)                                          // a few clear systems, not a tangle
  const segments: RootSegment[] = []
  // Share the budget so every rooted plant gets a small system (nearest first if it runs out).
  const perPlant = Math.max(5, Math.min(12, Math.floor(maxRootSegments / Math.max(1, near.length))))
  for (const { plant, gap } of near) {
    const limit = Math.min(maxRootSegments, segments.length + perPlant)
    const h = habit[plant.kind]!
    const rand = random(plant.id * 7919 + 17)
    const grown = Math.max(0.25, Math.min(1, plant.biomass / Math.max(1e-6, plant.capacity)))
    const alpha = (0.65 + 0.35 * Math.max(0, 1 - gap / reach)) * (0.7 + 0.3 * grown)
    const angle = Math.atan2(plant.z, plant.x)
    // Drawn on the glass behind the plant: start at the wall's own top edge there.
    const x0 = angle * wallRadius, y0 = groundY(Math.cos(angle) * (wallRadius - 0.1), Math.sin(angle) * (wallRadius - 0.1)) - 0.03
    const depth = h.depth * 2.2 * (0.6 + 0.4 * grown)
    const grow = (x: number, y: number, dir: number, length: number, width: number, level: number) => {
      if (segments.length >= limit || length < 0.04) return
      // A root bends in two or three short pieces as it goes down.
      let px = x, py = y, d = dir
      const pieces = 2 + Math.floor(rand() * 2)
      for (let k = 0; k < pieces && segments.length < limit; k += 1) {
        d += (rand() - 0.5) * 0.5
        const step = length / pieces
        const nx = px + Math.sin(d) * step, ny = py - Math.cos(d) * step
        segments.push({ ax: px, ay: py, bx: nx, by: ny, width: width * (1 - 0.25 * k / pieces), alpha })
        // Side branches leave at a wide angle, shorter and thinner.
        if (level < h.levels && rand() < 0.75) grow(nx, ny, d + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.5), length * 0.5, width * 0.6, level + 1)
        px = nx; py = ny
      }
    }
    for (let m = 0; m < h.mains && segments.length < limit; m += 1) {
      const fan = h.mains === 1 ? (rand() - 0.5) * 0.3 : (m / (h.mains - 1) - 0.5) * h.spread * 1.3
      grow(x0 + (rand() - 0.5) * 0.06, y0, fan, depth * (0.7 + 0.3 * rand()), h.width * (0.6 + 0.4 * grown), 1)
    }
  }
  return segments.slice(0, maxRootSegments)
}
