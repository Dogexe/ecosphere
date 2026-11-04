import { fogLevel } from '../sim/seal'
import { fallenLeaf, Mushroom } from './paperNature'
import { drawnLook, useFallenLeaves } from './DrawnPlant'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, MathUtils, Object3D, PerspectiveCamera, SphereGeometry, Vector2 } from 'three'
import { Vector3 } from 'three'
import type { Ray } from 'three'
import { NatureAsset } from './NatureAsset'
import { PaperAnimal, paperLook } from './PaperCritter'
import { Watercolor } from './watercolor'
import { Polish, polishLook } from './Polish'

/** Paper look paints the jar like a watercolour (soil, stone and water stay real); ?paint=0 shows it unpainted. */
const watercolorLook = (() => { try { return new URLSearchParams(window.location.search).get('paint') !== '0' } catch { return true } })()
/** Phones and tablets draw at most 1.25 device pixels per CSS pixel: most of the GPU time goes on pixels. */
const coarsePointer = (() => { try { return window.matchMedia('(pointer: coarse)').matches } catch { return false } })()
import { JarSetting } from './JarSetting'
import { PondWater } from './PondWater'
import { modelUnavailable, OrganismAsset, PlantAsset } from './OrganismAsset'
import { worldPickRadius, animalTargetPixels } from './picking'
import { terrainGeometry } from './terrainGeometry'
import { Daylight } from './Daylight'
import { PondAtmosphere, PondControls } from './PondView'
import { AntColonyScene } from './AntColony'
import { NestControls } from './NestView'
import { antPosition, seedMaterialAvailable } from '../sim/colony'
import type { Remains } from '../sim/life'
import { AntRemainsScene } from './AntRemains'
import type { SurfacePose } from './PondView'
import { plantGeometry, propaguleGeometry } from './plantGeometry'
import { creatureIsFeeding, creatureKind, habitatFit, nearestSoil } from '../sim/ecosystem'
import type { Creature, Plant, SimulationEvent, SoilPatch, World } from '../sim/ecosystem'
import type { SavedSubstrate } from '../sim/substrate'
import { defaultPond, isAquatic } from '../sim/pond'
import type { Pond } from '../sim/pond'
import { plantFlowering, plantStage, woodlouseLife } from '../sim/life'
import { scheduledRest } from '../sim/climate'
import { animalGroundY, animalModelScale, animalWaterY, environmentScale, groundShape, plantGroundY, plantGrowthScale, plantModelScale, plantSeedDimensions, springtailTrackingRate } from './scale'
import { plantCameraFocus } from './plantCamera'

type SceneProps = {
  world: World
  events: SimulationEvent[]
  worldRevision: number
  selectedPlant: number | null
  selectedCreature: number | null
  selectedSoil: number | null
  placing: boolean
  onSelectPlant: (id: number | null) => void
  onSelectCreature: (id: number | null) => void
  onSelectSoil: (id: number) => void
  onPlace: (x: number, z: number) => void
  onClearSelection: () => void
  onSelectPond: () => void
  followCreature: number | null
  focusPlant: number | null
  speed: number
  underwater: boolean
  underground: boolean
  selectedAnt: number | null
  followAnt: number | null
  onSelectAnt: (id: number) => void
  onSelectColony: () => void
  focusBrood: boolean
  selectedBrood: number | null
  onSelectBrood: (id: number) => void
  focusChamber: number | null
  onSelectChamber: (id: number) => void
  showAntFood: boolean
  focusedRemains?: Remains
  onSelectRemains: (id: number) => void
}

const grassPositions = [
  [-3.05, -0.22], [-2.86, 1.66], [-2.2, 2.46], [-1.7, 0.03], [-1.42, -1.1],
  [-0.94, -2.65], [-0.38, -1.48], [0.18, -0.75], [0.52, 0.44], [0.02, 2.96],
  [0.94, -2.58], [1.52, -0.28], [1.94, 1.25], [2.79, -0.91], [2.92, 1.02],
  [0.82, 2.68], [-3.06, -1.55], [2.22, 2.2],
] as const

const rockPositions = [
  [-3.1, 0.65, 0.34], [-2.76, -2.05, 0.26], [-1.08, -3.15, 0.22],
  [0.7, -3.18, 0.31], [2.95, -1.7, 0.28], [3.13, 0.45, 0.38],
  [2.45, 2.36, 0.23], [0.42, 3.2, 0.28], [-1.8, 2.87, 0.32],
] as const

// One foliage family across authored leaves, flowers, and ground dressing.
const leafPalette = { clover: '#5b966d', fern: '#4d8668', bloom: '#5b966d', moss: '#6b9468', grass: '#7d9c69', tree: '#678e67', lily: '#679775', reed: '#839a69', dry: '#aaa56e' }

function GrassField() {
  const instances = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!instances.current) return
    const transform = new Object3D()
    grassPositions.forEach(([x, z], shade) => {
      const color = new Color(shade % 3 === 0 ? '#6e946c' : shade % 3 === 1 ? '#809d70' : '#94aa7b')
      transform.position.set(x, 0.04, z)
      transform.rotation.set(0, shade * 2.4, 0)
      transform.scale.setScalar(environmentScale.groundGrassScale * (0.94 + shade % 3 * 0.06))
      transform.updateMatrix()
      instances.current!.setMatrixAt(shade, transform.matrix)
      instances.current!.setColorAt(shade, color)
    })
    instances.current.instanceMatrix.needsUpdate = true
    if (instances.current.instanceColor) instances.current.instanceColor.needsUpdate = true
    // Changing the clump geometry during live editing can reuse a material
    // compiled before instanceColor exists. Rebuild its instancing color flag.
    if (!Array.isArray(instances.current.material)) instances.current.material.needsUpdate = true
    instances.current.computeBoundingSphere()
  }, [plantGeometry.grass])
  return (
    <instancedMesh key={plantGeometry.grass.uuid} ref={instances} args={[undefined, undefined, grassPositions.length]} castShadow>
      <primitive object={plantGeometry.grass} attach="geometry" />
      <meshStandardMaterial roughness={1} side={DoubleSide} flatShading />
    </instancedMesh>
  )
}

/** Drawn oak leaves on the soil (paper look): 8-14 mm, like small leaf litter in a jar. */
function DrawnLitter({ patch, count, size }: { patch: SoilPatch; count: number; size: number }) {
  const leaves = useFallenLeaves()
  return <group position={[patch.x, 0.042, patch.z]}>
    {Array.from({ length: count * 2 }, (_, index) => {
      const angle = index * 2.4 + patch.id, reach = (0.12 + index * 0.05) * size
      const x = Math.sin(angle) * reach, z = Math.cos(angle) * reach
      const leaf = leaves[(index + patch.id) % leaves.length]
      return <mesh key={index} geometry={leaf.geometry} material={leaf.material} position={[x, groundShape.offset(patch.x + x, patch.z + z) + index * 0.003, z]} rotation={[((index * 7) % 5 - 2) * 0.05, angle * 1.7, ((index * 3) % 5 - 2) * 0.04]} scale={0.45 + (index * 13 % 5) * 0.06} receiveShadow raycast={() => undefined} />
    })}
  </group>
}

