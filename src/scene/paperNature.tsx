import { useMemo } from 'react'
import { CanvasTexture, Color, DoubleSide, Group, LatheGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, Shape, ShapeGeometry, SRGBColorSpace, TubeGeometry, Vector2, Vector3, CatmullRomCurve3 } from 'three'
import type { BufferGeometry } from 'three'
import { plantModelScale } from './scale'
import { naturalLook } from './PaperCritter'

/*
 * Mushrooms, floating pads, hairgrass and fallen leaves for the paper look
 * (2026-11-03). No CC0 scan of these could be downloaded without an account,
 * so they are modelled in code with painted, photo-like textures, sized from
 * real species that fit a 14 cm jar (1 unit is about 19 mm):
 *
 * - Mushroom: a bonnet (Mycena), the small litter mushroom of damp woodland.
 *   Cap 2.5-7.5 mm, stem 5-20 mm (Mycena adscendens).
 * - Lily: a floating rosette like Amazon frogbit (Limnobium laevigatum),
 *   leaves 8-40 mm wide (Plants of South Eastern NSW).
 * - Reed: a hairgrass tuft (Eleocharis acicularis), thin round stems.
 * - Litter: fallen leaflets of the jar's own plants, Oxalis leaflets being
 *   4-13 mm (VicFlora).
 *
 * Shared geometry and materials are made once; only transforms vary per item.
 */

const noRaycast = () => undefined
type Painter = (context: CanvasRenderingContext2D, size: number) => void
function paint(size: number, painter: Painter) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  painter(canvas.getContext('2d')!, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
let seed = 7
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

/* ---------- Mushroom ---------- */

let mushroomParts: { cap: BufferGeometry; gills: BufferGeometry; stems: BufferGeometry[]; capMaterial: MeshStandardMaterial; gillMaterial: MeshStandardMaterial; stemMaterial: MeshStandardMaterial } | null = null
function mushrooms() {
  if (mushroomParts) return mushroomParts
  // A bell-shaped bonnet: radius 1 at the rim, height 0.9, with a slight boss on top.
  const profile: Vector2[] = []
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14, angle = t * Math.PI / 2
    profile.push(new Vector2(Math.sin(angle) * (1 - 0.08 * Math.sin(t * Math.PI)), Math.cos(angle) * 0.9 + (t < 0.2 ? 0.05 * (1 - t / 0.2) : 0)))
  }
  profile.reverse()
  const cap = new LatheGeometry(profile, 24)
  const gills = new LatheGeometry([new Vector2(0.95, 0.02), new Vector2(0.12, 0.42)], 24)
  // Thin stems, each with its own gentle curve.
  const stems = [0, 1, 2].map((variant) => new TubeGeometry(new CatmullRomCurve3([
    new Vector3(0, 0, 0), new Vector3(0.05 * (variant - 1), 0.35, 0.04), new Vector3(0.1 * (variant - 1), 0.7, 0.02 * variant), new Vector3(0.08 * (variant - 1), 1, 0),
  ]), 10, 0.035, 6, false))
  const capMap = paint(256, (context, size) => {
    // Seen from above: a dark umber centre fading to a pale, striate (lined) margin.
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, '#5b4632'); gradient.addColorStop(0.35, '#8a735b'); gradient.addColorStop(1, '#cbbba2')
    context.fillStyle = gradient; context.fillRect(0, 0, size, size)
    context.strokeStyle = 'rgba(80,62,44,0.28)'; context.lineWidth = 1.2
    for (let i = 0; i < 64; i += 1) {
      const angle = i / 64 * Math.PI * 2
      context.beginPath(); context.moveTo(size / 2 + Math.cos(angle) * size * 0.2, size / 2 + Math.sin(angle) * size * 0.2); context.lineTo(size / 2 + Math.cos(angle) * size * 0.5, size / 2 + Math.sin(angle) * size * 0.5); context.stroke()
    }
  })
  // Lathe UVs run along the profile (v) and around (u): map v to the radial gradient.
  const capUv = cap.getAttribute('uv'), capPosition = cap.getAttribute('position')
  for (let i = 0; i < capUv.count; i += 1) {
    const x = capPosition.getX(i), z = capPosition.getZ(i)
    capUv.setXY(i, 0.5 + x * 0.5, 0.5 + z * 0.5)
  }
  const gillMap = paint(128, (context, size) => {
    context.fillStyle = '#ddd2bf'; context.fillRect(0, 0, size, size)
    context.strokeStyle = 'rgba(120,100,80,0.45)'; context.lineWidth = 1
    for (let x = 0; x < size; x += 3) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size); context.stroke() }
  })
  return mushroomParts = {
    cap, gills, stems,
    capMaterial: new MeshStandardMaterial({ map: capMap, roughness: 0.55 }),
    gillMaterial: new MeshStandardMaterial({ map: gillMap, roughness: 0.9, side: DoubleSide }),
    stemMaterial: new MeshStandardMaterial({ color: '#d8ccb6', roughness: 0.5 }),
  }
}

