import type { Plant, SoilPatch, World } from './ecosystem'
import { isLand, isLandSegment, walkOnLand } from './land.ts'
import { addRemains, plantStage } from './life.ts'
import { environmentAt } from './climate.ts'
import { rateAt } from './pond.ts'
import { excavationSite, nestCrowded, planExcavation, workExcavation } from './excavation.ts'

export const antLimits = { workers: 16, cohorts: 8, nodes: 12, edges: 20, surfaceClearance: 0.08 } as const
export type NestNode = { id: number; x: number; y: number; z: number; role: 'entrance' | 'junction' | 'food' | 'brood' | 'queen' | 'rest' }
export type NestDig = { from: number; target: NestNode; work: number }
export type NestConstruction = { enabled: boolean; removed: number; job: NestDig | null }
export type AntLocation = { kind: 'surface'; x: number; z: number; heading: number }
  | { kind: 'nest'; from: number; to: number; progress: number; offset?: { x: number; y: number; z: number } }
export type Ant = {
  id: number; caste: 'queen' | 'worker'; stage: 'teneral' | 'adult'; age: number
  body: number; gut: number; energy: number; hydration: number; carried: number
  activity: 'foraging' | 'carrying' | 'entering' | 'depositing' | 'feeding' | 'nursing' | 'resting' | 'brooding' | 'rehydrating' | 'excavating'
  goal: { kind: 'plant' | 'chamber'; id: number } | null
  location: AntLocation
}
export type AntBrood = { id: number; count: number; stage: 'egg' | 'larva' | 'pupa'; age: number; material: number; parentId: number }
export type AntLedger = { introduced: number; harvested: number; metabolized: number; soilReturn: number; remains: number; exported: number }
export type AntColony = {
  entrance: { x: number; z: number }; patchId: number
  nodes: NestNode[]; edges: [number, number][]
  queen: Ant | null; workers: Ant[]; brood: AntBrood[]; food: number
  nextAntId: number; nextBroodId: number; ledger: AntLedger
  construction?: NestConstruction
}
export type AntEvent = { type: 'ant'; action: 'harvest' | 'delivery' | 'feeding' | 'nursing' | 'egg' | 'hatch' | 'pupate' | 'birth' | 'death' | 'excavation' | 'chamber'; id: number; amount: number; broodId?: number }

export const nestTunnelRadius = 0.085
export const nestChamberRadius = (node: NestNode) => node.role === 'queen' ? 0.20 : node.role === 'brood' || node.role === 'food' || node.role === 'rest' ? 0.17 : 0.085
export const antContactRadius = (ant: Pick<Ant, 'caste'>) => ant.caste === 'queen' ? 0.085 : 0.04
// Soil stocks belong to four surface columns, not an extra reservoir per room.
export const antSoilAt = (soil: readonly SoilPatch[], position: { x: number; z: number }) => soil.reduce((best, next) => Math.hypot(next.x - position.x, next.z - position.z) < Math.hypot(best.x - position.x, best.z - position.z) ? next : best)
export function antOffsetLimit(colony: Pick<AntColony, 'nodes'>, ant: Ant) {
  if (ant.location.kind !== 'nest') return 0
  const location = ant.location
  const radius = location.from === location.to ? nestChamberRadius(colony.nodes.find((node) => node.id === location.from)!) : nestTunnelRadius
  return radius - antContactRadius(ant)
}
function copyAnt(ant: Ant): Ant {
  return { ...ant, goal: ant.goal ? { ...ant.goal } : null, location: ant.location.kind === 'nest'
    ? { ...ant.location, ...(ant.location.offset ? { offset: { ...ant.location.offset } } : {}) } : { ...ant.location } }
}

export function nestContains(colony: Pick<AntColony, 'nodes' | 'edges'>, p: { x: number; y: number; z: number }, radius: number) {
  if (p.y > 0.045 || !isLand(p.x, p.z, radius)) return false
  if (colony.nodes.some((node) => Math.hypot(p.x - node.x, p.y - node.y, p.z - node.z) <= nestChamberRadius(node) - radius + 1e-8)) return true
  return colony.edges.some(([aId, bId]) => {
    const a = colony.nodes.find((node) => node.id === aId)!, b = colony.nodes.find((node) => node.id === bId)!
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / (dx * dx + dy * dy + dz * dz)))
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t, p.z - a.z - dz * t) <= nestTunnelRadius - radius + 1e-8
  })
}

