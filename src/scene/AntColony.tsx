import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { BackSide, DoubleSide, Group, Matrix4, PerspectiveCamera, Quaternion, SphereGeometry, Vector3 } from 'three'
import type { Box3, Ray } from 'three'
import { antPosition } from '../sim/colony'
import type { Ant, AntBrood, AntColony as Colony } from '../sim/colony'
import type { SimulationEvent } from '../sim/ecosystem'
import { antModelUnavailable, OrganismAsset } from './OrganismAsset'
import { animalTargetPixels, worldPickRadius } from './picking'
import { chamberRadius, nestFrame, prepareField } from './nestGeometry'
import { antSupportTranslation } from './antSupport'
import { useNestGeometry } from './useNestGeometry'
import type { Remains } from '../sim/life'
import { antRemainsInView } from './AntRemains'
import { eggBounds, grainBounds, nestContentOffset, nurseryOrigin } from './nestContents'

export const antLength = { worker: 0.115, queen: 0.20, larva: 0.065, pupa: 0.08 } as const
const targetGeometry = new SphereGeometry(1, 10, 6)
type PickedLife = { kind: 'ant' | 'brood' | 'remains'; id: number }

function broodPosition(colony: Colony, index: number) {
  const room = colony.nodes.find((node) => node.role === 'brood')!
  return nurseryOrigin(room, index)
}

function BroodModel({ colony, cohort, index, rotation, selected, center, onPick, field }: { colony: Colony; cohort: AntBrood; index: number; rotation: Quaternion; selected: boolean; center: Vector3; onPick: (ray: Ray) => void; field: ReturnType<typeof prepareField> }) {
  const hit = useRef<Group>(null), halo = useRef<Group>(null), { camera, size } = useThree()
  const localCenter = useRef(new Vector3(0, -0.04, 0)), offset = useRef(new Vector3())
  const [bounds, setBounds] = useState<Box3 | null>(cohort.stage === 'egg' ? eggBounds : null)
  const measure = useCallback((value: Box3) => { value.getCenter(localCenter.current); setBounds(value) }, [])
  const position = broodPosition(colony, index)
  const floor = useMemo(() => bounds ? nestContentOffset(field, position, bounds, rotation, cohort.count) : 0, [field, position.x, position.y, position.z, bounds, rotation, cohort.count])
  useFrame(() => {
    offset.current.copy(localCenter.current).applyQuaternion(rotation)
    offset.current.y += (cohort.count - 1) * 0.017 / 2 + floor
    center.copy(position).add(offset.current)
    hit.current?.position.copy(offset.current); halo.current?.position.copy(offset.current)
    hit.current?.scale.setScalar(worldPickRadius(camera.position.distanceTo(center), camera instanceof PerspectiveCamera ? camera.fov : 45, size.height))
  }, -0.75)
  return <group position={position} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onPick(event.ray) }}>
    {Array.from({ length: cohort.count }, (_, i) => <group key={i} position={[0, i * 0.017 + floor, 0]} quaternion={rotation}>
      {cohort.stage === 'egg' ? <mesh scale={[0.007, 0.008, 0.012]} position={[0, -0.04, 0]}><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#e7e0bf" roughness={0.9} /></mesh> : <OrganismAsset key={cohort.stage} file={cohort.stage === 'larva' ? 'ant-larva' : 'ant-pupa'} shape={{ length: cohort.stage === 'larva' ? antLength.larva * Math.cbrt(cohort.material / cohort.count / 0.04) : antLength.pupa, base: -0.055 }} fallback={null} unavailable={antModelUnavailable} onBounds={i === 0 ? measure : undefined} />}
    </group>)}
    {selected && <group ref={halo}><Billboard><mesh><ringGeometry args={[0.049, 0.052, 32]} /><meshBasicMaterial color="#e8c783" side={DoubleSide} depthTest={false} transparent opacity={0.8} /></mesh></Billboard></group>}
    <group ref={hit}><mesh geometry={targetGeometry}><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh></group>
  </group>
}

