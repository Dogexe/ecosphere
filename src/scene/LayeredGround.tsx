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

/*
 * The sim works on a 40×40 grid of cells (about 3.6 mm each), which drawn as
 * is shows terraced steps and saw-tooth shorelines. The drawing smooths it
 * like settled soil: the cell tops are softened with two small blur passes,
 * then sampled with a smooth (Catmull-Rom) curve onto a mesh three times
 * finer. Plants, animals and the pond stand on the same smoothed ground
 * (see `smoothGround`), so nothing floats or sinks. Visual only: the sim
 * keeps its own heights.
 */
const S = 3
const M = (N - 1) * S + 1
const cellSize = (2 * R) / (N - 1)
const clampCell = (value: number) => Math.min(N - 1, Math.max(0, value))

/** Softened cell tops. Cells outside the jar copy the rim band, so the edge is not pulled down. */
export function smoothTops(state: Substrate) {
  let field = new Float32Array(N * N), next = new Float32Array(N * N)
  for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) field[j * N + i] = topAt(state, sampleCell(cellX(i), cellX(j)))
  for (let pass = 0; pass < 2; pass += 1) {
    for (let axis = 0; axis < 2; axis += 1) {
      for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
        const at = (d: number) => axis === 0 ? field[j * N + clampCell(i + d)] : field[clampCell(j + d) * N + i]
        next[j * N + i] = (at(-1) + 2 * at(0) + at(1)) / 4
      }
      ;[field, next] = [next, field]
    }
  }
  return field
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
/** Smooth height of the softened field at a point. */
export function sampleField(field: Float32Array, x: number, z: number) {
  const fx = Math.min(N - 1.0001, Math.max(0, (x + R) / cellSize)), fz = Math.min(N - 1.0001, Math.max(0, (z + R) / cellSize))
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
  const row = (b: number) => { const o = clampCell(b) * N; return catmull(field[o + clampCell(i - 1)], field[o + i], field[o + clampCell(i + 1)], field[o + clampCell(i + 2)], u) }
  return catmull(row(j - 1), row(j), row(j + 1), row(j + 2), v)
}

/** Ground height function on the smoothed soil, matching what LayeredGround draws (before any `shape`). */
export const smoothGround = (state: Substrate) => { const field = smoothTops(state); return (x: number, z: number) => sampleField(field, x, z) }

/** Plain bilinear blend of a per-cell value, for colours and puddle depth. */
function bilinear(values: Float32Array, stride: number, offset: number, x: number, z: number) {
  const fx = Math.min(N - 1.0001, Math.max(0, (x + R) / cellSize)), fz = Math.min(N - 1.0001, Math.max(0, (z + R) / cellSize))
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
  const at = (a: number, b: number) => values[(b * N + a) * stride + offset]
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v
}
const smoothstep = (edge0: number, edge1: number, value: number) => { const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t) }

