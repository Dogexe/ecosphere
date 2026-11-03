import type { Creature, SimulationEvent } from './ecosystem'
import { daylightNormalization, scheduledRest } from './climate.ts'

export interface Climate { temperatureC: number; rainfall: number; photoperiod?: boolean }
export interface Pond { water: number; nutrients: number; organic: number; oxygen: number; algae: number }
export const defaultClimate = (): Climate => ({ temperatureC: 22, rainfall: 0 })
export const defaultPond = (): Pond => ({ water: 60, nutrients: 5, organic: 4, oxygen: 48, algae: 1 })
export const maturity = { grazer: 36, woodlouse: 60, beetle: 72, springtail: 24, flea: 12, fish: 96 } as const
export const lifespan = { grazer: 960, woodlouse: 17520, beetle: 1920, springtail: 4320, flea: 480, fish: 2880 } as const
export const rateAt = (temperature: number) => Math.max(0.25, Math.min(2.4, 2 ** ((temperature - 22) / 10)))
export { pondCenter, pondShape, setPondShape } from './pondShape.ts'
import { pondCenter, pondShape, pushToShore } from './pondShape.ts'
export const isAquatic = (kind: string) => kind === 'flea' || kind === 'fish' || kind === 'lily' || kind === 'reed'
const poured = () => pondShape().kind === 'mask'
export const isPondPosition = (x: number, z: number) => Number.isFinite(x) && Number.isFinite(z) && (poured() ? pondShape().signedDistance(x, z) <= 1e-9 : Math.hypot(x - pondCenter.x, z - pondCenter.z) <= pondCenter.radius + 1e-9)
// Conservative adult physics hulls, independent of meshes, growth and hit targets.
export const swimmingClearance = (kind: string) => kind === 'fish' ? 0.24 : kind === 'flea' ? 0.07 : 0
export const isSwimmingPosition = (kind: string, x: number, z: number) => Number.isFinite(x) && Number.isFinite(z) && (poured() ? pondShape().signedDistance(x, z) + swimmingClearance(kind) <= 1e-9 : Math.hypot(x - pondCenter.x, z - pondCenter.z) + swimmingClearance(kind) <= pondCenter.radius + 1e-9)

/** The middle of the open water and how far a swimmer can wander from it. */
const pondMiddle = () => poured() ? pondShape().center : pondCenter
const wander = (reach: number) => poured() ? Math.min(reach, pondShape().inner * 0.8) : reach

function boundSwimmer(kind: string, x: number, z: number) {
  if (poured()) {
    // A poured pond can take any shape: slide the swimmer back along the shore's normal.
    const margin = swimmingClearance(kind)
    if (pondShape().signedDistance(x, z) <= -margin) return { x, z }
    const point = pushToShore(x, z, -margin - 0.01)
    return pondShape().signedDistance(point.x, point.z) <= -margin + 0.005 ? point : { ...pondShape().center }
  }
  const distance = Math.hypot(x - pondCenter.x, z - pondCenter.z)
  const radius = pondCenter.radius - swimmingClearance(kind)
  return distance <= radius ? { x, z } : {
    x: pondCenter.x + (x - pondCenter.x) / distance * radius,
    z: pondCenter.z + (z - pondCenter.z) / distance * radius,
  }
}

function swim(creature: Creature, x: number, z: number, stride: number) {
  const distance = Math.hypot(x - creature.x, z - creature.z)
  const reach = Math.min(stride, distance)
  const { x: nextX, z: nextZ } = boundSwimmer(creature.kind, creature.x + (x - creature.x) / (distance || 1) * reach, creature.z + (z - creature.z) / (distance || 1) * reach)
  return { x: nextX, z: nextZ, heading: Math.atan2(nextX - creature.x, nextZ - creature.z) }
}

/** Potential algal growth this hour before any CO2 limit. */
export function algaeGrowth(pond: Pond, light: number, climate: Climate) {
  const wet = Math.min(1, pond.water / 25)
  const temperatureFit = Math.max(0, 1 - Math.abs(climate.temperatureC - 22) / 24)
  return Math.min(pond.nutrients / 0.6, 0.08 * pond.algae * light * (climate.photoperiod ? daylightNormalization : 1) * wet * temperatureFit * Math.max(0, 1 - pond.algae / 12))
}