function LitterPatch({ patch }: { patch: SoilPatch }) {
  const size = Math.min(1.45, 0.35 + Math.sqrt(patch.organic) / 5)
  const count = patch.organic > 0.04 ? Math.min(6, Math.ceil(patch.organic / 3)) : 0
  if (paperLook) {
    // Fallen leaflets of the jar's own plants, 6-10 mm long (Oxalis leaflets are 4-13 mm, VicFlora).
    if (drawnLook) return <Suspense fallback={null}><DrawnLitter patch={patch} count={count} size={size} /></Suspense>
    const leaf = fallenLeaf()
    return <group position={[patch.x, 0.042, patch.z]}>
      {Array.from({ length: count * 2 }, (_, index) => {
        const angle = index * 2.4 + patch.id, reach = (0.12 + index * 0.05) * size
        const x = Math.sin(angle) * reach, z = Math.cos(angle) * reach
        return <mesh key={index} geometry={leaf.geometry} material={leaf.materials[(index + patch.id) % leaf.materials.length]} position={[x, groundShape.offset(patch.x + x, patch.z + z) + index * 0.002, z]} rotation={[((index * 7) % 5 - 2) * 0.08, angle * 1.7, ((index * 3) % 5 - 2) * 0.06]} scale={0.32 + (index * 13 % 5) * 0.05} receiveShadow castShadow raycast={() => undefined} />
      })}
    </group>
  }
  return (
    <group position={[patch.x, 0.068, patch.z]}>
      {Array.from({ length: count }, (_, index) => {
        const angle = index * 2.4 + patch.id
        return (
          <mesh key={index} position={[Math.sin(angle) * (0.12 + index * 0.025) * size, index % 2 * 0.012 + groundShape.offset(patch.x + Math.sin(angle) * (0.12 + index * 0.025) * size, patch.z + Math.cos(angle) * (0.12 + index * 0.025) * size), Math.cos(angle) * (0.12 + index * 0.025) * size]} rotation={[0.1, angle, 0.08]} scale={[environmentScale.litterLength / 2 * (0.85 + index % 3 * 0.1), 0.012, 0.05]} receiveShadow>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={index % 2 ? '#b6986f' : '#c4aa7b'} roughness={1} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

function Terrain({ pond, soil, selectedSoil, onGroundClick, onPondClick, underwater, swimmers, substrate, fog = 0 }: { fog?: number; pond: Pond; swimmers: { id: number; x: number; z: number }[]; substrate?: SavedSubstrate; soil: SoilPatch[]; selectedSoil: number | null; onGroundClick: (x: number, z: number) => void; onPondClick: (x: number, z: number) => void; underwater: boolean }) {
  return (
    <group onClick={(event) => { if (event.delta > 5 || (event.point.y < 0.025 && !paperLook)) return; event.stopPropagation(); onGroundClick(event.point.x, event.point.z) }}>
      {paperLook ? <JarSetting substrate={substrate} soil={soil} pond={pond} underwater={underwater} onPondClick={onPondClick} fog={fog} /> : <>
      <mesh position={[0, -0.75, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.72, 3.43, 1.05, 48]} />
        <meshStandardMaterial color="#8b715a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -1.35, 0]} receiveShadow>
        <cylinderGeometry args={[3.43, 3.15, 0.28, 48]} />
        <meshStandardMaterial color="#62564b" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <primitive object={terrainGeometry.cap} attach="geometry" />
        <meshStandardMaterial color="#6d946a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, environmentScale.soilSurfaceY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={terrainGeometry.surface} attach="geometry" />
        <meshStandardMaterial color="#8fac76" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[environmentScale.islandRadius, 0.035, 8, 64]} />
        <meshStandardMaterial color="#c7bda4" roughness={0.72} metalness={0.05} />
      </mesh>
      </>}

      {soil.map((patch) => (
        <group key={patch.id} position={[patch.x, 0.052 + groundShape.offset(patch.x, patch.z), patch.z]}>
          {patch.water > 52 && !paperLook && <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
            <circleGeometry args={[0.86, 24]} />
            <meshBasicMaterial color="#8db9a7" transparent opacity={Math.min(0.19, (patch.water - 52) / 230)} depthWrite={false} />
          </mesh>}
          {selectedSoil === patch.id && <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
            <ringGeometry args={[0.78, 0.82, 40]} />
            <meshBasicMaterial color="#f7f1cf" transparent opacity={0.86} depthWrite={false} />
          </mesh>}
        </group>
      ))}
      {soil.map((patch) => <LitterPatch key={`litter-${patch.id}`} patch={patch} />)}

      {/* A poured jar draws its own pond, shaped by where the water stands. */}
      {!(paperLook && substrate?.pool) && <PondWater pond={pond} underwater={underwater} swimmers={swimmers} onPondClick={onPondClick} />}

      {!paperLook && <>
      <GrassField />
      {rockPositions.map(([x, z], index) => {
        const size = [environmentScale.rockMedium, environmentScale.rockSmall, environmentScale.rockSmall, environmentScale.rockMedium, environmentScale.rockMedium, environmentScale.rockLarge, environmentScale.rockSmall, environmentScale.rockMedium, environmentScale.rockMedium][index] / 1.7
        return <mesh key={index} position={[x, 0.04 + size * 0.32, z]} rotation={[0.12, index * 1.3, 0.08]} scale={[size, size * 0.55, size * 0.8]} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={index % 2 ? '#c9c5ad' : '#b3b6a5'} roughness={1} flatShading />
        </mesh>
      })}

      <mesh position={[1.28, 0.14, 0.37]} rotation={[0, -0.45, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[environmentScale.logRadius * 0.85, environmentScale.logRadius, environmentScale.logLength, 7]} />
        <meshStandardMaterial color="#9a8062" roughness={1} flatShading />
      </mesh>
      <mesh position={[1.05, 0.18, 0.22]} rotation={[0, 0.7, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.55, 7]} />
        <meshStandardMaterial color="#a38b69" roughness={1} flatShading />
      </mesh>
      </>}
    </group>
  )
}

function FungalPatch({ patch }: { patch: SoilPatch }) {
  const count = Math.min(5, Math.floor(patch.fungi * 1.5))
  // Paper look: bonnets at their real size, cap 2.5-7.5 mm on a 5-20 mm stem (Mycena adscendens).
  if (paperLook) return <group position={[patch.x, 0.04, patch.z]}>
    {Array.from({ length: count }, (_, index) => {
      const angle = index * 2.4 + patch.id, radius = 0.15 + index * 0.1
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
      const grown = Math.min(1, 0.55 + patch.fungi * 0.08)
      return <group key={index} position={[x, groundShape.offset(patch.x + x, patch.z + z), z]}>
        <Mushroom height={(0.5 + (index * 37 % 5) * 0.11) * grown} cap={(0.2 + (index * 23 % 4) * 0.05) * grown} lean={((index * 17 % 5) - 2) * 0.06} variant={index + patch.id} />
      </group>
    })}
  </group>
  return (
    <group position={[patch.x, 0.045, patch.z]}>
      {Array.from({ length: count }, (_, index) => {
        const angle = index * 2.4 + patch.id
        const radius = 0.19 + index * 0.13
        const height = Math.min(environmentScale.mushroomMax, environmentScale.mushroomMin + index % 3 * 0.04 + Math.min(0.05, patch.fungi * 0.01))
        return (
          <group key={index} position={[Math.cos(angle) * radius, groundShape.offset(patch.x + Math.cos(angle) * radius, patch.z + Math.sin(angle) * radius), Math.sin(angle) * radius]}>
            <NatureAsset file="mushroom_tan" height={height} accent={patch.id % 2 ? '#b98164' : '#cba77a'} fallback={<group><mesh position={[0, height * 0.38, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.03, height * 0.76, 5]} />
              <meshStandardMaterial color="#e9d7b5" roughness={1} flatShading />
            </mesh>
            <mesh position={[0, height * 0.78, 0]} castShadow>
              <coneGeometry args={[height * 0.43, height * 0.44, 7]} />
              <meshStandardMaterial color={patch.id % 2 ? '#b98164' : '#cba77a'} roughness={0.92} flatShading />
            </mesh></group>} />
          </group>
        )
      })}
    </group>
  )
}

function PlantModel({ plant, fit, tick, selected, onSelect }: { plant: Plant; fit: number; tick: number; selected: boolean; onSelect: () => void }) {
  const root = useRef<Group>(null)
  const hit = useRef<Object3D>(null), halo = useRef<Object3D>(null)
  const hitPosition = useRef(new Vector3())
  const stage = plantStage(plant)
  const young = ['seed', 'germinating', 'seedling'].includes(stage)
  const seed = plantSeedDimensions[plant.kind]
  const scale = plantGrowthScale(plant)
  const youngCenterY = young ? (plantCameraFocus(plant, 1).y - plantGroundY(plant)) / scale : 0
  const startScale = useRef(scale)
  const previousSeed = useRef(stage === 'seed')
  useLayoutEffect(() => {
    // The seed has its own tiny geometry at scale1. Its replacement foliage
    // must start at its real emerging scale, rather than shrink from adult size.
    if (previousSeed.current !== (stage === 'seed') && root.current) root.current.scale.setScalar(scale)
    previousSeed.current = stage === 'seed'
  }, [stage, scale])
  const leafColor = new Color(leafPalette.dry).lerp(new Color(leafPalette[plant.kind]), MathUtils.clamp((fit - 0.05) / 0.45, 0, 1))
  if (stage === 'senescent') leafColor.lerp(new Color('#b49c70'), 0.65)
  const flowerColor = fit < 0.16 ? '#c5ae91' : '#e8a391'
  const flowering = plantFlowering(plant)
  useFrame(({ camera, size }, delta) => {
    if (!root.current) return
    root.current.scale.setScalar(MathUtils.lerp(root.current.scale.x, scale, 1 - Math.exp(-delta * 5)))
    if (hit.current && camera instanceof PerspectiveCamera) {
      hit.current.getWorldPosition(hitPosition.current)
      const radius = worldPickRadius(camera.position.distanceTo(hitPosition.current), camera.getEffectiveFOV(), size.height)
      hit.current.scale.setScalar((young ? radius : environmentScale.minimumPickRadius) / root.current.scale.x)
      if (halo.current) halo.current.scale.setScalar(young ? radius * 1.3 / 0.49 / root.current.scale.x : 1)
    }
  })

  return (
    <group ref={root} position={[plant.x, plantGroundY(plant), plant.z]} rotation={[0, plant.id * 2.4, 0]} scale={startScale.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect() }}>
      {selected && (
        <mesh ref={halo} position={[0, young ? youngCenterY : 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.49, 32]} />
          <meshBasicMaterial color="#f9f6d3" transparent opacity={0.88} />
        </mesh>
      )}
      {stage === 'seed' ? <mesh geometry={propaguleGeometry} position={[0, seed.height / 2, 0]} scale={[seed.length, seed.height, seed.width]} castShadow><meshStandardMaterial color={plant.kind === 'moss' || plant.kind === 'fern' ? '#a6a27d' : '#aa8864'} roughness={1} flatShading /></mesh> : (stage === 'germinating' || stage === 'seedling') && !['moss', 'fern', 'lily', 'reed'].includes(plant.kind) ? <group>
        <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.013, 0.022, 0.26, 5]} /><meshStandardMaterial color="#88a174" roughness={1} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.075, 0.25, 0]} rotation={[0, 0, side * -0.35]} scale={[0.1, 0.027, 0.07]}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial color={leafColor} roughness={1} flatShading /></mesh>)}
      </group> : <PlantAsset seed={plant.id} kind={plant.kind} health={stage === 'senescent' ? 0.15 : MathUtils.clamp(fit / 0.45, 0, 1)} flowering={flowering} fallback={<group scale={plantModelScale(plant.kind)}>{plant.kind === 'lily' ? <group>
        {[0, 1, 2].map((index) => <mesh key={index} position={[Math.sin(index * 2.4) * 0.15, 0.025 + index * 0.003, Math.cos(index * 2.4) * 0.13]} rotation={[-Math.PI / 2, 0, index]} scale={[1, 0.85, 1]} receiveShadow><circleGeometry args={[0.18, 12, 0.15, Math.PI * 1.86]} /><meshStandardMaterial color={leafColor} side={DoubleSide} roughness={1} /></mesh>)}
        {flowering && <mesh position={[0, 0.06, 0]} scale={0.23}><primitive object={plantGeometry.bloom.petals} attach="geometry" /><meshStandardMaterial color="#dfb5a5" side={DoubleSide} roughness={1} /></mesh>}
      </group> : plant.kind === 'reed' ? <mesh castShadow><primitive object={plantGeometry.grass} attach="geometry" /><meshStandardMaterial color={leafColor} side={DoubleSide} roughness={1} flatShading /></mesh> : plant.kind === 'tree' ? <group>
        <mesh castShadow><primitive object={plantGeometry.tree.branches} attach="geometry" /><meshStandardMaterial color="#9a8062" roughness={1} flatShading /></mesh>
        <mesh castShadow receiveShadow><primitive object={plantGeometry.tree.crown} attach="geometry" /><meshStandardMaterial color={leafColor} roughness={1} flatShading /></mesh>
      </group> : plant.kind === 'grass' ? <mesh castShadow receiveShadow><primitive object={plantGeometry.grass} attach="geometry" /><meshStandardMaterial color={leafColor} side={DoubleSide} roughness={1} flatShading /></mesh> : plant.kind === 'moss' ? (
        <group>
          <mesh castShadow receiveShadow><primitive object={plantGeometry.moss} attach="geometry" /><meshStandardMaterial color={leafColor} roughness={1} flatShading /></mesh>
          {[0, 1, 2].map((index) => <group key={index} position={[Math.sin(index * 2.4) * 0.24, 0.12, Math.cos(index * 2.4) * 0.24]}>
            <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.006, 0.009, 0.06, 4]} /><meshStandardMaterial color="#a19664" roughness={1} /></mesh>
            <mesh position={[0, 0.06, 0]} rotation={[0.2, 0, 0.3]} scale={[0.018, 0.027, 0.018]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#b6a76f" roughness={1} /></mesh>
          </group>)}
        </group>
      ) : plant.kind === 'fern' ? (
        <group scale={[1, 0.7 + Math.min(fit, 0.7) * 0.5, 1]}>
          <mesh castShadow receiveShadow><primitive object={plantGeometry.fern.leaves} attach="geometry" /><meshStandardMaterial color={leafColor} side={DoubleSide} roughness={0.95} flatShading /></mesh>
          <mesh castShadow><primitive object={plantGeometry.fern.stems} attach="geometry" /><meshStandardMaterial color="#71905b" roughness={1} /></mesh>
        </group>
      ) : plant.kind === 'bloom' ? (
        <group>
          <mesh castShadow receiveShadow><primitive object={plantGeometry.bloom.leaves} attach="geometry" /><meshStandardMaterial color={leafColor} side={DoubleSide} roughness={0.95} flatShading /></mesh>
          {flowering ? <><mesh castShadow><primitive object={plantGeometry.bloom.petals} attach="geometry" /><meshStandardMaterial color={fit < 0.16 ? flowerColor : plant.id % 2 ? '#e5d5a3' : '#dfab9c'} side={DoubleSide} roughness={0.95} flatShading /></mesh><mesh castShadow><primitive object={plantGeometry.bloom.centers} attach="geometry" /><meshStandardMaterial color={fit < 0.16 ? '#b9a27a' : '#d6b269'} roughness={1} flatShading /></mesh></> : <mesh position={[0.08, 0.76, -0.04]} scale={[0.05, 0.075, 0.05]}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#a3ae7d" roughness={1} /></mesh>}
        </group>
      ) : (
        <group>
          <mesh castShadow receiveShadow><primitive object={plantGeometry.clover.leaves} attach="geometry" /><meshStandardMaterial color={leafColor} side={DoubleSide} roughness={0.95} flatShading /></mesh>
          <mesh castShadow><primitive object={plantGeometry.clover.stems} attach="geometry" /><meshStandardMaterial color="#6b8957" roughness={1} /></mesh>
        </group>
      )}</group>} />}
      {plant.lastReproduction === tick && <mesh position={[0.2, 0.16, 0]}><sphereGeometry args={[0.04, 7, 4]} /><meshStandardMaterial color="#bd9c63" roughness={1} /></mesh>}
      <mesh ref={hit} position={[0, young ? youngCenterY : 0.1 / scale, 0]} scale={environmentScale.minimumPickRadius / scale}><sphereGeometry args={[1, 6, 4]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>
  )
}