/** One bonnet mushroom standing at the origin: `height` to the cap top, in units. */
export function Mushroom({ height, cap, lean = 0, variant = 0 }: { height: number; cap: number; lean?: number; variant?: number }) {
  const parts = mushrooms()
  const stemHeight = height - cap * 0.75
  return <group rotation={[lean * 0.6, variant * 1.7, lean]}>
    <mesh geometry={parts.stems[variant % 3]} material={parts.stemMaterial} scale={[cap * 0.9, stemHeight, cap * 0.9]} castShadow raycast={noRaycast} />
    <group position={[0.08 * ((variant % 3) - 1) * cap * 0.9, stemHeight - cap * 0.1, 0]} scale={cap / 2}>
      <mesh geometry={parts.cap} material={parts.capMaterial} castShadow raycast={noRaycast} />
      <mesh geometry={parts.gills} material={parts.gillMaterial} raycast={noRaycast} />
    </group>
  </group>
}

/* ---------- Floating rosette (lily kind) ---------- */

let padParts: { geometry: BufferGeometry; texture: CanvasTexture } | null = null
function pads() {
  if (padParts) return padParts
  // A round leaf with a narrow notch where the stalk joins, radius 1.
  const shape = new Shape()
  const notch = 0.12
  shape.moveTo(0, 0)
  for (let i = 0; i <= 40; i += 1) {
    const angle = notch + i / 40 * (Math.PI * 2 - notch * 2)
    shape.lineTo(Math.cos(angle) * (1 - 0.04 * Math.sin(angle * 3)), Math.sin(angle) * 0.92)
  }
  shape.lineTo(0, 0)
  const geometry = new ShapeGeometry(shape, 1)
  geometry.rotateX(-Math.PI / 2)
  // Dome the leaf a little, as a spongy frogbit leaf is.
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), z = position.getZ(i), r = Math.hypot(x, z)
    position.setY(i, 0.06 * (1 - r * r))
    uv.setXY(i, 0.5 + x * 0.5, 0.5 + z * 0.5)
  }
  geometry.computeVertexNormals()
  const texture = paint(256, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // Natural look: the fresher lime-green pads of the owner's reference (2026-11-11).
    if (naturalLook) { gradient.addColorStop(0, '#79a63c'); gradient.addColorStop(1, '#5a8a2e') } else { gradient.addColorStop(0, '#5f7d35'); gradient.addColorStop(1, '#46622a') }
    context.fillStyle = gradient; context.fillRect(0, 0, size, size)
    // Arcing veins from the stalk.
    context.strokeStyle = 'rgba(190,210,140,0.35)'; context.lineWidth = 1.4
    for (let i = -4; i <= 4; i += 1) {
      context.beginPath(); context.moveTo(size / 2, size / 2)
      context.quadraticCurveTo(size / 2 + i * size * 0.06, size * 0.15, size / 2 + i * size * 0.11, size * 0.03); context.stroke()
      context.beginPath(); context.moveTo(size / 2, size / 2)
      context.quadraticCurveTo(size / 2 + i * size * 0.06, size * 0.85, size / 2 + i * size * 0.11, size * 0.97); context.stroke()
    }
    for (let i = 0; i < 900; i += 1) { context.fillStyle = `rgba(30,50,20,${rand() * 0.12})`; context.fillRect(rand() * size, rand() * size, 2, 2) }
  })
  return padParts = { geometry, texture }
}

const dry = new Color('#a89366')
const leafMaterials = new Map<string, MeshStandardMaterial>()
function leafMaterial(kind: string, health: number, make: () => MeshStandardMaterial) {
  const step = Math.round(Math.max(0, Math.min(1, health)) * 4), key = `${kind}:${step}`
  let material = leafMaterials.get(key)
  if (!material) { material = make(); material.color = new Color('#ffffff').lerp(dry, (1 - step / 4) * 0.75); leafMaterials.set(key, material) }
  return material
}

