import type { World } from './ecosystem'
import type { Notebook } from './notebook'
import { progress } from './notebook.ts'
import type { DecorKind, JarShape } from './substrate'

/**
 * Field goals (systems pass item 3, 2026-11-20). The notebook already fills from
 * what really happens in the jar; goals give it a direction. Each goal is a thing
 * worth seeing or a way of keeping the jar, in an order that teaches the jar's
 * systems one at a time, and each one gives the keeper something for their jars:
 * an odd object to set in the soil or a new shape of glass. Like the notebook,
 * goals belong to the player, not to one jar, and only read the world.
 */
export type Unlock = { kind: 'object'; id: DecorKind } | { kind: 'glass'; id: JarShape }
export type Goal = {
  id: string
  title: string
  /** What to do, as a keeper would say it. */
  hint: string
  unlock: Unlock
  reached: (notebook: Notebook, world: World) => boolean
}

const seen = (page: string) => (notebook: Notebook) => !!notebook.found[page]

export const goals: Goal[] = [
  { id: 'first-week', title: 'A week of green', hint: 'Keep a jar growing for seven days.', unlock: { kind: 'object', id: 'marble' },
    reached: (_, world) => world.tick >= 7 * 24 && world.plants.length > 0 },
  { id: 'pairing', title: 'Woodlice pair up', hint: 'Keep at least two woodlice in damp shade with leaf litter.', unlock: { kind: 'object', id: 'shell' },
    reached: seen('pairing') },
  { id: 'flowering', title: 'First flowers', hint: 'Grow a violet to full leaf in bright, fertile soil.', unlock: { kind: 'glass', id: 'globe' },
    reached: seen('flowering') },
  { id: 'brood-pouch', title: 'A new woodlouse', hint: 'Let a paired female carry her brood until the young walk out.', unlock: { kind: 'object', id: 'acorn' },
    reached: seen('brood-pouch') },
  { id: 'sealed', title: 'A jar on its own', hint: 'Seal a jar and let it reach its goal without opening it.', unlock: { kind: 'glass', id: 'apothecary' },
    reached: seen('sealed-goal') },
  { id: 'new-chamber', title: 'The ants dig in', hint: 'Keep an ant colony fed on seeds until it opens a new chamber.', unlock: { kind: 'object', id: 'leaf' },
    reached: seen('new-chamber') },
  { id: 'thirty-pages', title: 'A well-kept notebook', hint: 'Fill 30 pages of the field notebook.', unlock: { kind: 'glass', id: 'wide' },
    reached: (notebook) => progress(notebook).found >= 30 },
  { id: 'sealed-60', title: 'Two months sealed', hint: 'Keep a sealed jar alive for its full 60-day goal.', unlock: { kind: 'object', id: 'crystal' },
    reached: (_, world) => !!world.sealed && world.sealed.goalDays >= 60 && world.tick - world.sealed.since >= 60 * 24 && world.plants.length > 0 },
]
export const goalById = new Map(goals.map((goal) => [goal.id, goal]))

export const objectNames: Record<DecorKind, { name: string; note: string }> = {
  stone: { name: 'Stone', note: 'A river stone' },
  log: { name: 'Wood', note: 'A dry branch' },
  marble: { name: 'Glass marble', note: 'A swirl of colour in the soil' },
  shell: { name: 'Snail shell', note: 'Empty, banded, about 2 cm' },
  acorn: { name: 'Acorn', note: 'An oak seed in its cup' },
  leaf: { name: 'Fallen leaf', note: 'A dry leaf on the ground' },
  crystal: { name: 'Quartz point', note: 'A clear six-sided crystal' },
}
export const glassNames: Record<JarShape, { name: string; note: string }> = {
  squat: { name: 'Squat jar', note: 'Straight sides, wide screw neck' },
  globe: { name: 'Bubble bowl', note: 'Round, small opening: stays damp longer' },
  apothecary: { name: 'Apothecary jar', note: 'Tall, narrower neck: dries a little slower' },
  wide: { name: 'Wide bowl', note: 'Low and open: bright, but dries faster' },
}
export const unlockName = (unlock: Unlock) => unlock.kind === 'object' ? objectNames[unlock.id].name : glassNames[unlock.id].name

/** Goals reached so far (by id, when), kept beside the notebook in the same browser key. */
export type GoalLog = Record<string, { at: number; tick: number }>

export function unlockedObjects(log: GoalLog): DecorKind[] {
  return ['stone', 'log', ...goals.filter((goal) => log[goal.id] && goal.unlock.kind === 'object').map((goal) => goal.unlock.id as DecorKind)]
}
export function unlockedGlass(log: GoalLog): JarShape[] {
  return ['squat', ...goals.filter((goal) => log[goal.id] && goal.unlock.kind === 'glass').map((goal) => goal.unlock.id as JarShape)]
}

/** The next goals still open, in order: what the overview suggests. */
export const openGoals = (log: GoalLog, count = 3) => goals.filter((goal) => !log[goal.id]).slice(0, count)

/** Checks every open goal; returns the same log when nothing new was reached. */
export function reachGoals(log: GoalLog, notebook: Notebook, world: World, at: number): { log: GoalLog; reached: Goal[] } {
  const reached = goals.filter((goal) => !log[goal.id] && goal.reached(notebook, world))
  if (reached.length === 0) return { log, reached }
  const next = { ...log }
  for (const goal of reached) next[goal.id] = { at, tick: world.tick }
  return { log: next, reached }
}

export function decodeGoals(source: unknown): GoalLog {
  const log: GoalLog = {}
  if (!source || typeof source !== 'object') return log
  for (const [id, value] of Object.entries(source as Record<string, unknown>)) {
    const item = value as { at?: unknown; tick?: unknown } | null
    if (goalById.has(id) && item && typeof item.at === 'number' && Number.isFinite(item.at) && typeof item.tick === 'number' && Number.isFinite(item.tick)) log[id] = { at: item.at, tick: item.tick }
  }
  return log
}