type CreatureProps = { creature: Creature; world: World; events: SimulationEvent[]; selected: boolean; onSelect: (ray: Ray) => void; speed: number }

function useAnimalClock(speed: number) {
  const clock = useRef({ elapsedTime: 0 })
  useFrame((_, delta) => { clock.current.elapsedTime += Math.min(delta, 0.05) * speed })
  return clock
}

function AnimalInteraction({ scale, y, selected, markerRadius = 0.24 }: { scale: number; y: number; selected: boolean; markerRadius?: number }) {
  const hit = useRef<Object3D>(null)
  const point = useRef(new Vector3())
  const worldScale = useRef(new Vector3())
  useFrame(({ camera, size }) => {
    if (!hit.current || !(camera instanceof PerspectiveCamera)) return
    hit.current.getWorldPosition(point.current)
    // Remove parent growth scale: accessibility never changes biological size.
    hit.current.parent!.getWorldScale(worldScale.current)
    const radius = worldPickRadius(camera.position.distanceTo(point.current), camera.getEffectiveFOV(), size.height)
    hit.current.scale.setScalar(radius / Math.max(0.001, worldScale.current.x))
  })
  return <group scale={1 / scale}>
    {selected && <mesh position={[0, 0.058 - y, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[markerRadius, markerRadius * 1.1, 28]} /><meshBasicMaterial color="#f9f6d3" transparent opacity={0.9} depthWrite={false} /></mesh>}
    <mesh ref={hit}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </group>
}

function AquaticAnimal({ creature, events, selected, onSelect, speed }: CreatureProps) {
  const animationClock = useAnimalClock(speed)
  const group = useRef<Group>(null)
  const tail = useRef<Group>(null)
  const size = animalModelScale(creature)
  const initialScale = useRef(size)
  const fish = creature.kind === 'fish'
  const y = animalWaterY(creature.kind)
  const start = useRef<[number, number, number]>([creature.x, y, creature.z])
  const rotation = useRef<[number, number, number]>([0, creature.heading, 0])
  const motion = useRef(false)
  const fed = events.some((event) => event.type === 'predation' ? event.predatorId === creature.id : event.type === 'feeding' && event.id === creature.id)
  useFrame((_, delta) => {
    const clock = animationClock.current
    if (!group.current) return
    const moving = Math.hypot(group.current.position.x - creature.x, group.current.position.z - creature.z) > 0.01
    motion.current = moving
    const factor = 1 - Math.exp(-delta * 9)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, size, factor))
    group.current.position.x = MathUtils.lerp(group.current.position.x, creature.x, factor)
    group.current.position.z = MathUtils.lerp(group.current.position.z, creature.z, factor)
    group.current.rotation.y += Math.atan2(Math.sin(creature.heading - group.current.rotation.y), Math.cos(creature.heading - group.current.rotation.y)) * factor
    if (tail.current) tail.current.rotation.y = moving ? Math.sin(clock.elapsedTime * 18) * 0.35 : 0
  })
  return <group ref={group} position={start.current} rotation={rotation.current} scale={initialScale.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(event.ray) }}>
    <AnimalInteraction scale={size} y={y} selected={selected} />
    {fish ? <OrganismAsset file="pond-fish" shape={{ length: 0.48, base: 0, centered: true }} moving={motion} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} fallback={<group position={[0, 0, 0.04]}>
      <mesh scale={[0.09, 0.065, 0.2]} castShadow><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#ca9a7c" roughness={0.8} flatShading /></mesh>
      <group ref={tail} position={[0, 0, -0.2]}><mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.5]}><coneGeometry args={[0.1, 0.16, 3]} /><meshStandardMaterial color="#ad8e78" roughness={1} flatShading /></mesh></group>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.07, 0.026, 0.12]}><sphereGeometry args={[0.015, 6, 4]} /><meshStandardMaterial color="#3b5652" /></mesh>)}
    </group>} /> : paperLook ? <PaperAnimal animal="water-flea" base={0} bend="none" moving={motion} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} juvenile={creature.stage === 'juvenile'} feeding={fed} /> : <OrganismAsset file="daphnia" shape={{ length: 0.14, base: 0, centered: true, measure: 'max' }} moving={motion} feeding={fed} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} fallback={null} unavailable={(retry) => modelUnavailable('Water flea', retry)} />}
  </group>
}

