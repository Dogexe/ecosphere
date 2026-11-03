import type { Creature, CreatureKind, Plant, PlantKind } from '../sim/ecosystem'
import { plantStage, woodlouseLife } from '../sim/life.ts'
import { maturity, pondCenter } from '../sim/pond.ts'

// Presentation dimensions only. The solver owns navigation, stocks and rates.
// Dimensions are world units; see SCALE_BIBLE.md for the chosen relationships.
export const environmentScale = {
  islandRadius: 3.77, playableRadius: 3.15, pondRadius: pondCenter.radius,
  soilSurfaceY: 0.039,
  // The pond is about 2 cm deep in the middle (1.05 units) and shelves up to
  // the bank; reeds root on that shallow margin shelf, about 6 mm under water.
  pondBedY: -0.98, pondSurfaceY: 0.07, pondVisualDepth: 1.05, pondShelfY: -0.23,
  logLength: 1.45, logRadius: 0.12,
  rockSmall: 0.3, rockMedium: 0.48, rockLarge: 0.65,
  mushroomMin: 0.14, mushroomMax: 0.27,
  litterLength: 0.18, groundGrassScale: 0.66,
  minimumPickRadius: 0.24,
} as const

// Maximum horizontal spread / height at full biomass. Sources are measured
// baked bounds, not guessed import scale factors (x/z preserve aspect ratio).
export const plantDimensions: Record<PlantKind, { spread: number; height: number; sourceSpread: number; sourceHeight: number }> = {
  moss: { spread: 0.72, height: 0.17, sourceSpread: 0.8772, sourceHeight: 0.272 },
  // Oxalis, 2026-11-03: about 3 cm across and 3 cm high, so its leaflets fall in the real 4-13 mm (VicFlora).
  clover: { spread: 1.6, height: 1.5, sourceSpread: 1.0199, sourceHeight: 0.4306 },
  grass: { spread: 0.4, height: 0.48, sourceSpread: 0.2911, sourceHeight: 0.355 },
  fern: { spread: 2.0, height: 1.2, sourceSpread: 1.5927, sourceHeight: 0.9044 },
  bloom: { spread: 0.72, height: 0.94, sourceSpread: 0.7935, sourceHeight: 0.8433 },
  // A young Calathea in the paper look: up to about 5 cm across, half the glass height.
  tree: { spread: 2.6, height: 2.5, sourceSpread: 1.6055, sourceHeight: 1.8527 },
  lily: { spread: 0.68, height: 0.22, sourceSpread: 0.64, sourceHeight: 0.27 },
  reed: { spread: 0.42, height: 1.1, sourceSpread: 0.2911, sourceHeight: 0.355 },
}

// Relative seed/spore anatomy, never a tap target or extra material pool.
export const plantSeedDimensions: Record<PlantKind, { length: number; width: number; height: number }> = {
  moss: { length: 0.001, width: 0.001, height: 0.001 },
  fern: { length: 0.0015, width: 0.0015, height: 0.0015 },
  clover: { length: 0.03, width: 0.022, height: 0.014 },
  grass: { length: 0.06, width: 0.022, height: 0.016 },
  bloom: { length: 0.035, width: 0.02, height: 0.014 },
  tree: { length: 0.08, width: 0.055, height: 0.038 },
  lily: { length: 0.045, width: 0.032, height: 0.024 },
  reed: { length: 0.018, width: 0.008, height: 0.007 },
}

export function plantModelScale(kind: PlantKind): [number, number, number] {
  const size = plantDimensions[kind]
  return [size.spread / size.sourceSpread, size.height / size.sourceHeight, size.spread / size.sourceSpread]
}

export const stableVariation = (id: number) => 0.94 + ((id * 37 % 101) / 100) * 0.12

// Presentation depth only: upright Daphnia antennae remain below the water.
export const animalWaterY = (kind: CreatureKind) => kind === 'fish' ? -0.05 : -0.025

export function plantGrowthScale(plant: Plant) {
  if (plantStage(plant) === 'seed') return 1
  const biomass = Math.max(0, Math.min(1, plant.biomass / plant.capacity))
  const development = Math.max(0, Math.min(1, (plant.development ?? 90) / 60))
  const emergence = ['moss', 'fern', 'lily', 'reed'].includes(plant.kind)
    ? Math.max(0.001, Math.min(1, ((plant.development ?? 90) - 3) / 21)) : 1
  return (0.32 + 0.68 * Math.sqrt(biomass)) * (0.6 + 0.4 * development) * stableVariation(plant.id) * emergence
}

/**
 * How far the ground at a point sits above the flat default. Zero unless the
 * player built the jar; then the jar scene sets it from their poured soil.
 */
export const groundShape: { offset: (x: number, z: number) => number; poured: boolean } = { offset: () => 0, poured: false }

export function plantGroundY(plant: Plant) {
  // In a poured pond reeds root on the actual bed under the water.
  if (plant.kind === 'reed' && groundShape.poured) return environmentScale.soilSurfaceY + groundShape.offset(plant.x, plant.z) + 0.002
  return flatPlantGroundY(plant) + (['lily', 'reed'].includes(plant.kind) ? 0 : groundShape.offset(plant.x, plant.z))
}

function flatPlantGroundY(plant: Plant) {
  if (plant.kind === 'lily') return environmentScale.pondSurfaceY + 0.002 - 0.025 * plantModelScale('lily')[1] * plantGrowthScale(plant)
  if (plant.kind === 'reed') return environmentScale.pondShelfY + 0.002
  if (['seed', 'germinating', 'seedling'].includes(plantStage(plant))) return environmentScale.soilSurfaceY
  return 0.045
}

// Longitudinal envelopes except upright Daphnia, whose max-axis idle envelope
// includes antennae. Picking volumes never contribute to normalization.
export const animalDimensions: Record<CreatureKind, { length: number; sourceLength: number; clearance: number; newbornRatio: number }> = {
  grazer: { length: 0.52, sourceLength: 0.87, clearance: 0.145, newbornRatio: 0.55 },
  woodlouse: { length: 0.34, sourceLength: 0.64, clearance: 0.09, newbornRatio: Math.cbrt(0.055 / 0.22) },
  beetle: { length: 0.55, sourceLength: 0.75, clearance: 0.145, newbornRatio: 0.55 },
  springtail: { length: 0.022, sourceLength: 0.39, clearance: 0.07, newbornRatio: 0.55 },
  flea: { length: 0.105, sourceLength: 0.14, clearance: 0, newbornRatio: 0.55 },
  fish: { length: 0.43, sourceLength: 0.48, clearance: 0, newbornRatio: 0.55 },
}

export function animalModelScale(creature: Creature) {
  const kind = creature.kind ?? 'grazer'
  const size = animalDimensions[kind]
  const growth = kind === 'woodlouse' ? Math.cbrt(woodlouseLife(creature).mass / 0.22)
    : size.newbornRatio + (1 - size.newbornRatio) * Math.min(1, (creature.age ?? maturity[kind]) / maturity[kind])
  return size.length / size.sourceLength * growth * stableVariation(creature.id)
}

export const animalGroundY = (creature: Creature) => 0.05 + animalDimensions[creature.kind ?? 'grazer'].clearance * animalModelScale(creature) + groundShape.offset(creature.x, creature.z)

// Micro follow must match the rendered body's interpolation. A slower
// camera can trail farther than its entire close frustum during3× foraging.
export const springtailTrackingRate = 10