/** A floating rosette of five leaves, spread and height matched to the lily kind. */
export function FloatingRosette({ health, seed: id }: { health: number; seed: number }) {
  const parts = pads()
  const material = leafMaterial('pad', health, () => new MeshStandardMaterial({ map: parts.texture, roughness: naturalLook ? 0.62 : 0.28, side: DoubleSide }))
  const leaves = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const angle = i / 5 * Math.PI * 2 + id * 0.7, size = 0.15 + ((id * 13 + i * 7) % 5) * 0.012
    return { x: Math.cos(angle) * size * 0.9, z: Math.sin(angle) * size * 0.9, turn: -angle - Math.PI / 2, size }
  }), [id])
  // The lily anchor sits 0.025 source units below the surface (see plantGroundY).
  const top = 0.025 * plantModelScale('lily')[1] + 0.002
  return <group position={[0, top, 0]}>
    {leaves.map((leaf, i) => <mesh key={i} geometry={parts.geometry} material={material} position={[leaf.x, i * 0.0015, leaf.z]} rotation={[0, leaf.turn, 0]} scale={leaf.size} receiveShadow raycast={noRaycast} />)}
  </group>
}

/* ---------- Hairgrass tuft (reed kind) ---------- */

let bladeParts: { geometry: BufferGeometry; texture: CanvasTexture } | null = null
function blades() {
  if (bladeParts) return bladeParts
  const geometry = new PlaneGeometry(1, 1, 1, 6)
  geometry.translate(0, 0.5, 0)
  // Bend each blade outward toward its tip.
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i += 1) { const y = position.getY(i); position.setZ(i, y * y * 0.35) }
  geometry.computeVertexNormals()
  const texture = paint(64, (context, size) => {
    const gradient = context.createLinearGradient(0, size, 0, 0)
    gradient.addColorStop(0, '#3f5a2a'); gradient.addColorStop(0.7, '#6f8f3e'); gradient.addColorStop(1, '#a3a861')
    context.fillStyle = gradient; context.fillRect(size * 0.4, 0, size * 0.2, size)
  })
  return bladeParts = { geometry, texture }
}

/** About 18 thin stems from one base, fitting the reed kind's spread and height. */
export function HairgrassTuft({ height, spread, health, seed: id }: { height: number; spread: number; health: number; seed: number }) {
  const parts = blades()
  const material = leafMaterial('blade', health, () => new MeshStandardMaterial({ map: parts.texture, alphaTest: 0.5, transparent: false, side: DoubleSide, roughness: 0.7 }))
  const tuft = useMemo(() => {
    const group = new Group()
    for (let i = 0; i < 18; i += 1) {
      const mesh = new Mesh(parts.geometry, material)
      const angle = i * 2.4 + id, lean = 0.1 + ((i * 7 + id) % 5) * 0.06
      mesh.position.set(Math.cos(angle) * spread * 0.08, 0, Math.sin(angle) * spread * 0.08)
      mesh.rotation.set(0, -angle + Math.PI / 2, 0)
      mesh.rotateX(lean)
      mesh.scale.set(spread * 0.12, height * (0.7 + ((i * 11 + id) % 7) * 0.05), spread * 1.1)
      mesh.castShadow = true; mesh.raycast = noRaycast
      group.add(mesh)
    }
    return group
  }, [parts, material, height, spread, id])
  return <primitive object={tuft} />
}

/* ---------- Fallen leaflets (litter) ---------- */

let litterParts: { geometry: BufferGeometry; materials: MeshStandardMaterial[] } | null = null
export function fallenLeaf() {
  if (litterParts) return litterParts
  // An obovate leaflet, length 1 along x, slightly cupped and curled.
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.25, 0.32, 0.75, 0.42, 1, 0.08)
  shape.bezierCurveTo(1, -0.02, 0.98, -0.06, 0.92, -0.1)
  shape.bezierCurveTo(0.7, -0.4, 0.25, -0.3, 0, 0)
  const geometry = new ShapeGeometry(shape, 8)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), z = position.getZ(i)
    position.setY(i, z * z * 0.6 + x * x * 0.05)
    uv.setXY(i, x, 0.5 + z)
  }
  geometry.computeVertexNormals()
  const tones = [['#8c6a3f', '#6e5030'], ['#a7895a', '#7c6340'], ['#6b5a3a', '#4f4128'], ['#9a7b4b', '#5e472b']]
  const materials = tones.map(([body, vein]) => new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide, map: paint(128, (context, size) => {
    context.fillStyle = body; context.fillRect(0, 0, size, size)
    for (let i = 0; i < 500; i += 1) { context.fillStyle = `rgba(40,25,10,${rand() * 0.15})`; context.fillRect(rand() * size, rand() * size, 2, 2) }
    context.strokeStyle = vein; context.lineWidth = 2
    context.beginPath(); context.moveTo(0, size / 2); context.lineTo(size, size / 2); context.stroke()
    context.lineWidth = 0.8
    for (let x = 0.15; x < 0.9; x += 0.12) for (const side of [-1, 1]) { context.beginPath(); context.moveTo(x * size, size / 2); context.lineTo((x + 0.12) * size, size / 2 + side * size * 0.28); context.stroke() }
  }) }))
  return litterParts = { geometry, materials }
}
