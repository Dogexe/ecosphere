import { creatureCounts, creatureLimits, isCreatureKind, isLand } from './ecosystem.ts'
import type { Creature, Plant, PlantKind, SoilPatch, World } from './ecosystem'
import { defaultClimate, defaultPond, isAquatic, isPondPosition, maturity } from './pond.ts'
import { woodlouseLife } from './life.ts'
import type { Remains, WoodlouseLife } from './life'
import { parseColony } from './colonySave.ts'
import { movePondPocket, settleOutOfWidePond } from './widePond.ts'
import { loadSubstrate, saveSubstrate } from './substrate.ts'
import type { Seal } from './seal'
import { startingCO2, startingO2 } from './seal.ts'

const damaged = () => new Error('This experiment is incomplete or damaged.')

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw damaged()
  return value as Record<string, unknown>
}

function number(source: Record<string, unknown>, key: string, min: number, max: number, integer = false): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw damaged()
  return value
}

function array(source: Record<string, unknown>, key: string, max: number): unknown[] {
  const value = source[key]
  if (!Array.isArray(value) || value.length > max) throw damaged()
  return value
}

function unique(items: { id: number }[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw damaged()
}

function optionalId(source: Record<string, unknown>, key: string): number | null {
  return source[key] === undefined || source[key] === null ? null : number(source, key, 0, 1e9, true)
}

export function serializeSave(world: World): string {
  return JSON.stringify({ version: 3, world: { ...world, colony: world.colony ?? null, climate: world.climate ?? defaultClimate(), pond: world.pond ?? defaultPond(), creatures: world.creatures.map((creature) => ({ ...creature, age: creature.age ?? maturity[creature.kind ?? 'grazer'], stage: creature.stage ?? 'adult', materialReserve: creature.materialReserve ?? 0 })) } })
}

/**
 * Reads a save. A world written before the pond grew is read a second time
 * with its flooded land moved onto the bank (see widePond.ts); anything that
 * is still invalid after that is rejected as before.
 */
export function parseSave(text: string): World {
  try { return parseWorld(text, false) } catch (error) {
    try { return parseWorld(text, true) } catch { throw error }
  }
}

function parseWorld(text: string, settle: boolean): World {
  if (text.length > 200_000) throw damaged()
  let decoded: unknown
  try { decoded = JSON.parse(text) } catch { throw damaged() }
  const envelope = record(decoded)
  if (envelope.version !== 1 && envelope.version !== 2 && envelope.version !== 3) throw new Error('This experiment uses an unsupported save version.')
  const source = settle ? settleOutOfWidePond(record(envelope.world)) : record(envelope.world)
  const soil = movePondPocket(array(source, 'soil', 4).map((value): SoilPatch => {
    const patch = record(value)
    return {
      id: number(patch, 'id', 0, 3, true), x: number(patch, 'x', -3.15, 3.15), z: number(patch, 'z', -3.15, 3.15),
      water: number(patch, 'water', 0, 100), nutrients: number(patch, 'nutrients', 0, 1e9),
      organic: number(patch, 'organic', 0, 1e9), fungi: number(patch, 'fungi', 0, 1e9),
    }
  }))
  if (soil.length !== 4) throw damaged()
  unique(soil)
  const plants = array(source, 'plants', 32).map((value): Plant => {
    const plant = record(value)
    if (typeof plant.kind !== 'string' || !['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed'].includes(plant.kind)) throw damaged()
    const result = {
      id: number(plant, 'id', 0, 1e9, true), kind: plant.kind as PlantKind,
      x: number(plant, 'x', -3.7, 3.7), z: number(plant, 'z', -3.7, 3.7),
      biomass: number(plant, 'biomass', 0, 100), capacity: number(plant, 'capacity', 0.01, 100),
      age: plant.age === undefined ? 90 : number(plant, 'age', 0, 1e9, true),
      development: plant.development === undefined ? 90 : number(plant, 'development', 0, 1e9),
      parentId: optionalId(plant, 'parentId'),
      lastReproduction: plant.lastReproduction === undefined ? -1 : number(plant, 'lastReproduction', -1, 1e9, true),
    }
    if (result.biomass > result.capacity || !(isAquatic(result.kind) ? isPondPosition(result.x, result.z) : isLand(result.x, result.z))) throw damaged()
    return result
  })
  unique(plants)
  const creatures = array(source, 'creatures', Object.values(creatureLimits).reduce((sum, limit) => sum + limit, 0)).map((value): Creature => {
    const creature = record(value)
    const kind = creature.kind === undefined ? 'grazer' : creature.kind
    if (typeof kind !== 'string' || !isCreatureKind(kind)) throw damaged()
    const result = {
      id: number(creature, 'id', 0, 1e9, true), kind, x: number(creature, 'x', -3.7, 3.7), z: number(creature, 'z', -3.7, 3.7),
      energy: number(creature, 'energy', 0, 100), heading: number(creature, 'heading', -1e12, 1e12),
      age: envelope.version === 1 ? maturity[kind] : number(creature, 'age', 0, 1e9, true),
      stage: envelope.version === 1 ? 'adult' as const : creature.stage as 'adult' | 'juvenile',
      materialReserve: envelope.version === 1 ? 0 : number(creature, 'materialReserve', 0, 1e9),
    }
    if (kind === 'woodlouse') {
      const lifeSource = creature.life === undefined ? null : record(creature.life)
      let life = woodlouseLife(result)
      if (lifeSource) {
        if (!['male', 'female'].includes(lifeSource.sex as string) || !['foraging', 'feeding', 'resting', 'courting', 'brooding', 'rehydrating', 'fleeing'].includes(lifeSource.activity as string)) throw damaged()
        life = { mass: number(lifeSource, 'mass', 0.001, 0.220001), hydration: number(lifeSource, 'hydration', 0, 100), sex: lifeSource.sex as 'male' | 'female', partnerId: optionalId(lifeSource, 'partnerId'), courtship: number(lifeSource, 'courtship', 0, 1e9, true), gestation: number(lifeSource, 'gestation', 0, 24, true), brood: number(lifeSource, 'brood', 0, 0.110001), gut: lifeSource.gut === undefined ? 0 : number(lifeSource, 'gut', 0, 0.130001), parentId: optionalId(lifeSource, 'parentId'), activity: lifeSource.activity as WoodlouseLife['activity'] }
        if (life.partnerId === result.id || (life.sex === 'male' && life.brood > 0)) throw damaged()
      }
      ;(result as Creature).life = life
    } else if (creature.life !== undefined) throw damaged()
    if (!['juvenile', 'adult'].includes(result.stage) || result.stage !== (result.age >= maturity[kind] && (kind !== 'woodlouse' || (result as Creature).life!.mass >= 0.2) ? 'adult' : 'juvenile')) throw damaged()
    if (result.materialReserve > (kind === 'fish' ? 0.48 : 0)) throw damaged()
    if (!(isAquatic(kind) ? isPondPosition(result.x, result.z) : isLand(result.x, result.z))) throw damaged()
    return result
  })
  unique(creatures)
  const populations = creatureCounts(creatures)
  if (Object.entries(creatureLimits).some(([kind, limit]) => populations[kind as keyof typeof creatureLimits] > limit)) throw damaged()
  for (const key of ['water', 'nutrients', 'organic']) number(source, key, 0, key === 'water' ? 100 : 1e9)
  const mean = (key: 'water' | 'nutrients' | 'organic') => soil.reduce((sum, patch) => sum + patch[key], 0) / soil.length
  let climate = defaultClimate()
  let pond = defaultPond()
  if (envelope.version !== 1) {
    const climateSource = record(source.climate)
    climate = { temperatureC: number(climateSource, 'temperatureC', 0, 40), rainfall: number(climateSource, 'rainfall', 0, 1) }
    if (climateSource.photoperiod !== undefined) {
      if (typeof climateSource.photoperiod !== 'boolean') throw damaged()
      climate.photoperiod = climateSource.photoperiod
    }
    const pondSource = record(source.pond)
    pond = { water: number(pondSource, 'water', 0, 100), nutrients: number(pondSource, 'nutrients', 0, 1e9), organic: number(pondSource, 'organic', 0, 1e9), oxygen: number(pondSource, 'oxygen', 0, 100), algae: number(pondSource, 'algae', 0, 1e9) }
    if (pond.oxygen > pond.water) throw damaged()
  }
  const remains = (source.remains === undefined ? [] : array(source, 'remains', 300)).map((value): Remains => {
    const item = record(value)
    if (typeof item.kind !== 'string' || !['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed', 'grazer', 'woodlouse', 'springtail', 'beetle', 'flea', 'fish', ...(envelope.version === 3 ? ['ant'] : [])].includes(item.kind)) throw damaged()
    const result: Remains = { id: number(item, 'id', 0, 1e9, true), kind: item.kind as Remains['kind'], x: number(item, 'x', -3.7, 3.7), z: number(item, 'z', -3.7, 3.7), material: number(item, 'material', 0, 1e9), initial: number(item, 'initial', 0, 1e9), age: number(item, 'age', 0, 1e9, true), patchId: number(item, 'patchId', 0, 4, true) }
    if (item.ant !== undefined) {
      if (envelope.version !== 3 || item.kind !== 'ant') throw damaged()
      const ant = record(item.ant), form = ant.form
      if (!['queen', 'worker', 'egg', 'larva', 'pupa'].includes(form as string)) throw damaged()
      const count = number(ant, 'count', 1, form === 'queen' || form === 'worker' ? 1 : 4, true)
      const sourceId = number(ant, 'sourceId', form === 'worker' ? 1 : 0, form === 'queen' ? 0 : 1e9, true)
      const body = number(ant, 'body', 0.0000001, form === 'queen' ? 0.3 : form === 'egg' ? 0.004001 : 0.040001)
      if (body * count > result.initial + 1e-8) throw damaged()
      result.ant = { sourceId, form: form as NonNullable<Remains['ant']>['form'], count, body, y: number(ant, 'y', -1.85, 0.045) }
    }
    if (result.material > result.initial || (isAquatic(result.kind) ? result.patchId !== 4 || !isPondPosition(result.x, result.z) : result.patchId === 4 || !isLand(result.x, result.z))) throw damaged()
    return result
  })
  unique(remains)
  const nextCreatureId = Math.max(0, ...creatures.map((creature) => creature.id + 1))
  const nextPlantId = Math.max(0, ...plants.map((plant) => plant.id + 1))
  const storedNextCreatureId = source.nextCreatureId === undefined ? nextCreatureId : number(source, 'nextCreatureId', nextCreatureId, 1e9, true)
  const storedNextPlantId = source.nextPlantId === undefined ? nextPlantId : number(source, 'nextPlantId', nextPlantId, 1e9, true)
  if (envelope.version !== 3 && source.colony != null) throw damaged()
  const colony = envelope.version === 3 ? parseColony(source.colony, plants, soil) : null
  const tick = number(source, 'tick', 0, 1e9, true)
  let sealed: Seal | null = null
  if (source.sealed !== undefined && source.sealed !== null) {
    // Optional Seal Mode state (2026-11-03); older saves simply have none.
    if (envelope.version !== 3) throw damaged()
    const seal = record(source.sealed)
    // Jar air and airings joined later the same day; default to fresh air.
    const optional = (key: string, fallback: number, min: number, max: number, integer = false) => seal[key] === undefined ? fallback : number(seal, key, min, max, integer)
    sealed = { since: number(seal, 'since', 0, tick, true), goalDays: number(seal, 'goalDays', 1, 365, true), vapor: number(seal, 'vapor', -1e-6, 1e6), co2: optional('co2', startingCO2, -1e3, 1e6), o2: optional('o2', startingO2, -1e3, 1e6), airings: optional('airings', 0, 0, 1e6, true) }
    if (climate.rainfall !== 0) throw damaged()
  }
  // Optional built substrate (2026-11-03); worlds made from a habitat starter have none.
  if (source.substrate != null && envelope.version !== 3) throw damaged()
  const substrate = source.substrate == null ? null : saveSubstrate(loadSubstrate(source.substrate))
  return {
    tick, seed: number(source, 'seed', 0, 4294967295, true),
    light: number(source, 'light', 0.15, 1), grazed: number(source, 'grazed', 0, 1e12),
    water: mean('water'), nutrients: mean('nutrients'), organic: mean('organic'), soil, plants, creatures, climate, pond, remains, nextCreatureId: storedNextCreatureId, nextPlantId: storedNextPlantId, ...(colony ? { colony } : {}), ...(sealed ? { sealed } : {}), ...(substrate ? { substrate } : {}),
  }
}