function AntModel({ colony, ant, speed, selected, feeding, onPick, field, center }: { colony: Colony; ant: Ant; speed: number; selected: boolean; feeding: boolean; onPick: (ray: Ray) => void; field: ReturnType<typeof prepareField>; center: Vector3 }) {
  const root = useRef<Group>(null), hit = useRef<Group>(null), moving = useRef(false)
  const body = useRef<Group>(null), marker = useRef<Group>(null), envelope = useRef<Box3 | null>(null)
  const localCenter = useRef(new Vector3())
  const lastPose = useRef('')
  const measure = useCallback((bounds: Box3) => { envelope.current = bounds.clone().expandByScalar(0.012); bounds.getCenter(localCenter.current); lastPose.current = '' }, [])
  const bornScale = ant.caste === 'worker' ? Math.cbrt(ant.body / 0.04) : 1
  const initial = useRef(antPosition(colony, ant)), previous = useRef(new Vector3(initial.current.x, initial.current.y, initial.current.z))
  const target = antPosition(colony, ant)
  const frame = useMemo(() => nestFrame(colony), [colony.nodes])
  const orientation = (forward: Vector3) => {
    forward.normalize()
    const up = Math.abs(forward.y) < 0.92 ? new Vector3(0, 1, 0) : frame.normal.clone()
    const right = up.clone().cross(forward).normalize()
    if (right.lengthSq() < 0.001) return new Quaternion()
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, forward.clone().cross(right), forward))
  }
  const initialRotation = useRef<Quaternion | null>(null)
  if (!initialRotation.current) {
    const location = ant.location
    if (location.kind === 'surface') initialRotation.current = orientation(new Vector3(Math.sin(location.heading), 0, Math.cos(location.heading)))
    else {
      const nextId = location.from !== location.to ? location.to : colony.edges.find(([a, b]) => a === location.from || b === location.from)?.find((id) => id !== location.from)
      const next = colony.nodes.find((node) => node.id === nextId)
      initialRotation.current = orientation(next ? new Vector3(next.x - target.x, next.y - target.y, next.z - target.z) : frame.right.clone())
    }
  }
  const { camera, size } = useThree()
  useFrame((_, delta) => {
    if (!root.current) return
    {
      const before = previous.current.copy(root.current.position)
      // Settling to a changed fixed-step state also works with paused +1h.
      // Imported clip clocks still freeze at speed0, as with existing fauna.
      root.current.position.lerp(new Vector3(target.x, target.y, target.z), 1 - Math.exp(-delta * 14 * Math.max(1, speed)))
      const dx = root.current.position.x - before.x, dz = root.current.position.z - before.z
      moving.current = speed > 0 && Math.hypot(dx, dz, root.current.position.y - before.y) > 0.00003
      const direction = root.current.position.clone().sub(before)
      if (direction.lengthSq() > 1e-10) root.current.quaternion.slerp(orientation(direction), 1 - Math.exp(-delta * 12))
    }
    if (body.current && envelope.current) {
      const pose = ant.location.kind + [...root.current.position.toArray(), ...root.current.quaternion.toArray(), bornScale].map(n => n.toFixed(5)).join('/')
      if (pose !== lastPose.current) {
        body.current.position.copy(ant.location.kind === 'surface' ? new Vector3() : antSupportTranslation(field, root.current.position, root.current.quaternion, envelope.current, bornScale, colony))
        lastPose.current = pose
      }
      const local = localCenter.current.clone().multiplyScalar(bornScale)
      local.add(body.current.position)
      center.copy(local).applyQuaternion(root.current.quaternion).add(root.current.position)
      hit.current?.position.copy(local)
      if (marker.current) marker.current.position.copy(body.current.position)
    } else center.copy(root.current.position)
    if (hit.current) hit.current.scale.setScalar(worldPickRadius(camera.position.distanceTo(center), camera instanceof PerspectiveCamera ? camera.fov : 38, size.height))
  }, -0.75)
  useEffect(() => { lastPose.current = '' }, [field])
  return <group ref={root} position={[initial.current.x, initial.current.y, initial.current.z]} quaternion={initialRotation.current} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onPick(event.ray) }}>
    <group ref={body}><group scale={bornScale}>
      <OrganismAsset file={ant.caste === 'queen' ? 'ant-queen' : 'ant-worker'} shape={{ length: antLength[ant.caste], base: 0 }} fallback={null} unavailable={antModelUnavailable} moving={moving} feeding={feeding} speed={speed} juvenile={ant.stage === 'teneral'} onBounds={measure} />
      {ant.carried > 0 && <mesh position={[0, 0.017, antLength[ant.caste] * 0.42]} scale={[0.008, 0.006, 0.012]}><sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#c9a16a" roughness={1} /></mesh>}
    </group></group>
    <group ref={marker}>{selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}><ringGeometry args={[0.069, 0.074, 32]} /><meshBasicMaterial color="#e8c783" side={DoubleSide} depthTest={false} transparent opacity={0.8} /></mesh>}</group>
    <group ref={hit}><mesh geometry={targetGeometry} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onPick(event.ray) }}><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh></group>
  </group>
}

