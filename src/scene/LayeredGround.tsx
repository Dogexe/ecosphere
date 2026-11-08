import type { MossState } from './MossCarpet'
import { useLayoutEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, Vector4 } from 'three'
import { cellX, index, inside, substrateSize, topAt, topLayer, wetness } from '../sim/substrate'
import type { Substrate } from '../sim/substrate'
import { polyHaven, useTextureSet } from './semiReal'
import { naturalLook } from './PaperCritter'
import { MossCarpet } from './MossCarpet'

/*
 * Draws a poured substrate: the top surface and the strata seen through the
 * glass. Colour comes from the layer on top (and how wet the soil is); a
 * painted soil scan adds grain. Used by the jar builder every frame while
 * pouring, and once by the game for a jar the player built.
 */

const N = substrateSize
const R = cellX(N - 1)
export const layerColours = { gravel: new Color('#a59e92'), charcoal: new Color('#33302d'), soil: new Color('#8a6244'), wetSoil: new Color('#4a3121'), water: new Color('#7fb4d8') }

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
 * like settled soil: the cell tops are softened with four small blur passes,
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
  // Four passes (2026-11-08, overview item 2: bank tops and corners read as sharp boxes); was two.
  for (let pass = 0; pass < 4; pass += 1) {
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
    surface.setAttribute('flatness', new BufferAttribute(new Float32Array(M * M).fill(1), 1))
    // UVs in world units so the grain keeps its size: about 4 tiles across the jar.
    const uv = surface.getAttribute('uv') as BufferAttribute, position = surface.getAttribute('position') as BufferAttribute
    for (let v = 0; v < uv.count; v += 1) uv.setXY(v, position.getX(v) / 2.1, position.getZ(v) / 2.1)
    const ring = 160, bands = 5
    const walls = new BufferGeometry()
    walls.setAttribute('position', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    walls.setAttribute('color', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    walls.setAttribute('uv', new BufferAttribute(new Float32Array(ring * bands * 6 * 2), 2).setUsage(DynamicDrawUsage))
    walls.setAttribute('pebble', new BufferAttribute(new Float32Array(ring * bands * 6), 1).setUsage(DynamicDrawUsage))
    walls.setAttribute('flatness', new BufferAttribute(new Float32Array(ring * bands * 6).fill(1), 1))
    const puddles = new PlaneGeometry(2 * R, 2 * R, M - 1, M - 1).rotateX(-Math.PI / 2)
    puddles.setAttribute('color', new BufferAttribute(new Float32Array(M * M * 4), 4))
    return { surface, walls, puddles, ring, cells: new Float32Array(N * N * 5) }
  }, [])
}

