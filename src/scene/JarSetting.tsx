import { Suspense, useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { CylinderGeometry, DoubleSide, RepeatWrapping, SRGBColorSpace, Vector2, Vector3 } from 'three'
import type { Texture } from 'three'
import { charcoalTexture, soilSideTexture } from '../lab/proceduralTextures'
import { pondCenter } from '../sim/pond'
import { environmentScale, groundShape } from './scale'
import { cellX, heightAt, inside, loadSubstrate, substrateSize, topAt } from '../sim/substrate'
import type { Decor, SavedSubstrate } from '../sim/substrate'
import { LayeredGround } from './LayeredGround'
import { terrainGeometry } from './terrainGeometry'
import { Fern, MossSprigs, MossyStone, paintify, polyHaven, ScannedProp } from './semiReal'
import type { Ground } from './semiReal'

/*
 * The semi-real jar for ?look=paper: the island becomes a glass jar on a
 * windowsill with layers you can see through the glass.
 *
 * One world unit is about 19 mm (the woodlouse is 0.64 long, about 12 mm),
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
const glassTop = top + 5.2
const flat = () => top
const pond = [{ x: pondCenter.x, z: pondCenter.z, radius: pondCenter.radius + 0.15 }]
const noRaycast = () => undefined

function useScan(id: string, repeat: [number, number]) {
  const set = useTexture({ map: `${polyHaven}${id}/${id}_diff_1k.jpg`, normalMap: `${polyHaven}${id}/${id}_nor_gl_1k.jpg`, roughnessMap: `${polyHaven}${id}/${id}_rough_1k.jpg` }) as Record<string, Texture>
  return useMemo(() => {
    for (const [key, texture] of Object.entries(set)) {
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.repeat.set(...repeat)
      texture.anisotropy = 8
      if (key === 'map') texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
    }
    return { ...set, map: paintify(set.map, '', 1), normalScale: new Vector2(0.6, 0.6) }
  }, [set, repeat])
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
  const soil = useScan('forest_ground_04', soilRepeat)
  const pebbles = useScan('clean_pebbles', pebbleRepeat)
  const side = useMemo(() => ({ charcoal: charcoalTexture(), soil: deepSoil(), bands: { gravel: band(gravelBottom, charcoalBottom), charcoal: band(charcoalBottom, soilBottom), soil: band(soilBottom, top) } }), [])
  return <group>
    <mesh geometry={side.bands.gravel} raycast={noRaycast}><meshStandardMaterial {...pebbles} side={DoubleSide} /></mesh>
    <mesh geometry={side.bands.charcoal} raycast={noRaycast}><meshStandardMaterial map={side.charcoal} roughness={0.6} side={DoubleSide} /></mesh>
    <mesh geometry={side.bands.soil} raycast={noRaycast}><meshStandardMaterial map={side.soil} roughness={0.95} side={DoubleSide} /></mesh>
    {/* Damp soil reads darker; the scan is dry forest floor. */}
    <mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={terrainGeometry.cap} attach="geometry" />
      <meshStandardMaterial {...soil} color="#a8927c" />
    </mesh>
  </group>
}

