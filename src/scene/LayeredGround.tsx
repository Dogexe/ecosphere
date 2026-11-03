import { useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Texture } from 'three'
import { cellX, index, inside, substrateSize, topAt, topLayer, wetness } from '../sim/substrate'
import type { Substrate } from '../sim/substrate'
import { paintify, polyHaven } from './semiReal'

/*
 * Draws a poured substrate: the top surface and the strata seen through the
 * glass. Colour comes from the layer on top (and how wet the soil is); a
 * painted soil scan adds grain. Used by the jar builder every frame while
 * pouring, and once by the game for a jar the player built.
 */

const N = substrateSize
const R = cellX(N - 1)
export const layerColours = { gravel: new Color('#d3cbbd'), charcoal: new Color('#33302d'), soil: new Color('#8a6244'), wetSoil: new Color('#4a3121'), water: new Color('#7fb4d8') }

/** The ring next to the glass is drawn from one band of cells so the top surface meets the strata on the wall without a gap. */
const RIM = R - 0.35
const cellAt = (x: number, z: number) => index(Math.round((x + R) / (2 * R) * (N - 1)), Math.round((z + R) / (2 * R) * (N - 1)))
function sampleCell(x: number, z: number) {
  const r = Math.hypot(x, z)
  if (r <= RIM) { const k = cellAt(x, z); if (inside[k]) return k }
  const pull = RIM / Math.max(r, 1e-6)
  return cellAt(x * pull, z * pull)
}

export type GroundShape = {
  /** Optional height override for a point, for instance to sink the ground under a pond. */
  shape?: (x: number, z: number, height: number) => number
  /** How much of the poured puddle water still stands at a point (0-1); the game dries puddles as the soil drains. */
  poolScale?: (x: number, z: number) => number
}

