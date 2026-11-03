import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import type { AntColony, NestNode } from '../sim/colony'
import { nestChamberRadius, nestTunnelRadius } from '../sim/colony.ts'
import { growingRadius } from '../sim/excavation.ts'

export const chamberRadius = (node: NestNode) => nestChamberRadius(node)
type Point = { x: number; y: number; z: number }
export type NestShape = Pick<AntColony, 'nodes' | 'edges' | 'construction'>

export function nestFrame(colony: NestShape) {
  const origin = colony.nodes.find((node) => node.role === 'entrance')!
  const bounds = new Box3()
  for (const node of colony.nodes) {
    const r = growingRadius(colony, node) * 1.3
    bounds.expandByPoint(new Vector3(node.x - r, node.y - r, node.z - r))
    bounds.expandByPoint(new Vector3(node.x + r, node.y + r, node.z + r))
  }
  const center = bounds.getCenter(new Vector3()), right = new Vector3(1, 0, 0)
  // Stable world orientation: adding a branch must not rotate the observer.
  const normal = new Vector3(0.32, 0.14, 1).normalize()
  const project = (node: NestNode) => node.x - origin.x
  return { origin, right, normal, project, bounds, min: bounds.min.x - origin.x, max: bounds.max.x - origin.x, bottom: bounds.min.y, center }
}

export function nestCameraSettings(colony: AntColony, width: number, height: number) {
  const frame = nestFrame(colony), fov = width < height ? 65 : 45
  const desktop = width >= 760, tangent = Math.tan(fov * Math.PI / 360)
  const size = frame.bounds.getSize(new Vector3())
  const distance = Math.max(0.8, Math.hypot(size.x, size.z) / (2 * tangent * width / Math.max(1, height) * (desktop ? 0.62 : 0.90)), size.y / (2 * tangent * (desktop ? 0.50 : 0.74))) * 1.1
  const radius = Math.max(0.85, ...colony.nodes.map((node) => new Vector3(node.x, node.y, node.z).distanceTo(frame.center) + 0.24))
  return { fov, distance, radius, maxDistance: Math.max(3.5, distance * 1.5), offsetX: desktop ? width * 0.12 : 0, offsetY: desktop ? height * 0.04 : 0 }
}

const smoothUnion = (a: number, b: number) => {
  const h = Math.max(0, 0.026 - Math.abs(a - b)) / 0.026
  return Math.min(a, b) - h * h * 0.0065
}

// Negative is excavated space. Variation only enlarges solver clearances.
export function nestVoidField(colony: Pick<AntColony, 'nodes' | 'edges' | 'construction'>, p: Point) {
  return prepareField(colony)(p.x, p.y, p.z)
}

export function prepareField(colony: Pick<AntColony, 'nodes' | 'edges' | 'construction'>) {
  const nodes = colony.nodes.map((node) => ({ ...node, radius: growingRadius(colony, node) }))
  const edges = colony.edges.map(([aId, bId]) => {
    const a = nodes.find((node) => node.id === aId)!, b = nodes.find((node) => node.id === bId)!
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    return { a, dx, dy, dz, lengthSq: dx * dx + dy * dy + dz * dz }
  })
  return (x: number, y: number, z: number) => {
    let field = Infinity
    for (const node of nodes) {
      const dx = (x - node.x) / 1.16, dy = y - node.y, dz = (z - node.z) / 1.06
      const radius = node.radius * (1.04 + 0.018 * Math.sin((x - node.x) * 23 + node.id) * Math.cos((z - node.z) * 21))
      field = smoothUnion(field, Math.sqrt(dx * dx + dy * dy + dz * dz) - radius)
    }
    for (const edge of edges) {
      const x0 = x - edge.a.x, y0 = y - edge.a.y, z0 = z - edge.a.z
      const t = Math.max(0, Math.min(1, (x0 * edge.dx + y0 * edge.dy + z0 * edge.dz) / edge.lengthSq))
      const dx = x0 - edge.dx * t, dy = y0 - edge.dy * t, dz = z0 - edge.dz * t
      field = smoothUnion(field, Math.sqrt(dx * dx + dy * dy + dz * dz) - nestTunnelRadius * 1.025)
    }
    return field
  }
}

// A bounded marching-tetrahedra union, with open junctions in real3D.
// Back-side rendering exposes interior walls from every observer direction.
export function makeNestGeometry(colony: NestShape) {
  const bounds = nestFrame(colony).bounds, size = bounds.getSize(new Vector3())
  const spacing = 0.04, field = prepareField(colony)
  const nx = Math.ceil(size.x / spacing), ny = Math.ceil(size.y / spacing), nz = Math.ceil(size.z / spacing)
  const strideY = nz + 1, strideX = (ny + 1) * strideY
  const values = new Float32Array((nx + 1) * strideX)
  const point = (x: number, y: number, z: number) => new Vector3(bounds.min.x + size.x * x / nx, bounds.min.y + size.y * y / ny, bounds.min.z + size.z * z / nz)
  for (let x = 0; x <= nx; x++) for (let y = 0; y <= ny; y++) for (let z = 0; z <= nz; z++) values[x * strideX + y * strideY + z] = field(bounds.min.x + size.x * x / nx, bounds.min.y + size.y * y / ny, bounds.min.z + size.z * z / nz)
  const positions: number[] = [], colors: number[] = []
  const vertex = (p: Vector3) => {
    positions.push(p.x, p.y, p.z)
    const band = Math.sin(p.y * 52 + Math.sin(p.x * 5) * 0.6 + Math.cos(p.z * 7) * 0.4) * 0.022
    const depth = Math.min(1, Math.max(0, -p.y / 1.5))
    colors.push(0.46 + depth * 0.16 + band, 0.31 + depth * 0.13 + band, 0.19 + depth * 0.11 + band)
  }
  const triangle = (a: Vector3, b: Vector3, c: Vector3, outward: Vector3) => {
    if (b.clone().sub(a).cross(c.clone().sub(a)).dot(outward) < 0) [b, c] = [c, b]
    vertex(a); vertex(b); vertex(c)
  }
  const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]]
  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const samples = corners.map(([dx, dy, dz]) => values[(x + dx) * strideX + (y + dy) * strideY + z + dz])
    if (samples.every((d) => d > 0) || samples.every((d) => d < 0)) continue
    const points = corners.map(([dx, dy, dz]) => point(x + dx, y + dy, z + dz))
    for (const tetra of tetrahedra) {
      const inside = tetra.filter((i) => samples[i] < 0), outside = tetra.filter((i) => samples[i] >= 0)
      if (!inside.length || !outside.length) continue
      const normal = new Vector3()
      outside.forEach((i) => normal.addScaledVector(points[i], 1 / outside.length))
      inside.forEach((i) => normal.addScaledVector(points[i], -1 / inside.length))
      const cross = (a: number, b: number) => points[a].clone().lerp(points[b], samples[a] / (samples[a] - samples[b]))
      if (inside.length === 2) {
        const [a, b] = inside, [c, d] = outside
        const ac = cross(a, c), ad = cross(a, d), bc = cross(b, c), bd = cross(b, d)
        triangle(ac, ad, bd, normal); triangle(ac, bd, bc, normal)
      } else {
        const lone = inside.length === 1 ? inside[0] : outside[0], others = inside.length === 1 ? outside : inside
        triangle(cross(lone, others[0]), cross(lone, others[1]), cross(lone, others[2]), normal)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals(); geometry.computeBoundingSphere()
  return geometry
}