export function stepPond(source: Pond, animals: Creature[], light: number, climate: Climate, seed: number, nextId: number, tick = 0, carbon = 1, breath = 1) {
  const pond = { ...source }
  const events: SimulationEvent[] = []
  const bodies: Creature[] = []
  const rate = rateAt(climate.temperatureC)
  const wet = Math.min(1, pond.water / 25)
  const growth = algaeGrowth(pond, light, climate) * carbon
  pond.algae += growth
  pond.nutrients -= growth * 0.6
  pond.oxygen += growth * 0.8
  const loss = Math.min(pond.algae, pond.algae * (0.006 + (1 - wet) * 0.08) * rate)
  pond.algae -= loss
  pond.organic += loss * 0.6
  const processed = Math.min(pond.organic, pond.oxygen / 2.5, 0.012 * pond.organic * wet * rate * Math.min(1, pond.oxygen / 8))
  pond.organic -= processed
  pond.nutrients += processed * 0.7
  pond.oxygen = Math.max(0, pond.oxygen - processed * 2.5 - pond.algae * 0.012 * rate)
  // Open atmospheric exchange; warm water has a lower saturation target.
  // In a sealed jar the pond exchanges with the jar air, which can run low on O2.
  const saturation = pond.water * Math.max(0.45, 0.85 - (climate.temperatureC - 22) * 0.012) * breath
  pond.oxygen += (saturation - pond.oxygen) * 0.018
  const survivors: Creature[] = []
  for (const creature of animals) {
    const oxygenFit = Math.min(1, pond.oxygen / Math.max(1, pond.water) / 0.35)
    const maintenance = (creature.kind === 'fish' ? 0.18 : 0.15) * rate
    const stress = (1 - oxygenFit) * 1.3 + (1 - wet) * 2
    const resting = scheduledRest({ tick, climate }, { ...creature, energy: creature.energy - maintenance - stress })
    let energy = creature.energy - maintenance * (resting ? 0.5 : 1) - stress
    if (energy <= 0 || pond.water <= 1) {
      bodies.push(creature)
      events.push({ type: 'death', id: creature.id, kind: creature.kind, reason: 'energy' })
      continue
    }
    pond.oxygen = Math.max(0, pond.oxygen - 0.007 * rate * (resting ? 0.5 : 1))
    survivors.push({ ...creature, ...boundSwimmer(creature.kind, creature.x, creature.z), energy })
  }
  let countsFlea = survivors.filter((animal) => animal.kind === 'flea').length
  let countsFish = survivors.filter((animal) => animal.kind === 'fish').length
  const consumed = new Set<number>()
  const young: Creature[] = []
  for (const creature of survivors) {
    if (creature.kind === 'flea') {
      const threat = survivors.find((animal) => animal.kind === 'fish' && Math.hypot(animal.x - creature.x, animal.z - creature.z) < 0.38)
      const heading = creature.heading + (threat ? 1.5 : 0.1)
      Object.assign(creature, swim(creature, threat ? creature.x + (creature.x - threat.x) * 2 : pondMiddle().x + Math.sin(heading) * wander(0.65), threat ? creature.z + (creature.z - threat.z) * 2 : pondMiddle().z + Math.cos(heading) * wander(0.65), threat ? 0.095 : 0.04))
      creature.energy -= 0.025
      if (!threat) {
        const bite = Math.min(pond.algae, 0.035 * wet * pond.algae / (pond.algae + 1), (100 - creature.energy) / 18)
        pond.algae -= bite
        pond.organic += bite * 0.2
        pond.nutrients += bite * 0.15
        creature.energy += bite * 18
        if (bite > 0) events.push({ type: 'feeding', id: creature.id, kind: 'flea', source: 'algae', amount: bite })
      }
      if (creature.energy <= 0) {
        consumed.add(creature.id)
        countsFlea -= 1
        bodies.push(creature)
        events.push({ type: 'death', id: creature.id, kind: 'flea', reason: 'energy' })
      }
    }
  }
  for (const fish of survivors.filter((animal) => animal.kind === 'fish')) {
    if (scheduledRest({ tick, climate }, fish)) continue
    const prey = survivors.filter((animal) => animal.kind === 'flea' && !consumed.has(animal.id)).sort((a, b) => Math.hypot(a.x - fish.x, a.z - fish.z) - Math.hypot(b.x - fish.x, b.z - fish.z))[0]
    if (prey && fish.energy < 70) {
      Object.assign(fish, swim(fish, prey.x, prey.z, 0.12))
      fish.energy -= 0.04
      if (fish.energy > 0 && Math.hypot(fish.x - prey.x, fish.z - prey.z) < 0.18) {
        consumed.add(prey.id)
        countsFlea -= 1
        const stored = Math.min(0.02, Math.max(0, 0.48 - (fish.materialReserve ?? 0)))
        fish.materialReserve = (fish.materialReserve ?? 0) + stored
        fish.energy = Math.min(100, fish.energy + 14)
        pond.organic += 0.008
        events.push({ type: 'predation', predatorKind: 'fish', predatorId: fish.id, preyId: prey.id, preyKind: 'flea', x: prey.x, z: prey.z, preyMaterial: 0.04, offspringMaterial: 0, storedMaterial: stored, litter: 0.008, metabolized: 0.032 - stored })
      }
    } else {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const heading = fish.heading + (seed / 4294967296 - 0.5) * 0.6
      Object.assign(fish, swim(fish, pondMiddle().x + Math.sin(heading) * wander(0.7), pondMiddle().z + Math.cos(heading) * wander(0.7), 0.035))
    }
    if (fish.energy <= 0) {
      consumed.add(fish.id)
      countsFish -= 1
      bodies.push(fish)
      events.push({ type: 'death', id: fish.id, kind: 'fish', reason: 'energy' })
    }
  }
  for (const parent of survivors) {
    if (consumed.has(parent.id) || parent.energy < 82 || parent.stage === 'juvenile' || pond.water < 25 || scheduledRest({ tick, climate }, parent)) continue
    if (parent.kind === 'flea') {
      if (countsFlea >= 6 || pond.algae < 0.2) continue
      pond.algae -= 0.04
      countsFlea += 1
    } else {
      if (countsFish >= 2 || (parent.materialReserve ?? 0) < 0.24) continue
      parent.materialReserve = (parent.materialReserve ?? 0) - 0.24
      countsFish += 1
    }
    const energy = parent.energy * 0.42
    parent.energy -= energy
    const position = swim(parent, pondMiddle().x, pondMiddle().z, 0.1)
    const child = { ...parent, ...position, id: nextId++, age: 0, stage: 'juvenile' as const, energy, materialReserve: 0 }
    young.push(child)
    events.push({ type: 'birth', id: child.id, kind: child.kind, parentId: parent.id })
  }
  pond.water = Math.max(0, pond.water - (0.035 + light * 0.04) * rate)
  pond.oxygen = Math.max(0, Math.min(pond.water, pond.oxygen))
  return { pond, creatures: [...survivors.filter((animal) => !consumed.has(animal.id)), ...young], events, seed, bodies, nextId }
}
