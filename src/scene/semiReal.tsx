import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { BufferAttribute, CanvasTexture, Color, DoubleSide, InstancedMesh, Matrix3, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, RepeatWrapping, SRGBColorSpace, Texture, Vector2, Vector3 } from 'three'
import type { BufferGeometry, Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeNoise } from '../lab/proceduralTextures'

/*
 * Semi-real look shared by the realism lab and the game (?look=paper):
 * photo scans softened into painted patches, painted moss sprig cards and
 * Poly Haven CC0 props. Reference: GPT scene round 2, image 2.
 */

import { lighter } from './scanLod'

export const polyHaven = `${import.meta.env.BASE_URL}assets/lab/polyhaven/`

/**
 * Tiling scan textures by key. drei's keyed useTexture returns a new object on
 * every render, and memos keyed on it re-flagged every texture for upload (and
 * rebuilt materials) whenever the jar re-rendered: about four 1k uploads a frame.
 * This keys on the loaded textures themselves and only flags an upload when a
 * setting really changes.
 */
export function useTextureSet<K extends string>(urls: Record<K, string>, colour: NoInfer<K>[]): Record<K, Texture> {
  const keys = Object.keys(urls) as K[]
  const list = useTexture(keys.map((key) => urls[key])) as Texture[]
  return useMemo(() => {
    const set = {} as Record<K, Texture>
    keys.forEach((key, n) => {
      const texture = list[n], srgb = colour.includes(key)
      if (texture.wrapS !== RepeatWrapping || texture.wrapT !== RepeatWrapping || texture.anisotropy !== 8 || (srgb && texture.colorSpace !== SRGBColorSpace)) {
        texture.wrapS = texture.wrapT = RepeatWrapping
        texture.anisotropy = 8
        if (srgb) texture.colorSpace = SRGBColorSpace
        texture.needsUpdate = true
      }
      set[key] = texture
    })
    return set
  }, [list.map((texture) => texture.uuid).join()]) // eslint-disable-line react-hooks/exhaustive-deps
}
export type Ground = (x: number, z: number) => number
const noRaycast = () => undefined
const nowhere: { x: number; z: number; radius: number }[] = []

/** Soften a photo texture into broad painted patches (blur, lift, a little saturation). */
export function paintify(texture: Texture, extra = '', blur = 3) {
  const image = texture.image as HTMLImageElement
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const context = canvas.getContext('2d')!
  context.filter = `blur(${blur}px) saturate(1.15) contrast(0.85) brightness(1.06) ${extra}`
  context.drawImage(image, 0, 0)
  const painted = new CanvasTexture(canvas)
  painted.wrapS = painted.wrapT = RepeatWrapping
  painted.repeat.copy(texture.repeat)
  painted.colorSpace = SRGBColorSpace
  painted.anisotropy = 8
  return painted
}

/** A painted moss sprig on a transparent card: a stem with soft forked leaflets. */
/**
 * A moss sprig painted to match the drawn plants (2026-11-04): olive stem,
 * small pointed leaves in two tones from the GPT moss painting's palette
 * (olive in shade to bright yellow-green tips), each with a faint darker edge.
 */
