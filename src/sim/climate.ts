import type { Creature, World } from './ecosystem'
import type { Climate } from './pond'

type ClockWorld = { tick: number; light: number; climate?: Climate }
const solarAt = (hour: number) => hour <= 6 || hour >= 18 ? 0 : Math.sin((hour - 6) * Math.PI / 12)
// Existing rates are daily-average potentials. Convert to a 12-hour light pulse
// with the same 24-step integral, not an extra daily material grant.
export const daylightNormalization = 24 / Array.from({ length: 24 }, (_, hour) => solarAt(hour)).reduce((sum, value) => sum + value, 0)

export function environmentAt(world: ClockWorld) {
  const hour = ((world.tick % 24) + 24) % 24
  const cycling = world.climate?.photoperiod === true
  const solar = cycling ? solarAt(hour) : 1
  const phase = !cycling ? 'constant' : hour < 5 || hour >= 20 ? 'night' : hour < 7 ? 'dawn' : hour < 16 ? 'daylight' : hour < 18 ? 'sunset' : 'twilight'
  const temperatureC = Math.max(0, Math.min(40, (world.climate?.temperatureC ?? 22) + (cycling ? 3 * Math.sin((hour - 9) * Math.PI / 12) : 0)))
  return { cycling, hour, solar, phase, light: world.light * solar, photosynthesis: cycling ? solar * daylightNormalization : 1, temperatureC }
}

// Selected functional groups, not universal species chronotypes. Water fleas
// retain continuous grazing. Starvation/dehydration override the schedule;
// the solver handles immediate danger before applying rest.
export function scheduledRest(world: Pick<ClockWorld, 'tick' | 'climate'>, creature: Pick<Creature, 'kind' | 'energy' | 'life'>) {
  if (!world.climate?.photoperiod || creature.energy < 25 || creature.kind === 'flea') return false
  if (creature.kind === 'woodlouse' && (creature.life?.hydration ?? 80) < 35) return false
  const hour = ((world.tick % 24) + 24) % 24
  const daylight = hour >= 6 && hour < 18
  return creature.kind === 'woodlouse' || creature.kind === 'springtail' ? daylight : !daylight
}

export function beginDaylitWorld(world: World): World {
  return { ...world, tick: 8, climate: { ...world.climate, photoperiod: true } }
}
