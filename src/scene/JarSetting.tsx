import { Suspense, useLayoutEffect, useMemo } from 'react'
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, LatheGeometry, ShaderMaterial, MathUtils, Vector2, Vector3 } from 'three'
import { charcoalTexture, soilSideTexture } from '../lab/proceduralTextures'
import { pondCenter } from '../sim/pond'
import { nearestSoil } from '../sim/ecosystem'
import type { SoilPatch } from '../sim/ecosystem'
import { environmentScale, groundShape } from './scale'
import { cellX, inside, loadSubstrate, substrateSize, topAt } from '../sim/substrate'
import type { Decor, SavedSubstrate } from '../sim/substrate'
import { isPresetJar } from '../sim/substrate'
import { maskShape } from '../sim/pondShape'
import type { PondShape } from '../sim/pondShape'
import type { Pond } from '../sim/pond'
import { ShapedPond } from './PondWater'
import { GlassDroplets } from './GlassDroplets'
import { DrawnCurledLeaf } from './DrawnPlant'
import { LayeredGround, smoothGround } from './LayeredGround'
import defaultJar from '../sim/defaultJar.json'
import { terrainGeometry } from './terrainGeometry'
import { Fern, MossSprigs, MossyStone, paintify, polyHaven, ScannedProp, useTextureSet } from './semiReal'
import type { Ground } from './semiReal'

/*
 * The semi-real jar for ?look=paper: the island becomes a glass jar on a
 * windowsill with layers you can see through the glass.
 *
 * One world unit is about 19 mm (an adult woodlouse is about 12 mm, 0.63 long),
 * so the 3.77 radius jar is about 14 cm across. Layer depths follow UVM
 * Extension's terrarium guide (1-2 in of gravel, a thin layer of charcoal,
 * 2-3 in of soil): https://www.uvm.edu/news/extension/terrarium-gardening
 *
 * Decoration only. The simulation still sees a flat surface at soilSurfaceY,
 * and nothing here takes clicks except the soil, which the Terrain handles.
 */

const R = environmentScale.islandRadius
const top = environmentScale.soilSurfaceY
export const jarLayers = { soil: 2.9, charcoal: 0.25, gravel: 1.6 } // 55 mm, 5 mm, 30 mm
const soilBottom = top - jarLayers.soil
const charcoalBottom = soilBottom - jarLayers.charcoal
const gravelBottom = charcoalBottom - jarLayers.gravel
/*
 * The jar's shape follows the owner's target picture (concept round 3, image 12,
 * picked 2026-11-06): a fat, squat jar with straight sides, rounded shoulders
 * and a wide screw-top neck. The owner asked the same day for no bulge, so the
 * wall runs straight up from the base to the shoulder and then rounds in to the
 * neck.
 */
const wall = R + 0.12
const belly = 0
const bellyTop = top + 2.0
const neck = top + 3.1
const neckRadius = R * 0.93
const glassTop = neck + 0.35
/** The glass radius at height y. */
export function glassRadiusAt(y: number) {
  if (y <= bellyTop) return wall + belly * MathUtils.smoothstep(y, top + 0.1, bellyTop)
  if (y >= neck) return neckRadius
  const t = (y - bellyTop) / (neck - bellyTop)
  return neckRadius + (wall + belly - neckRadius) * Math.cos(t * Math.PI / 2)
}
const glassEdge = new ShaderMaterial({
  transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
  uniforms: { tint: { value: new Color('#dfeee8') } },
  vertexShader: `varying vec3 vNormal; varying vec3 vView;
    void main() { vec4 world = modelMatrix * vec4(position, 1.0); vNormal = normalize(mat3(modelMatrix) * normal); vView = normalize(cameraPosition - world.xyz); gl_Position = projectionMatrix * viewMatrix * world; }`,
  fragmentShader: `uniform vec3 tint; varying vec3 vNormal; varying vec3 vView;
    void main() { float facing = abs(dot(normalize(vNormal), normalize(vView))); float edge = pow(1.0 - facing, 4.0); gl_FragColor = vec4(tint * edge * 0.3, 1.0); }`,
})
/*
 * The humid film on a sealed jar's glass (concept image 12): a faint milky haze that thickens toward
 * the shoulder, peppered with very fine beads that catch the window light. The larger beads and
 * trails are GlassDroplets.
 */