export function useLayeredGeometry() {
  return useMemo(() => {
    const surface = new PlaneGeometry(2 * R, 2 * R, N - 1, N - 1).rotateX(-Math.PI / 2)
    surface.setAttribute('color', new BufferAttribute(new Float32Array(N * N * 3), 3))
    surface.setAttribute('pebble', new BufferAttribute(new Float32Array(N * N), 1))
    // UVs in world units so the grain keeps its size: about 4 tiles across the jar.
    const uv = surface.getAttribute('uv') as BufferAttribute, position = surface.getAttribute('position') as BufferAttribute
    for (let v = 0; v < uv.count; v += 1) uv.setXY(v, position.getX(v) / 1.9, position.getZ(v) / 1.9)
    const ring = 160, bands = 5
    const walls = new BufferGeometry()
    walls.setAttribute('position', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    walls.setAttribute('color', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    walls.setAttribute('uv', new BufferAttribute(new Float32Array(ring * bands * 6 * 2), 2).setUsage(DynamicDrawUsage))
    walls.setAttribute('pebble', new BufferAttribute(new Float32Array(ring * bands * 6), 1).setUsage(DynamicDrawUsage))
    const puddles = new PlaneGeometry(2 * R, 2 * R, N - 1, N - 1).rotateX(-Math.PI / 2)
    puddles.setAttribute('color', new BufferAttribute(new Float32Array(N * N * 4), 4))
    return { surface, walls, puddles, ring }
  }, [])
}

const tint = new Color(), other = new Color()
/** Puddle water over soil: clear but tea-coloured from the humus it sits on. */
const waterTint = new Color('#5e6650')

/** Rewrites both geometries from the substrate. Cheap enough to run every frame (40×40 cells). */
export function updateLayered(geometry: ReturnType<typeof useLayeredGeometry>, state: Substrate, { shape, poolScale }: GroundShape = {}) {
  const position = geometry.surface.getAttribute('position') as BufferAttribute
  const water = geometry.puddles.getAttribute('position') as BufferAttribute
  const waterColours = geometry.puddles.getAttribute('color') as BufferAttribute
  const colours = geometry.surface.getAttribute('color') as BufferAttribute
  const pebbles = geometry.surface.getAttribute('pebble') as BufferAttribute
  for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
    const x = cellX(i), z = cellX(j), r = Math.hypot(x, z), limit = R - 0.02
    const k = sampleCell(x, z), v = j * N + i
    const px = r > limit ? x * limit / r : x, pz = r > limit ? z * limit / r : z
    const height = topAt(state, k)
    const ground = shape ? shape(px, pz, height) : height + 0.001
    position.setXYZ(v, px, ground, pz)
    // Standing water: a sheet just above the ground where there is any, tucked under it where there is none,
    // so the shoreline falls where the two cross. None where the game has dug the pond.
    const depth = (shape && Math.abs(ground - height) > 0.05) ? 0 : state.pool[k] * (poolScale ? poolScale(px, pz) : 1)
    if (depth > 0.004) { water.setXYZ(v, px, ground + depth + 0.003, pz); waterColours.setXYZW(v, waterTint.r, waterTint.g, waterTint.b, Math.min(0.68, 0.25 + depth * 2)) }
    else { water.setXYZ(v, px, ground - 0.02, pz); waterColours.setXYZW(v, waterTint.r, waterTint.g, waterTint.b, 0) }
    const layer = topLayer(state, k)
    if (!layer) tint.set('#eef2f0')
    else if (layer === 'soil') tint.copy(layerColours.soil).lerp(layerColours.wetSoil, wetness(state, k))
    else tint.copy(layerColours[layer])
    colours.setXYZ(v, tint.r, tint.g, tint.b)
    pebbles.setX(v, layer === 'gravel' ? 1 : 0)
  }
  position.needsUpdate = true; colours.needsUpdate = true; pebbles.needsUpdate = true; water.needsUpdate = true; waterColours.needsUpdate = true
  geometry.puddles.computeVertexNormals()
  geometry.surface.computeVertexNormals()
  geometry.surface.computeBoundingSphere(); geometry.surface.computeBoundingBox()

  const wall = geometry.walls.getAttribute('position') as BufferAttribute
  const wallColours = geometry.walls.getAttribute('color') as BufferAttribute
  const wallUv = geometry.walls.getAttribute('uv') as BufferAttribute
  const wallPebbles = geometry.walls.getAttribute('pebble') as BufferAttribute
  let n = 0, pebble = 0
  const put = (x: number, y: number, z: number, colour: Color, u: number, flat = false) => { wall.setXYZ(n, x, y, z); wallColours.setXYZ(n, colour.r, colour.g, colour.b); if (flat) wallUv.setXY(n, x / 1.9, z / 1.9); else wallUv.setXY(n, u * 12, y / 1.9); wallPebbles.setX(n, pebble); n += 1 }
  const topColour = (k: number, into: Color) => { const layer = topLayer(state, k); return !layer ? into.set('#eef2f0') : layer === 'soil' ? into.copy(layerColours.soil).lerp(layerColours.wetSoil, wetness(state, k)) : into.copy(layerColours[layer]) }
  const capA = new Color(), capB = new Color()
  const edge = (angle: number) => {
    const k = sampleCell(Math.cos(angle) * R, Math.sin(angle) * R)
    return { x: Math.cos(angle) * (R + 0.02), z: Math.sin(angle) * (R + 0.02), ix: Math.cos(angle) * RIM, iz: Math.sin(angle) * RIM, k, g: state.gravel[k], c: state.charcoal[k], s: state.soil[k], wet: wetness(state, k) }
  }
  for (let step = 0; step < geometry.ring; step += 1) {
    const a = edge(step / geometry.ring * Math.PI * 2), b = edge((step + 1) / geometry.ring * Math.PI * 2)
    const ua = step / geometry.ring, ub = (step + 1) / geometry.ring
    const band = (y0a: number, y1a: number, y0b: number, y1b: number, ca: Color, cb: Color) => {
      put(a.x, y0a, a.z, ca, ua); put(b.x, y0b, b.z, cb, ub); put(b.x, y1b, b.z, cb, ub)
      put(a.x, y0a, a.z, ca, ua); put(b.x, y1b, b.z, cb, ub); put(a.x, y1a, a.z, ca, ua)
    }
    pebble = 1
    band(0, a.g, 0, b.g, layerColours.gravel, layerColours.gravel)
    // Drained water standing in the gravel shows as a darker, bluish band through the glass.
    band(0.002, Math.min(state.table, a.g), 0.002, Math.min(state.table, b.g), other.copy(layerColours.gravel).lerp(layerColours.water, 0.55), other)
    pebble = 0
    band(a.g, a.g + a.c, b.g, b.g + b.c, layerColours.charcoal, layerColours.charcoal)
    const sa = tint.copy(layerColours.soil).lerp(layerColours.wetSoil, a.wet).clone(), sb = new Color().copy(layerColours.soil).lerp(layerColours.wetSoil, b.wet)
    band(a.g + a.c, a.g + a.c + a.s, b.g + b.c, b.g + b.c + b.s, sa, sb)
    // A flat lip from the rim band of cells out to the glass: the grid's square edge never leaves a gap to see through.
    const ta = a.g + a.c + a.s, tb = b.g + b.c + b.s
    topColour(a.k, capA); topColour(b.k, capB); pebble = topLayer(state, a.k) === 'gravel' ? 1 : 0
    put(a.ix, ta, a.iz, capA, 0, true); put(b.x, tb, b.z, capB, 0, true); put(b.ix, tb, b.iz, capB, 0, true)
    put(a.ix, ta, a.iz, capA, 0, true); put(a.x, ta, a.z, capA, 0, true); put(b.x, tb, b.z, capB, 0, true)
  }
  wall.needsUpdate = true; wallColours.needsUpdate = true; wallUv.needsUpdate = true; wallPebbles.needsUpdate = true
  geometry.walls.computeVertexNormals()
}

/**
 * The layer material: a painted soil grain everywhere, swapped for a pebble
 * scan where gravel is on top or in the gravel band of the wall. Vertex
 * colours tint both (wet soil darker, charcoal near black).
 */
export function useLayerMaterials() {
  const [scan, pebbleScan] = useTexture([`${polyHaven}forest_ground_04/forest_ground_04_diff_1k.jpg`, `${polyHaven}clean_pebbles/clean_pebbles_diff_1k.jpg`]) as Texture[]
  return useMemo(() => {
    scan.colorSpace = SRGBColorSpace
    const grain = paintify(scan, 'saturate(0) brightness(1.5) contrast(1.1)', 0.6)
    grain.wrapS = grain.wrapT = RepeatWrapping
    pebbleScan.colorSpace = SRGBColorSpace
    const pebble = paintify(pebbleScan, 'saturate(0.45) brightness(1.15) contrast(1.15)', 0)
    pebble.wrapS = pebble.wrapT = RepeatWrapping
    const make = (roughness: number, double: boolean) => {
      const material = new MeshStandardMaterial({ vertexColors: true, map: grain, roughness, side: double ? DoubleSide : undefined })
      material.onBeforeCompile = (shader) => {
        shader.uniforms.pebbleMap = { value: pebble }
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float pebble;\nvarying float vPebble;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPebble = pebble;')
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D pebbleMap;\nvarying float vPebble;').replace('#include <map_fragment>', 'diffuseColor *= mix(texture2D(map, vMapUv), texture2D(pebbleMap, vMapUv * 0.35), vPebble);')
      }
      return material
    }
    const puddles = new MeshPhysicalMaterial({ vertexColors: true, transparent: true, roughness: 0.06, metalness: 0, ior: 1.333, specularIntensity: 1, depthWrite: false })
    return { surface: make(0.95, false), walls: make(0.9, true), puddles }
  }, [scan, pebbleScan])
}

/** Static drawing of a built substrate, raised by `floor`. */
export function LayeredGround({ state, floor, shape, poolScale, onClick }: { state: Substrate; floor: number; shape?: GroundShape['shape']; poolScale?: GroundShape['poolScale']; onClick?: boolean }) {
  const geometry = useLayeredGeometry()
  const materials = useLayerMaterials()
  useLayoutEffect(() => { updateLayered(geometry, state, { shape, poolScale }) }, [geometry, state, shape, poolScale])
  return <group position={[0, floor, 0]}>
    <mesh geometry={geometry.surface} material={materials.surface} receiveShadow raycast={onClick ? undefined : () => undefined} />
    <mesh geometry={geometry.walls} material={materials.walls} raycast={() => undefined} />
    <mesh geometry={geometry.puddles} material={materials.puddles} raycast={() => undefined} renderOrder={2} />
  </group>
}
