import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Reuse the existing faceted seed marker, normalized to a unit-sized box.
export const propaguleGeometry = new IcosahedronGeometry(1, 1)
propaguleGeometry.computeBoundingBox()
const propaguleSize = propaguleGeometry.boundingBox!.getSize(new Vector3())
propaguleGeometry.scale(1 / propaguleSize.x, 1 / propaguleSize.y, 1 / propaguleSize.z)

// Bake repeated leaflets/stems once. Rich silhouettes still use only two draws.
function leaf(heart = false) {
  const outline = heart
    ? [[0, 0], [-0.11, 0.03], [-0.18, 0.15], [-0.16, 0.26], [-0.07, 0.3], [0, 0.255], [0.07, 0.3], [0.16, 0.26], [0.18, 0.15], [0.11, 0.03]]
    : [[0, 0], [-0.06, 0.06], [-0.085, 0.16], [0, 0.32], [0.085, 0.16], [0.06, 0.06]]
  const vertices: number[] = []
  for (let index = 0; index < outline.length; index += 1) {
    const a = outline[index]
    const b = outline[(index + 1) % outline.length]
    vertices.push(0, 0.035, 0.14, a[0], 0, a[1], b[0], 0, b[1])
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

function stem(start: Vector3, end: Vector3, width: number) {
  const direction = end.clone().sub(start)
  const geometry = new CylinderGeometry(width * 0.75, width, direction.length(), 5).toNonIndexed()
  geometry.deleteAttribute('uv')
  return geometry.applyMatrix4(new Matrix4().compose(start.clone().add(end).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()), new Vector3(1, 1, 1)))
}

function combine(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!
  for (const part of parts) part.dispose()
  return geometry
}

function clover() {
  const leaves: BufferGeometry[] = []
  const stems: BufferGeometry[] = []
  for (let crown = 0; crown < 5; crown += 1) {
    const angle = crown * 2.4
    const x = Math.sin(angle) * (crown ? 0.23 : 0)
    const z = Math.cos(angle) * (crown ? 0.23 : 0)
    const y = 0.23 + crown % 3 * 0.075
    stems.push(stem(new Vector3(x * 0.3, 0, z * 0.3), new Vector3(x, y, z), 0.016))
    for (let index = 0; index < 3; index += 1) leaves.push(leaf(true).rotateX(-0.1 + crown * 0.025).rotateY(index / 3 * Math.PI * 2 + angle).translate(x, y, z))
  }
  return { leaves: combine(leaves), stems: combine(stems) }
}

function fern() {
  const leaves: BufferGeometry[] = []
  const stems: BufferGeometry[] = []
  for (let frond = 0; frond < 7; frond += 1) {
    const angle = frond / 7 * Math.PI * 2
    const reach = frond % 2 ? 0.82 : 0.66
    const point = (t: number) => new Vector3(Math.sin(angle) * reach * t, Math.sin(t * 2.2) * (frond % 2 ? 0.66 : 0.84), Math.cos(angle) * reach * t)
    for (let index = 1; index <= 6; index += 1) {
      const t = index / 7
      const at = point(t)
      stems.push(stem(point((index - 1) / 7), at, 0.013 - t * 0.006))
      for (const side of [-1, 1]) {
        const size = 0.88 * (1 - t) + 0.26
        leaves.push(leaf().scale(1, 1, size).rotateX(-0.28).rotateY(angle + side * 1.08).translate(at.x, at.y, at.z))
      }
    }
    const tip = point(6 / 7)
    leaves.push(leaf().scale(0.65, 1, 0.65).rotateX(-0.5).rotateY(angle).translate(tip.x, tip.y, tip.z))
  }
  return { leaves: combine(leaves), stems: combine(stems) }
}

function moss() {
  const cushions: BufferGeometry[] = []
  for (let index = 0; index < 11; index += 1) {
    const angle = index * 2.4
    const radius = index ? 0.12 + index % 3 * 0.1 : 0
    const geometry = new IcosahedronGeometry(1, 1).scale(0.18, 0.1 + index % 3 * 0.018, 0.18).translate(Math.sin(angle) * radius, 0.075, Math.cos(angle) * radius)
    geometry.deleteAttribute('uv')
    cushions.push(geometry)
  }
  return combine(cushions)
}

function bloom() {
  const greenery: BufferGeometry[] = []
  const petals: BufferGeometry[] = []
  const centers: BufferGeometry[] = []
  for (let head = 0; head < 2; head += 1) {
    const x = head ? -0.22 : 0.08
    const z = head ? 0.13 : -0.04
    const y = head ? 0.48 : 0.76
    const size = head ? 0.73 : 1
    const tip = new Vector3(x, y, z)
    const bend = new Vector3(x * 0.5 - 0.035, y * 0.54, z * 0.5)
    greenery.push(stem(new Vector3(0, 0, 0), bend, 0.016), stem(bend, tip, 0.012))
    for (let index = 0; index < 3; index += 1) {
      const t = 0.2 + index * 0.18
      greenery.push(leaf().scale(1.2, 1, 1.12).rotateX(-0.4).rotateY(head + index * 2.4).translate(x * t, y * t, z * t))
    }
    for (let index = 0; index < 6; index += 1) {
      // Rounded, gently folded petals share the fern's thin leaf language.
      const outline = [[0, 0], [-0.065, 0.035], [-0.115, 0.12], [-0.12, 0.22], [-0.07, 0.29], [0, 0.315], [0.07, 0.29], [0.12, 0.22], [0.115, 0.12], [0.065, 0.035]]
      const vertices: number[] = []
      for (let edge = 0; edge < outline.length; edge += 1) {
        const a = outline[edge]
        const b = outline[(edge + 1) % outline.length]
        vertices.push(0, 0.035, 0.15, a[0], a[1] * 0.08, a[1], b[0], b[1] * 0.08, b[1])
      }
      const petal = new BufferGeometry()
      petal.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      petal.computeVertexNormals()
      petals.push(petal.scale(size, size, size).rotateX(-0.08).rotateY(index / 6 * Math.PI * 2 + head).translate(x, y, z))
    }
    const center = new SphereGeometry(1, 8, 4).toNonIndexed().scale(0.078 * size, 0.04 * size, 0.078 * size).translate(x, y + 0.035, z)
    center.deleteAttribute('uv')
    centers.push(center)
  }
  return { leaves: combine(greenery), petals: combine(petals), centers: combine(centers) }
}

function grass() {
  const blades: BufferGeometry[] = []
  for (let blade = 0; blade < 9; blade += 1) {
    const height = 0.22 + blade % 4 * 0.045
    const point = (level: number, side: number) => {
      const t = level / 3
      const width = [0.012, 0.025, 0.014, 0][level]
      return [0.06 * t * t + width * side, height * t, 0.11 * t * t]
    }
    const vertices: number[] = []
    for (let level = 0; level < 3; level += 1) {
      vertices.push(...point(level, -1), ...point(level, 1), ...point(level + 1, -1))
      if (level < 2) vertices.push(...point(level, 1), ...point(level + 1, 1), ...point(level + 1, -1))
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    geometry.computeVertexNormals()
    blades.push(geometry.rotateY(blade * 2.4).translate(Math.sin(blade * 2.4) * 0.025, 0, Math.cos(blade * 2.4) * 0.025))
  }
  return combine(blades)
}

function tree() {
  const branches = [stem(new Vector3(0, 0, 0), new Vector3(0.04, 1.18, 0), 0.085)]
  const crowns: BufferGeometry[] = []
  for (let index = 0; index < 7; index += 1) {
    const angle = index * 2.4
    const x = index ? Math.sin(angle) * 0.38 : 0
    const z = index ? Math.cos(angle) * 0.38 : 0
    const y = 1.1 + index % 3 * 0.21
    branches.push(stem(new Vector3(0, y * 0.55, 0), new Vector3(x, y, z), 0.038))
    const crown = new IcosahedronGeometry(1, 1).scale(0.43, 0.33, 0.4).translate(x, y, z)
    crown.deleteAttribute('uv')
    crowns.push(crown)
  }
  return { branches: combine(branches), crown: combine(crowns) }
}

export const plantGeometry = { clover: clover(), fern: fern(), moss: moss(), bloom: bloom(), grass: grass(), tree: tree() }
