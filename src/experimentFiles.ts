import { parseSave } from './sim/saves.ts'
import type { World } from './sim/ecosystem'

export const maxWorldFileBytes = 200_000

export async function readWorldFile(file: Pick<File, 'size' | 'text'>): Promise<World> {
  if (file.size > maxWorldFileBytes) throw new Error('This file is too large. Choose an ECOSPHERE world under 200 KB.')
  return parseSave(await file.text())
}

export function worldFileName(world: Pick<World, 'tick'>) {
  return `ecosphere-day-${Math.floor(world.tick / 24) + 1}-${String(world.tick % 24).padStart(2, '0')}00.json`
}
