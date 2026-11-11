import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Object3D } from 'three'
import type { InstancedMesh } from 'three'
import type { SoilPatch } from '../sim/ecosystem'
import { groundShape } from './scale'

/*
 * Fallen leaves for the natural look (2026-11-11): genuinely 3D low-poly leaves instead of the
 * painted flat oak cards of the paper look, which read as stickers next to the low-poly plants.
 * Asset-first: the Quaternius megakit already in the project has only alpha-textured canopy cards and
 * no fallen-leaf models, so these follow the jar's own shared leaf geometry (plantGeometry.ts: a
 * fan of triangles from a raised centre) with a folded midrib, cupped halves and a curl. Four shapes
 * (lobed oak, ovate, narrow, curled), flat shaded, one shared material, instance colours from a dry
 * leaf palette, one InstancedMesh per shape. The number of leaves per soil pocket still comes from
 * the sim's organic matter, exactly as before. Visual only.
 */
// Half-width along the leaf (x 0..1) for each shape: a rounded base outline, oak with rounded lobes.
const body = (x: number, width: number, tip = 1) => width * Math.sin(Math.PI * Math.pow(x, 0.85)) ** tip
const widths: ((x: number) => number)[] = [
  (x) => body(x, 0.2, 0.9) * (0.72 + 0.28 * Math.abs(Math.cos(Math.PI * 4.5 * x))), // lobed oak
  (x) => body(x, 0.25, 0.8), // ovate
  (x) => body(x, 0.12, 1.1), // narrow
  (x) => body(x, 0.29, 0.7), // broad, strongly curled
]
const outlines = widths
// How much the leaf curls up at both ends and how much its halves fold up from the midrib.
const curl = [0.06, 0.04, 0.035, 0.1], cup = [0.15, 0.18, 0.13, 0.26]

function leafGeometry(k: number) {
  const width = widths[k], positions: number[] = [], colours: number[] = []
  const steps = 12, rings = [0, 0.55, 1]
  // Surface height: halves fold up from the midrib (cup), the whole leaf curls up at both ends.
  const lift = (x: number, y: number) => Math.abs(y) * cup[k] * (1 + Math.abs(y) * 2) + Math.pow(x - 0.5, 2) * curl[k] * 4 + Math.sin(x * 9.1 + k) * 0.006
  const point = (x: number, r: number, side: number) => { const y = width(x) * r * side; return [x - 0.5, lift(x, y) + (r === 0 ? 0.008 : 0), y] }
  const shade = (r: number) => r === 0 ? 0.66 : r < 1 ? 0.92 : 1
  for (const side of [1, -1]) {
    for (let n = 0; n < steps; n += 1) {
      const x0 = n / steps, x1 = (n + 1) / steps
      for (let ring = 0; ring < rings.length - 1; ring += 1) {
        const a = point(x0, rings[ring], side), b = point(x1, rings[ring], side), c = point(x0, rings[ring + 1], side), d = point(x1, rings[ring + 1], side)
        const ca = shade(rings[ring]), cc = shade(rings[ring + 1])
        const tri: [number[], number][] = side > 0 ? [[a, ca], [c, cc], [d, cc], [a, ca], [d, cc], [b, ca]] : [[a, ca], [d, cc], [c, cc], [a, ca], [b, ca], [d, cc]]
        for (const [p, v] of tri) { positions.push(p[0], p[1], p[2]); colours.push(v, v * 0.97, v * 0.92) }
      }
    }
  }
  // A short stalk.
  const base = lift(0, 0) + 0.008
  positions.push(-0.5, base, 0.012, -0.5, base, -0.012, -0.6, base + 0.02, 0); colours.push(0.66, 0.64, 0.6, 0.66, 0.64, 0.6, 0.66, 0.64, 0.6)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

let shapes: BufferGeometry[] | null = null
export function litterGeometries() { return shapes ??= outlines.map((_, k) => leafGeometry(k)) }
let material: MeshStandardMaterial | null = null
const litterMaterial = () => material ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, side: DoubleSide })
// Dry leaf tones: tan, ochre, russet, umber; restrained, close to the soil and gravel palette.
const tones = ['#a8834f', '#b99560', '#8f6a3e', '#9c6a3c', '#7a5a36', '#b48a52'].map((hex) => new Color(hex))

interface Spot { x: number; z: number; y: number; turn: number; tiltX: number; tiltZ: number; size: number; shape: number; tone: number }

/** Leaves on every soil pocket: count and spread from the pocket's organic matter (as the drawn litter). */
export function NaturalLitter({ soil }: { soil: SoilPatch[] }) {
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const key = soil.map((patch) => `${patch.id}:${patch.organic > 0.04 ? Math.min(6, Math.ceil(patch.organic / 3)) : 0}:${Math.round(Math.min(1.45, 0.35 + Math.sqrt(patch.organic) / 5) * 20)}`).join('|')
  const spots = useMemo(() => {
    const out: Omit<Spot, 'y'>[] = []
    for (const patch of soil) {
      const size = Math.min(1.45, 0.35 + Math.sqrt(patch.organic) / 5)
      const count = patch.organic > 0.04 ? Math.min(6, Math.ceil(patch.organic / 3)) : 0
      for (let index = 0; index < count * 2; index += 1) {
        const angle = index * 2.4 + patch.id, reach = (0.12 + index * 0.05) * size
        out.push({ x: patch.x + Math.sin(angle) * reach, z: patch.z + Math.cos(angle) * reach, turn: angle * 1.7, tiltX: ((index * 7) % 5 - 2) * 0.06, tiltZ: ((index * 3) % 5 - 2) * 0.05, size: 0.36 + (index * 13 % 5) * 0.05, shape: (index + patch.id) % outlines.length, tone: (index * 5 + patch.id * 3) % tones.length })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const counts = useMemo(() => outlines.map((_, k) => spots.filter((spot) => spot.shape === k).length), [spots])
  // The jar's ground shape is set by JarSetting after mount; place leaves when it (or the litter) changes.
  const placed = useRef<{ offset: unknown; spots: unknown }>({ offset: null, spots: null })
  useFrame(() => {
    if (placed.current.offset === groundShape.offset && placed.current.spots === spots) return
    const holder = new Object3D(), next = outlines.map(() => 0)
    spots.forEach((spot, n) => {
      const mesh = meshes.current[spot.shape]
      if (!mesh) return
      holder.position.set(spot.x, 0.042 + groundShape.offset(spot.x, spot.z) + (n % 4) * 0.003, spot.z)
      holder.rotation.set(spot.tiltX, spot.turn, spot.tiltZ)
      holder.scale.setScalar(spot.size)
      holder.updateMatrix()
      const k = next[spot.shape]++
      mesh.setMatrixAt(k, holder.matrix)
      mesh.setColorAt(k, tones[spot.tone])
    })
    meshes.current.forEach((mesh) => { if (!mesh) return; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere() })
    placed.current = { offset: groundShape.offset, spots }
  })
  const geometries = litterGeometries()
  return <>{geometries.map((geometry, k) => counts[k] > 0 && <instancedMesh key={`${k}:${counts[k]}:${key}`} ref={(mesh) => { meshes.current[k] = mesh; placed.current.spots = null; if (mesh && !mesh.instanceColor) for (let i = 0; i < mesh.count; i += 1) mesh.setColorAt(i, tones[0]) }} name="litter" args={[geometry, litterMaterial(), counts[k]]} castShadow receiveShadow raycast={() => undefined} />)}</>
}
