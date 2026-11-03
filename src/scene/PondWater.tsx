import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { AdditiveBlending, BufferAttribute, CanvasTexture, Color, DoubleSide, FrontSide, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import type { Group, Texture } from 'three'
import type { Pond } from '../sim/pond'
import { pondCenter } from '../sim/pond'
import { environmentScale } from './scale'
import { paintify, polyHaven } from './semiReal'

/*
 * The pond: a 6 cm bowl about 2 cm deep with a shallow shelf at the edge.
 *
 * Looks follow real still water:
 * - Clear water is nearly colourless; you see the bed through it, and deeper
 *   water looks darker and bluer-green because water absorbs red light first
 *   (https://en.wikipedia.org/wiki/Color_of_water).
 * - Green algae turn it pea-green and cloudy, rotting leaves stain it brown
 *   with tannins, and low oxygen goes with grey murk. Cloudier water hides
 *   the bed.
 * - The surface reflects the sky more at grazing angles (Fresnel), shows
 *   sunlight caustics on the bed, and stays almost flat in a closed jar;
 *   swimming animals and poured water send out rings.
 * - Below 60% of capacity the level visibly drops and the wet bank shows.
 */

const R = pondCenter.radius
const surface = environmentScale.pondSurfaceY
const deep = environmentScale.pondVisualDepth
const bed = environmentScale.pondBedY
const smooth = (edge0: number, edge1: number, value: number) => { const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t) }
/** Bed height at distance r from the pond centre: flat 2 cm deep middle, sloping up to the bank. */
export const pondBedAt = (r: number) => bed + deep * smooth(0.5 * R, 1.04 * R, r)
const noRaycast = () => undefined
/** Where the water meets the bowl at a given level. */
function shoreRadius(level: number) {
  let low = 0, high = R * 1.04
  for (let step = 0; step < 20; step += 1) { const mid = (low + high) / 2; if (pondBedAt(mid) < level) low = mid; else high = mid }
  return low
}

/** How the water looks for the simulated pond chemistry. */
export function waterLook(pond: Pond) {
  const green = Math.min(1, pond.algae / 12)
  const brown = Math.min(0.7, pond.organic / 30)
  const stale = Math.max(0, Math.min(1, 0.6 - pond.oxygen / Math.max(1, pond.water)))
  const tint = new Color('#3d6b62').lerp(new Color('#5f8a33'), green).lerp(new Color('#7a5a2c'), brown).lerp(new Color('#7c8378'), stale * 0.5)
  const cloud = Math.min(1, green * 0.75 + brown * 0.5 + stale * 0.4)
  return { tint, cloud, level: surface - Math.max(0, (60 - pond.water) / 60) * deep * 0.8 }
}

/** The bowl profile, inner side up. */
function bowl(segments = 64) {
  const points: Vector2[] = []
  for (let index = 0; index <= 24; index += 1) {
    const r = index / 24 * R * 1.04
    points.push(new Vector2(r, pondBedAt(r) - bed))
  }
  const geometry = new LatheGeometry(points, segments)
  // Planar UVs (seen from above) so pebbles and caustics keep their size across the bowl.
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv')
  for (let index = 0; index < position.count; index += 1) uv.setXY(index, position.getX(index) / (2 * R) + 0.5, position.getZ(index) / (2 * R) + 0.5)
  return geometry
}