function Springtail({ creature, world, events, selected, onSelect, speed }: CreatureProps) {
  const group = useRef<Group>(null)
  const motion = useRef(false)
  const size = animalModelScale(creature)
  const initialScale = useRef(size)
  const start = useRef<[number, number, number]>([creature.x, animalGroundY(creature), creature.z])
  const rotation = useRef<[number, number, number]>([0, creature.heading, 0])
  const feeding = creatureIsFeeding(world, creature, events)
  useFrame((_, delta) => {
    if (!group.current) return
    motion.current = speed > 0 && Math.hypot(group.current.position.x - creature.x, group.current.position.z - creature.z) > 0.0003
    const factor = 1 - Math.exp(-delta * springtailTrackingRate)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, size, factor))
    group.current.position.x = MathUtils.lerp(group.current.position.x, creature.x, factor)
    group.current.position.z = MathUtils.lerp(group.current.position.z, creature.z, factor)
    group.current.position.y = animalGroundY(creature)
    group.current.rotation.y += Math.atan2(Math.sin(creature.heading - group.current.rotation.y), Math.cos(creature.heading - group.current.rotation.y)) * factor
  })
  return <group ref={group} position={start.current} rotation={rotation.current} scale={initialScale.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(event.ray) }}>
    <AnimalInteraction scale={size} y={animalGroundY(creature)} selected={selected} markerRadius={0.018} />
    {paperLook ? <PaperAnimal animal="springtail" base={-0.07} moving={motion} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} juvenile={creature.stage === 'juvenile'} feeding={feeding} resting={scheduledRest(world, creature)} pooping={feeding} /> : <OrganismAsset file="springtail" shape={{ length: 0.39, base: -0.07 }} moving={motion} feeding={feeding} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} fallback={null} unavailable={(retry) => modelUnavailable('Springtail', retry)} />}
  </group>
}
const grazerBody = new SphereGeometry(1, 10, 7)
const grazerLeg = new SphereGeometry(1, 6, 4)
const woodlouseLeg = new CylinderGeometry(0.014, 0.011, 1, 4)

