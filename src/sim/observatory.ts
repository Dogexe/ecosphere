import { creatureCounts, simulateStep, vitality } from './ecosystem.ts'
import type { World } from './ecosystem'
import { co2Ppm, o2Percent } from './seal.ts'

// Read-only measurements of a world. Nothing here feeds back into the simulation.
export type ObservationSample = {
  tick: number
  plants: number
  leafCover: number
  soilWater: number
  soilNutrients: number
  soilOrganic: number
  pondOxygen: number
  algae: number
  grazer: number
  woodlouse: number
  beetle: number
  springtail: number
  flea: number
  fish: number
  snail: number
  shrimp: number
  antWorkers: number
  /** Jar air; room air (20.9% / 420 ppm) while the world is open. */
  jarOxygen: number
  jarCO2: number
}

export type MetricKey = Exclude<keyof ObservationSample, 'tick'>
export type Metric = { key: MetricKey; label: string; unit: string; group: 'producers' | 'soil' | 'pond' | 'animals' | 'air' }

export const metrics: readonly Metric[] = [
  { key: 'plants', label: 'Plants', unit: '', group: 'producers' },
  { key: 'leafCover', label: 'Leaf cover', unit: '%', group: 'producers' },
  { key: 'soilWater', label: 'Soil water', unit: '%', group: 'soil' },
  { key: 'soilNutrients', label: 'Root nutrients', unit: '', group: 'soil' },
  { key: 'soilOrganic', label: 'Organic matter', unit: '', group: 'soil' },
  { key: 'pondOxygen', label: 'Pond oxygen', unit: '%', group: 'pond' },
  { key: 'algae', label: 'Algae', unit: '', group: 'pond' },
  { key: 'grazer', label: 'Grazers', unit: '', group: 'animals' },
  { key: 'woodlouse', label: 'Woodlice', unit: '', group: 'animals' },
  { key: 'beetle', label: 'Beetles', unit: '', group: 'animals' },
  { key: 'springtail', label: 'Springtails', unit: '', group: 'animals' },
  { key: 'flea', label: 'Water fleas', unit: '', group: 'animals' },
  { key: 'fish', label: 'Fish', unit: '', group: 'animals' },
  { key: 'snail', label: 'Ramshorn snails', unit: '', group: 'animals' },
  { key: 'shrimp', label: 'Cherry shrimp', unit: '', group: 'animals' },
  { key: 'antWorkers', label: 'Ant workers', unit: '', group: 'animals' },
  { key: 'jarOxygen', label: 'Jar oxygen', unit: '%', group: 'air' },
  { key: 'jarCO2', label: 'Jar CO2', unit: 'ppm', group: 'air' },
]

/** Live-run history kept in memory: 60 model days at one sample per hour. */
export const historyLimit = 24 * 60

export function sampleWorld(world: World): ObservationSample {
  const counts = creatureCounts(world.creatures)
  return {
    tick: world.tick,
    plants: world.plants.length,
    leafCover: vitality(world) * 100,
    soilWater: world.water,
    soilNutrients: world.nutrients,
    soilOrganic: world.organic,
    pondOxygen: world.pond.oxygen / Math.max(1, world.pond.water) * 100,
    algae: world.pond.algae,
    ...counts,
    antWorkers: world.colony?.workers.length ?? 0,
    jarOxygen: world.sealed ? o2Percent(world.sealed.o2) : 20.9,
    jarCO2: world.sealed ? Math.max(0, co2Ppm(world.sealed.co2)) : 420,
  }
}

/**
 * Adds the world's current hour to a history. Repeated ticks replace the
 * last sample (interventions within the same hour); time moving backwards
 * means a different run, so the history restarts.
 */
export function recordSample(history: readonly ObservationSample[], world: World, limit = historyLimit): ObservationSample[] {
  const sample = sampleWorld(world)
  const last = history[history.length - 1]
  if (!last || sample.tick < last.tick) return [sample]
  const next = sample.tick === last.tick ? [...history.slice(0, -1), sample] : [...history, sample]
  return next.length > limit ? next.slice(next.length - limit) : next
}

/**
 * Untouched projection: steps a copy of the world forward with the unchanged
 * solver and no interventions. The input world is never mutated.
 */
export function projectWorld(world: World, hours: number): ObservationSample[] {
  let current = world
  const samples = [sampleWorld(current)]
  for (let hour = 0; hour < hours; hour += 1) {
    current = simulateStep(current).world
    samples.push(sampleWorld(current))
  }
  return samples
}
