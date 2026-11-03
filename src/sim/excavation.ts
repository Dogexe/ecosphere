import type { Ant, AntColony, NestDig, NestNode } from './colony'
import { antLimits, nestChamberRadius, nestTunnelRadius } from './colony.ts'
import { isLand, isLandSegment } from './land.ts'

export const digLength = (colony: Pick<AntColony, 'nodes'>, job: NestDig) => {
  const a = colony.nodes.find((node) => node.id === job.from)!
  return Math.hypot(job.target.x - a.x, job.target.y - a.y, job.target.z - a.z)
}
export const tunnelVolume = (length: number) => Math.PI * nestTunnelRadius ** 2 * length
export const chamberWork = () => 4 / 3 * Math.PI * (0.17 ** 3 - nestTunnelRadius ** 3)
export const digRequired = (colony: Pick<AntColony, 'nodes'>, job: NestDig) => tunnelVolume(digLength(colony, job)) + chamberWork()
export const nestCrowded = (colony: AntColony) => colony.workers.length + colony.brood.reduce((sum, cohort) => sum + cohort.count, 0) > 3 + colony.nodes.filter((node) => node.role === 'rest').length * 4

export function excavationSite(colony: AntColony): NestNode {
  const job = colony.construction?.job
  return (job ? colony.nodes.find((node) => node.id === job.target.id) ?? colony.nodes.find((node) => node.id === job.from)
    : [...colony.nodes].filter((node) => node.role === 'junction' || node.role === 'rest').sort((a, b) => b.id - a.id)[0]) ?? colony.nodes[0]
}

export function growingRadius(colony: Pick<AntColony, 'nodes' | 'construction'>, node: NestNode) {
  const job = colony.construction?.job
  if (!job || job.target.id !== node.id) return nestChamberRadius(node)
  const volume = Math.max(0, job.work - tunnelVolume(digLength(colony, job)))
  return Math.cbrt(nestTunnelRadius ** 3 + volume * 3 / (4 * Math.PI))
}

export function planExcavation(colony: AntColony, water: number, seed: number) {
  const construction = colony.construction
  if (!construction?.enabled || construction.job || !colony.queen || colony.nodes.length >= antLimits.nodes || colony.edges.length >= antLimits.edges || colony.workers.length < 3 || water <= 20 || water >= 88) return
  const committed = colony.brood.reduce((sum, cohort) => sum + (cohort.stage === 'pupa' ? 0 : Math.max(0, cohort.count * 0.04 - cohort.material) / 0.75), 0)
  if (!nestCrowded(colony) || colony.food < 0.18 + committed) return
  const parent = excavationSite(colony)
  if (parent.role !== 'junction' && parent.role !== 'rest') return
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = seed / 4294967296 * Math.PI * 2 + colony.nodes.length * 2.399 + attempt * 0.79
    const length = 0.44 + (attempt % 3) * 0.055
    const target: NestNode = { id: Math.max(...colony.nodes.map((node) => node.id)) + 1, role: 'rest', x: parent.x + Math.cos(angle) * length, y: parent.y - 0.18 - (attempt % 2) * 0.07, z: parent.z + Math.sin(angle) * length }
    if (target.y < -1.6 || !isLand(target.x, target.z, 0.25) || !isLandSegment(parent.x, parent.z, target.x, target.z, 0.12)) continue
    let clear = true
    for (let i = 1; i <= 20 && clear; i++) {
      const t = i / 20, p = { x: parent.x + (target.x - parent.x) * t, y: parent.y + (target.y - parent.y) * t, z: parent.z + (target.z - parent.z) * t }
      for (const node of colony.nodes) if (node.id !== parent.id && Math.hypot(p.x - node.x, p.y - node.y, p.z - node.z) < nestChamberRadius(node) + (i === 20 ? 0.20 : 0.10)) clear = false
      for (const [aId, bId] of colony.edges) {
        if (aId === parent.id || bId === parent.id) continue
        const a = colony.nodes.find((node) => node.id === aId)!, b = colony.nodes.find((node) => node.id === bId)!
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / (dx * dx + dy * dy + dz * dz)))
        if (Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u, p.z - a.z - dz * u) < 0.19) clear = false
      }
    }
    if (clear) { construction.job = { from: parent.id, target, work: 0 }; return }
  }
}