const tint = new Color(), other = new Color()
/** Pebbles under pond water: grey stone greened by a film of algae, darker with depth. */
const pondBed = new Color('#5f6a4c')
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
    // Under standing water the bed reads as washed pebbles and silt, as in concept image 12: the
    // fines wash off the slope and the pond floor is gravel-coloured even where the model keeps soil.
    const bed = smoothstep(0.2, 0.6, state.pool[k])
    if (bed > 0) tint.lerp(pondBed, bed * 0.75)
    cells[o] = tint.r; cells[o + 1] = tint.g; cells[o + 2] = tint.b; cells[o + 3] = Math.max(layer === 'gravel' ? 1 : 0, bed); cells[o + 4] = state.pool[k]
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
  // The surface UVs are a top-down projection, so on the steep pond bank the pebble scan stretches into
  // streaks that read as a see-through ramp (Codex reviews, image 12 rounds 2-5): banks steeper than
  // about 40 degrees show soil instead, and the algae-pebble tint fades with them.
  const normals = geometry.surface.getAttribute('normal') as BufferAttribute, flatAttribute = geometry.surface.getAttribute('flatness') as BufferAttribute
  for (let v = 0; v < pebbles.count; v += 1) {
    const flatness = smoothstep(0.55, 0.85, normals.getY(v))
    // Under the pond, seen at a grazing angle through the water, the scans' bumps also streak: keep it plain.
    const x = position.getX(v), z = position.getZ(v), wet = smoothstep(0.15, 0.5, bilinear(cells, 5, 4, x, z))
    flatAttribute.setX(v, flatness * (1 - wet))
    if (flatness < 1) {
      pebbles.setX(v, pebbles.getX(v) * flatness)
      const soilTone = tint.copy(layerColours.soil).lerp(layerColours.wetSoil, 0.85)
      colours.setXYZ(v, colours.getX(v) * flatness + soilTone.r * (1 - flatness), colours.getY(v) * flatness + soilTone.g * (1 - flatness), colours.getZ(v) * flatness + soilTone.b * (1 - flatness))
    }
  }
  pebbles.needsUpdate = true; colours.needsUpdate = true; flatAttribute.needsUpdate = true
  geometry.surface.computeBoundingSphere(); geometry.surface.computeBoundingBox()

  const wall = geometry.walls.getAttribute('position') as BufferAttribute
  const wallColours = geometry.walls.getAttribute('color') as BufferAttribute
  const wallUv = geometry.walls.getAttribute('uv') as BufferAttribute
  const wallPebbles = geometry.walls.getAttribute('pebble') as BufferAttribute
  let n = 0, pebble = 0
  const put = (x: number, y: number, z: number, colour: Color, u: number, flat = false) => { wall.setXYZ(n, x, y, z); wallColours.setXYZ(n, colour.r, colour.g, colour.b); if (flat) wallUv.setXY(n, x / 2.1, z / 2.1); else wallUv.setXY(n, u * 11, y / 2.1); wallPebbles.setX(n, pebble); n += 1 }
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
    band(0.002, Math.min(state.table, a.g), 0.002, Math.min(state.table, b.g), other.copy(layerColours.gravel).lerp(layerColours.water, 0.2).multiplyScalar(0.85), other)
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
 * The layer materials: real soil, gravel and charcoal-grit scans (Poly Haven,
 * CC0) so the jar reads as photographed, like the owner's target picture
 * (concept round 3, image 12). The vertex colours only say which layer and
 * how wet: wet soil darkens the scan, charcoal (grey) swaps to the black grit,
 * and the `pebble` attribute swaps to gravel. Each 2 m scan tile is mapped to
 * about 4 cm of jar, so a 2-5 cm clod in the scan becomes a 0.5-1 mm crumb.
 */
const soilRef = new Color('#8a6244'), gravelRef = new Color('#d3cbbd')
/** x min, x max, z of the cut face, active flag; filled each frame from cutawayBox. */
export const cutUniform = new Vector4(0, 0, 0, 0)
/**
 * Natural look's ant-farm view (owner's reference, 2026-11-07): the nest's tunnels and chambers, as
 * seen from the glass, open as windows in the soil wall so the nest behind shows through. World-space
 * nodes (x, y, z, radius) and tunnel ends; radius 0 marks an unused slot.
 */
