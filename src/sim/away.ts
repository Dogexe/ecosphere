import { simulateStep } from './ecosystem.ts'
import type { Lifeform, SimulationEvent, World } from './ecosystem'
import { recordSample } from './observatory.ts'
import type { ObservationSample } from './observatory'

/**
 * Time away (2026-11-04, owner-approved "real-time growth while away"):
 * a jar on the windowsill keeps living while the game is closed. One model
 * hour passes for every real hour away, the same fixed step the game uses at
 * 1×, so the jar keeps every rate it already has; nothing is sped up or
 * skipped. Minutes short of a full hour are carried to the next visit.
 */
export const hourMs = 60 * 60 * 1000
/** The longest absence the jar lives through in one go (60 days). */
export const awayLimitHours = 60 * 24
/** Hours worked through per slice, so a long absence never freezes the page. */
export const awaySliceHours = 96

/** Whole model hours to live through, and the minutes carried to next time. */
export function awayHours(savedAt: number, now: number, limit = awayLimitHours) {
  const elapsed = now - savedAt
  if (!Number.isFinite(elapsed) || savedAt <= 0 || elapsed < hourMs) return { hours: 0, carryMs: Math.max(0, Math.min(hourMs - 1, Number.isFinite(elapsed) ? elapsed : 0)), capped: false }
  const whole = Math.floor(elapsed / hourMs)
  return { hours: Math.min(whole, limit), carryMs: whole > limit ? 0 : elapsed - whole * hourMs, capped: whole > limit }
}

type Tally = Partial<Record<Lifeform, number>>

export type AwayReport = {
  hours: number
  capped: boolean
  plants: { before: number; after: number; sprouted: Tally; died: Tally }
  animals: { before: number; after: number; born: Tally; died: Tally }
  meals: number
  hunts: number
  ants: { before: number; after: number }
  soilWater: { before: number; after: number }
  pondWater: { before: number; after: number }
  /** Set when a sealed jar's experiment ended while the player was away. */
  seal: { collapsedDay: number | null; reachedGoal: boolean } | null
}

const isPlantKind = (kind: Lifeform) => ['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed'].includes(kind)
const antCount = (world: World) => (world.colony?.workers.length ?? 0) + (world.colony?.queen ? 1 : 0)
const meanSoilWater = (world: World) => world.soil.reduce((sum, patch) => sum + patch.water, 0) / Math.max(1, world.soil.length)
const add = (tally: Tally, kind: Lifeform) => { tally[kind] = (tally[kind] ?? 0) + 1 }

export function startReport(world: World, capped: boolean): AwayReport {
  return {
    hours: 0,
    capped,
    plants: { before: world.plants.length, after: world.plants.length, sprouted: {}, died: {} },
    animals: { before: world.creatures.length, after: world.creatures.length, born: {}, died: {} },
    meals: 0,
    hunts: 0,
    ants: { before: antCount(world), after: antCount(world) },
    soilWater: { before: meanSoilWater(world), after: meanSoilWater(world) },
    pondWater: { before: world.pond.water, after: world.pond.water },
    seal: world.sealed ? { collapsedDay: null, reachedGoal: false } : null,
  }
}

function tallyEvents(report: AwayReport, events: readonly SimulationEvent[]) {
  for (const event of events) {
    if (event.type === 'birth') add(isPlantKind(event.kind) ? report.plants.sprouted : report.animals.born, event.kind)
    else if (event.type === 'death') add(isPlantKind(event.kind) ? report.plants.died : report.animals.died, event.kind)
    else if (event.type === 'feeding') report.meals += 1
    else if (event.type === 'predation') { report.hunts += 1; add(report.animals.died, event.preyKind) }
  }
}

function producersAlive(world: World) {
  return world.plants.length > 0 || world.pond.algae > 0.05
}

/**
 * Lives through up to `hours` model hours with the unchanged solver, adding
 * one Observatory reading per hour as if the player had watched. Returns the
 * world, its history and the running report; call again for the next slice.
 * `observe` sees every lived hour (the field notebook reads it; it cannot change the world).
 */