/** Clear glass: a thin physical shell with sharp reflections, so the jar contents stay crisp. */
function Glass({ bottom = gravelBottom }: { bottom?: number }) {
  return <group>
    <mesh position={[0, (bottom + glassTop) / 2, 0]} raycast={noRaycast} renderOrder={2}>
      <cylinderGeometry args={[R + 0.12, R + 0.12, glassTop - bottom + 0.1, 96, 1, true]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0.02} metalness={0} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={1.4} side={DoubleSide} depthWrite={false} />
    </mesh>
    <mesh position={[0, glassTop, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
      <torusGeometry args={[R + 0.1, 0.12, 12, 96]} />
      <meshPhysicalMaterial color="#dfe8e4" transmission={0.6} roughness={0.1} thickness={0.2} />
    </mesh>
  </group>
}

function Sill({ bottom = gravelBottom }: { bottom?: number }) {
  const oak = useScan('oak_veneer_01', sillRepeat)
  return <mesh position={[0, bottom - 0.55, 1.5]} raycast={noRaycast} receiveShadow>
    <boxGeometry args={[30, 1, 14]} />
    <meshStandardMaterial {...oak} />
  </mesh>
}

const leaf = 'dry_quiver_leaf/dry_quiver_leaf_1k.gltf'

/** Moss, stones, a fern and fallen leaves from the approved reference (round 2, image 2), kept clear of the pond. */
function Dressing() {
  return <>
    <MossyStone node="rock_moss_set_01_rock01" x={2.55} z={-1.35} width={1.5} turn={0.9} ground={flat} />
    <MossyStone node="rock_moss_set_01_rock03" x={-2.55} z={-1.9} width={1.0} turn={2.2} ground={flat} />
    <MossyStone node="rock_moss_set_01_rock05" x={0.6} z={3.05} width={0.8} turn={-0.6} ground={flat} />
    <MossSprigs x={1.6} z={-1.9} radius={1.3} count={260} ground={flat} avoid={pond} />
    <MossSprigs x={-2.2} z={-0.7} radius={1.0} count={170} ground={flat} avoid={pond} />
    <MossSprigs x={-0.3} z={2.6} radius={0.9} count={130} ground={flat} avoid={pond} />
    <MossSprigs x={2.6} z={1.7} radius={0.8} count={110} ground={flat} avoid={pond} />
    <MossSprigs x={0} z={0} radius={3.5} count={320} flat scale={0.55} ground={flat} avoid={pond} />
    <MossSprigs x={pondCenter.x} z={pondCenter.z} radius={1} count={260} ground={flat} spots={bank} scale={1.1} />
    <Fern x={-2.6} z={1.9} ground={flat} />
    <ScannedProp file={leaf} node="dry_quiver_leaf_a" x={0.9} z={1.5} length={0.95} turn={0.4} ground={flat} />
    <ScannedProp file={leaf} node="dry_quiver_leaf_a" x={2.2} z={0.4} length={0.8} turn={-1.6} ground={flat} />
    <ScannedProp file={leaf} node="dry_quiver_leaf_a" x={-1.2} z={-2.6} length={0.8} turn={-0.9} ground={flat} />
    <ScannedProp file="dry_branches_medium_01/dry_branches_medium_01_1k.gltf" node="dry_branches_medium_01_c" x={1.25} z={0.35} length={1.4} turn={-0.45} ground={flat} />
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
function BuiltJar({ substrate }: { substrate: SavedSubstrate }) {
  const state = useMemo(() => loadSubstrate(substrate), [substrate])
  const floor = useMemo(() => {
    let sum = 0, count = 0
    for (let k = 0; k < state.soil.length; k += 1) {
      const i = k % substrateSize, j = Math.floor(k / substrateSize)
      if (!inside[k] || Math.hypot(cellX(i) - pondCenter.x, cellX(j) - pondCenter.z) < pondCenter.radius + 0.3) continue
      sum += topAt(state, k); count += 1
    }
    return top - (count ? sum / count : 0)
  }, [state])
  const shape = useMemo(() => pondCut(floor), [floor])
  const ground = useMemo(() => (x: number, z: number) => shape(x, z, heightAt(state, x, z)) + floor, [shape, state, floor])
  // Plants and animals stand on this ground instead of the flat default.
  useLayoutEffect(() => { groundShape.offset = (x, z) => ground(x, z) - top; return () => { groundShape.offset = () => 0 } }, [ground])
  return <>
    <Suspense fallback={null}><LayeredGround state={state} floor={floor} shape={shape} onClick /></Suspense>
    <Suspense fallback={null}>{state.decor.map((item, index) => <DecorPiece key={index} item={item} index={index} ground={ground} />)}</Suspense>
    <Suspense fallback={null}><Sill bottom={floor} /></Suspense>
    <Glass bottom={floor} />
  </>
}

/** Everything the jar adds around the simulation. Each part loads its scans on its own so the game never waits for them. */
export function JarSetting({ substrate }: { substrate?: SavedSubstrate }) {
  if (substrate) return <BuiltJar substrate={substrate} />
  return <>
    <Suspense fallback={<mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]}><primitive object={terrainGeometry.cap} attach="geometry" /><meshStandardMaterial color="#6b5544" roughness={1} /></mesh>}><JarSubstrate /></Suspense>
    <Suspense fallback={null}><Dressing /></Suspense>
    <Suspense fallback={null}><Sill /></Suspense>
    <Glass />
  </>
}