function Grazer({ creature, world, events, selected, onSelect, speed }: CreatureProps) {
  const animationClock = useAnimalClock(speed)
  const group = useRef<Group>(null)
  const size = animalModelScale(creature)
  const initialScale = useRef(size)
  const motion = useRef(false)
  const bite = useRef<Group>(null)
  const body = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const transform = useRef(new Object3D())
  const startPosition = useRef<[number, number, number]>([creature.x, 0.18, creature.z])
  const startRotation = useRef<[number, number, number]>([0, creature.heading, 0])
  const feeding = creatureIsFeeding(world, creature, events)
  const strength = MathUtils.clamp((creature.energy - 10) / 40, 0, 1)
  const shellColor = new Color('#a8a38b').lerp(new Color(creature.id === 1 ? '#b98563' : '#d69b76'), strength)
  const shellHex = shellColor.getHex()
  useLayoutEffect(() => {
    if (!body.current) return
    for (let index = 0; index < 6; index += 1) body.current.setColorAt(index, new Color('#efce9d').lerp(new Color(shellHex), index % 2 ? 0.75 : 1))
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [shellHex])
  useFrame((_, delta) => {
    const clock = animationClock.current
    if (!group.current) return
    const moving = Math.hypot(group.current.position.x - creature.x, group.current.position.z - creature.z) > 0.01
    motion.current = moving
    const factor = 1 - Math.exp(-delta * 7)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, size, factor))
    group.current.position.x = MathUtils.lerp(group.current.position.x, creature.x, factor)
    group.current.position.z = MathUtils.lerp(group.current.position.z, creature.z, factor)
    group.current.position.y = animalGroundY(creature) + (feeding ? Math.sin(clock.elapsedTime * 13) * 0.008 * size : 0)
    const turn = Math.atan2(Math.sin(creature.heading - group.current.rotation.y), Math.cos(creature.heading - group.current.rotation.y))
    group.current.rotation.y += turn * factor
    const pose = transform.current
    for (let index = 0; index < 6; index += 1) {
      const wave = moving ? Math.sin(clock.elapsedTime * 15 - index * 0.8) : 0
      const fullness = 0.82 + Math.sin(index / 5 * Math.PI) * 0.18
      pose.position.set(wave * 0.012, 0.005 + wave * 0.012, 0.2 - index * 0.108)
      pose.rotation.set(0, 0, wave * 0.035)
      pose.scale.set(0.15 * fullness, 0.13 * fullness, 0.105)
      pose.updateMatrix()
      body.current?.setMatrixAt(index, pose.matrix)
    }
    for (let index = 0; index < 16; index += 1) {
      const side = index % 2 ? 1 : -1
      const pair = Math.floor(index / 2)
      const wave = moving ? Math.sin(clock.elapsedTime * 15 - pair * 0.7 + side) : 0
      pose.position.set(side * (pair < 3 ? 0.105 : 0.115), -0.09 + Math.max(0, wave) * 0.018, 0.25 - pair * 0.078 + wave * 0.012)
      pose.rotation.set(0, 0, side * (pair < 3 ? 0.45 : 0.15))
      pose.scale.set(pair < 3 ? 0.018 : 0.035, pair < 3 ? 0.055 : 0.05, 0.028)
      pose.updateMatrix()
      legs.current?.setMatrixAt(index, pose.matrix)
    }
    if (body.current) body.current.instanceMatrix.needsUpdate = true
    if (legs.current) legs.current.instanceMatrix.needsUpdate = true
    if (bite.current) {
      bite.current.position.z = 0.46 + Math.sin(clock.elapsedTime * 15) * 0.035
      bite.current.rotation.z = Math.sin(clock.elapsedTime * 15) * 0.16
    }
  })
  return (
    <group ref={group} position={startPosition.current} rotation={startRotation.current} scale={initialScale.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(event.ray) }}>
      <AnimalInteraction scale={size} y={animalGroundY(creature)} selected={selected} />
      {paperLook ? <PaperAnimal animal="caterpillar" base={-0.145} moving={motion} speed={speed} health={strength} juvenile={creature.stage === 'juvenile'} feeding={feeding} resting={scheduledRest(world, creature)} pooping={feeding} /> : <OrganismAsset file="leaf-grazer" shape={{ length: 0.87, base: -0.145 }} moving={motion} feeding={feeding} speed={speed} health={strength} fallback={<>
      <instancedMesh ref={body} args={[undefined, undefined, 6]} castShadow><primitive object={grazerBody} attach="geometry" /><meshStandardMaterial color="#ffffff" roughness={0.93} flatShading /></instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, 16]} castShadow><primitive object={grazerLeg} attach="geometry" /><meshStandardMaterial color="#9f8063" roughness={1} flatShading /></instancedMesh>
      <mesh position={[0, 0.015, 0.31]} scale={[0.145, 0.135, 0.13]} castShadow>
        <sphereGeometry args={[1, 10, 7]} />
        <meshStandardMaterial color="#d7b08a" roughness={0.9} flatShading />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.105, 0.07, 0.43]} scale={[0.027, 0.031, 0.025]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#342e2a" roughness={0.5} />
          </mesh>
          <mesh position={[side * 0.11, 0.105, 0.405]} rotation={[0.85, 0, side * 0.3]}>
            <cylinderGeometry args={[0.01, 0.016, 0.075, 5]} />
            <meshStandardMaterial color="#765744" roughness={1} />
          </mesh>
        </group>
      ))}
      </>} />}
      {feeding && !paperLook && (
        <group ref={bite} position={[0, 0.03, 0.46]}>
          <mesh position={[-0.04, 0, 0]} scale={[0.055, 0.025, 0.085]} rotation={[0, 0.5, 0]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#78a977" roughness={1} flatShading />
          </mesh>
          <mesh position={[0.055, -0.015, 0.02]} scale={[0.045, 0.025, 0.065]} rotation={[0, -0.5, 0]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#9cba80" roughness={1} flatShading />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Woodlouse({ creature, world, events, selected, onSelect, speed }: CreatureProps) {
  const animationClock = useAnimalClock(speed)
  const group = useRef<Group>(null)
  const legs = useRef<InstancedMesh>(null)
  const legTransform = useRef(new Object3D())
  const mouth = useRef<Group>(null)
  const isMoving = useRef(false)
  const yaw = useRef(creature.heading)
  const startPosition = useRef<[number, number, number]>([creature.x, 0.145, creature.z])
  const startRotation = useRef<[number, number, number]>([0, creature.heading, 0])
  const feeding = creatureIsFeeding(world, creature, events)
  const strength = MathUtils.clamp(creature.energy / 50, 0, 1)
  const shell = new Color('#aaa692').lerp(new Color('#6e898b'), strength)
  const life = woodlouseLife(creature)
  const size = animalModelScale(creature)
  const startScale = useRef(size)
  if (creature.stage === 'juvenile') shell.lerp(new Color('#cfceb0'), 0.55)
  useFrame((_, delta) => {
    const clock = animationClock.current
    if (!group.current) return
    const moving = Math.hypot(group.current.position.x - creature.x, group.current.position.z - creature.z) > 0.01
    isMoving.current = moving && speed > 0
    const factor = 1 - Math.exp(-delta * 8)
    group.current.position.x = MathUtils.lerp(group.current.position.x, creature.x, factor)
    group.current.position.z = MathUtils.lerp(group.current.position.z, creature.z, factor)
    const turn = Math.atan2(Math.sin(creature.heading - group.current.rotation.y), Math.cos(creature.heading - group.current.rotation.y))
    group.current.rotation.y += turn * factor
    yaw.current = group.current.rotation.y
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, size, factor))
    group.current.position.y = animalGroundY(creature)
    if (legs.current) {
      const pose = legTransform.current
      for (let index = 0; index < 14; index += 1) {
        const side = index % 2 ? 1 : -1
        const pair = Math.floor(index / 2)
        const wave = moving ? Math.sin(clock.elapsedTime * 19 - pair * 0.7 + side) : 0
        pose.position.set(side * 0.18, -0.025, pair * 0.065 - 0.2 + wave * 0.013)
        pose.rotation.set(wave * 0.3, 0, side * 1.1)
        pose.scale.set(1, 0.15, 1)
        pose.updateMatrix()
        legs.current.setMatrixAt(index * 2, pose.matrix)
        pose.position.set(side * 0.265, -0.06 + Math.max(0, wave) * 0.012, pair * 0.065 - 0.18 + wave * 0.013)
        pose.rotation.set(0.3 + wave * 0.2, 0, side * 0.45)
        pose.scale.set(0.85, 0.1, 0.85)
        pose.updateMatrix()
        legs.current.setMatrixAt(index * 2 + 1, pose.matrix)
      }
      legs.current.instanceMatrix.needsUpdate = true
    }
    if (mouth.current) mouth.current.position.z = 0.37 + Math.sin(clock.elapsedTime * 15) * 0.018
  })
  return (
    <group ref={group} position={startPosition.current} rotation={startRotation.current} scale={startScale.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(event.ray) }}>
      <AnimalInteraction scale={size} y={animalGroundY(creature)} selected={selected} />
      {paperLook ? <PaperAnimal animal="woodlouse" base={-0.09} heading={yaw} moving={isMoving} speed={speed} health={strength} juvenile={creature.stage === 'juvenile'} feeding={feeding} resting={life.activity === 'resting'} pooping={life.gut > 0.01} courting={life.activity === 'courting'} /> : <OrganismAsset file="woodlouse" shape={{ length: 0.64, base: -0.09 }} moving={isMoving} feeding={feeding} speed={speed} health={strength} juvenile={creature.stage === 'juvenile'} fallback={<group>
      <instancedMesh ref={legs} args={[undefined, undefined, 28]}><primitive object={woodlouseLeg} attach="geometry" /><meshStandardMaterial color="#7c8071" roughness={1} /></instancedMesh>
      {Array.from({ length: 7 }, (_, index) => (
        <mesh key={index} position={[0, 0.035, index * 0.066 - 0.2]} scale={[0.16 + Math.sin(index / 6 * Math.PI) * 0.045, 0.09, 0.063]} castShadow>
          <sphereGeometry args={[1, 8, 5]} />
          <meshStandardMaterial color={index % 2 ? '#859d9a' : shell} roughness={0.9} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.015, 0.285]} scale={[0.12, 0.075, 0.09]} castShadow>
        <sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial color={shell} roughness={0.9} flatShading />
      </mesh>
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[side * 0.068, 0.055, 0.34]}><sphereGeometry args={[0.022, 6, 4]} /><meshStandardMaterial color="#2e4140" roughness={0.7} /></mesh>
        <mesh position={[side * 0.095, 0.06, 0.385]} rotation={[0.8, 0, side * 0.65]}><cylinderGeometry args={[0.009, 0.012, 0.15, 4]} /><meshStandardMaterial color="#71837a" roughness={1} /></mesh>
      </group>)}
      </group>} />}
      {feeding && !paperLook && <group ref={mouth} position={[0, -0.005, 0.37]}><mesh scale={[0.055, 0.02, 0.08]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#bc9870" roughness={1} flatShading /></mesh></group>}
      {life.brood > 0 && !paperLook && <mesh position={[0, -0.055, 0.03]} scale={[0.12, 0.045, 0.18]}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial color="#bcbca0" roughness={1} flatShading /></mesh>}
    </group>
  )
}