export function AntColonyScene({ colony, underground, speed, events, selected, chamber, revision, remains, selectedRemains, selectedBrood, onSelectBrood, onSelect, onColony, onChamber, onRemains, antCenters, broodCenters }: { broodCenters: Map<number, Vector3>; antCenters: Map<number, Vector3>; colony: Colony; underground: boolean; speed: number; events: SimulationEvent[]; selected: number | null; chamber: number | null; revision: number; remains: Remains[]; selectedRemains: number | null; selectedBrood: number | null; onSelectBrood: (id: number) => void; onSelect: (id: number) => void; onColony: () => void; onChamber: (id: number) => void; onRemains: (id: number) => void }) {
  const { camera, size, gl } = useThree()
  const field = useMemo(() => prepareField(colony), [colony.nodes, colony.edges, colony.construction])
  for (const id of broodCenters.keys()) if (!colony.brood.some((cohort) => cohort.id === id)) broodCenters.delete(id)
  for (const cohort of colony.brood) if (!broodCenters.has(cohort.id)) broodCenters.set(cohort.id, new Vector3())
  const actors = [colony.queen, ...colony.workers].filter((ant): ant is Ant => !!ant && (underground ? ant.location.kind === 'nest' : ant.location.kind === 'surface'))
  for (const id of antCenters.keys()) if (!actors.some(ant => ant.id === id)) antCenters.delete(id)
  for (const ant of actors) if (!antCenters.has(ant.id)) { const p = antPosition(colony, ant); antCenters.set(ant.id, new Vector3(p.x, p.y, p.z)) }
  function pick(ray: Ray, fallback?: PickedLife) {
    const pointer = ray.at(1, new Vector3()).project(camera)
    let chosen = fallback, nearest = animalTargetPixels / 2
    for (const ant of actors) {
      const point = antCenters.get(ant.id)!.clone().project(camera)
      if (point.z < -1 || point.z > 1) continue
      const distance = Math.hypot((point.x - pointer.x) * size.width / 2, (point.y - pointer.y) * size.height / 2)
      if (distance < nearest) { nearest = distance; chosen = { kind: 'ant', id: ant.id } }
    }
    for (const item of antRemainsInView(remains, colony, underground, selectedRemains)) {
      const point = new Vector3(item.x, item.ant!.y + (underground ? -0.045 : 0.01), item.z).project(camera)
      if (point.z < -1 || point.z > 1) continue
      const distance = Math.hypot((point.x - pointer.x) * size.width / 2, (point.y - pointer.y) * size.height / 2)
      if (distance < nearest) { nearest = distance; chosen = { kind: 'remains', id: item.id } }
    }
    if (underground) colony.brood.forEach((cohort) => {
      const point = broodCenters.get(cohort.id)!.clone().project(camera)
      if (point.z < -1 || point.z > 1) return
      const distance = Math.hypot((point.x - pointer.x) * size.width / 2, (point.y - pointer.y) * size.height / 2)
      if (distance < nearest) { nearest = distance; chosen = { kind: 'brood', id: cohort.id } }
    })
    if (chosen?.kind === 'remains') onRemains(chosen.id)
    else if (chosen?.kind === 'brood') onSelectBrood(chosen.id)
    else if (chosen) onSelect(chosen.id)
    return !!chosen
  }
  const geometry = useNestGeometry(colony, underground)
  useEffect(() => {
    gl.domElement.dataset.nestMeshing = geometry?.userData.nestMeshing ?? ''
    return () => { delete gl.domElement.dataset.nestMeshing }
  }, [geometry, gl])
  const frame = useMemo(() => nestFrame(colony), [colony.nodes])
  const broodRotation = useMemo(() => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(frame.normal.clone().cross(frame.right), frame.normal, frame.right)), [frame])
  const food = colony.nodes.find((node) => node.role === 'food')!
  const grainCount = Math.min(12, Math.ceil(colony.food * 20))
  const grains = useMemo(() => Array.from({ length: grainCount }, (_, i) => {
    const p = new Vector3(food.x + Math.sin(i * 2.4) * 0.035, food.y - 0.035 + Math.floor(i / 4) * 0.009, food.z + Math.cos(i * 2.4) * 0.035)
    p.y += nestContentOffset(field, p, grainBounds, new Quaternion())
    return p
  }), [field, food.x, food.y, food.z, grainCount])
  return <>
    {underground && <>
      {geometry && <mesh geometry={geometry} receiveShadow onClick={(event) => {
        if (event.delta > 5) return
        event.stopPropagation()
        if (pick(event.ray)) return
        // Back walls sit behind the organisms. A proxy in front of a chamber
        // used to swallow taps on visible legs beyond the minimum28px target.
        const room = colony.nodes.filter((node) => node.role !== 'entrance' && node.role !== 'junction').map((node) => ({ node, distance: event.point.distanceTo(new Vector3(node.x, node.y, node.z)) / chamberRadius(node) })).sort((a, b) => a.distance - b.distance)[0]
        if (room && room.distance < 1.35) onChamber(room.node.id)
        else onColony()
      }}><meshStandardMaterial vertexColors roughness={1} side={BackSide} /></mesh>}
      {colony.nodes.filter((node) => node.role !== 'entrance' && node.role !== 'junction').map((node) => <group key={node.id} position={[node.x, node.y, node.z]}>
        {chamber === node.id && <Billboard><mesh><ringGeometry args={[0.188, 0.192, 48]} /><meshBasicMaterial color="#e8c783" transparent opacity={0.55} depthTest={false} side={DoubleSide} /></mesh></Billboard>}
      </group>)}
      {grains.map((position, i) => <mesh key={i} position={position} scale={[0.012, 0.008, 0.018]}><sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#c9aa74" roughness={1} /></mesh>)}
      {colony.brood.map((cohort, index) => <BroodModel key={`${revision}:${cohort.id}:${cohort.stage}`} {...{ colony, cohort, index, field }} rotation={broodRotation} selected={selectedBrood === cohort.id} center={broodCenters.get(cohort.id)!} onPick={(ray) => pick(ray, { kind: 'brood', id: cohort.id })} />)}
    </>}
    {!underground && <group position={[colony.entrance.x, 0.047, colony.entrance.z]} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onColony() }}>
      {(colony.construction?.removed ?? 0) > 0 && <mesh position={[0, -0.025, 0]} scale={[0.09 + Math.cbrt(colony.construction!.removed) * 0.35, 0.025 + Math.cbrt(colony.construction!.removed) * 0.1, 0.09 + Math.cbrt(colony.construction!.removed) * 0.35]}><sphereGeometry args={[1, 14, 7]} /><meshStandardMaterial color="#a6845c" roughness={1} /></mesh>}
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.037, 0.072, 12]} /><meshStandardMaterial color="#aa8c61" roughness={1} side={DoubleSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}><circleGeometry args={[0.038, 12]} /><meshBasicMaterial color="#302b21" /></mesh>
    </group>}
    {actors.map((ant) => <AntModel key={`${revision}:${ant.id}`} {...{ colony, ant, speed, field }} center={antCenters.get(ant.id)!} selected={selected === ant.id} feeding={events.some((event) => event.type === 'ant' && event.id === ant.id && (event.action === 'feeding' || event.action === 'nursing' || event.action === 'harvest' || event.action === 'excavation' || event.action === 'chamber'))} onPick={(ray) => pick(ray, { kind: 'ant', id: ant.id })} />)}
  </>
}