export function antMaterial(colony: AntColony): number {
  return colony.food + [colony.queen, ...colony.workers].reduce((sum, ant) => sum + (ant ? ant.body + ant.gut + ant.carried : 0), 0)
    + colony.brood.reduce((sum, cohort) => sum + cohort.material, 0)
}

export function antMaterialError(colony: AntColony): number {
  const ledger = colony.ledger
  return ledger.introduced + ledger.harvested - antMaterial(colony)
    - ledger.metabolized - ledger.soilReturn - ledger.remains - ledger.exported
}

export function antPosition(colony: Pick<AntColony, 'nodes'>, ant: Ant): { x: number; y: number; z: number } {
  if (ant.location.kind === 'surface') return { x: ant.location.x, y: 0.045, z: ant.location.z }
  const location = ant.location
  const a = colony.nodes.find((node) => node.id === location.from)!
  const b = colony.nodes.find((node) => node.id === location.to)!
  return { x: a.x + (b.x - a.x) * location.progress + (location.offset?.x ?? 0), y: a.y + (b.y - a.y) * location.progress + (location.offset?.y ?? 0), z: a.z + (b.z - a.z) * location.progress + (location.offset?.z ?? 0) }
}

export function resolveAntContacts(source: AntColony, allowance?: ReadonlyMap<number, number>): AntColony {
  const colony = { ...source, queen: source.queen ? copyAnt(source.queen) : null, workers: source.workers.map(copyAnt) }
  const ants = [colony.queen, ...colony.workers].filter((ant): ant is Ant => !!ant && ant.location.kind === 'nest').sort((a, b) => a.id - b.id)
  const budget = new Map(ants.map((ant) => [ant.id, ant.caste === 'queen' ? 0 : Math.min(0.04, allowance?.get(ant.id) ?? 0.04)]))
  function move(ant: Ant, dx: number, dy: number, dz: number, wanted: number) {
    if (ant.location.kind !== 'nest') return 0
    const amount = Math.min(wanted, budget.get(ant.id)!), p = antPosition(colony, ant)
    const old = ant.location.offset ?? { x: 0, y: 0, z: 0 }
    const offset = { x: old.x + dx * amount, y: old.y + dy * amount, z: old.z + dz * amount }
    if (amount <= 0 || Math.hypot(offset.x, offset.y, offset.z) > antOffsetLimit(colony, ant) + 1e-9 || !isLandSegment(p.x, p.z, p.x + dx * amount, p.z + dz * amount, antContactRadius(ant)) || !nestContains(colony, { x: p.x + dx * amount, y: p.y + dy * amount, z: p.z + dz * amount }, antContactRadius(ant))) return 0
    ant.location.offset = offset; budget.set(ant.id, budget.get(ant.id)! - amount)
    return amount
  }
  for (let sweep = 0; sweep < 6; sweep++) for (let i = 0; i < ants.length; i++) for (let j = i + 1; j < ants.length; j++) {
    const a = ants[i], b = ants[j], pa = antPosition(colony, a), pb = antPosition(colony, b)
    let dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z
    const distance = Math.hypot(dx, dy, dz), missing = antContactRadius(a) + antContactRadius(b) - distance
    if (missing <= 1e-8) continue
    if (distance > 1e-8) { dx /= distance; dy /= distance; dz /= distance }
    else {
      const origin = colony.nodes[0], far = colony.nodes.find((node) => Math.hypot(node.x - origin.x, node.z - origin.z) > 0.01)
      const length = far ? Math.hypot(far.x - origin.x, far.z - origin.z) : 1
      const angle = (a.id + b.id) * 2.399
      dx = (far ? (far.x - origin.x) / length : 1) * Math.cos(angle)
      dy = Math.sin(angle); dz = (far ? (far.z - origin.z) / length : 0) * Math.cos(angle)
    }
    const first = move(a, -dx, -dy, -dz, missing / 2)
    const second = move(b, dx, dy, dz, missing - first)
    if (first + second < missing) move(a, -dx, -dy, -dz, missing - first - second)
  }
  return colony
}

export function nestRoute(colony: AntColony, from: number, to: number): number[] {
  const queue = [[from]], visited = new Set([from])
  while (queue.length) {
    const route = queue.shift()!, end = route[route.length - 1]
    if (end === to) return route
    const neighbors = colony.edges.flatMap(([a, b]) => a === end ? [b] : b === end ? [a] : []).sort((a, b) => a - b)
    for (const next of neighbors) if (!visited.has(next)) { visited.add(next); queue.push([...route, next]) }
  }
  return []
}

