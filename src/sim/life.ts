import type { Creature, Lifeform, Plant, PlantKind, SoilPatch, World } from './ecosystem'
import { isAquatic, rateAt } from './pond.ts'
import type { Pond } from './pond'

export const plantLifetime: Record<PlantKind, number> = { clover: 8760, grass: 8760, bloom: 2880, fern: 43800, moss: 87600, tree: 175200, lily: 17520, reed: 17520 }
export const developmentRate: Record<PlantKind, number> = { clover: 1.2, grass: 1.5, bloom: 1, fern: 0.65, moss: 0.8, tree: 0.45, lily: 0.8, reed: 1.1 }
export function plantStage(plant: Plant): 'seed' | 'germinating' | 'seedling' | 'growing' | 'mature' | 'senescent' {
  const age = plant.age ?? 90
  const development = plant.development ?? 90
  if (age >= plantLifetime[plant.kind] * 0.8) return 'senescent'
  if (development < 3) return 'seed'
  if (development < 6) return 'germinating'
  if (development < 24) return 'seedling'
  if (development < 60) return 'growing'
  return 'mature'
}

export function plantFlowering(plant: Plant) {
  const stage = plantStage(plant)
  return (stage === 'mature' || stage === 'senescent') && plant.biomass / plant.capacity >= 0.7
}

export interface WoodlouseLife {
  mass: number
  hydration: number
  sex: 'female' | 'male'
  partnerId: number | null
  courtship: number
  gestation: number
  brood: number
  gut: number
  parentId: number | null
  activity: 'foraging' | 'feeding' | 'resting' | 'courting' | 'brooding' | 'rehydrating' | 'fleeing'
}

export function woodlouseLife(creature: Creature): WoodlouseLife {
  return creature.life ? { ...creature.life, gut: creature.life.gut ?? 0 } : { mass: 0.22, hydration: 80, sex: creature.id % 2 ? 'male' : 'female', partnerId: null, courtship: 0, gestation: 0, brood: 0, gut: 0, parentId: null, activity: 'foraging' }
}

export function woodlouseMate(world: World, creature: Creature): Creature | null {
  const life = woodlouseLife(creature)
  if (creature.stage === 'juvenile' || life.mass < 0.2 || life.hydration < 45 || life.brood > 0 || creature.energy < 45) return null
  let best: Creature | null = null
  let distance = 4.5
  for (const other of world.creatures) {
    if (other.kind !== 'woodlouse' || other.id === creature.id || other.stage === 'juvenile' || other.energy < 45) continue
    const candidate = woodlouseLife(other)
    if (candidate.sex === life.sex || candidate.mass < 0.2 || candidate.hydration < 45 || candidate.brood > 0 || candidate.parentId === creature.id || life.parentId === other.id || (life.parentId !== null && life.parentId === candidate.parentId)) continue
    const next = Math.hypot(other.x - creature.x, other.z - creature.z)
    if (next < distance) { best = other; distance = next }
  }
  return best
}

export type AntRemains = { sourceId: number; form: 'queen' | 'worker' | 'egg' | 'larva' | 'pupa'; count: number; body: number; y: number }
export interface Remains { id: number; kind: Lifeform | 'ant'; x: number; z: number; material: number; initial: number; age: number; patchId: number; ant?: AntRemains }

export function addRemains(remains: Remains[], kind: Remains['kind'], x: number, z: number, material: number, patchId: number, ant?: AntRemains) {
  if (material <= 0) return
  // Bound visual records without destroying stock or transporting it to a
  // different soil compartment. Old remains of the same pocket aggregate.
  const aggregate = remains.length >= 256 ? remains.find((item) => item.patchId === patchId) : undefined
  if (aggregate) { aggregate.material += material; aggregate.initial += material; delete aggregate.ant; return }
  remains.push({ id: remains.reduce((highest, item) => Math.max(highest, item.id), -1) + 1, kind, x, z, material, initial: material, age: 0, patchId, ...(kind === 'ant' && ant ? { ant: { ...ant } } : {}) })
}

export function decayRemains(source: Remains[], soilSource: SoilPatch[], pondSource: Pond, temperature: number) {
  const soil = soilSource.map((patch) => ({ ...patch }))
  const pond = { ...pondSource }
  const remains: Remains[] = []
  for (const item of source) {
    const patch = item.patchId === 4 ? pond : soil.find((patch) => patch.id === item.patchId)!
    const moisture = Math.min(1, Math.max(0, (patch.water - 8) / 55))
    const fungi = item.patchId === 4 ? 1 : soil.find((patch) => patch.id === item.patchId)!.fungi
    let released = Math.min(item.material, item.material * (0.025 + Math.min(0.04, fungi * 0.01)) * moisture * rateAt(temperature))
    // The old absolute dust cutoff can exceed a whole ant egg/young larva.
    // Preserve its modeled fractional decay; only the final small residue
    // joins soil at once. Unrecorded historical pools keep their old rule.
    const residue = item.ant ? Math.min(0.001, item.initial * 0.025) : 0.001
    if (moisture > 0 && item.material - released < residue) released = item.material
    patch.organic += released
    if (item.material > released) remains.push({ ...item, material: item.material - released, age: item.age + 1 })
  }
  return { soil, pond, remains }
}

export const bodyStock = (creature: Creature, fallback: number) => creature.kind === 'woodlouse' ? woodlouseLife(creature).mass + woodlouseLife(creature).brood + woodlouseLife(creature).gut : fallback + (isAquatic(creature.kind) ? creature.materialReserve ?? 0 : 0)