// Geometry-volume units are soil, not biological material/nutrients. Excavation
// spends reserve (digestion replenishes it); spoil handling is aggregated at the
// entrance, not an invented food carry. Work only happens at the actual face.
export function workExcavation(colony: AntColony, ant: Ant, water: number, rate: number, travelLeft: number) {
  const job = colony.construction?.job
  const none = { amount: 0, distance: 0, complete: false }
  if (!job || !colony.construction?.enabled || !colony.queen || !nestCrowded(colony) || colony.workers.length < 3 || ant.energy <= 50 || water <= 20 || water >= 88 || colony.food <= 0.12 || ant.location.kind !== 'nest' || ant.location.from !== ant.location.to) return none
  const tip = colony.nodes.find((node) => node.id === job.target.id)
  if (!tip && (colony.nodes.length >= antLimits.nodes || colony.edges.length >= antLimits.edges)) return none
  if (ant.location.from !== (tip?.id ?? job.from)) return none
  if (ant.location.offset && Math.hypot(ant.location.offset.x, ant.location.offset.y, ant.location.offset.z) > 1e-8) return none
  const start = colony.nodes.find((node) => node.id === job.from)!, length = digLength(colony, job), tube = tunnelVolume(length)
  const ease = Math.max(0, 1 - Math.abs(water - 55) / 35)
  const amount = Math.min(digRequired(colony, job) - job.work, 0.0014 * ease * Math.min(1.6, rate), (ant.energy - 50) / 650)
  const oldProgress = Math.min(1, job.work / tube)
  const nextProgress = Math.min(1, (job.work + amount) / tube)
  const distance = (nextProgress - oldProgress) * length
  // The face cannot carry its worker farther than the unused hourly stride.
  if (amount <= 0 || distance > travelLeft + 1e-9 || !tip && nextProgress * length < 0.020001) return none
  job.work += amount; colony.construction.removed += amount; ant.energy -= amount * 650
  const complete = job.work >= digRequired(colony, job) - 1e-9
  const p = Math.min(1, job.work / tube)
  const next: NestNode = { ...job.target, x: start.x + (job.target.x - start.x) * p, y: start.y + (job.target.y - start.y) * p, z: start.z + (job.target.z - start.z) * p, role: complete ? 'rest' : 'junction' }
  // Extending an edge must not advect another ant at a fractional location.
  // Rebase its route fraction so its actual world position stays unchanged.
  if (tip) {
    const oldLength = Math.hypot(tip.x - start.x, tip.y - start.y, tip.z - start.z)
    const newLength = Math.hypot(next.x - start.x, next.y - start.y, next.z - start.z)
    for (const other of colony.workers) {
      if (other.id === ant.id || other.location.kind !== 'nest') continue
      const location = other.location
      if (location.from === tip.id && location.to === tip.id) other.location = { ...location, from: start.id, to: tip.id, progress: oldLength / newLength }
      else if (location.from === start.id && location.to === tip.id) location.progress *= oldLength / newLength
      else if (location.from === tip.id && location.to === start.id) location.progress = 1 - (1 - location.progress) * oldLength / newLength
    }
  }
  colony.nodes = tip ? colony.nodes.map((node) => node.id === tip.id ? next : node) : [...colony.nodes, next]
  if (!tip) colony.edges = [...colony.edges, [job.from, next.id]]
  ant.location = { kind: 'nest', from: next.id, to: next.id, progress: 0 }
  if (complete) colony.construction.job = null
  return { amount, distance, complete }
}