function Beetle({ creature, world, events, selected, onSelect, speed }: CreatureProps) {
  const animationClock = useAnimalClock(speed)
  const group = useRef<Group>(null)
  const size = animalModelScale(creature)
  const initialScale = useRef(size)
  const motion = useRef(false)
  const legs = useRef<(Group | null)[]>([])
  const mouth = useRef<Group>(null)
  const startPosition = useRef<[number, number, number]>([creature.x, 0.17, creature.z])
  const startRotation = useRef<[number, number, number]>([0, creature.heading, 0])
  const meal = events.find((event): event is Extract<SimulationEvent, { type: 'predation' }> => event.type === 'predation' && event.predatorId === creature.id)
  const shell = new Color('#999a89').lerp(new Color('#526774'), MathUtils.clamp(creature.energy / 50, 0, 1))
  useFrame((_, delta) => {
    const clock = animationClock.current
    if (!group.current) return
    const moving = Math.hypot(group.current.position.x - creature.x, group.current.position.z - creature.z) > 0.01
    motion.current = moving
    const factor = 1 - Math.exp(-delta * 8)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, size, factor))
    group.current.position.x = MathUtils.lerp(group.current.position.x, creature.x, factor)
    group.current.position.z = MathUtils.lerp(group.current.position.z, creature.z, factor)
    const turn = Math.atan2(Math.sin(creature.heading - group.current.rotation.y), Math.cos(creature.heading - group.current.rotation.y))
    group.current.rotation.y += turn * factor
    group.current.position.y = animalGroundY(creature) + (moving ? Math.sin(clock.elapsedTime * 20) * 0.007 * size : 0)
    for (let index = 0; index < legs.current.length; index += 1) {
      const leg = legs.current[index]
      if (leg) leg.rotation.y = moving ? Math.sin(clock.elapsedTime * 22 + (index % 2) * Math.PI) * 0.23 : 0
    }
    if (mouth.current) mouth.current.rotation.x = Math.sin(clock.elapsedTime * 16) * 0.13
  })
  return (
    <group ref={group} position={startPosition.current} rotation={startRotation.current} scale={initialScale.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(event.ray) }}>
      <AnimalInteraction scale={size} y={animalGroundY(creature)} selected={selected} />
      {paperLook ? <PaperAnimal animal="tiger-beetle" base={-0.145} moving={motion} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} juvenile={creature.stage === 'juvenile'} feeding={!!meal} resting={scheduledRest(world, creature)} /> : <OrganismAsset file="tiger-beetle" shape={{ length: 0.75, base: -0.145 }} moving={motion} feeding={!!meal} speed={speed} health={MathUtils.clamp(creature.energy / 50, 0, 1)} fallback={<>
      {[-1, 1].map((side, sideIndex) => <group key={side}>
        {[0, 1, 2].map((index) => <group key={index} ref={(leg) => { legs.current[sideIndex * 3 + index] = leg }} position={[side * 0.14, -0.035, index * 0.17 - 0.2]}>
          <mesh position={[side * 0.075, -0.015, 0]} rotation={[0, 0, side * 1.2]}><cylinderGeometry args={[0.018, 0.02, 0.19, 5]} /><meshStandardMaterial color="#9b876d" roughness={0.95} /></mesh>
          <mesh position={[side * 0.18, -0.065, 0.025]} rotation={[0.3, 0, side * 0.8]}><cylinderGeometry args={[0.012, 0.016, 0.18, 5]} /><meshStandardMaterial color="#737568" roughness={0.95} /></mesh>
        </group>)}
        <mesh position={[side * 0.102, 0.015, -0.11]} scale={[0.106, 0.135, 0.245]} castShadow>
          <sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color={shell} roughness={0.88} flatShading />
        </mesh>
        <mesh position={[side * 0.073, 0.055, 0.315]}><sphereGeometry args={[0.025, 7, 5]} /><meshStandardMaterial color="#283c3b" roughness={0.5} /></mesh>
        <mesh position={[side * 0.12, 0.065, 0.4]} rotation={[0.7, 0, side * 0.65]}><cylinderGeometry args={[0.009, 0.014, 0.2, 5]} /><meshStandardMaterial color="#9e8d73" roughness={0.9} /></mesh>
        <mesh position={[side * 0.055, -0.005, 0.365]} rotation={[0.7, 0, side * 0.3]}><coneGeometry args={[0.025, 0.09, 5]} /><meshStandardMaterial color="#8f8069" roughness={0.9} /></mesh>
      </group>)}
      <mesh position={[0, 0.035, 0.14]} scale={[0.17, 0.11, 0.12]} castShadow><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#9c9176" roughness={0.85} flatShading /></mesh>
      <mesh position={[0, 0.015, 0.29]} scale={[0.12, 0.085, 0.105]} castShadow><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#657d77" roughness={0.85} flatShading /></mesh>
      </>} />}
      {meal && !paperLook && <group ref={mouth} position={[0, -0.035, 0.405]}><mesh scale={[0.065, 0.04, 0.075]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={meal.preyKind === 'woodlouse' ? '#829b99' : meal.preyKind === 'springtail' ? '#d9d5b4' : '#c39d7c'} roughness={1} flatShading /></mesh></group>}
    </group>
  )
}

function Fauna({ world, events, worldRevision, selectedCreature, placing, onPlace, onSelectCreature, speed }: Pick<SceneProps, 'world' | 'events' | 'worldRevision' | 'selectedCreature' | 'placing' | 'onPlace' | 'onSelectCreature' | 'speed'>) {
  const { camera, size } = useThree()
  function pickAnimal(ray: Ray, fallback: Creature) {
    if (placing) { onPlace(fallback.x, fallback.z); return }
    const pointer = ray.at(1, new Vector3()).project(camera)
    let closest = animalTargetPixels / 2
    let chosen = fallback
    for (const candidate of world.creatures) {
      const center = new Vector3(candidate.x, isAquatic(candidate.kind) ? animalWaterY(candidate.kind) : animalGroundY(candidate), candidate.z).project(camera)
      if (center.z < -1 || center.z > 1) continue
      const distance = new Vector2((center.x - pointer.x) * size.width / 2, (center.y - pointer.y) * size.height / 2).length()
      if (distance < closest) { closest = distance; chosen = candidate }
    }
    onSelectCreature(chosen.id)
  }
  return <>{world.creatures.map((creature) => {
    const kind = creatureKind(creature)
    const Model = kind === 'fish' || kind === 'flea' ? AquaticAnimal : kind === 'woodlouse' ? Woodlouse : kind === 'beetle' ? Beetle : kind === 'springtail' ? Springtail : Grazer
    return <Model key={`${worldRevision}:${creature.id}`} creature={creature} world={world} events={events} selected={selectedCreature === creature.id} speed={speed} onSelect={(ray) => pickAnimal(ray, creature)} />
  })}</>
}

type RenderSample = { mean: number; p95: number; calls: number; triangles: number; geometries: number; eye: number[]; target: number[]; near: number; fov: number; input: string }

function RemainsField({ world }: { world: World }) {
  const instances = useRef<InstancedMesh>(null)
  const remains = (world.remains ?? []).filter((item) => !item.ant)
  useLayoutEffect(() => {
    if (!instances.current) return
    const pose = new Object3D()
    remains.forEach((item, index) => {
      const ratio = Math.max(0, item.material / item.initial)
      const size = Math.min(0.45, 0.12 + Math.cbrt(item.initial) * 0.18) * Math.sqrt(ratio)
      const animal = ['grazer', 'woodlouse', 'beetle', 'springtail', 'flea', 'fish', 'ant'].includes(item.kind)
      for (let part = 0; part < 3; part += 1) {
        const px = item.x + Math.sin(item.id * 2.4) * part * size * 0.6, pz = item.z + Math.cos(item.id * 2.4) * part * size * 0.6
        pose.position.set(px, 0.06 + part * 0.004 + groundShape.offset(px, pz), pz)
        pose.rotation.set(0, item.id * 2.4 + part, 0.12)
        pose.scale.set(size * (animal ? 0.7 : 1), size * 0.15, size * (animal ? 0.45 : 0.55))
        pose.updateMatrix()
        instances.current!.setMatrixAt(index * 3 + part, pose.matrix)
        instances.current!.setColorAt(index * 3 + part, new Color(animal ? '#8d9080' : '#ac956e').lerp(new Color('#9a9b79'), 1 - ratio))
      }
    })
    instances.current.instanceMatrix.needsUpdate = true
    if (instances.current.instanceColor) instances.current.instanceColor.needsUpdate = true
    instances.current.computeBoundingSphere()
  }, [remains])
  if (!remains.length) return null
  return <instancedMesh key={remains.length} ref={instances} args={[undefined, undefined, remains.length * 3]} receiveShadow><sphereGeometry args={[1, 7, 4]} /><meshStandardMaterial roughness={1} flatShading /></instancedMesh>
}

