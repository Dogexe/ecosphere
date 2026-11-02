import type { Plant, SoilPatch } from './ecosystem'
import { antContactRadius, antLimits, antMaterialError, antOffsetLimit, antPosition, nestContains, nestRoute } from './colony.ts'
import type { Ant, AntBrood, AntColony, AntLedger, AntLocation, NestNode } from './colony'
import { isLand, isLandSegment } from './land.ts'
import { digLength, digRequired, tunnelVolume } from './excavation.ts'

const damaged = () => new Error('This ant colony is incomplete or damaged.')
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw damaged()
  return value as Record<string, unknown>
}
function num(source: Record<string, unknown>, key: string, min: number, max: number, integer = false): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) throw damaged()
  return value
}
function list(source: Record<string, unknown>, key: string, max: number): unknown[] {
  const value = source[key]
  if (!Array.isArray(value) || value.length > max) throw damaged()
  return value
}
function unique(items: { id: number }[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw damaged()
}

export function parseColony(value: unknown, plants: Plant[], soil: SoilPatch[]): AntColony | null {
  if (value === null) return null
  const source = object(value)
  const entranceSource = object(source.entrance)
  const entrance = { x: num(entranceSource, 'x', -3.15, 3.15), z: num(entranceSource, 'z', -3.15, 3.15) }
  const nodes = list(source, 'nodes', antLimits.nodes).map((value): NestNode => {
    const node = object(value)
    if (!['entrance', 'junction', 'food', 'brood', 'queen', 'rest'].includes(node.role as string)) throw damaged()
    const result = { id: num(node, 'id', 0, 1e9, true), x: num(node, 'x', -3.15, 3.15), y: num(node, 'y', -1.65, 0.045), z: num(node, 'z', -3.15, 3.15), role: node.role as NestNode['role'] }
    if (!isLand(result.x, result.z, antLimits.surfaceClearance)) throw damaged()
    if (result.role === 'entrance' ? Math.abs(result.y - 0.045) > 1e-9 : result.y > -0.1) throw damaged()
    return result
  })
  unique(nodes)
  for (const role of ['entrance', 'food', 'brood', 'queen']) if (nodes.filter((node) => node.role === role).length !== 1) throw damaged()
  const entry = nodes.find((node) => node.role === 'entrance')!
  if (Math.hypot(entry.x - entrance.x, entry.z - entrance.z) > 1e-9) throw damaged()
  const edges = list(source, 'edges', antLimits.edges).map((value): [number, number] => {
    if (!Array.isArray(value) || value.length !== 2 || !value.every((id) => typeof id === 'number' && Number.isInteger(id))) throw damaged()
    const a = nodes.find((node) => node.id === value[0]), b = nodes.find((node) => node.id === value[1])
    if (!a || !b || a.id === b.id) throw damaged()
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (length < 0.02 || length > 1.5) throw damaged()
    if (!isLandSegment(a.x, a.z, b.x, b.z, antLimits.surfaceClearance)) throw damaged()
    return [a.id, b.id]
  })
  if (new Set(edges.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`)).size !== edges.length) throw damaged()
  const graph = { nodes, edges } as AntColony
  if (nodes.some((node) => nestRoute(graph, entry.id, node.id).length === 0)) throw damaged()
  const patchId = num(source, 'patchId', 0, 3, true)
  const nearest = soil.reduce((best, next) => Math.hypot(next.x - entrance.x, next.z - entrance.z) < Math.hypot(best.x - entrance.x, best.z - entrance.z) ? next : best)
  if (nearest.id !== patchId) throw damaged()

  function actor(value: unknown, caste: Ant['caste']): Ant {
    const ant = object(value)
    if (ant.caste !== caste || !['teneral', 'adult'].includes(ant.stage as string)
      || !['foraging', 'carrying', 'entering', 'depositing', 'feeding', 'nursing', 'resting', 'brooding', 'rehydrating', 'excavating'].includes(ant.activity as string)) throw damaged()
    const locationSource = object(ant.location)
    let location: AntLocation
    if (locationSource.kind === 'surface') {
      location = { kind: 'surface', x: num(locationSource, 'x', -3.15, 3.15), z: num(locationSource, 'z', -3.15, 3.15), heading: num(locationSource, 'heading', -1e12, 1e12) }
      if (caste === 'queen' || !isLand(location.x, location.z, antLimits.surfaceClearance)) throw damaged()
    } else if (locationSource.kind === 'nest') {
      const from = num(locationSource, 'from', 0, 1e9, true), to = num(locationSource, 'to', 0, 1e9, true)
      const progress = num(locationSource, 'progress', 0, 1)
      if (!nodes.some((node) => node.id === from) || !nodes.some((node) => node.id === to)
        || (from === to ? progress !== 0 : !edges.some(([a, b]) => a === from && b === to || b === from && a === to))) throw damaged()
      if (caste === 'queen' && (from !== to || nodes.find((node) => node.id === from)!.role !== 'queen')) throw damaged()
      location = { kind: 'nest', from, to, progress }
      if (locationSource.offset !== undefined) {
        const offset = object(locationSource.offset)
        location.offset = { x: num(offset, 'x', -0.18, 0.18), y: num(offset, 'y', -0.18, 0.18), z: num(offset, 'z', -0.18, 0.18) }
        if (caste === 'queen' || Math.hypot(location.offset.x, location.offset.y, location.offset.z) > 0.18000001) throw damaged()
      }
    } else throw damaged()
    let goal: Ant['goal'] = null
    if (caste === 'queen' && ant.goal !== null) throw damaged()
    if (ant.goal !== null) {
      const target = object(ant.goal), id = num(target, 'id', 0, 1e9, true)
      if (target.kind === 'plant' ? !plants.some((plant) => plant.id === id && ['clover', 'bloom', 'grass'].includes(plant.kind))
        : target.kind !== 'chamber' || !nodes.some((node) => node.id === id)) throw damaged()
      goal = { kind: target.kind as 'plant' | 'chamber', id }
    }
    const result: Ant = { id: num(ant, 'id', caste === 'queen' ? 0 : 1, caste === 'queen' ? 0 : 1e9, true), caste,
      stage: ant.stage as Ant['stage'], age: num(ant, 'age', 0, 1e9, true),
      body: num(ant, 'body', 0.0001, caste === 'queen' ? 0.3 : 0.040001), gut: num(ant, 'gut', 0, caste === 'queen' ? 0.030001 : 0.012001),
      energy: num(ant, 'energy', 0, 100), hydration: num(ant, 'hydration', 0, 100), carried: num(ant, 'carried', 0, caste === 'queen' ? 0 : 0.012001),
      activity: ant.activity as Ant['activity'], goal, location }
    if (caste === 'queen' && result.stage !== 'adult' || caste === 'worker' && result.stage !== (result.age < 24 ? 'teneral' : 'adult')) throw damaged()
    if (location.kind === 'nest') {
      const actual = antPosition({ nodes }, result)
      const anchor = antPosition({ nodes }, { ...result, location: { ...location, offset: undefined } })
      if (location.offset && Math.hypot(location.offset.x, location.offset.y, location.offset.z) > antOffsetLimit({ nodes }, result) + 1e-8) throw damaged()
      if (!nestContains({ nodes, edges }, actual, antContactRadius(result)) || !isLandSegment(anchor.x, anchor.z, actual.x, actual.z, antContactRadius(result))) throw damaged()
    }
    return result
  }

  const queen = source.queen === null ? null : actor(source.queen, 'queen')
  const workers = list(source, 'workers', antLimits.workers).map((value) => actor(value, 'worker'))
  unique(queen ? [queen, ...workers] : workers)
  const brood = list(source, 'brood', antLimits.cohorts).map((value): AntBrood => {
    const cohort = object(value)
    if (!['egg', 'larva', 'pupa'].includes(cohort.stage as string)) throw damaged()
    const count = num(cohort, 'count', 1, 4, true)
    return { id: num(cohort, 'id', 0, 1e9, true), count, stage: cohort.stage as AntBrood['stage'], age: num(cohort, 'age', 0, 1e9), material: num(cohort, 'material', 0.000001, 0.040001 * count), parentId: num(cohort, 'parentId', 0, 0, true) }
  })
  unique(brood)
  if (workers.length + brood.reduce((sum, cohort) => sum + cohort.count, 0) > antLimits.workers) throw damaged()
  const ledgerSource = object(source.ledger)
  const ledger = Object.fromEntries(['introduced', 'harvested', 'metabolized', 'soilReturn', 'remains', 'exported'].map((key) => [key, num(ledgerSource, key, 0, 1e9)])) as AntLedger
  const nextAnt = Math.max(1, ...workers.map((ant) => ant.id + 1))
  const nextBrood = Math.max(0, ...brood.map((cohort) => cohort.id + 1))
  const colony: AntColony = { entrance, patchId, nodes, edges, queen, workers, brood, ledger,
    food: num(source, 'food', 0, 10), nextAntId: num(source, 'nextAntId', nextAnt, 1e9, true), nextBroodId: num(source, 'nextBroodId', nextBrood, 1e9, true) }
  if (source.construction !== undefined) {
    const construction = object(source.construction)
    if (typeof construction.enabled !== 'boolean') throw damaged()
    colony.construction = { enabled: construction.enabled, removed: num(construction, 'removed', 0, 10), job: null }
    if (construction.job !== null) {
      const data = object(construction.job), targetSource = object(data.target)
      const target: NestNode = { id: num(targetSource, 'id', 1, 1e9, true), role: 'rest', x: num(targetSource, 'x', -3.15, 3.15), y: num(targetSource, 'y', -1.6, -0.1), z: num(targetSource, 'z', -3.15, 3.15) }
      const from = num(data, 'from', 0, 1e9, true), parent = nodes.find((node) => node.id === from)
      if (targetSource.role !== 'rest' || !parent || parent.id === target.id || parent.role === 'entrance' || !isLand(target.x, target.z, 0.25) || !isLandSegment(parent.x, parent.z, target.x, target.z, 0.12)) throw damaged()
      const job = { from, target, work: num(data, 'work', 0, 1) }, length = digLength(colony, job)
      if (length < 0.1 || length > 1 || job.work >= digRequired(colony, job) || job.work > colony.construction.removed + 1e-9) throw damaged()
      const tip = nodes.find((node) => node.id === target.id)
      if (!tip && (nodes.length >= antLimits.nodes || edges.length >= antLimits.edges)) throw damaged()
      if (job.work === 0 ? !!tip : !tip) throw damaged()
      if (tip) {
        const progress = Math.min(1, job.work / tunnelVolume(length))
        if (tip.role !== 'junction' || edges.filter(([a, b]) => a === tip.id || b === tip.id).length !== 1 || !edges.some(([a, b]) => a === from && b === tip.id || b === from && a === tip.id)
          || Math.hypot(tip.x - parent.x - (target.x - parent.x) * progress, tip.y - parent.y - (target.y - parent.y) * progress, tip.z - parent.z - (target.z - parent.z) * progress) > 1e-8) throw damaged()
      } else if (target.id <= Math.max(...nodes.map((node) => node.id))) throw damaged()
      colony.construction.job = job
    }
  }
  if (Math.abs(antMaterialError(colony)) > 1e-6) throw damaged()
  return colony
}
