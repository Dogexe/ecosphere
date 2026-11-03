import type { World } from './ecosystem'
import { historyLimit, metrics } from './observatory.ts'
import type { MetricKey, ObservationSample } from './observatory'
import { parseSave, serializeSave } from './saves.ts'

/**
 * The browser keeps one automatic save: the live world plus its Observatory
 * history. It sits beside (never inside) the A/B experiment slots.
 */
export const autosaveKey = 'ecosphere.autosave'
/** Minimum real time between routine autosaves while the world is running. */
export const autosaveInterval = 5000

export type Autosave = { savedAt: number; world: World; history: ObservationSample[] }

const keys = metrics.map((metric) => metric.key)
/** Defaults for measurements added after a save was written (room air). */
const fallback: Partial<Record<MetricKey, number>> = { jarOxygen: 20.9, jarCO2: 420 }
const round = (value: number) => Math.round(value * 100) / 100

/** Encodes the world and history; history rows are [tick, ...metric values]. */
export function encodeAutosave(world: World, history: readonly ObservationSample[], savedAt = Date.now()): string {
  const rows = history.slice(-historyLimit).map((sample) => [sample.tick, ...keys.map((key) => round(sample[key]))])
  return JSON.stringify({ version: 1, savedAt, world: serializeSave(world), keys, history: rows })
}

/**
 * Restores an autosave. A damaged world rejects the whole save; a damaged
 * history is dropped so the world can still be played.
 */
export function decodeAutosave(text: string): Autosave {
  let decoded: unknown
  try { decoded = JSON.parse(text) } catch { throw new Error('The autosave is damaged.') }
  if (!decoded || typeof decoded !== 'object') throw new Error('The autosave is damaged.')
  const source = decoded as Record<string, unknown>
  if (source.version !== 1 || typeof source.world !== 'string') throw new Error('The autosave is damaged.')
  const world = parseSave(source.world)
  const savedAt = typeof source.savedAt === 'number' && Number.isFinite(source.savedAt) ? source.savedAt : 0
  return { savedAt, world, history: decodeHistory(source.keys, source.history, world.tick) }
}

function decodeHistory(savedKeys: unknown, rows: unknown, lastTick: number): ObservationSample[] {
  if (!Array.isArray(savedKeys) || !Array.isArray(rows) || rows.length > historyLimit) return []
  const columns = savedKeys.filter((key): key is string => typeof key === 'string')
  if (columns.length !== savedKeys.length) return []
  const history: ObservationSample[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== columns.length + 1 || !row.every((value) => typeof value === 'number' && Number.isFinite(value))) return []
    const tick = row[0] as number
    const previous = history[history.length - 1]
    if (!Number.isInteger(tick) || tick < 0 || tick > lastTick || (previous && tick <= previous.tick)) return []
    const sample = { tick } as ObservationSample
    for (const key of keys) {
      const index = columns.indexOf(key)
      const value = index >= 0 ? row[index + 1] as number : fallback[key]
      if (value === undefined) return []
      sample[key] = value
    }
    history.push(sample)
  }
  return history
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Writes the autosave; returns false when storage is full or blocked. */
export function writeAutosave(store: Store | null, world: World, history: readonly ObservationSample[], savedAt = Date.now()): boolean {
  if (!store) return false
  try {
    store.setItem(autosaveKey, encodeAutosave(world, history, savedAt))
    return true
  } catch {
    try { store.setItem(autosaveKey, encodeAutosave(world, [], savedAt)); return true } catch { return false }
  }
}

/** Reads the autosave; a missing, blocked or damaged save gives null. */
export function readAutosave(store: Store | null): Autosave | null {
  if (!store) return null
  try {
    const text = store.getItem(autosaveKey)
    return text ? decodeAutosave(text) : null
  } catch {
    return null
  }
}

export function clearAutosave(store: Store | null) {
  try { store?.removeItem(autosaveKey) } catch { /* storage blocked */ }
}

export function browserStore(): Store | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}
