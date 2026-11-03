import { isLand, settleOnLand } from './land.ts'
import { isAquatic, isPondPosition, isSwimmingPosition, setPondShape, swimmingClearance } from './pond.ts'
import { pushToShore } from './pondShape.ts'
import { parseSave, serializeSave } from './saves.ts'
import type { World } from './ecosystem.ts'
import type { SavedSubstrate } from './substrate.ts'
import { moveColony } from './widePond.ts'

/*
 * Moving a world into a poured jar (2026-11-03). A poured jar's pond is
 * wherever its water stands, so its shore is not the round one the world was
 * made with. Land life that would be under water steps onto the nearest bank,
 * water life that would be on land slips into the nearest water, and an ant
 * nest moves as one piece. Nothing is removed. The result goes through the
 * normal save check, so it is a valid world or this throws.
 */

type Source = Record<string, unknown>
const isRecord = (value: unknown): value is Source => !!value && typeof value === 'object' && !Array.isArray(value)

/** How far inside the shore water life settles: lilies float clear of the bank, reeds stand in the shallows. */
const intoWater = (kind: string) => kind === 'lily' ? 0.14 : kind === 'reed' ? 0.05 : swimmingClearance(kind) + 0.06

export function adoptPouredJar(world: World, substrate: SavedSubstrate): World {
  const envelope = JSON.parse(serializeSave({ ...world, substrate })) as Source
  const source = envelope.world as Source
  setPondShape(substrate)
  for (const key of ['plants', 'creatures', 'remains']) {
    const items = source[key]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      if (!isRecord(item) || typeof item.x !== 'number' || typeof item.z !== 'number') continue
      const kind = typeof item.kind === 'string' ? item.kind : 'grazer'
      const x = item.x, z = item.z
      if (isAquatic(kind)) {
        const fits = key === 'creatures' ? isSwimmingPosition(kind, x, z) : isPondPosition(x, z)
        if (fits) continue
        const point = pushToShore(x, z, -intoWater(kind))
        item.x = point.x; item.z = point.z
      } else if (!isLand(x, z)) {
        const point = settleOnLand(x, z, key === 'creatures' ? 0.05 : 0.02)
        item.x = point.x; item.z = point.z
      }
    }
  }
  if (isRecord(source.colony)) moveColony(source.colony, source.soil, (nodes) => !nodes.every((node) => isLand(node.x as number, node.z as number, 0.26)))
  return parseSave(JSON.stringify(envelope))
}