/** Rippled height field baked into a tiling normal map: a few soft crossing waves. */
function rippleNormals() {
  const size = 128
  const height = (x: number, y: number) => {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 5 - v * 4 + 1.3) * 0.3 + Math.sin(u * 2 - v * 7 + 2.1) * 0.2
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const dx = height(x + 1, y) - height(x - 1, y), dy = height(x, y + 1) - height(x, y - 1)
    const length = Math.hypot(dx, dy, 1)
    const index = (y * size + x) * 4
    image.data[index] = (-dx / length * 0.5 + 0.5) * 255
    image.data[index + 1] = (-dy / length * 0.5 + 0.5) * 255
    image.data[index + 2] = (1 / length * 0.5 + 0.5) * 255
    image.data[index + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

/** Sunlight focused by surface ripples onto the bed: a soft net of bright lines. */
function causticTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = '#000'; context.fillRect(0, 0, size, size)
  context.strokeStyle = 'rgba(255,250,225,0.55)'
  context.lineWidth = 6
  context.filter = 'blur(2.5px)'
  let seed = 11
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  // Cells drawn on a 3x3 tiling so the edges wrap.
  const cells = Array.from({ length: 22 }, () => [rand() * size, rand() * size, 14 + rand() * 18])
  for (const [cx, cy, radius] of cells) for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    context.beginPath()
    for (let step = 0; step <= 12; step += 1) {
      const angle = step / 12 * Math.PI * 2, wobble = radius * (0.8 + 0.3 * Math.sin(angle * 3 + cx))
      const x = cx + ox + Math.cos(angle) * wobble, y = cy + oy + Math.sin(angle) * wobble
      if (step === 0) context.moveTo(x, y); else context.lineTo(x, y)
    }
    context.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(1.3, 1.3)
  return texture
}

const pebbleRepeat: [number, number] = [0.6, 0.6] // one scan tile over most of the bowl: pebbles about 3-6 mm across, like aquarium gravel

function PebbleBed({ geometry }: { geometry: LatheGeometry }) {
  const set = useTexture({ map: `${polyHaven}clean_pebbles/clean_pebbles_diff_1k.jpg`, normalMap: `${polyHaven}clean_pebbles/clean_pebbles_nor_gl_1k.jpg` }) as Record<string, Texture>
  const material = useMemo(() => {
    for (const texture of Object.values(set)) { texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(...pebbleRepeat) }
    set.map.colorSpace = SRGBColorSpace
    // Silt settles over the pebbles; a muddy tint keeps them from reading as a fish-tank floor.
    return { map: paintify(set.map, 'brightness(0.85) saturate(0.75)', 0.5), normalMap: set.normalMap, normalScale: new Vector2(0.5, 0.5), color: new Color('#c9b89a'), roughness: 0.9 }
  }, [set])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial {...material} side={DoubleSide} /></mesh>
}

type Swimmer = { id: number; x: number; z: number }
type Ring = { mesh: Mesh; age: number; life: number; size: number }

export function PondWater({ pond, underwater, swimmers, onPondClick }: { pond: Pond; underwater: boolean; swimmers: Swimmer[]; onPondClick: (x: number, z: number) => void }) {
  const look = waterLook(pond)
  const parts = useMemo(() => {
    const geometry = bowl()
    // Darkening that grows with depth: vertex alpha follows the water column above each bed point.
    const shade = geometry.clone()
    const position = shade.getAttribute('position')
    const colours = new Float32Array(position.count * 4)
    for (let index = 0; index < position.count; index += 1) {
      const depth = Math.max(0, surface - (bed + position.getY(index))) / deep
      colours.set([0.13, 0.25, 0.24, Math.min(0.38, depth * 0.38)], index * 4)
    }
    shade.setAttribute('color', new BufferAttribute(colours, 4))
    return { geometry, shade, ripples: rippleNormals(), caustics: causticTexture() }
  }, [])
  const surfaceMaterial = useMemo(() => new MeshPhysicalMaterial({ transparent: true, roughness: 0.03, metalness: 0, ior: 1.333, reflectivity: 0.5, normalMap: parts.ripples, normalScale: new Vector2(0.06, 0.06), depthWrite: false }), [parts])
  const causticMaterial = useMemo(() => new MeshBasicMaterial({ map: parts.caustics, transparent: true, blending: AdditiveBlending, depthWrite: false }), [parts])
  const water = useRef<Mesh>(null)
  const rings = useRef<Group>(null)
  const state = useRef({ level: look.level, pool: [] as Ring[], last: new Map<number, { x: number; z: number; t: number }>(), water: pond.water, clock: 0 })

  // Mutable material settings follow the chemistry each render.
  surfaceMaterial.color.copy(look.tint)
  surfaceMaterial.opacity = 0.05 + look.cloud * 0.8
  surfaceMaterial.side = underwater ? DoubleSide : FrontSide
  causticMaterial.opacity = 0.55 * (1 - look.cloud)

  const ring = (x: number, z: number, size: number, life: number) => {
    const free = state.current.pool.find((item) => item.age >= item.life)
    if (!free) return
    free.mesh.position.set(x - pondCenter.x, 0.003, z - pondCenter.z)
    free.age = 0; free.life = life; free.size = size
  }

  useFrame((_, delta) => {
    const memory = state.current
    memory.clock += delta
    // The level eases to its new height, like water settling after a pour.
    memory.level += (look.level - memory.level) * Math.min(1, delta * 1.5)
    if (water.current) { water.current.position.y = memory.level - bed; water.current.scale.setScalar(Math.max(0.01, shoreRadius(memory.level) / (R * 1.04))) }
    if (rings.current) rings.current.position.y = memory.level - bed
    // Ripple normals drift slowly in two directions; a closed jar has no wind.
    parts.ripples.offset.set(memory.clock * 0.012, memory.clock * 0.007)
    parts.caustics.offset.set(Math.sin(memory.clock * 0.3) * 0.05, memory.clock * 0.01)
    if (pond.water > memory.water + 0.5) for (let index = 0; index < 4; index += 1) ring(pondCenter.x + (index - 1.5) * 0.2, pondCenter.z, 0.9, 1.6 + index * 0.2)
    memory.water = pond.water
    // A swimmer that moves far enough stirs the surface behind it.
    for (const swimmer of swimmers) {
      const before = memory.last.get(swimmer.id)
      if (!before || Math.hypot(swimmer.x - before.x, swimmer.z - before.z) > 0.25 || memory.clock - before.t > 6) {
        if (before) ring(swimmer.x, swimmer.z, 0.35, 1.4)
        memory.last.set(swimmer.id, { x: swimmer.x, z: swimmer.z, t: memory.clock })
      }
    }
    for (const item of memory.pool) {
      item.age += delta
      const t = Math.min(1, item.age / item.life)
      item.mesh.visible = t < 1
      item.mesh.scale.setScalar(0.05 + t * item.size)
      ;(item.mesh.material as MeshBasicMaterial).opacity = (1 - t) * 0.35
    }
  })

  return <group position={[pondCenter.x, bed, pondCenter.z]} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onPondClick(event.point.x, event.point.z) }}>
    <Suspense fallback={<mesh geometry={parts.geometry}><meshStandardMaterial color="#5d5040" roughness={1} side={DoubleSide} /></mesh>}>
      <PebbleBed geometry={parts.geometry} />
    </Suspense>
    <mesh geometry={parts.geometry} position={[0, 0.008, 0]} material={causticMaterial} raycast={noRaycast} renderOrder={1} />
    <mesh geometry={parts.shade} position={[0, 0.006, 0]} raycast={noRaycast}>
      <meshBasicMaterial vertexColors transparent depthWrite={false} side={DoubleSide} />
    </mesh>
    <mesh ref={water} visible={pond.water > 1} rotation={[-Math.PI / 2, 0, 0]} position={[0, look.level - bed, 0]} material={surfaceMaterial} raycast={noRaycast} renderOrder={1}>
      <circleGeometry args={[R * 1.04, 96]} />
    </mesh>
    <group ref={rings}>
      {Array.from({ length: 10 }, (_, index) => <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={noRaycast} ref={(mesh) => { if (mesh && !state.current.pool.some((item) => item.mesh === mesh)) state.current.pool.push({ mesh, age: 1, life: 1, size: 1 }) }}>
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial color="#f4fbf6" transparent opacity={0} depthWrite={false} />
      </mesh>)}
    </group>
  </group>
}