function WatchingControls({ creature, plant, ant, surfacePose, remains }: { creature: Creature | undefined; plant: Plant | undefined; ant?: { id: number; x: number; y: number; z: number }; surfacePose: SurfacePose; remains?: Remains }) {
  const subject = ant ?? (remains?.ant ? { id: remains.id, x: remains.x, y: remains.ant.y + 0.01, z: remains.z } : undefined)
  const micro = creature?.kind === 'springtail'
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const keyControls = useRef<ComponentRef<typeof OrbitControls> | null>(null)
  const { gl, camera, size } = useThree()
  const focusedFrame = plant ? plantCameraFocus(plant, size.width / size.height, 38, size.width > 760) : null
  const closePlant = !!focusedFrame && focusedFrame.distance < 1.7
  useLayoutEffect(() => {
    if ((!micro && !closePlant) || !(camera instanceof PerspectiveCamera)) return
    const near = camera.near
    const before = { position: surfacePose.position.clone(), target: surfacePose.target.clone(), ready: surfacePose.ready, width: surfacePose.width, height: surfacePose.height }
    camera.near = closePlant ? 0.0001 : 0.002
    camera.updateProjectionMatrix()
    return () => {
      camera.near = near; camera.updateProjectionMatrix()
      // Subsurface views clear the land subject. Their Return must restore
      // the ordinary surface pose, not a microscopic pose with no organism.
      surfacePose.position.copy(before.position); surfacePose.target.copy(before.target)
      surfacePose.ready = before.ready; surfacePose.width = before.width; surfacePose.height = before.height
    }
  }, [camera, micro, closePlant, surfacePose])
  const plantId = plant?.id ?? null
  useLayoutEffect(() => {
    if (plantId === null || !(camera instanceof PerspectiveCamera)) return
    const previous = camera.view ? { ...camera.view } : null
    if (size.width > 760) camera.setViewOffset(size.width, size.height, size.width * 0.12, 0, size.width, size.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    return () => {
      if (previous?.enabled) camera.setViewOffset(previous.fullWidth, previous.fullHeight, previous.offsetX, previous.offsetY, previous.width, previous.height)
      else camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, plantId, size.width, size.height])
  const focus = useRef({ id: null as string | null, remaining: 0, distance: 14, previous: 14 })
  const autoPlant = useRef(true)
  const activePlant = useRef(false)
  activePlant.current = !!plant || !!remains
  useEffect(() => {
    gl.domElement.tabIndex = 0
    gl.domElement.setAttribute('role', 'img')
    gl.domElement.setAttribute('aria-label', 'Terrarium camera. Arrow keys pan.')
    const manualPan = (event: KeyboardEvent) => {
      gl.domElement.dataset.cameraInput = `${event.key}/${event.code || 'no code'}`
      if (activePlant.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        autoPlant.current = false
        focus.current.remaining = 0
      }
    }
    gl.domElement.addEventListener('keydown', manualPan)
    return () => {
      if (keyControls.current?._domElementKeyEvents) keyControls.current.stopListenToKeyEvents()
      keyControls.current = null
      gl.domElement.removeEventListener('keydown', manualPan)
    }
  }, [gl])
  const offset = useRef(new Vector3())
  const layout = useRef('')
  useFrame(({ camera, size }, delta) => {
    if (!controls.current) return
    // Bind after Drei's effect setup/StrictMode cleanup. Binding in the parent
    // effect can be silently removed by the child's later dispose/reconnect.
    if (keyControls.current !== controls.current) {
      if (keyControls.current?._domElementKeyEvents) keyControls.current.stopListenToKeyEvents()
      controls.current.listenToKeyEvents(gl.domElement)
      keyControls.current = controls.current
    }
    const target = controls.current.target
    const plantFrame = plant ? plantCameraFocus(plant, size.width / size.height, camera instanceof PerspectiveCamera ? camera.fov : 38, size.width > 760) : null
    const layoutKey = `${size.width}:${size.height}`
    if (layout.current !== layoutKey) {
      const restoring = layout.current === '' && surfacePose.ready && surfacePose.width === size.width && surfacePose.height === size.height
      layout.current = layoutKey
      const overview = Math.min(21, Math.max(14.5, 13.5 / (size.width / size.height)))
      focus.current.previous = overview
      if (!creature && !plant && !ant && !restoring) { focus.current.distance = overview; focus.current.remaining = 1.4 }
    }
    const id = remains ? `remains:${remains.id}` : ant ? `ant:${ant.id}` : creature ? `animal:${creature.id}` : plantFrame?.key ?? null
    if (id !== focus.current.id) {
      if (focus.current.id === null) focus.current.previous = focus.current.remaining > 0 ? focus.current.distance : camera.position.distanceTo(target)
      autoPlant.current = true
      focus.current = { ...focus.current, id, remaining: micro ? 3.2 : 1.4, distance: subject ? 0.65 : creature ? micro ? 0.12 : 3.2 : plantFrame?.distance ?? focus.current.previous }
    }
    const factor = 1 - Math.exp(-delta * (micro ? springtailTrackingRate : 3))
    const trackingPlant = plantFrame && autoPlant.current
    const tracking = subject && (!remains || autoPlant.current) || creature || trackingPlant || focus.current.remaining > 0
    const dx = tracking ? ((subject?.x ?? creature?.x ?? plantFrame?.x ?? 0) - target.x) * factor : 0
    const dz = tracking ? ((subject?.z ?? creature?.z ?? plantFrame?.z ?? 0) - target.z) * factor : 0
    const targetY = subject?.y ?? (creature ? isAquatic(creature.kind) ? animalWaterY(creature.kind) : animalGroundY(creature) : plantFrame?.y ?? -0.4)
    const dy = tracking ? (targetY - target.y) * factor : 0
    target.x += dx; target.y += dy; target.z += dz
    camera.position.x += dx; camera.position.y += dy; camera.position.z += dz
    if (focus.current.remaining > 0 || trackingPlant) {
      focus.current.remaining = Math.max(0, focus.current.remaining - delta)
      offset.current.copy(camera.position).sub(target)
      offset.current.setLength(MathUtils.lerp(offset.current.length(), trackingPlant ? plantFrame.distance : focus.current.distance, 1 - Math.exp(-delta * 3)))
      camera.position.copy(target).add(offset.current)
    }
    controls.current.update()
    surfacePose.position.copy(camera.position)
    surfacePose.target.copy(target)
    surfacePose.ready = true
    surfacePose.width = size.width; surfacePose.height = size.height
  }, -0.5)
  const minimum = closePlant && focusedFrame ? focusedFrame.distance / 2 : micro ? 0.06 : subject ? 0.22 : 1.7
  return <OrbitControls ref={controls} makeDefault enablePan screenSpacePanning minDistance={minimum} maxDistance={focusedFrame?.maxDistance ?? 21} minPolarAngle={0.25} maxPolarAngle={1.42} target={surfacePose.target} enableDamping dampingFactor={0.08} onStart={() => { if (plant || remains) { autoPlant.current = false; focus.current.remaining = 0 } }} />
}

function RenderProbe({ onSample }: { onSample: (sample: RenderSample) => void }) {
  const frames = useRef<number[]>([])
  const warmup = useRef(0)
  useFrame(({ gl, camera, controls }, delta) => {
    if (warmup.current++ < 30) return
    frames.current.push(delta * 1000)
    if (frames.current.length < 120) return
    const sorted = [...frames.current].sort((a, b) => a - b)
    const target = (controls as { target?: Vector3 } | null)?.target
    onSample({ mean: frames.current.reduce((sum, ms) => sum + ms, 0) / frames.current.length, p95: sorted[Math.floor(sorted.length * 0.95)], calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, eye: camera.position.toArray(), target: target?.toArray() ?? [], near: camera.near, fov: camera instanceof PerspectiveCamera ? camera.fov : 0, input: [gl.domElement.dataset.cameraInput, gl.domElement.dataset.nestMeshing].filter(Boolean).join(' · ') })
    frames.current = []
  })
  return null
}

/** ?debug: exposes the scene and renderer as window.__three for profiling scripts. */
function DebugHandle() {
  const { scene, gl } = useThree()
  useEffect(() => { if (location.search.includes('debug')) (window as unknown as { __three: unknown }).__three = { scene, gl } }, [scene, gl])
  return null
}

export function Terrarium({ world, events, worldRevision, selectedPlant, selectedCreature, selectedSoil, placing, onSelectPlant, onSelectCreature, onSelectSoil, onPlace, onClearSelection, onSelectPond, followCreature, focusPlant, speed, underwater, underground, selectedAnt, followAnt, onSelectAnt, onSelectColony, focusBrood, selectedBrood, onSelectBrood, focusChamber, onSelectChamber, showAntFood, focusedRemains, onSelectRemains }: SceneProps) {
  const [profile, setProfile] = useState<RenderSample | null>(null)
  const broodCenters = useMemo(() => new Map<number, Vector3>(), [worldRevision])
  const antCenters = useMemo(() => new Map<number, Vector3>(), [worldRevision])
  const surfacePose = useRef<SurfacePose>({ position: new Vector3(8.5, 6.55, 10), target: new Vector3(0, -0.4, 0), ready: false, width: 0, height: 0 }).current
  const viewWorld = underwater ? { ...world, plants: world.plants.filter((plant) => isAquatic(plant.kind)), creatures: world.creatures.filter((creature) => isAquatic(creature.kind)), remains: (world.remains ?? []).filter((remains) => isAquatic(remains.kind)) } : world
  const profiling = new URLSearchParams(window.location.search).get('profile') === '1'
  const followedAnt = world.colony ? [world.colony.queen, ...world.colony.workers].find((ant) => ant?.id === followAnt) ?? undefined : undefined
  const surfaceAnt = followedAnt && world.colony ? { id: followedAnt.id, ...antPosition(world.colony, followedAnt) } : undefined
  const selectRemains = (id: number) => {
    const item = world.remains.find((remains) => remains.id === id)
    if (placing && item) onPlace(item.x, item.z)
    else onSelectRemains(id)
  }
  const selectAnt = (id: number) => {
    const ant = [world.colony?.queen, ...world.colony?.workers ?? []].find((item) => item?.id === id)
    if (placing && ant && world.colony) { const p = antPosition(world.colony, ant); onPlace(p.x, p.z) }
    else onSelectAnt(id)
  }
  return (
    <>
    <Canvas
      shadows
      dpr={[1, coarsePointer ? 1.25 : 1.7]}
      camera={{ position: [8.5, 6.55, 10], fov: 38, near: 0.1, far: 70 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => { if (!placing) onClearSelection() }}
      style={{ cursor: placing ? 'crosshair' : 'grab' }}
    >
      <DebugHandle />
      {paperLook && watercolorLook && <Watercolor />}
      {!underground && <Daylight world={world} dramatic={paperLook && watercolorLook} />}
      {paperLook && watercolorLook && !underground && !underwater && <><color attach="background" args={['#23272f']} /><fog attach="fog" args={['#23272f', 16, 44]} /></>}
      {paperLook && watercolorLook && polishLook && <Polish light={coarsePointer} />}
      {underwater && <PondAtmosphere world={world} />}
      {underground && <><color attach="background" args={['#ded9c8']} /><ambientLight intensity={0.85} /><hemisphereLight args={['#fff4de', '#b39b78', 1.3]} /><directionalLight position={[4, 3, -6]} intensity={2} color="#ffebc4" /></>}
      {!underground && <>
      <Terrain fog={fogLevel(world)} underwater={underwater} substrate={paperLook ? world.substrate : undefined} swimmers={world.creatures.filter((creature) => isAquatic(creature.kind))} pond={world.pond ?? defaultPond()} soil={world.soil ?? []} selectedSoil={selectedSoil} onPondClick={(x, z) => { if (placing) onPlace(x, z); else onSelectPond() }} onGroundClick={(x, z) => { if (underwater) return; if (placing) onPlace(x, z); else if (world.soil?.length) onSelectSoil(nearestSoil(world.soil, x, z).id) }} />
      {!underwater && (world.soil ?? []).map((patch) => <FungalPatch key={patch.id} patch={patch} />)}
      <RemainsField world={viewWorld} />
      {viewWorld.plants.map((plant) => <PlantModel key={`${worldRevision}:${plant.id}`} plant={plant} fit={habitatFit(world, plant)} tick={world.tick} selected={selectedPlant === plant.id} onSelect={() => placing ? onPlace(plant.x, plant.z) : onSelectPlant(plant.id)} />)}
      {showAntFood && world.colony && !underwater && world.plants.filter((plant) => ['clover', 'grass', 'bloom'].includes(plant.kind) && Math.hypot(plant.x - world.colony!.entrance.x, plant.z - world.colony!.entrance.z) <= 2.8).map((plant) => <mesh key={`food:${plant.id}`} position={[plant.x, 0.052, plant.z]} rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelectPlant(plant.id) }}><ringGeometry args={[0.28, 0.30, 40]} /><meshBasicMaterial color={seedMaterialAvailable(plant) > 0.00001 ? '#55805e' : '#bc9751'} transparent opacity={0.8} depthWrite={false} /></mesh>)}
      <Fauna {...{ world: viewWorld, events, worldRevision, selectedCreature, placing, onPlace, onSelectCreature, speed }} />
      </>}
      {world.colony && !underwater && <AntColonyScene broodCenters={broodCenters} antCenters={antCenters} colony={world.colony} underground={underground} speed={speed} events={events} selected={selectedAnt} chamber={focusChamber} revision={worldRevision} onSelect={selectAnt} onColony={() => placing ? onPlace(world.colony!.entrance.x, world.colony!.entrance.z) : onSelectColony()} onChamber={onSelectChamber} remains={world.remains} selectedRemains={focusedRemains?.id ?? null} onRemains={selectRemains} selectedBrood={selectedBrood} onSelectBrood={onSelectBrood} />}
      {!underwater && <AntRemainsScene remains={world.remains} colony={world.colony} underground={underground} selected={focusedRemains?.id ?? null} onSelect={selectRemains} />}
      {profiling && <RenderProbe onSample={setProfile} />}
      {underground && world.colony ? <NestControls broodCenters={broodCenters} antCenters={antCenters} remains={focusedRemains} colony={world.colony} ant={followedAnt} focusBrood={focusBrood} broodId={selectedBrood} chamber={focusChamber} surfacePose={surfacePose} /> : underwater ? <PondControls creature={viewWorld.creatures.find((creature) => creature.id === followCreature)} fish={viewWorld.creatures.filter((creature) => creature.kind === 'fish')} surfacePose={surfacePose} /> : <WatchingControls remains={focusedRemains} creature={world.creatures.find((creature) => creature.id === followCreature)} plant={world.plants.find((plant) => plant.id === focusPlant)} ant={surfaceAnt} surfacePose={surfacePose} />}
    </Canvas>
    {profiling && <output className="render-profile" aria-label="Renderer profile" aria-live="off">{profile ? <>{`${profile.mean.toFixed(1)} ms mean · ${profile.p95.toFixed(1)} ms p95 · ${profile.calls} draws · ${profile.triangles.toLocaleString()} triangles · ${profile.geometries} geometries`}<br />{`eye ${profile.eye.map((n) => n.toFixed(3)).join('/')} · target ${profile.target.map((n) => n.toFixed(3)).join('/')} · near ${profile.near} · fov ${profile.fov} · ${profile.input}`}</> : 'Measuring renderer frames…'}</output>}
    </>
  )
}