// Mutates only the caller's cloned actor, using actual connected edge lengths.
export function advanceInNest(colony: AntColony, ant: Ant, goal: number, stride: number, centerAtGoal = false): number {
  if (ant.location.kind !== 'nest') return 0
  let traveled = 0
  if (ant.location.offset && (centerAtGoal || !(ant.location.from === goal && ant.location.to === goal))) {
    const offset = ant.location.offset, length = Math.hypot(offset.x, offset.y, offset.z)
    const distance = Math.min(stride, length)
    if (length > 1e-9) {
      const factor = Math.max(0, 1 - distance / length)
      ant.location.offset = { x: offset.x * factor, y: offset.y * factor, z: offset.z * factor }
      traveled += distance; stride -= distance
    }
    if (length <= distance + 1e-9) delete ant.location.offset
  }
  for (let transition = 0; transition < antLimits.nodes && stride > 1e-9; transition++) {
    const location = ant.location as Extract<AntLocation, { kind: 'nest' }>
    if (location.from === location.to) {
      if (location.from === goal) break
      const route = nestRoute(colony, location.from, goal)
      if (route.length < 2) break
      ant.location = { kind: 'nest', from: route[0], to: route[1], progress: 0 }
    }
    const current = ant.location as Extract<AntLocation, { kind: 'nest' }>
    const a = colony.nodes.find((node) => node.id === current.from)!, b = colony.nodes.find((node) => node.id === current.to)!
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const distance = Math.min(stride, (1 - current.progress) * length)
    current.progress = Math.min(1, current.progress + distance / length)
    stride -= distance; traveled += distance
    if (current.progress >= 1 - 1e-9) ant.location = { kind: 'nest', from: current.to, to: current.to, progress: 0 }
  }
  return traveled
}

export function colonyPlacementIssue(world: World, x: number, z: number): string | null {
  if (world.colony) return 'This world already has an ant colony. Export it before introducing another.'
  if (!isLand(x, z, 0.18)) return 'Choose dry ground with room for the nest entrance.'
  return makeNest(x, z) ? null : 'Leave a little more land around the underground chambers.'
}

function makeNest(x: number, z: number): { nodes: NestNode[]; edges: [number, number][] } | null {
  const layout: [number, number, number, NestNode['role']][] = [[0, 0.045, 0, 'entrance'], [0, -0.16, 0, 'junction'], [0.06, -0.34, 0, 'junction'], [0.32, -0.39, -0.21909, 'food'], [-0.20, -0.44, 0.18655, 'brood'], [-0.395, -0.54, 0.04666, 'queen']]
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]]
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = attempt * Math.PI / 4
    const nodes = layout.map(([dx, y, dz, role], id) => ({ id, x: x + Math.cos(angle) * dx - Math.sin(angle) * dz, y, z: z + Math.sin(angle) * dx + Math.cos(angle) * dz, role }))
    if (nodes.every((node) => isLand(node.x, node.z, 0.12)) && edges.every(([a, b]) => isLandSegment(nodes[a].x, nodes[a].z, nodes[b].x, nodes[b].z, 0.12))) return { nodes, edges }
  }
  return null
}

export function introduceColony(world: World, x: number, z: number): World {
  if (colonyPlacementIssue(world, x, z)) return world
  const nest = makeNest(x, z)!
  const patch = world.soil.reduce((best, next) => Math.hypot(next.x - x, next.z - z) < Math.hypot(best.x - x, best.z - z) ? next : best)
  const actor = (id: number, caste: Ant['caste'], node: number): Ant => ({
    id, caste, stage: 'adult', age: caste === 'queen' ? 120 : 48,
    body: caste === 'queen' ? 0.22 : 0.04, gut: caste === 'queen' ? 0.02 : 0.006,
    energy: 68, hydration: 80, carried: 0, activity: caste === 'queen' ? 'brooding' : 'resting', goal: null,
    location: { kind: 'nest', from: node, to: node, progress: 0 },
  })
  const colony: AntColony = { entrance: { x, z }, patchId: patch.id, ...nest,
    queen: actor(0, 'queen', 5), workers: [actor(1, 'worker', 3), actor(2, 'worker', 1), actor(3, 'worker', 2), actor(4, 'worker', 4)],
    brood: [], food: 0.35, nextAntId: 5, nextBroodId: 0, construction: { enabled: true, removed: 0, job: null },
    ledger: { introduced: 0, harvested: 0, metabolized: 0, soilReturn: 0, remains: 0, exported: 0 } }
  colony.ledger.introduced = antMaterial(colony)
  return { ...world, colony }
}