const condensationFilm = new ShaderMaterial({
  transparent: true, depthWrite: false, side: DoubleSide,
  uniforms: { amount: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
    void main() { vUv = uv; vec4 world = modelMatrix * vec4(position, 1.0); vNormal = normalize(mat3(modelMatrix) * normal); vView = normalize(cameraPosition - world.xyz); gl_Position = projectionMatrix * viewMatrix * world; }`,
  fragmentShader: `uniform float amount; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      float height = smoothstep(0.3, 0.9, vUv.y);
      vec2 cell = vUv * vec2(900.0, 260.0);
      vec2 id = floor(cell), f = fract(cell) - 0.5;
      float r = 0.18 + 0.22 * hash(id + 3.1);
      float bead = (1.0 - smoothstep(r - 0.08, r, length(f))) * step(0.45, hash(id));
      float glint = bead * smoothstep(0.0, 0.25, -f.y);
      float facing = abs(dot(normalize(vNormal), normalize(vView)));
      float haze = height * (0.10 + 0.08 * (1.0 - facing));
      float alpha = amount * (haze + bead * height * 0.22);
      vec3 colour = mix(vec3(0.86, 0.9, 0.88), vec3(1.0, 0.99, 0.95), glint);
      gl_FragColor = vec4(colour, alpha);
    }`,
})
function jarGeometry(bottom: number) {
  const points: Vector2[] = []
  const steps = 48
  for (let n = 0; n <= steps; n += 1) {
    const y = bottom + (glassTop - bottom) * n / steps
    points.push(new Vector2(glassRadiusAt(y), y))
  }
  return new LatheGeometry(points, 128)
}
const flat = () => top
const pond = [{ x: pondCenter.x, z: pondCenter.z, radius: pondCenter.radius + 0.15 }]
const nowhere: { x: number; z: number; radius: number }[] = []
const noRaycast = () => undefined

/** `realistic`: soil and stone keep the scan's own detail and full relief (watercolour look paints the rest). */
function useScan(id: string, repeat: [number, number], realistic = false) {
  const set = useTextureSet({ map: `${polyHaven}${id}/${id}_diff_1k.jpg`, normalMap: `${polyHaven}${id}/${id}_nor_gl_1k.jpg`, roughnessMap: `${polyHaven}${id}/${id}_rough_1k.jpg` }, ['map'])
  return useMemo(() => {
    for (const texture of Object.values(set)) texture.repeat.set(...repeat)
    return realistic ? { ...set, normalScale: new Vector2(1, 1), userData: { realistic: true } } : { ...set, map: paintify(set.map, '', 1), normalScale: new Vector2(0.6, 0.6) }
  }, [set, repeat, realistic])
}

/** The soil band is about 3x taller than the lab's, so tile its cross-section texture more to keep crumbs small. */
function deepSoil() {
  const texture = soilSideTexture()
  texture.repeat.set(7, 2.5)
  return texture
}

/** Moss creeping over the pond bank, in a ring just outside the water. */
const bank = Array.from({ length: 90 }, (_, index) => {
  const angle = index / 90 * Math.PI * 2 + Math.sin(index * 7.3) * 0.05
  const reach = pondCenter.radius + 0.08 + Math.abs(Math.sin(index * 3.7)) * 0.22
  return new Vector3(pondCenter.x + Math.cos(angle) * reach, top + 0.02, pondCenter.z + Math.sin(angle) * reach)
})

const band = (y0: number, y1: number) => new CylinderGeometry(R, R, y1 - y0, 128, 1, true).translate(0, (y0 + y1) / 2, 0)
const soilRepeat: [number, number] = [0.21, 0.21] // surface UVs are in world units; about 1.6 tiles across the jar
const pebbleRepeat: [number, number] = [8, 0.55]
const sillRepeat: [number, number] = [1.5, 0.7]

/** The soil surface and the layers seen through the glass. */
export function JarSubstrate() {
  const soil = useScan('forest_ground_04', soilRepeat, true)
  const pebbles = useScan('clean_pebbles', pebbleRepeat, true)
  const side = useMemo(() => ({ charcoal: charcoalTexture(), soil: deepSoil(), bands: { gravel: band(gravelBottom, charcoalBottom), charcoal: band(charcoalBottom, soilBottom), soil: band(soilBottom, top) } }), [])
  return <group>
    <mesh geometry={side.bands.gravel} raycast={noRaycast}><meshStandardMaterial {...pebbles} side={DoubleSide} /></mesh>
    <mesh geometry={side.bands.charcoal} raycast={noRaycast}><meshStandardMaterial map={side.charcoal} roughness={0.6} side={DoubleSide} userData={{ realistic: true }} /></mesh>
    <mesh geometry={side.bands.soil} raycast={noRaycast}><meshStandardMaterial map={side.soil} roughness={0.95} side={DoubleSide} userData={{ realistic: true }} /></mesh>
    {/* Damp soil reads darker; the scan is dry forest floor. */}
    <mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={terrainGeometry.cap} attach="geometry" />
      <meshStandardMaterial {...soil} color="#a8927c" />
    </mesh>
  </group>
}

/** Clear glass: a thin physical shell with sharp reflections, so the jar contents stay crisp. Sealed jars wear a screw lid. */
function Glass({ bottom = gravelBottom, sealed = false, mist = 0 }: { bottom?: number; sealed?: boolean; mist?: number }) {
  const geometry = useMemo(() => jarGeometry(bottom - 0.05), [bottom])
  const lid = neckRadius + 0.16
  return <group>
    <mesh geometry={geometry} raycast={noRaycast} renderOrder={2}>
      <meshStandardMaterial color="#ffffff" transparent opacity={0.045} roughness={0.02} metalness={0} envMapIntensity={0.8} depthWrite={false} />
    </mesh>
    {/* Glass is seen by its edges: where you look along the curved wall it turns pale and reflective. */}
    <mesh geometry={geometry} raycast={noRaycast} renderOrder={3} material={glassEdge} />
    {mist > 0.2 && <mesh geometry={geometry} raycast={noRaycast} renderOrder={4} material={condensationFilm} onBeforeRender={() => { condensationFilm.uniforms.amount.value = Math.min(1, (mist - 0.2) / 0.5) }} />}
    {/* The rolled rim of the neck, and the screw thread just under it. */}
    <mesh position={[0, glassTop, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
      <torusGeometry args={[neckRadius, 0.07, 10, 96]} />
      <meshPhysicalMaterial color="#dfe8e4" transparent opacity={0.55} roughness={0.1} clearcoat={1} clearcoatRoughness={0.05} />
    </mesh>
    {[0.12, 0.24].map((drop) => <mesh key={drop} position={[0, glassTop - drop, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
      <torusGeometry args={[neckRadius + 0.02, 0.035, 8, 96]} />
      <meshPhysicalMaterial color="#e6eeea" transparent opacity={0.4} roughness={0.1} clearcoat={1} />
    </mesh>)}
    {sealed && <group position={[0, glassTop + 0.02, 0]}>
      {/* A brushed tin screw cap with a ribbed skirt, like a canning jar. */}
      <mesh position={[0, 0.12, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[lid, lid, 0.24, 96, 1, false]} />
        <meshStandardMaterial color="#9d9890" metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.24, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[lid - 0.06, lid, 0.06, 96]} />
        <meshStandardMaterial color="#c9c6bd" metalness={0.85} roughness={0.32} />
      </mesh>
      {Array.from({ length: 3 }, (_, n) => <mesh key={n} position={[0, 0.05 + n * 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <torusGeometry args={[lid, 0.018, 6, 96]} />
        <meshStandardMaterial color="#a7a49b" metalness={0.85} roughness={0.42} />
      </mesh>)}
    </group>}
  </group>
}

function Sill({ bottom = gravelBottom }: { bottom?: number }) {
  const oak = useScan('oak_veneer_01', sillRepeat, true)
  return <mesh position={[0, bottom - 0.55, 1.5]} raycast={noRaycast}>
    <boxGeometry args={[30, 1, 14]} />
    {/* Dark walnut, like the sill in concept image 12. */}
    <meshStandardMaterial {...oak} roughnessMap={null} roughness={0.82} color="#57412f" envMapIntensity={0.35} />
  </mesh>
}

const leaf = 'dry_quiver_leaf/dry_quiver_leaf_1k.gltf'

/**
 * Distinct moss cushions instead of one scattered carpet (Codex review of the
 * game against concept image 12, 2026-11-06: 12-18 rounded cushions, heights
 * varying about 2:1, with dark soil showing between them).
 */
const cushions = Array.from({ length: 16 }, (_, n) => {
  const hash = (k: number) => { const s = Math.sin((n + k) * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
  const angle = n * 2.39996 + 0.6, reach = 0.9 + Math.sqrt((n + 0.5) / 16) * 2.3
  const radius = 0.35 + hash(3) * 0.35
  return { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach, radius, count: Math.round(radius * radius * 520), scale: 0.75 + hash(7) * 0.75 }
})

/** Moss, stones, a fern and fallen leaves from the approved reference (round 2, image 2), kept clear of the pond. */
function Dressing({ ground = flat, keepOut, shore }: { ground?: Ground; keepOut?: (x: number, z: number) => boolean; shore?: Vector3[] }) {
  const avoid = keepOut ? nowhere : pond
  const dry = (x: number, z: number) => !keepOut || !keepOut(x, z)
  return <>
    {dry(2.55, -1.35) && <MossyStone node="rock_moss_set_01_rock01" x={2.55} z={-1.35} width={1.5} turn={0.9} ground={ground} />}
    {dry(-2.55, -1.9) && <MossyStone node="rock_moss_set_01_rock03" x={-2.55} z={-1.9} width={1.0} turn={2.2} ground={ground} />}
    {dry(0.6, 3.05) && <MossyStone node="rock_moss_set_01_rock05" x={0.6} z={3.05} width={0.8} turn={-0.6} ground={ground} />}
    {cushions.map((cushion, index) => <MossSprigs key={index} x={cushion.x} z={cushion.z} radius={cushion.radius} count={cushion.count} scale={cushion.scale} ground={ground} avoid={avoid} keepOut={keepOut} />)}
    <MossSprigs x={pondCenter.x} z={pondCenter.z} radius={1} count={150} ground={ground} spots={shore ?? bank} scale={0.9} />
    {dry(-2.6, 1.9) && <Fern x={-2.6} z={1.9} ground={ground} />}
    {/* Drawn curled dry leaves on the front bank, the shelter a woodlouse uses in concept image 12. */}
    {dry(2.1, 2.25) && <group position={[2.1, ground(2.1, 2.25) - 0.03, 2.25]}><DrawnCurledLeaf length={2.0} turn={-0.25} /></group>}
    {dry(1.7, -0.2) && <group position={[1.7, ground(1.7, -0.2) - 0.03, -0.2]}><DrawnCurledLeaf length={1.0} turn={0.4} /></group>}
    {dry(-1.2, -2.6) && <ScannedProp file={leaf} node="dry_quiver_leaf_a" x={-1.2} z={-2.6} length={0.8} turn={-0.9} ground={ground} />}
    {dry(1.25, 0.35) && <ScannedProp file="dry_branches_medium_01/dry_branches_medium_01_1k.gltf" node="dry_branches_medium_01_c" x={1.25} z={0.35} length={1.4} turn={-0.45} ground={ground} />}
  </>
}

/** A stone or piece of wood the player set while building the jar. */
export function DecorPiece({ item, index, ground }: { item: Decor; index: number; ground: Ground }) {
  return item.kind === 'stone'
    ? <MossyStone node={`rock_moss_set_01_rock0${index % 6 + 1}`} x={item.x} z={item.z} width={item.size} turn={item.turn} ground={ground} moss={false} />
    : <ScannedProp file="dry_branches_medium_01/dry_branches_medium_01_1k.gltf" node="dry_branches_medium_01_a" x={item.x} z={item.z} length={item.size} turn={item.turn} ground={ground} />
}

/** The pond is dug into a built jar: the ground sinks under the water and eases up to the pond lip. */
function pondCut(floor: number) {
  const lip = environmentScale.pondSurfaceY - floor
  const under = environmentScale.pondBedY - floor - 0.1
  return (x: number, z: number, height: number) => {
    const d = Math.hypot(x - pondCenter.x, z - pondCenter.z)
    if (d < pondCenter.radius * 1.02) return under
    const t = Math.min(1, (d - pondCenter.radius * 1.02) / 0.7)
    return lip + (height - lip) * t * t * (3 - 2 * t)
  }
}

/** A jar the player built: their layers, raised so the soil sits where the simulation expects the ground. */
/** Puddles stand while the soil under them is waterlogged (the sim's 85% line) and dry up as it drains. */
function usePoolScale(soil: SoilPatch[]) {
  const key = soil.map((patch) => Math.round(Math.min(1, Math.max(0, (patch.water - 85) / 15)) * 20)).join(',')
  return useMemo(() => {
    const levels = key.split(',').map((value) => Number(value) / 20)
    return (x: number, z: number) => soil.length ? levels[soil.indexOf(nearestSoil(soil, x, z))] ?? 0 : 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

function BuiltJar({ substrate, soil, dressed, pond, underwater, onPondClick, fog = 0, sealed = false }: { substrate: SavedSubstrate; soil: SoilPatch[]; dressed: boolean; pond?: Pond; underwater?: boolean; onPondClick?: (x: number, z: number) => void; fog?: number; sealed?: boolean }) {
  const state = useMemo(() => loadSubstrate(substrate), [substrate])
  // A jar poured since ponds follow the water has its pond where the water stands; older built jars keep the dug round one.
  const water = useMemo(() => substrate.pool ? maskShape(substrate) : null, [substrate])
  const hasPond = !!water && (water.volume ?? 0) > 0
  const floor = useMemo(() => {
    // With a poured pond, line its water up with the sim's pond surface; otherwise put the mean ground where the sim expects it.
    if (water && hasPond) return environmentScale.pondSurfaceY - (water.level ?? 0)
    let sum = 0, count = 0
    for (let k = 0; k < state.soil.length; k += 1) {
      const i = k % substrateSize, j = Math.floor(k / substrateSize)
      if (!inside[k] || (!water && Math.hypot(cellX(i) - pondCenter.x, cellX(j) - pondCenter.z) < pondCenter.radius + 0.3)) continue
      sum += topAt(state, k); count += 1
    }
    return top - (count ? sum / count : 0)
  }, [state, water, hasPond])
  const shape = useMemo(() => water ? undefined : pondCut(floor), [floor, water])
  const soilScale = usePoolScale(soil)
  // Pond water is drawn by the pond itself; the rest of the standing water dries with the soil.
  const poolScale = useMemo(() => water && hasPond ? (x: number, z: number) => water.signedDistance(x, z) < 0.1 ? 0 : soilScale(x, z) : soilScale, [water, hasPond, soilScale])
  // The same smoothed soil LayeredGround draws, so plants and animals sit on it.
  const soilHeight = useMemo(() => smoothGround(state), [state])
  const ground = useMemo(() => (x: number, z: number) => (shape ? shape(x, z, soilHeight(x, z)) : soilHeight(x, z)) + floor, [shape, soilHeight, floor])
  // Plants and animals stand on this ground instead of the flat default.
  useLayoutEffect(() => { groundShape.offset = (x, z) => ground(x, z) - top; groundShape.poured = !!water; return () => { groundShape.offset = () => 0; groundShape.poured = false } }, [ground, water])
  const keepOut = useMemo(() => water && hasPond ? (x: number, z: number) => water.signedDistance(x, z) < 0.12 : undefined, [water, hasPond])
  const shore = useMemo(() => water && hasPond ? shoreSpots(water, ground) : undefined, [water, hasPond, ground])
  // A closed jar with standing water always beads a little on the glass, as in concept image 12; the sim's fog adds more.
  const mist = sealed && hasPond ? Math.max(fog, 0.45) : fog
  return <>
    <Suspense fallback={null}><LayeredGround state={state} floor={floor} shape={shape} poolScale={poolScale} onClick /></Suspense>
    {water && hasPond && water.cells && pond && <ShapedPond ground={ground} cells={water.cells} level={water.level ?? 0} floor={floor} pond={pond} underwater={!!underwater} onPondClick={onPondClick ?? (() => undefined)} />}
    <Suspense fallback={null}>{state.decor.map((item, index) => <DecorPiece key={index} item={item} index={index} ground={ground} />)}</Suspense>
    {dressed && <Suspense fallback={null}><Dressing ground={ground} keepOut={keepOut} shore={shore} /></Suspense>}
    {dressed && water && hasPond && <Suspense fallback={null}><Pebbles water={water} ground={ground} /></Suspense>}
    <Suspense fallback={null}><Sill bottom={floor} /></Suspense>
    <Glass bottom={floor} sealed={sealed} mist={underwater ? 0 : mist} />
    {mist > 0.2 && !underwater && <GlassDroplets fog={mist} radiusAt={glassRadiusAt} top={neck - 0.3} ground={ground} />}
  </>
}

const stones = 'namaqualand_stones_01/namaqualand_stones_01_1k.gltf'
/**
 * Real pebbles (Poly Haven "Namaqualand Stones 01", CC0): a few along the bank
 * and more on the pond bed, where they show through the water and the front glass,
 * as in the owner's target picture. 3-9 mm across.
 */
function Pebbles({ water, ground }: { water: PondShape; ground: Ground }) {
  const spots = useMemo(() => {
    const found: { x: number; z: number; size: number; turn: number; node: string; wet: boolean }[] = []
    let bank = 0, bed = 0
    for (let n = 0; n < 9000 && (bank < 6 || bed < 26); n += 1) {
      const x = -3.6 + ((n * 0.618034 + 0.31) % 1) * 7.2, z = -3.6 + ((n * 0.7548777 + 0.17) % 1) * 7.2
      if (Math.hypot(x, z) > 3.45) continue
      const d = water.signedDistance(x, z)
      const wet = d < -0.12
      if (wet ? bed >= 26 : (d < 0.05 || d > 0.4 || bank >= 6)) continue
      if (found.some((spot) => Math.hypot(spot.x - x, spot.z - z) < (wet ? 0.22 : 0.35))) continue
      if (wet) bed += 1; else bank += 1
      // A pebble bed seen through the front glass (image 12): many small stones, a few larger ones.
      found.push({ x, z, size: wet ? 0.12 + ((n * 0.37) % 1) ** 2 * 0.36 : 0.16 + ((n * 0.37) % 1) * 0.32, turn: n * 2.4, node: `namaqualand_stones_01_${'abcde'[n % 5]}`, wet })
    }
    return found
  }, [water])
  return <>{spots.map((spot, n) => <ScannedProp key={n} file={stones} node={spot.node} x={spot.x} z={spot.z} length={spot.size} turn={spot.turn} ground={ground} lift={0.01} />)}</>
}

/** Points along a poured pond's bank, for moss creeping to the water's edge. */
function shoreSpots(water: PondShape, ground: Ground) {
  const spots: Vector3[] = []
  for (let n = 0; spots.length < 120 && n < 4000; n += 1) {
    const x = -3.5 + ((n * 0.618034) % 1) * 7, z = -3.5 + ((n * 0.7548777) % 1) * 7
    const d = water.signedDistance(x, z)
    if (d > 0.1 && d < 0.32 && Math.hypot(x, z) < 3.4) spots.push(new Vector3(x, ground(x, z) + 0.02, z))
  }
  return spots
}

/**
 * Everything the jar adds around the simulation. A jar the player built shows
 * their layers; every other jar uses the default one, poured the same way
 * (scripts/pour_default_jar.mjs) and dressed with moss, stones and a fern.
 */
export function JarSetting({ substrate, soil = [], pond, underwater, onPondClick, fog = 0, sealed = false }: { substrate?: SavedSubstrate; soil?: SoilPatch[]; pond?: Pond; underwater?: boolean; onPondClick?: (x: number, z: number) => void; fog?: number; sealed?: boolean }) {
  const jar = substrate ?? defaultJar as SavedSubstrate
  return <BuiltJar substrate={jar} soil={soil} dressed={isPresetJar(jar)} pond={pond} underwater={underwater} onPondClick={onPondClick} fog={fog} sealed={sealed} />
}

/** The earlier hand-made default jar: flat layered cylinders. Kept for reference. */
export function FlatJarSetting() {
  return <>
    <Suspense fallback={<mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]}><primitive object={terrainGeometry.cap} attach="geometry" /><meshStandardMaterial color="#6b5544" roughness={1} /></mesh>}><JarSubstrate /></Suspense>
    <Suspense fallback={null}><Dressing /></Suspense>
    <Suspense fallback={null}><Sill /></Suspense>
    <Glass />
  </>
}