export function sprigTexture(seed: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 128; canvas.height = 128
  const context = canvas.getContext('2d')!
  let state = Math.abs(Math.round(seed)) % 2147483646 + 1
  const rand = () => { state = (state * 16807) % 2147483647; return state / 2147483647 }
  const shade = [[96, 124, 24], [112, 142, 30], [128, 156, 36]], light = [[150, 176, 44], [170, 192, 56], [190, 206, 74]]
  const leaf = (x: number, y: number, angle: number, size: number, tip: number) => {
    const tone = (tip > 0.5 ? light : shade)[Math.floor(rand() * 3)]
    context.save(); context.translate(x, y); context.rotate(angle)
    context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(size * 0.5, -size * 0.32, size, 0); context.quadraticCurveTo(size * 0.5, size * 0.32, 0, 0)
    context.fillStyle = `rgb(${tone.join(',')})`; context.fill()
    context.strokeStyle = 'rgba(38, 48, 4, 0.45)'; context.lineWidth = 0.7; context.stroke()
    context.restore()
  }
  const branch = (x: number, y: number, angle: number, length: number, depth: number) => {
    const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length
    context.strokeStyle = depth > 1 ? '#56661a' : '#6f8424'
    context.lineWidth = Math.max(1, depth * 1.3)
    context.lineCap = 'round'
    context.beginPath(); context.moveTo(x, y); context.lineTo(ex, ey); context.stroke()
    for (let step = 0.18; step < 1.02; step += 0.12) {
      const lx = x + (ex - x) * step, ly = y + (ey - y) * step
      for (const side of [-1, 1]) leaf(lx, ly, angle + side * (0.7 + rand() * 0.3), 6 + rand() * 3, (3 - depth) / 3 * 0.6 + step * 0.4 + (rand() - 0.5) * 0.3)
    }
    leaf(ex, ey, angle, 7, 1)
    if (depth > 0) for (const turn of [-0.5, 0.45]) branch(ex, ey, angle + turn + (rand() - 0.5) * 0.3, length * 0.62, depth - 1)
  }
  branch(64, 126, -Math.PI / 2 + (rand() - 0.5) * 0.3, 48, 3)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

type MossProps = { x: number; z: number; radius: number; count: number; ground: Ground; flat?: boolean; spots?: Vector3[]; scale?: number; avoid?: { x: number; z: number; radius: number }[]; keepOut?: (x: number, z: number) => boolean }

// Painted sprig cushions are the default since 2026-11-07 (closer to the lime moss in concept image 12); ?moss=scan keeps the scanned shoots.
const paintedMoss = typeof location === 'undefined' || new URLSearchParams(location.search).get('moss') !== 'scan'

/**
 * Moss on the soil. By default it is built from real scanned moss shoots
 * (owner, 2026-11-06: realistic moss or the image 09 cushions are both fine);
 * ?moss=painted brings back the painted sprig cards.
 */
export function MossSprigs(props: MossProps) {
  return paintedMoss ? <PaintedMossSprigs {...props} /> : <ScanMoss {...props} />
}

/** Turn the black backdrop of the moss scan's colour map into a cut-out, so shoots and their shadows have real outlines. */
function cutOut(texture: Texture) {
  const image = texture.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let index = 0; index < data.length; index += 4) {
    const bright = Math.max(data[index], data[index + 1], data[index + 2])
    data[index + 3] = Math.max(0, Math.min(255, (bright - 16) * 10))
  }
  context.putImageData(pixels, 0, 0)
  const cut = new CanvasTexture(canvas)
  cut.colorSpace = SRGBColorSpace
  cut.flipY = texture.flipY
  cut.anisotropy = 4
  return cut
}

/** The shoots of Poly Haven "Moss 01" (CC0, Rob Tuytel), each seated on its base and one unit tall. */
let mossShoots: { shoots: BufferGeometry[]; material: MeshStandardMaterial } | null = null
function useMossShoots() {
  const { nodes } = useGLTF(`${polyHaven}moss_01/moss_01_1k.gltf`)
  // Built once and shared by every cushion: one texture and one material for all the moss.
  return useMemo(() => mossShoots ??= (() => {
    const shoots: BufferGeometry[] = []
    let source: MeshStandardMaterial | undefined
    for (const node of Object.values(nodes)) {
      const mesh = node as Mesh
      if (!mesh.isMesh || mesh.name.includes('tall')) continue
      source = mesh.material as MeshStandardMaterial
      const geometry = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone())
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name)
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!, centre = box.getCenter(new Vector3()), height = box.max.y - box.min.y
      geometry.translate(-centre.x, -box.min.y, -centre.z)
      geometry.scale(1 / height, 1 / height, 1 / height)
      shoots.push(geometry)
    }
    const material = new MeshStandardMaterial({ map: cutOut(source!.map!), normalMap: source!.normalMap, alphaTest: 0.5, side: DoubleSide, roughness: 0.75, vertexColors: true })
    material.normalScale = new Vector2(1.2, 1.2)
    return { shoots, material }
  })(), [nodes])
}

/**
 * A moss cushion of scanned shoots merged into one mesh: dense and tall in the
 * middle, leaning out and shorter at the edge, dark at the base and lit at the
 * tips, like the cushions in concept image 09 and the clumps in image 12.
 */