export function seedMaterialAvailable(plant: Plant): number {
  if (!['clover', 'grass', 'bloom'].includes(plant.kind) || !['mature', 'senescent'].includes(plantStage(plant))) return 0
  // Aggregate seed-bearing material within producer biomass, not a new pool.
  return Math.max(0, plant.biomass - plant.capacity * 0.7)
}

export function antFoodSources(plants: Plant[], x: number, z: number): Plant[] {
  return plants.filter((plant) => seedMaterialAvailable(plant) > 0.00001 && Math.hypot(plant.x - x, plant.z - z) <= 2.8)
}

export function clearMissingAntGoals(colony: AntColony, plants: Plant[]): AntColony {
  const valid = (ant: Ant) => ant.goal?.kind !== 'plant' || plants.some((plant) => plant.id === ant.goal!.id)
  if (colony.workers.every(valid)) return colony
  return { ...colony, workers: colony.workers.map((ant) => valid(ant) ? ant : { ...ant, goal: null }) }
}

export function exportColony(world: World): { world: World; exported: number; ledger: AntLedger | null } {
  if (!world.colony) return { world, exported: 0, ledger: null }
  const exported = antMaterial(world.colony)
  const ledger = { ...world.colony.ledger, exported: world.colony.ledger.exported + exported }
  const { colony: _colony, ...withoutColony } = world
  return { world: withoutColony, exported, ledger }
}