export function liveAway(world: World, history: readonly ObservationSample[], hours: number, report: AwayReport, observe?: (world: World, events: readonly SimulationEvent[]) => void) {
  let current = world
  let samples: ObservationSample[] = [...history]
  for (let hour = 0; hour < hours; hour += 1) {
    samples = recordSample(samples, current)
    const step = simulateStep(current)
    tallyEvents(report, step.events)
    observe?.(step.world, step.events)
    current = step.world
    if (report.seal && current.sealed && report.seal.collapsedDay === null && !report.seal.reachedGoal) {
      const sealedHours = current.tick - current.sealed.since
      if (!producersAlive(current)) report.seal.collapsedDay = Math.floor(sealedHours / 24) + 1
      else if (sealedHours >= current.sealed.goalDays * 24) report.seal.reachedGoal = true
    }
  }
  samples = recordSample(samples, current)
  report.hours += hours
  report.plants.after = current.plants.length
  report.animals.after = current.creatures.length
  report.ants.after = antCount(current)
  report.soilWater.after = meanSoilWater(current)
  report.pondWater.after = current.pond.water
  return { world: current, history: samples }
}

/** The whole absence at once (tests and tools; the game works in slices). */
export function catchUp(world: World, history: readonly ObservationSample[], hours: number, capped = false) {
  const report = startReport(world, capped)
  return { ...liveAway(world, history, hours, report), report }
}

const names: Record<Lifeform, [string, string]> = {
  clover: ['clover', 'clover'], fern: ['fern', 'ferns'], bloom: ['flower', 'flowers'], moss: ['moss tuft', 'moss tufts'], grass: ['grass blade', 'grass'], tree: ['sapling', 'saplings'], lily: ['water lily', 'water lilies'], reed: ['reed', 'reeds'],
  grazer: ['forager', 'foragers'], woodlouse: ['woodlouse', 'woodlice'], beetle: ['beetle', 'beetles'], springtail: ['springtail', 'springtails'], flea: ['water flea', 'water fleas'], fish: ['fish', 'fish'],
}

export function tallyWords(tally: Tally) {
  return (Object.entries(tally) as [Lifeform, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `${count} ${names[kind][count === 1 ? 0 : 1]}`)
    .join(', ')
}

/** "3 days and 5 hours" style wording for the hours away. */
export function awayDuration(hours: number) {
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  const part = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
  if (days === 0) return part(rest, 'hour')
  return rest === 0 ? part(days, 'day') : `${part(days, 'day')} and ${part(rest, 'hour')}`
}

/** Plain notebook lines about what changed, most telling first. */
export function awayLines(report: AwayReport): string[] {
  const lines: string[] = []
  if (report.seal?.collapsedDay) lines.push(`The sealed jar ran out of living plants and algae on day ${report.seal.collapsedDay}.`)
  else if (report.seal?.reachedGoal) lines.push('The sealed jar reached its goal while you were away.')
  const sprouted = tallyWords(report.plants.sprouted)
  const born = tallyWords(report.animals.born)
  const plantsDied = tallyWords(report.plants.died)
  const animalsDied = tallyWords(report.animals.died)
  if (sprouted) lines.push(`New growth: ${sprouted}.`)
  if (born) lines.push(`Born: ${born}.`)
  if (plantsDied) lines.push(`Plants that died back: ${plantsDied}.`)
  if (animalsDied) lines.push(`Animals lost: ${animalsDied}.`)
  if (report.hunts > 0) lines.push(`${report.hunts} ${report.hunts === 1 ? 'hunt' : 'hunts'} ended in a catch.`)
  if (report.ants.before > 0 || report.ants.after > 0) lines.push(`Ants: ${report.ants.before} → ${report.ants.after}.`)
  const drop = report.soilWater.before - report.soilWater.after
  if (drop >= 8) lines.push(report.soilWater.after < 25 ? `The soil dried out (water ${Math.round(report.soilWater.before)} → ${Math.round(report.soilWater.after)}). An open jar loses water to the room; water it, or seal it before a long trip.` : `The soil is drier (water ${Math.round(report.soilWater.before)} → ${Math.round(report.soilWater.after)}).`)
  else if (drop <= -8) lines.push(`The soil is wetter (water ${Math.round(report.soilWater.before)} → ${Math.round(report.soilWater.after)}).`)
  if (lines.length === 0) lines.push('A quiet stretch. Everything kept growing slowly.')
  if (report.capped) lines.push(`You were gone longer than ${awayLimitHours / 24} days; the jar lived through the first ${awayLimitHours / 24} and then waited for you.`)
  return lines
}