function ScanMoss({ x, z, radius, count, ground, flat = false, spots, scale = 1, avoid = nowhere, keepOut }: MossProps) {
  const { shoots, material } = useMossShoots()
  const geometry = useMemo(() => {
    const noise = makeNoise(x * 53 + z)
    let seed = 5 + Math.round(Math.abs(x * 311 + z * 173))
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const pieces: BufferGeometry[] = []
    const matrix = new Matrix4(), turn = new Quaternion(), tilt = new Quaternion(), place = new Vector3(), size = new Vector3(), axis = new Vector3(), up = new Vector3(0, 1, 0)
    const total = Math.round(count * 1.7)
    for (let index = 0; index < total; index += 1) {
      const angle = rand() * Math.PI * 2
      const reach = flat ? 1 : 0.7 + noise(Math.cos(angle) * 2 + x, Math.sin(angle) * 2 + z) * 0.6
      const distance = Math.sqrt(rand()) * radius * reach
      const spot = spots?.[Math.floor(rand() * spots.length)]
      const px = spot ? spot.x + (rand() - 0.5) * 0.12 : x + Math.cos(angle) * distance, pz = spot ? spot.z + (rand() - 0.5) * 0.12 : z + Math.sin(angle) * distance
      if (avoid.some((circle) => Math.hypot(px - circle.x, pz - circle.z) < circle.radius) || (!spot && keepOut?.(px, pz))) continue
      const edge = spot || flat ? 0.5 : distance / radius
      // Rounded cushions (Codex review vs image 12, 2026-11-07): a taller dome and shoots that shorten toward the rim.
      const dome = spot || flat ? 0 : Math.sqrt(Math.max(0, 1 - edge ** 2)) * radius * 0.3
      const tall = (0.26 + rand() * 0.14) * (1 - edge * 0.55) * scale
      place.set(px, (spot ? spot.y - 0.04 : ground(px, pz) + dome - 0.05), pz)
      turn.setFromAxisAngle(up, rand() * Math.PI * 2)
      const out = spot ? rand() * Math.PI * 2 : Math.atan2(pz - z, px - x)
      axis.set(Math.sin(out), 0, -Math.cos(out))
      tilt.setFromAxisAngle(axis, -(edge * 0.7 + rand() * 0.25))
      size.set(tall * (0.9 + rand() * 0.3), tall, tall * (0.9 + rand() * 0.3))
      matrix.compose(place, tilt.multiply(turn), size)
      const shoot = shoots[Math.floor(rand() * shoots.length)].clone().applyMatrix4(matrix)
      const local = shoot.getAttribute('position')
      const colours = new Float32Array(local.count * 3)
      const light = 0.85 + noise(px * 3, pz * 3) * 0.35 + rand() * 0.12, warm = 0.9 + rand() * 0.2
      for (let vertex = 0; vertex < local.count; vertex += 1) {
        const rise = Math.min(1, Math.max(0, (local.getY(vertex) - place.y) / tall))
        const shade = light * (0.4 + 0.75 * rise)
        // Sunlit tips go yellow-green like the cushions in image 12; the base stays deep olive.
        colours.set([shade * warm * (0.72 + 0.2 * rise), shade * (0.92 + 0.1 * rise), shade * 0.38], vertex * 3)
      }
      shoot.setAttribute('color', new BufferAttribute(colours, 3))
      pieces.push(shoot)
    }
    return pieces.length ? mergeGeometries(pieces) : null
  }, [shoots, x, z, radius, count, ground, flat, spots, scale, avoid, keepOut])
  if (!geometry) return null
  // Receives shadows but casts none: thousands of cut-out shoots in the shadow pass cost more than the soft shade is worth.
  return <mesh geometry={geometry} material={material} raycast={noRaycast} receiveShadow />
}