export const nestWindow = {
  nodes: Array.from({ length: 12 }, () => new Vector4(0, -99, 0, 0)),
  edgesA: Array.from({ length: 20 }, () => new Vector4(0, -99, 0, 0)),
  edgesB: Array.from({ length: 20 }, () => new Vector4(0, -99, 0, 0)),
}
export function useLayerMaterials() {
  const set = useTextureSet({
    soil: `${polyHaven}farm_soil/farm_soil_diff_1k.jpg`, soilNormal: `${polyHaven}farm_soil/farm_soil_nor_gl_1k.jpg`,
    pebble: `${polyHaven}clean_pebbles/clean_pebbles_diff_1k.jpg`, grit: `${polyHaven}gravel_stones/gravel_stones_diff_1k.jpg`,
  }, ['soil', 'pebble', 'grit'])
  return useMemo(() => {
    const make = (roughness: number, double: boolean, pebbleScale = 0.6) => {
      const material = new MeshStandardMaterial({ vertexColors: true, map: set.soil, normalMap: naturalLook ? null : set.soilNormal, roughness, side: double ? DoubleSide : undefined })
      material.normalScale.set(1.1, 1.1)
      material.userData.realistic = true
      material.customProgramCacheKey = () => `layer-${pebbleScale}-${naturalLook}`
      material.onBeforeCompile = (shader) => {
        shader.uniforms.pebbleMap = { value: set.pebble }
        shader.uniforms.cutBox = { value: cutUniform }
        shader.uniforms.nestNodes = { value: nestWindow.nodes }
        shader.uniforms.nestA = { value: nestWindow.edgesA }
        shader.uniforms.nestB = { value: nestWindow.edgesB }
        shader.uniforms.gritMap = { value: set.grit }
        shader.uniforms.soilRef = { value: soilRef }
        shader.uniforms.gravelRef = { value: gravelRef }
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float pebble;\nattribute float flatness;\nvarying float vPebble;\nvarying float vFlat;\nvarying vec3 vCutWorld;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPebble = pebble;\nvFlat = flatness;\nvCutWorld = (modelMatrix * vec4(position, 1.0)).xyz;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D pebbleMap;\nuniform sampler2D gritMap;\nuniform vec3 soilRef;\nuniform vec3 gravelRef;\nuniform vec4 cutBox;\nuniform vec4 nestNodes[12];\nuniform vec4 nestA[20];\nuniform vec4 nestB[20];\nvarying vec3 vCutWorld;\nvarying float vPebble;\nvarying float vFlat;')
          // Natural look's nest cutaway: no soil in front of the cut face.
          .replace('void main() {', `void main() {
  ${pebbleScale < 0.2 ? `
  // Nest windows (walls only): measure in the glass's own unrolled coordinates (arc length, height).
  float nestRim = 1e3;
  if (cutBox.w > 0.5) {
    float angle = atan(vCutWorld.z, vCutWorld.x), radius = length(vCutWorld.xz);
    float field = 1e3;
    for (int i = 0; i < 12; i++) { vec4 n = nestNodes[i]; if (n.w <= 0.0) continue; float da = atan(sin(angle - atan(n.z, n.x)), cos(angle - atan(n.z, n.x))); field = min(field, length(vec2(da * radius / 1.12, vCutWorld.y - n.y)) - n.w); }
    for (int i = 0; i < 20; i++) { vec4 a = nestA[i]; if (a.w <= 0.0) continue; vec4 b = nestB[i];
      vec2 pa = vec2(atan(sin(angle - atan(a.z, a.x)), cos(angle - atan(a.z, a.x))) * radius, vCutWorld.y - a.y);
      vec2 ab = vec2(atan(sin(atan(b.z, b.x) - atan(a.z, a.x)), cos(atan(b.z, b.x) - atan(a.z, a.x))) * radius, b.y - a.y);
      float t = clamp(dot(pa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0); field = min(field, length(pa - ab * t) - a.w); }
    if (field < 0.0) discard;
    nestRim = field;
  }` : ''}`)
          // On steep banks the top-down UVs stretch the scan's bumps into streaks; keep the plain normal there.
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(nonPerturbedNormal, normal, vFlat));')
          .replace('#include <map_fragment>', `
            vec3 soilScan = texture2D(map, vMapUv).rgb;
            vec3 pebbleScan = texture2D(pebbleMap, vMapUv * ${pebbleScale.toFixed(3)}).rgb;
            vec3 gritScan = texture2D(gritMap, vMapUv * 0.8).rgb;
            // Wetness darkens the soil scan; grey vertex colour marks the charcoal layer.
            vec3 ratio = clamp(vColor.rgb / soilRef, 0.0, 1.6);
            float warm = (vColor.r - vColor.b) / max(vColor.r, 1e-3);
            float charcoal = (1.0 - vPebble) * (1.0 - smoothstep(0.3, 0.6, warm));
            vec3 soil = soilScan * mix(vec3(1.0), ratio, 0.75) * 0.8;
            // Pale mineral bits (perlite, pumice) scattered through the potting soil, as in concept image 12.
            vec2 cell = floor(vMapUv * 90.0);
            float bit = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            vec2 inCell = fract(vMapUv * 90.0) - 0.5;
            float speck = step(0.965, bit) * (1.0 - smoothstep(0.18, 0.32, length(inCell)));
            soil = mix(soil, vec3(0.78, 0.75, 0.68), speck * ${pebbleScale < 0.2 ? '0.45' : '0.85'});
            ${pebbleScale < 0.2 ? `
            // Against the glass (image 12 round 7): soil pressed to the glass is clumpy, not a cut face.
            // Large dark and light clods, and fine pale roots wandering down through it.
            vec2 clodUv = vMapUv * vec2(3.0, 7.0);
            float clod = sin(clodUv.x * 2.1 + sin(clodUv.y * 1.7)) * sin(clodUv.y * 2.6 + clodUv.x * 0.9);
            soil *= 0.72 + 0.45 * smoothstep(-0.6, 0.8, clod);
            float rootLine = abs(fract(vMapUv.x * 1.4 + 0.012 * sin(vMapUv.y * 47.0) + 0.03 * sin(vMapUv.y * 7.0 + vMapUv.x * 9.0)) - 0.5);
            float root = (1.0 - smoothstep(0.002, 0.006, rootLine)) * step(0.55, fract(sin(floor(vMapUv.x * 1.4) * 17.3) * 431.7)) * smoothstep(0.2, 0.7, sin(vMapUv.y * 5.0 + vMapUv.x * 3.0));
            soil = mix(soil, vec3(0.5, 0.4, 0.29), root * 0.5);` : ''}
            vec3 grit = gritScan * 0.7;
            vec3 gravel = pebbleScan * clamp(vColor.rgb / gravelRef, 0.0, 1.4) * 1.35;
            ${naturalLook ? `
            // Natural look (stylized low-poly, 2026-11-07): soft painted crumbs instead of the photo scan,
            // warm earthy browns with a few lighter clods, and plain rounded pebbles.
            vec2 crumbCell = floor(vMapUv * 26.0);
            float crumb = fract(sin(dot(crumbCell, vec2(41.3, 289.1))) * 15731.7);
            vec3 earth = vec3(0.2, 0.11, 0.055) * mix(vec3(1.0), ratio, 0.5);
            soil = earth * (0.95 + 0.07 * crumb);
            grit = vec3(0.12, 0.1, 0.09);
            gravel = mix(vec3(0.36, 0.33, 0.29), vec3(0.62, 0.55, 0.45), smoothstep(0.25, 0.7, pebbleScan.g)) * clamp(vColor.rgb / gravelRef, 0.0, 1.2);
            ${pebbleScale < 0.2 ? `
            // Through the glass (owner's reference): rounded pebbles drawn as soft cells with a lit top and
            // a shaded rim, gently waving soil bands with a few stones embedded, and packed pale walls
            // round the ant tunnels.
            vec2 cellUv = vec2(vMapUv.x * 5.0, vMapUv.y * 17.0);
            vec2 cid = floor(cellUv), cf = fract(cellUv);
            float nearest = 9.0; vec2 nearestOff = vec2(0.0); float nearestId = 0.0;
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
              vec2 o = vec2(float(i), float(j));
              float h = fract(sin(dot(cid + o, vec2(127.1, 311.7))) * 43758.5453);
              vec2 centre = o + 0.5 + 0.35 * vec2(cos(h * 6.28), sin(h * 6.28)) - cf;
              float d = length(centre);
              if (d < nearest) { nearest = d; nearestOff = centre; nearestId = h; }
            }
            float stone = 1.0 - smoothstep(0.4, 0.5, nearest);
            vec3 stoneColour = mix(vec3(0.36, 0.32, 0.27), vec3(0.56, 0.48, 0.37), nearestId) * (0.8 + 0.35 * smoothstep(0.0, 0.4, nearestOff.y));
            gravel = mix(vec3(0.18, 0.15, 0.12), stoneColour, stone);
            float band = sin(vMapUv.y * 18.0 + sin(vMapUv.x * 3.0) * 1.4);
            soil *= 0.9 + 0.14 * smoothstep(-0.3, 0.3, band);
            float embedded = stone * step(0.97, nearestId);
            // (embedded stones now drawn below, darker and rounder)
            // Item 7 (2026-11-08): the wall behind the jar read as one flat slab. Give it a soil profile:
            // dark organic topsoil grading into lighter, sandier subsoil, wavy layers with a few sandy
            // streaks, more stones of mixed size, pale roots reaching down from the plants, and a damp
            // darker band just above the gravel. All from world height and the wall's own UVs.
            float depthDown = clamp((0.25 - vCutWorld.y) / 1.5, 0.0, 1.0);
            vec3 topsoil = vec3(0.14, 0.078, 0.04), subsoil = vec3(0.215, 0.135, 0.075);
            vec3 profile = mix(topsoil, subsoil, smoothstep(0.05, 0.75, depthDown));
            float wave = vMapUv.y * 4.0 + sin(vMapUv.x * 2.3) * 0.6 + sin(vMapUv.x * 7.1) * 0.15;
            float layer = smoothstep(0.15, 0.85, abs(fract(wave) - 0.5) * 2.0);
            float sand = smoothstep(0.82, 0.95, sin(wave * 0.5 + 1.3)) * smoothstep(0.2, 0.6, depthDown);
            vec3 natural = profile * (0.88 + 0.16 * layer) * (0.95 + 0.07 * crumb);
            natural = mix(natural, vec3(0.3, 0.21, 0.12), sand * 0.5);
            // Larger stones on a second, coarser cell grid.
            vec2 bigUv = vec2(vMapUv.x * 2.2, vMapUv.y * 7.5);
            vec2 bid = floor(bigUv), bf = fract(bigUv);
            float bh = fract(sin(dot(bid, vec2(269.5, 183.3))) * 43758.5453);
            vec2 bc = vec2(0.5) + 0.25 * vec2(cos(bh * 6.28), sin(bh * 9.1)) - bf;
            // The wall UVs are about 3x wider than tall in world space: squash x so stones come out round.
            float bigStone = (1.0 - smoothstep(0.2 + 0.1 * bh, 0.24 + 0.1 * bh, length(bc * vec2(2.6, 1.0)))) * step(0.8, bh);
            // The back wall faces the window and is lit hard, so stones are set relative to the soil, not absolute.
            vec3 bigColour = mix(vec3(0.11, 0.1, 0.085), vec3(0.17, 0.145, 0.115), fract(bh * 7.3)) * (0.7 + 0.5 * smoothstep(-0.2, 0.2, -bc.y));
            natural = mix(natural, bigColour, bigStone);
            // Roots: thin, wandering, pale; denser and thicker in the topsoil under the plants.
            float rootX = vMapUv.x * 3.2 + 0.05 * sin(vMapUv.y * 23.0 + vMapUv.x * 5.0) + 0.02 * sin(vMapUv.y * 61.0);
            float rootD = abs(fract(rootX) - 0.5);
            float rootOn = step(0.4, fract(sin(floor(rootX) * 91.7) * 437.3)) * (1.0 - smoothstep(0.25, 0.75, depthDown));
            float rootW = mix(0.012, 0.004, depthDown);
            float roots = (1.0 - smoothstep(rootW * 0.5, rootW, rootD)) * rootOn;
            natural = mix(natural, vec3(0.25, 0.17, 0.1), roots * 0.55);
            // Damp, darker soil just above the drainage gravel.
            natural *= 1.0 - 0.28 * smoothstep(0.7, 1.0, depthDown);
            soil = mix(soil, natural, 0.85);
            soil = mix(soil, vec3(0.52, 0.36, 0.22), 1.0 - smoothstep(0.0, 0.045, nestRim));` : ''}` : ''}
            diffuseColor.rgb *= mix(mix(soil, grit, charcoal), gravel, vPebble);`)
          .replace('#include <color_fragment>', '')
      }
      return material
    }
    // Natural look: a soft sheen, not the hot white sun blob a full-strength glossy specular made (item 6, 2026-11-08).
    const puddles = new MeshPhysicalMaterial({ vertexColors: true, transparent: true, roughness: naturalLook ? 0.16 : 0.06, metalness: 0, ior: 1.333, specularIntensity: naturalLook ? 0.22 : 1, depthWrite: false })
    // Against the glass the gravel reads as rounded 5-8 mm stones, as in concept image 12.
    return { surface: make(0.95, false, 0.28), walls: make(0.9, true, 0.16), puddles }
  }, [set])
}

/** Static drawing of a built substrate, raised by `floor`. */
export function LayeredGround({ state, floor, shape, poolScale, onClick, carpet = false, moss, mossKey }: { state: Substrate; floor: number; shape?: GroundShape['shape']; poolScale?: GroundShape['poolScale']; onClick?: boolean; carpet?: boolean; moss?: MossState; mossKey?: string }) {
  const geometry = useLayeredGeometry()
  const materials = useLayerMaterials()
  useLayoutEffect(() => { updateLayered(geometry, state, { shape, poolScale }) }, [geometry, state, shape, poolScale])
  return <group position={[0, floor, 0]}>
    <mesh geometry={geometry.surface} material={materials.surface} receiveShadow raycast={onClick ? undefined : () => undefined} />
    <mesh geometry={geometry.walls} material={materials.walls} raycast={() => undefined} />
    <mesh geometry={geometry.puddles} material={materials.puddles} raycast={() => undefined} renderOrder={2} />
    {carpet && <MossCarpet geometry={geometry.surface} floor={floor} state={moss} stateKey={mossKey} />}
  </group>
}