export function stepAntColony(world: World, forcing = environmentAt(world)): { world: World; events: AntEvent[] } {
  if (!world.colony) return { world, events: [] }
  const source = clearMissingAntGoals(world.colony, world.plants)
  const colony: AntColony = { ...source, queen: source.queen ? copyAnt(source.queen) : null,
    workers: source.workers.map(copyAnt), brood: source.brood.map((cohort) => ({ ...cohort })), ledger: { ...source.ledger },
    ...(source.construction ? { construction: { ...source.construction, job: source.construction.job ? { ...source.construction.job, target: { ...source.construction.job.target } } : null } } : {}) }
  const soil = world.soil.map((patch) => ({ ...patch })), plants = world.plants.map((plant) => ({ ...plant }))
  const remains = world.remains.map((item) => ({ ...item })), events: AntEvent[] = []
  const node = (role: NestNode['role']) => colony.nodes.find((item) => item.role === role)!.id
  const entry = node('entrance'), food = node('food'), broodRoom = node('brood'), queenRoom = node('queen')
  const at = (ant: Ant, id: number) => ant.location.kind === 'nest' && ant.location.from === id && ant.location.to === id
  const nearest = (x: number, z: number) => antSoilAt(soil, { x, z })
  const nursery = colony.nodes.find((item) => item.id === broodRoom)!, queenChamber = colony.nodes.find((item) => item.id === queenRoom)!, granary = colony.nodes.find((item) => item.id === food)!
  const nurserySoil = antSoilAt(soil, nursery), granarySoil = antSoilAt(soil, granary)
  const temperature = 20 + (forcing.temperatureC - 20) * 0.4
  const rate = rateAt(temperature)
  function soilReturn(amount: number, mineralFraction: number, x: number, z: number) {
    const patch = nearest(x, z)
    patch.organic += amount * (1 - mineralFraction)
    patch.nutrients += amount * mineralFraction
    colony.ledger.soilReturn += amount
  }
  function die(ant: Ant) {
    const position = antPosition(colony, ant), material = ant.body + ant.gut + ant.carried
    const patch = nearest(position.x, position.z)
    addRemains(remains, 'ant', position.x, position.z, material, patch.id, { sourceId: ant.id, form: ant.caste, count: 1, body: ant.body, y: position.y })
    patch.water = Math.min(100, patch.water + ant.hydration / 100 * ant.body * 0.4)
    colony.ledger.remains += material
    events.push({ type: 'ant', action: 'death', id: ant.id, amount: material })
  }
  function maintain(ant: Ant): boolean {
    ant.age++
    if (ant.caste === 'worker') ant.stage = ant.age < 24 ? 'teneral' : 'adult'
    const position = antPosition(colony, ant), patch = nearest(position.x, position.z)
    if (ant.caste === 'worker' && ant.energy < 25 && ant.gut < 0.001 && ant.carried > 0) {
      const meal = Math.min(0.006, ant.carried, 0.012 - ant.gut)
      ant.carried -= meal; ant.gut += meal
      events.push({ type: 'ant', action: 'feeding', id: ant.id, amount: meal })
    }
    const localRate = ant.location.kind === 'nest' ? rate : rateAt(forcing.temperatureC)
    ant.energy -= (ant.caste === 'queen' ? 0.17 : ant.activity === 'resting' ? 0.06 : 0.12) * localRate
    const digested = Math.min(ant.gut, (ant.caste === 'queen' ? 0.0006 : 0.0008) * localRate, Math.max(0, (90 - ant.energy) / 600))
    ant.gut -= digested; ant.energy += digested * 600
    colony.ledger.metabolized += digested * 0.55
    soilReturn(digested * 0.45, 2 / 9, position.x, position.z)
    ant.hydration = Math.max(0, ant.hydration - (0.22 + Math.max(0, 1 - patch.water / 55) * 0.7) * localRate)
    const gain = Math.min(100 - ant.hydration, Math.max(0, (patch.water - 8) / 55) * 3)
    const water = Math.min(patch.water, gain / 100 * ant.body * 0.4)
    patch.water -= water; ant.hydration += water / (ant.body * 0.4) * 100
    if (ant.energy <= 0 || ant.hydration <= 0 || ant.age >= (ant.caste === 'queen' ? 10000 : 1200)) { die(ant); return false }
    return true
  }
  if (colony.queen && !maintain(colony.queen)) colony.queen = null
  colony.workers = colony.workers.filter(maintain)
  // A lone survivor can care while food is stored, then forage when it runs out.
  const availableNurses = colony.workers.length === 1 && colony.food > 0.002 ? 1 : Math.max(0, colony.workers.length - 1)
  const nurseCount = Math.min(availableNurses, Math.max(1, Math.ceil(colony.brood.reduce((sum, cohort) => sum + cohort.count, 0) / 4)))
  const hungryLarvae = colony.brood.some((cohort) => cohort.stage === 'larva' && cohort.material < 0.039 * cohort.count)
  const needCare = hungryLarvae || !!colony.queen && colony.queen.gut < 0.012
  const readyToCare = (ant: Ant) => ant.stage === 'adult' && ant.energy >= 35 && ant.hydration >= 35
  // New carers need an actual stored meal to collect. Otherwise recalling an
  // unloaded forager just makes it bounce through an empty nest. Already
  // carried nursing deliveries retain their independent commitment below.
  const nurses = new Set(needCare && colony.food > 0.002 ? [...colony.workers].sort((a, b) => Number(readyToCare(b)) - Number(readyToCare(a)) || a.age - b.age || a.id - b.id).slice(0, nurseCount).map((ant) => ant.id) : [])
  planExcavation(colony, antSoilAt(soil, excavationSite(colony)).water, world.seed)
  const digWater = antSoilAt(soil, excavationSite(colony)).water
  const builder = colony.construction?.enabled && colony.construction.job && colony.queen && colony.workers.length >= 3 && nestCrowded(colony) && colony.food > 0.12 && digWater > 20 && digWater < 88
    ? [...colony.workers].filter((ant) => !nurses.has(ant.id) && ant.stage === 'adult' && ant.carried === 0 && ant.energy > 50 && ant.hydration > 45).sort((a, b) => b.age - a.age || a.id - b.id)[0]?.id : undefined
  const contactAllowance = new Map<number, number>()
  const foodNeeded = 0.06 + colony.brood.filter((cohort) => cohort.stage === 'larva').reduce((sum, cohort) => sum + Math.max(0, 0.04 * cohort.count - cohort.material) / 0.75, 0)
  function travel(ant: Ant, destination: number, stride: number, center = false) {
    ant.goal = { kind: 'chamber', id: destination }
    const traveled = advanceInNest(colony, ant, destination, stride, center || destination === entry)
    ant.energy -= traveled * 0.7
    contactAllowance.set(ant.id, Math.max(0, 0.14 - traveled))
  }
  function deliver(ant: Ant) {
    const amount = Math.min(ant.carried, 10 - colony.food)
    colony.food += amount; ant.carried -= amount
    if (amount > 0) events.push({ type: 'ant', action: 'delivery', id: ant.id, amount })
    ant.activity = 'depositing'
  }
  for (const ant of colony.workers) {
    const stride = 0.14 * Math.max(0.35, Math.min(1, ant.energy / 25)) * (ant.carried > 0 ? 0.75 : 1)
    // Like the other functional groups, hungry adults can interrupt their
    // normal rest schedule. Teneral confinement and dangerous heat still win.
    const sleepy = ant.stage === 'teneral' || forcing.cycling && forcing.solar < 0.15 && ant.energy >= 25 && colony.food >= foodNeeded || forcing.temperatureC > 34
    if (ant.location.kind === 'surface') {
      const position = ant.location
      const returning = ant.carried > 0 || sleepy || nurses.has(ant.id) || ant.id === builder || ant.energy < 18 && colony.food > 0
      if (returning) {
        ant.activity = ant.carried > 0 ? 'carrying' : 'entering'; ant.goal = { kind: 'chamber', id: entry }
        const distance = Math.hypot(position.x - colony.entrance.x, position.z - colony.entrance.z)
        if (distance <= 0.025) ant.location = { kind: 'nest', from: entry, to: entry, progress: 0 }
        else {
          const moved = walkOnLand({ ...position, id: ant.id }, colony.entrance.x, colony.entrance.z, Math.min(stride, distance), antLimits.surfaceClearance)
          ant.location = { kind: 'surface', x: moved.x, z: moved.z, heading: moved.heading }; ant.energy -= moved.distance * 0.7
        }
      } else {
        ant.activity = 'foraging'
        let target = ant.goal?.kind === 'plant' ? plants.find((plant) => plant.id === ant.goal!.id && seedMaterialAvailable(plant) > 0.00001) : undefined
        target ??= antFoodSources(plants, position.x, position.z)
          .sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z) || a.id - b.id)[0]
        ant.goal = target ? { kind: 'plant', id: target.id } : null
        if (target && Math.hypot(target.x - position.x, target.z - position.z) <= 0.12) {
          const amount = Math.min(0.012 - ant.carried, seedMaterialAvailable(target))
          target.biomass -= amount; ant.carried += amount; colony.ledger.harvested += amount
          ant.activity = 'carrying'; ant.goal = { kind: 'chamber', id: entry }
          if (amount > 0) events.push({ type: 'ant', action: 'harvest', id: ant.id, amount })
        } else {
          const angle = ant.id * 2.399 + Math.floor(ant.age / 12) * 1.8 + world.seed / 4294967296 * Math.PI * 2
          const x = target?.x ?? position.x + Math.sin(angle), z = target?.z ?? position.z + Math.cos(angle)
          const reach = target ? Math.min(stride, Math.max(0, Math.hypot(x - position.x, z - position.z) - 0.1)) : Math.min(stride, 0.055)
          const moved = walkOnLand({ ...position, id: ant.id }, x, z, reach, antLimits.surfaceClearance)
          ant.location = { kind: 'surface', x: moved.x, z: moved.z, heading: moved.heading }; ant.energy -= moved.distance * 0.7
        }
      }
      continue
    }
    const queenUrgent = colony.queen && colony.queen.energy < 35 && colony.queen.gut < 0.004
    const queenNeeds = colony.queen && colony.queen.gut < 0.008 && (!hungryLarvae || colony.queen.energy < 55)
    if (ant.carried > 0 && ant.activity !== 'nursing' && colony.food <= 0.002 && readyToCare(ant) && (queenNeeds || hungryLarvae)) {
      // A returning forager already holds real food. In an empty nest it can
      // become the carer, rather than requiring a separate granary round trip.
      ant.activity = 'nursing'; ant.goal = { kind: 'chamber', id: queenUrgent || queenNeeds ? queenRoom : broodRoom }
    }
    if (ant.carried > 0 && ant.activity === 'nursing') {
      // Complete a real delivery rather than turning back whenever the
      // queen's gut crosses a small threshold. Reserve sets urgency; eggs
      // and pupae do not eat, and unused nursery meals return to storage.
      const committed = ant.goal?.kind === 'chamber' && !at(ant, ant.goal.id)
        && (ant.goal.id === queenRoom && colony.queen || ant.goal.id === broodRoom && hungryLarvae) ? ant.goal.id : null
      const destination = queenUrgent ? queenRoom : committed ?? (queenNeeds ? queenRoom : hungryLarvae ? broodRoom : food)
      travel(ant, destination, stride)
      if (at(ant, destination)) {
        if (destination === queenRoom && colony.queen) {
          const amount = Math.min(ant.carried, Math.max(0, 0.024 - colony.queen.gut))
          colony.queen.gut += amount; ant.carried -= amount
          if (amount > 0) {
            events.push({ type: 'ant', action: 'nursing', id: ant.id, amount })
            events.push({ type: 'ant', action: 'feeding', id: colony.queen.id, amount })
          }
        } else if (destination === broodRoom) {
          let nursingBudget = 0.0024 * rate
          for (const cohort of colony.brood.filter((cohort) => cohort.stage === 'larva').sort((a, b) => a.id - b.id)) {
            const amount = Math.min(ant.carried, nursingBudget, Math.max(0, (0.04 * cohort.count - cohort.material) / 0.75))
            ant.carried -= amount; cohort.material += amount * 0.75
            nursingBudget -= amount
            soilReturn(amount * 0.2, 0.25, nursery.x, nursery.z); colony.ledger.metabolized += amount * 0.05
            if (amount > 0) { ant.energy -= 0.05; events.push({ type: 'ant', action: 'nursing', id: ant.id, amount }) }
          }
        } else deliver(ant)
      }
    } else if (ant.carried > 0) {
      ant.activity = 'carrying'; travel(ant, food, stride)
      if (at(ant, food)) deliver(ant)
    } else if (ant.energy < 75 && ant.gut < 0.004 && colony.food > 0) {
      ant.activity = 'feeding'; travel(ant, food, stride)
      if (at(ant, food)) {
        const amount = Math.min(colony.food, 0.006, 0.012 - ant.gut)
        colony.food -= amount; ant.gut += amount
        if (amount > 0) events.push({ type: 'ant', action: 'feeding', id: ant.id, amount })
      }
    } else if (ant.energy < 35 && ant.gut > 0 && at(ant, food)) {
      // Recover from a real meal before another trip. Empty guts release
      // the worker to seek food; carried deliveries retain priority above.
      ant.activity = 'resting'; ant.goal = null
    } else if (nurses.has(ant.id) && colony.food > 0.002) {
      ant.activity = 'nursing'; travel(ant, food, stride)
      if (at(ant, food)) { const amount = Math.min(0.012, colony.food); colony.food -= amount; ant.carried = amount }
    } else if (ant.id === builder && !sleepy && colony.construction?.job) {
      const job = colony.construction.job
      const face = colony.nodes.some((item) => item.id === job.target.id) ? job.target.id : job.from
      ant.activity = 'excavating'; travel(ant, face, stride, true)
      if (at(ant, face)) {
        const result = workExcavation(colony, ant, digWater, rate, contactAllowance.get(ant.id) ?? 0)
        if (result.amount > 0) events.push({ type: 'ant', action: result.complete ? 'chamber' : 'excavation', id: ant.id, amount: result.amount })
        contactAllowance.set(ant.id, Math.max(0, (contactAllowance.get(ant.id) ?? 0) - result.distance))
      }
    } else if (sleepy || colony.food > 1.5) {
      const rest = ant.stage === 'teneral' ? broodRoom : colony.nodes.filter((item) => item.role === 'rest').sort((a, b) => a.id - b.id)[ant.id % Math.max(1, colony.nodes.filter((item) => item.role === 'rest').length)]?.id ?? food
      ant.activity = 'resting'; travel(ant, rest, stride)
      if (at(ant, rest)) ant.goal = null
    } else {
      ant.activity = 'foraging'; travel(ant, entry, stride)
      if (at(ant, entry) && ant.location.kind === 'nest' && !ant.location.offset) { ant.location = { kind: 'surface', x: colony.entrance.x, z: colony.entrance.z, heading: ant.id * 2.399 }; ant.goal = null }
    }
  }
  colony.workers = colony.workers.filter((ant) => { if (ant.energy > 0) return true; die(ant); return false })

  const nextBrood: AntBrood[] = []
  const moisture = Math.min(1, nurserySoil.water / 55)
  for (const cohort of colony.brood) {
    const loss = Math.min(cohort.material, cohort.material * (0.0005 + (1 - moisture) * 0.007) * rate)
    cohort.material -= loss; soilReturn(loss * 0.2, 0, nursery.x, nursery.z); colony.ledger.metabolized += loss * 0.8
    // Ontogeny continues in a suitable microclimate. Larval growth separately
    // requires an actual visiting nurse's carried material above.
    if (moisture > 0.25) cohort.age += rate
    if (cohort.material < 0.0002 * cohort.count) {
      const room = colony.nodes.find((item) => item.id === broodRoom)!
      addRemains(remains, 'ant', room.x, room.z, cohort.material, nearest(room.x, room.z).id, { sourceId: cohort.id, form: cohort.stage, count: cohort.count, body: cohort.material / cohort.count, y: room.y })
      colony.ledger.remains += cohort.material
      continue
    }
    if (cohort.stage === 'egg' && cohort.age >= 12) { cohort.stage = 'larva'; cohort.age = 0; events.push({ type: 'ant', action: 'hatch', id: cohort.id, amount: cohort.material }) }
    else if (cohort.stage === 'larva' && cohort.age >= 24 && cohort.material >= 0.039 * cohort.count) { cohort.stage = 'pupa'; cohort.age = 0; events.push({ type: 'ant', action: 'pupate', id: cohort.id, amount: cohort.material }) }
    else if (cohort.stage === 'pupa' && cohort.age >= 24 && colony.workers.length + cohort.count <= antLimits.workers) {
      for (let i = 0; i < cohort.count; i++) {
        const body = cohort.material / cohort.count, id = colony.nextAntId++
        const hydration = Math.min(80, nurserySoil.water)
        const bodyWater = Math.min(nurserySoil.water, hydration / 100 * body * 0.4)
        nurserySoil.water -= bodyWater
        colony.workers.push({ id, caste: 'worker', stage: 'teneral', age: 0, body, gut: 0, energy: Math.min(50, body * 600), hydration: bodyWater / (body * 0.4) * 100, carried: 0,
          activity: 'resting', goal: null, location: { kind: 'nest', from: broodRoom, to: broodRoom, progress: 0 } })
        events.push({ type: 'ant', action: 'birth', id, amount: body, broodId: cohort.id })
      }
      continue
    }
    nextBrood.push(cohort)
  }
  colony.brood = nextBrood
  const queen = colony.queen
  const committedFood = colony.brood.reduce((sum, cohort) => sum + (cohort.stage === 'pupa' ? 0 : Math.max(0, 0.04 * cohort.count - cohort.material) / 0.75), 0)
  // A strong queen may fund a single replacement egg from her own gut even
  // when food moves through the nest faster than it accumulates in storage.
  // Incoming carried food is a signal, not a reservation or a body grant.
  const replacement = queen && colony.brood.length === 0 && queen.energy >= 70 && queen.gut >= 0.015
    && colony.workers.filter(readyToCare).length >= 3 && colony.food + colony.workers.reduce((sum, ant) => sum + ant.carried, 0) >= 0.006
  if (queen && queen.age % 18 === 0 && queen.energy >= 50 && queen.gut >= 0.005 && (colony.food >= 0.06 + committedFood || replacement)
    && colony.brood.length < antLimits.cohorts && colony.workers.length + colony.brood.reduce((sum, cohort) => sum + cohort.count, 0) < antLimits.workers) {
    queen.gut -= 0.005; queen.energy -= 3
    soilReturn(0.00075, 0, queenChamber.x, queenChamber.z); colony.ledger.metabolized += 0.00025
    colony.brood.push({ id: colony.nextBroodId++, count: 1, stage: 'egg', age: 0, material: 0.004, parentId: queen.id })
    events.push({ type: 'ant', action: 'egg', id: queen.id, amount: 0.004 })
  }
  const spoiled = colony.food * (colony.workers.length ? 0.0004 : 0.002) * Math.min(1, granarySoil.water / 55) * rate
  colony.food -= spoiled; soilReturn(spoiled, 0, granary.x, granary.z)
  const mean = (key: 'water' | 'nutrients' | 'organic') => soil.reduce((sum, patch) => sum + patch[key], 0) / soil.length
  return { world: { ...world, colony: resolveAntContacts(colony, contactAllowance), soil, plants, remains, water: mean('water'), nutrients: mean('nutrients'), organic: mean('organic') }, events }
}