/** Dense shrubs of painted sprig cards (two crossed planes each), like a tiny forest. `avoid` keeps sprigs out of circles such as the pond. */
function PaintedMossSprigs({ x, z, radius, count, ground, flat = false, spots, scale = 1, avoid = nowhere, keepOut }: MossProps) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => {
    // One card per sprig, turned no more than +-35 degrees from the jar front (no crossed cards).
    return new PlaneGeometry(1, 1).translate(0, 0.5, 0)
  }, [])
  const texture = useMemo(() => sprigTexture(Math.round(x * 100 + z * 10) + 7), [x, z])
  useLayoutEffect(() => {
    if (!mesh.current) return
    const dummy = new Object3D(), colour = new Color()
    const noise = makeNoise(x * 53 + z)
    let seed = 5
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let index = 0; index < count; index += 1) {
      const angle = rand() * Math.PI * 2
      // Ragged, organic patch edge instead of a perfect circle.
      const reach = flat ? 1 : 0.7 + noise(Math.cos(angle) * 2 + x, Math.sin(angle) * 2 + z) * 0.6
      const distance = Math.sqrt(rand()) * radius * reach
      const spot = spots?.[Math.floor(rand() * spots.length)]
      const px = spot ? spot.x : x + Math.cos(angle) * distance, pz = spot ? spot.z : z + Math.sin(angle) * distance
      const edge = spot || flat ? 0.5 : distance / radius
      const dome = spot || flat ? 0 : Math.sqrt(Math.max(0, 1 - edge ** 2)) * radius * 0.3
      const hidden = avoid.some((circle) => Math.hypot(px - circle.x, pz - circle.z) < circle.radius) || (!spot && !!keepOut?.(px, pz))
      const size = hidden ? 0 : (0.2 + rand() * 0.14) * (1 - edge * 0.35) * scale
      dummy.position.set(px, spot ? spot.y - 0.03 : ground(px, pz) + dome - 0.02, pz)
      dummy.rotation.set((rand() - 0.5) * 0.5, (rand() - 0.5) * 1.2, (rand() - 0.5) * 0.5)
      dummy.scale.set(size, size * (0.9 + rand() * 0.4), size)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
      const light = 0.75 + noise(px * 3, pz * 3) * 0.35 + rand() * 0.15
      colour.setRGB(light, light, light * 0.9, SRGBColorSpace)
      mesh.current.setColorAt(index, colour)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [x, z, radius, count, ground, flat, spots, scale, avoid, keepOut])
  return <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false} raycast={noRaycast} receiveShadow>
    <meshStandardMaterial map={texture} alphaTest={0.4} side={DoubleSide} roughness={1} />
  </instancedMesh>
}

function frondTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128; canvas.height = 256
  const context = canvas.getContext('2d')!
  context.strokeStyle = '#7f9a2c'; context.lineWidth = 3
  context.beginPath(); context.moveTo(64, 256); context.quadraticCurveTo(58, 120, 78, 8); context.stroke()
  for (let step = 0.12; step < 0.96; step += 0.07) {
    const t = step, y = 256 - t * 248, x = 64 + (t * t) * 14 - Math.sin(t * 3) * 3
    const length = 40 * Math.sin(Math.PI * Math.min(1, t * 1.05)) + 6
    for (const side of [-1, 1]) {
      const tone = 160 + Math.random() * 40
      context.fillStyle = `rgb(${tone * 0.66},${tone},${tone * 0.3})`
      context.beginPath(); context.ellipse(x + side * length * 0.5, y - 4, length * 0.5, 5, side * -0.35, 0, Math.PI * 2); context.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A fern sprout of painted frond cards. */
export function Fern({ x, z, ground }: { x: number; z: number; ground: Ground }) {
  const texture = useMemo(frondTexture, [])
  const frond = useMemo(() => new PlaneGeometry(0.55, 1.2).translate(0, 0.6, 0), [])
  const fronds = [[0, 0.25], [2.1, 0.45], [4.2, 0.35], [1.1, 0.1], [3.2, 0.6]]
  return <group position={[x, ground(x, z) - 0.03, z]}>
    {fronds.map(([turn, lean], index) => <group key={index} rotation={[0, turn, 0]}>
      <mesh geometry={frond} rotation={[lean, 0, 0]} castShadow>
        <meshStandardMaterial map={texture} alphaTest={0.4} side={DoubleSide} roughness={0.9} />
      </mesh>
    </group>)}
  </group>
}

/** Centre a scan on its bottom and lay anything taller than it is wide down on the soil. Returns its largest size. */
function seat(geometry: BufferGeometry, lieDown: boolean) {
  geometry.computeBoundingBox()
  const upright = geometry.boundingBox!.getSize(new Vector3())
  if (lieDown && upright.y > Math.max(upright.x, upright.z)) { geometry.rotateZ(Math.PI / 2); geometry.computeBoundingBox() }
  const box = geometry.boundingBox!
  const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3())
  geometry.translate(-centre.x, -box.min.y, -centre.z)
  return Math.max(size.x, size.y, size.z)
}

const scanParts = new WeakMap<Mesh, { geometry: BufferGeometry; material: MeshStandardMaterial; largest: number }>()
const stoneParts = new WeakMap<Mesh, { geometry: BufferGeometry; material: MeshStandardMaterial; footprint: number }>()
/** A scan's material with its colour map softened by `paintify`. */
function paintedScan(source: MeshStandardMaterial, extra: string, blur: number, normal: number) {
  const material = source.clone()
  if (source.map) { material.map = paintify(source.map, extra, blur); material.map.repeat.set(1, 1); material.map.flipY = source.map.flipY }
  material.normalScale = new Vector2(normal, normal)
  return material
}

/** A Poly Haven CC0 scan placed on the soil: one node, painted like the rest of the set, scaled to `length` units. */
const wetScans = new Map<Material, Material>()
/** Under water a stone is darker and glossier, with a green film of algae (stones looked like pale debris). */
function wetScan(material: Material) {
  let wet = wetScans.get(material)
  if (!wet) {
    const standard = (material as MeshStandardMaterial).clone()
    standard.color.multiply(new Color(0.5, 0.58, 0.44)); standard.roughness = 0.35
    wet = standard
    wetScans.set(material, wet)
  }
  return wet
}

export function ScannedProp({ file, node, x, z, length, turn, ground, lift = 0, wet = false }: { file: string; node: string; x: number; z: number; length: number; turn: number; ground: Ground; lift?: number; wet?: boolean }) {
  const { nodes } = useGLTF(`${polyHaven}${file}`)
  const mesh = nodes[node] as Mesh
  const { geometry, material, largest } = useMemo(() => {
    // One seated geometry and one painted material per scan node, shared by every copy
    // (each copy used to paint its own 1k texture: 13 pebbles meant 13 textures).
    const cached = scanParts.get(mesh)
    if (cached) return cached
    const geometry = lighter(mesh.geometry, 0.12).clone()
    const largest = seat(geometry, true)
    const parts = { geometry, material: paintedScan(mesh.material as MeshStandardMaterial, 'saturate(0.9)', 1.5, 0.6), largest }
    scanParts.set(mesh, parts)
    return parts
  }, [mesh])
  const scale = length / largest
  return <mesh geometry={geometry} material={wet ? wetScan(material) : material} position={[x, ground(x, z) - 0.02 + lift, z]} rotation={[0, turn, 0]} scale={scale} raycast={noRaycast} castShadow receiveShadow />
}

/** A painted grey stone from Poly Haven "Rock Moss Set 01" with a cap of moss sprigs on its upward faces. */
export function MossyStone({ node, x, z, width, turn, ground, sink = 0.2, moss = true }: { node: string; x: number; z: number; width: number; turn: number; ground: Ground; sink?: number; moss?: boolean }) {
  const { nodes } = useGLTF(`${polyHaven}rock_moss_set_01/rock_moss_set_01_1k.gltf`)
  const rock = nodes[node] as Mesh
  const { geometry, material, footprint } = useMemo(() => {
    const cached = stoneParts.get(rock)
    if (cached) return cached
    const geometry = lighter(rock.geometry, 0.4).clone()
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new Vector3())
    seat(geometry, false)
    const material = paintedScan(rock.material as MeshStandardMaterial, 'saturate(0.45) brightness(1.15)', 0, 1)
    material.userData.realistic = true
    material.color = new Color('#ece8e2')
    const parts = { geometry, material, footprint: Math.max(size.x, size.z) }
    stoneParts.set(rock, parts)
    return parts
  }, [rock])
  const scale = width / footprint
  const position = useMemo(() => new Vector3(x, ground(x, z) - sink * width, z), [x, z, ground, sink, width])
  const top = useMemo(() => {
    const placement = new Object3D()
    placement.position.copy(position); placement.rotation.set(0, turn, 0); placement.scale.setScalar(scale); placement.updateMatrix()
    const vertices = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
    const spots: Vector3[] = [], up = new Vector3()
    const turnNormal = new Matrix3().getNormalMatrix(placement.matrix)
    for (let index = 0; index < vertices.count; index += 3) {
      up.fromBufferAttribute(normals, index).applyMatrix3(turnNormal).normalize()
      if (up.y > 0.6) spots.push(new Vector3().fromBufferAttribute(vertices, index).applyMatrix4(placement.matrix))
    }
    const highest = Math.max(...spots.map((spot) => spot.y))
    return spots.filter((spot) => spot.y > highest - width * 0.22)
  }, [geometry, position, turn, scale, width])
  return <>
    <mesh geometry={geometry} material={material} position={position} rotation={[0, turn, 0]} scale={scale} castShadow receiveShadow />
    {moss && top.length > 0 && <MossSprigs x={x} z={z} radius={1} count={Math.round(220 * width)} ground={ground} spots={top} scale={0.4 + width * 0.3} />}
  </>
}