export function useLayeredGeometry() {
  return useMemo(() => {
    const surface = new PlaneGeometry(2 * R, 2 * R, M - 1, M - 1).rotateX(-Math.PI / 2)
    surface.setAttribute('color', new BufferAttribute(new Float32Array(M * M * 3), 3))
    surface.setAttribute('pebble', new BufferAttribute(new Float32Array(M * M), 1))
    // UVs in world units so the grain keeps its size: about 4 tiles across the jar.
    const uv = surface.getAttribute('uv') as BufferAttribute, position = surface.getAttribute('position') as BufferAttribute
    for (let v = 0; v < uv.count; v += 1) uv.setXY(v, position.getX(v) / 1.9, position.getZ(v) / 1.9)
    const ring = 160, bands = 5
    const walls = new BufferGeometry()
    walls.setAttribute('position', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    walls.setAttribute('color', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    walls.setAttribute('uv', new BufferAttribute(new Float32Array(ring * bands * 6 * 2), 2).setUsage(DynamicDrawUsage))
    walls.setAttribute('pebble', new BufferAttribute(new Float32Array(ring * bands * 6), 1).setUsage(DynamicDrawUsage))
    const puddles = new PlaneGeometry(2 * R, 2 * R, M - 1, M - 1).rotateX(-Math.PI / 2)
    puddles.setAttribute('color', new BufferAttribute(new Float32Array(M * M * 4), 4))
    return { surface, walls, puddles, ring, cells: new Float32Array(N * N * 5) }
  }, [])
}

const tint = new Color(), other = new Color()
/** Puddle water over soil: clear but tea-coloured from the humus it sits on. */
const waterTint = new Color('#5e6650')

/** Rewrites both geometries from the substrate. Cheap enough to run every frame while pouring. */
export function updateLayered(geometry: ReturnType<typeof useLayeredGeometry>, state: Substrate, { shape, poolScale }: GroundShape = {}) {
  const position = geometry.surface.getAttribute('position') as BufferAttribute
  const water = geometry.puddles.getAttribute('position') as BufferAttribute
  const waterColours = geometry.puddles.getAttribute('color') as BufferAttribute
  const colours = geometry.surface.getAttribute('color') as BufferAttribute
  const pebbles = geometry.surface.getAttribute('pebble') as BufferAttribute
  const field = smoothTops(state)
  // Per-cell colour (rgb), pebble and standing water, blended between cells on the finer mesh.
  const cells = geometry.cells
  for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
    const k = sampleCell(cellX(i), cellX(j)), o = (j * N + i) * 5
    const layer = topLayer(state, k)
    if (!layer) tint.set('#eef2f0')
    else if (layer === 'soil') tint.copy(layerColours.soil).lerp(layerColours.wetSoil, wetness(state, k))
    else tint.copy(layerColours[layer])
    cells[o] = tint.r; cells[o + 1] = tint.g; cells[o + 2] = tint.b; cells[o + 3] = layer === 'gravel' ? 1 : 0; cells[o + 4] = state.pool[k]
  }
  const step = (2 * R) / (M - 1), limit = R - 0.02
  for (let j = 0; j < M; j += 1) for (let i = 0; i < M; i += 1) {
    const x = -R + i * step, z = -R + j * step, r = Math.hypot(x, z), v = j * M + i
    const px = r > limit ? x * limit / r : x, pz = r > limit ? z * limit / r : z
    const height = sampleField(field, px, pz)
    const ground = shape ? shape(px, pz, height) : height + 0.001
    position.setXYZ(v, px, ground, pz)
    // Standing water: a sheet just above the ground where there is any, tucked under it where there is none,
    // so the shoreline falls where the two cross. None where the game has dug the pond.
    const depth = (shape && Math.abs(ground - height) > 0.05) ? 0 : bilinear(cells, 5, 4, px, pz) * (poolScale ? poolScale(px, pz) : 1)
    if (depth > 0.004) { water.setXYZ(v, px, ground + depth + 0.003, pz); waterColours.setXYZW(v, waterTint.r, waterTint.g, waterTint.b, Math.min(0.68, 0.25 + depth * 2) * smoothstep(0.004, 0.03, depth)) }
    else { water.setXYZ(v, px, ground - 0.02, pz); waterColours.setXYZW(v, waterTint.r, waterTint.g, waterTint.b, 0) }
    colours.setXYZ(v, bilinear(cells, 5, 0, px, pz), bilinear(cells, 5, 1, px, pz), bilinear(cells, 5, 2, px, pz))
    pebbles.setX(v, bilinear(cells, 5, 3, px, pz))
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
  const put = (x: number, y: number, z: number, colour: Color, u: number, flat = false) => { wall.setXYZ(n, x, y, z); wallColours.setXYZ(n, colour.r, colour.g, colour.b); if (flat) wallUv.setXY(n, x / 1.9, z / 1.9); else wallUv.setXY(n, u * 26, y / 0.9); wallPebbles.setX(n, pebble); n += 1 }
  const topColour = (k: number, into: Color) => { const layer = topLayer(state, k); return !layer ? into.set('#eef2f0') : layer === 'soil' ? into.copy(layerColours.soil).lerp(layerColours.wetSoil, wetness(state, k)) : into.copy(layerColours[layer]) }
  const capA = new Color(), capB = new Color()
  const edge = (angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const k = sampleCell(cos * R, sin * R)
    // The strata follow the smoothed top at the glass, each layer keeping its share of the column.
    const top = sampleField(field, cos * limit, sin * limit), column = topAt(state, k), share = column > 1e-6 ? top / column : 1
    return { x: cos * (R + 0.02), z: sin * (R + 0.02), ix: cos * RIM, iz: sin * RIM, k, g: state.gravel[k] * share, c: state.charcoal[k] * share, s: state.soil[k] * share, inner: sampleField(field, cos * RIM, sin * RIM) - 0.002, wet: wetness(state, k) }
  }
  // The layer lines through the glass come from the coarse cell grid and would step like saw teeth;
  // poured layers settle into soft waves, so smooth each line around the jar (top stays where it is).
  const ring = Array.from({ length: geometry.ring }, (_, step) => edge(step / geometry.ring * Math.PI * 2))
  const soften = (values: number[], reach: number) => values.map((_, i) => { let sum = 0; for (let d = -reach; d <= reach; d += 1) sum += values[(i + d + values.length) % values.length]; return sum / (2 * reach + 1) })
  const reach = Math.max(2, Math.round(geometry.ring / 64))
  const gravelLine = soften(soften(ring.map((e) => e.g), reach), reach), charcoalLine = soften(soften(ring.map((e) => e.g + e.c), reach), reach)
  ring.forEach((e, i) => { const top = e.g + e.c + e.s; e.g = Math.min(gravelLine[i], top); e.c = Math.max(0, Math.min(charcoalLine[i], top) - e.g); e.s = Math.max(0, top - e.g - e.c) })
  for (let step = 0; step < geometry.ring; step += 1) {
    const a = ring[step], b = ring[(step + 1) % geometry.ring]
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
    // A lip from just under the surface out to the glass: the grid's square edge never leaves a gap to see through.
    const ta = a.g + a.c + a.s, tb = b.g + b.c + b.s
    topColour(a.k, capA); topColour(b.k, capB); pebble = topLayer(state, a.k) === 'gravel' ? 1 : 0
    put(a.ix, a.inner, a.iz, capA, 0, true); put(b.x, tb, b.z, capB, 0, true); put(b.ix, b.inner, b.iz, capB, 0, true)
    put(a.ix, a.inner, a.iz, capA, 0, true); put(a.x, ta, a.z, capA, 0, true); put(b.x, tb, b.z, capB, 0, true)
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
    const grain = paintify(scan, 'saturate(0) brightness(1.45) contrast(1.6)', 0)
    grain.wrapS = grain.wrapT = RepeatWrapping
    pebbleScan.colorSpace = SRGBColorSpace
    const pebble = paintify(pebbleScan, 'saturate(0.45) brightness(1.15) contrast(1.15)', 0)
    pebble.wrapS = pebble.wrapT = RepeatWrapping
    const make = (roughness: number, double: boolean) => {
      const material = new MeshStandardMaterial({ vertexColors: true, map: grain, roughness, side: double ? DoubleSide : undefined })
      material.userData.realistic = true
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
