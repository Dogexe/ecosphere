import { isLand, settleOnLand } from './land.ts'
import { isAquatic, pondCenter } from './pond.ts'

/*
 * On 2026-11-03 the pond grew from 3.5 cm to 6 cm across (radius 0.93 to
 * 1.58 units), so a real water feature fits in the jar. Worlds saved before
 * then can have land plants, animals, remains or an ant nest where the water
 * now is. This moves them onto the nearest dry bank before the save is
 * checked. Nothing is removed and the save format does not change.
 */

type Source = Record<string, unknown>
const isRecord = (value: unknown): value is Source => !!value && typeof value === 'object' && !Array.isArray(value)
const isPoint = (value: Source) => typeof value.x === 'number' && typeof value.z === 'number'
/** Dry ground before the pond grew: outside the old 0.93 water plus its 0.12 bank. Anything closer was already invalid and stays rejected. */
const wasLand = (x: number, z: number) => Math.hypot(x - pondCenter.x, z - pondCenter.z) >= 1.05 - 1e-9

/** Every {x, z} in the colony, except offsets, which are relative to a node. */
function colonyPoints(value: unknown, found: Source[] = []): Source[] {
  if (Array.isArray(value)) value.forEach((item) => colonyPoints(item, found))
  else if (isRecord(value)) {
    if (isPoint(value)) found.push(value)
    for (const [key, item] of Object.entries(value)) if (key !== 'offset') colonyPoints(item, found)
  }
  return found
}

/** A nest is moved as one piece, straight away from the pond, until every node is on dry ground. */
function moveColony(colony: Source, soil: unknown) {
  const nodes = Array.isArray(colony.nodes) ? colony.nodes.filter(isRecord).filter(isPoint) : []
  const entrance = isRecord(colony.entrance) && isPoint(colony.entrance) ? colony.entrance : null
  const clear = 0.26 // past the strictest nest rule: rest chambers keep 0.25 from the water
  // Only a nest the old pond allowed and the new one floods is moved.
  if (!entrance || nodes.every((node) => isLand(node.x as number, node.z as number, 0.08)) || !nodes.every((node) => wasLand(node.x as number, node.z as number))) return
  const target = settleOnLand(entrance.x as number, entrance.z as number, clear)
  let dx = target.x - (entrance.x as number), dz = target.z - (entrance.z as number)
  const length = Math.hypot(dx, dz) || 1
  for (let extra = 0; extra < 40 && !nodes.every((node) => isLand(node.x as number + dx, node.z as number + dz, clear)); extra += 1) {
    dx += dx / length * 0.05; dz += dz / length * 0.05
  }
  for (const point of colonyPoints(colony)) { point.x = (point.x as number) + dx; point.z = (point.z as number) + dz }
  // The nest draws on the soil pocket under its entrance.
  if (Array.isArray(soil)) {
    const pockets = soil.filter(isRecord).filter(isPoint)
    const nearest = pockets.reduce<Source | null>((best, next) => !best || Math.hypot(next.x as number - (entrance.x as number), next.z as number - (entrance.z as number)) < Math.hypot(best.x as number - (entrance.x as number), best.z as number - (entrance.z as number)) ? next : best, null)
    if (nearest && typeof nearest.id === 'number') colony.patchId = nearest.id
  }
}

/** Returns a copy of a saved world with everything on land moved out of the wider pond. */
export function settleOutOfWidePond(world: Source): Source {
  const copy = structuredClone(world)
  for (const key of ['plants', 'creatures', 'remains']) {
    const items = copy[key]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      if (!isRecord(item) || !isPoint(item)) continue
      const kind = typeof item.kind === 'string' ? item.kind : 'grazer'
      if (isAquatic(kind) || !wasLand(item.x as number, item.z as number)) continue
      const point = settleOnLand(item.x as number, item.z as number)
      item.x = point.x; item.z = point.z
    }
  }
  if (isRecord(copy.colony)) moveColony(copy.colony, copy.soil)
  return copy
}

/** Pocket 2's old centre, now under water, and where it moved to (soilCenters in ecosystem.ts). */
const floodedPocket = { x: -1.7, z: 1.7 }, movedPocket = { x: -1.6, z: 2.45 }

/** Moves the soil pocket the pond now covers. Applied to every save, since a world with it under water still loads. */
export function movePondPocket<T extends { id: number; x: number; z: number }>(soil: T[]): T[] {
  return soil.map((patch) => patch.id === 2 && patch.x === floodedPocket.x && patch.z === floodedPocket.z ? { ...patch, ...movedPocket } : patch)
}
