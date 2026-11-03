import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { DoubleSide, Group, PerspectiveCamera, SphereGeometry, Vector3 } from 'three'
import type { Remains } from '../sim/life'
import type { AntColony } from '../sim/colony'
import { nestContains } from '../sim/colony'
import { antModelUnavailable, OrganismAsset } from './OrganismAsset'
import { worldPickRadius } from './picking'
import { groundShape } from './scale'

const target = new SphereGeometry(1, 10, 6)
export function antRemainsInView(remains: Remains[], colony: AntColony | undefined | null, underground: boolean, selected: number | null = null) {
  const visible = remains.filter((item) => item.ant && (underground
    ? item.ant.y < 0 && colony && nestContains(colony, { x: item.x, y: item.ant.y, z: item.z }, 0)
    : item.ant.y >= 0))
  const recent = visible.slice(-24)
  const focused = visible.find((item) => item.id === selected)
  return focused && !recent.includes(focused) ? [...recent, focused] : recent
}

function Carcass({ item, selected, onSelect }: { item: Remains; selected: boolean; onSelect: (id: number) => void }) {
  const hit = useRef<Group>(null), position = useRef(new Vector3())
  const { camera, size } = useThree(), ant = item.ant!
  const ratio = Math.max(0, Math.min(1, item.material / item.initial))
  const normalBody = ant.form === 'queen' ? 0.22 : ant.form === 'egg' ? 0.004 : 0.04
  const scale = Math.cbrt(ant.body / normalBody * ratio)
  const base = ant.y < 0 ? -0.055 : 0
  const y = ant.y + (ant.y >= 0 ? groundShape.offset(item.x, item.z) : 0)
  useFrame(() => {
    if (!hit.current) return
    position.current.set(item.x, y + base + 0.01, item.z)
    hit.current.scale.setScalar(worldPickRadius(camera.position.distanceTo(position.current), camera instanceof PerspectiveCamera ? camera.fov : 38, size.height))
  })
  return <group position={[item.x, y, item.z]} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(item.id) }}>
    <group rotation={[0, item.id * 2.399, 0]}>
      {Array.from({ length: ant.count }, (_, i) => <group key={i} position={[(i - (ant.count - 1) / 2) * 0.025, base, 0]} scale={scale}>
        {ant.form === 'egg' ? <mesh scale={[0.007, 0.008, 0.012]}><sphereGeometry args={[1, 10, 7]} /><meshStandardMaterial color="#b9ae89" roughness={1} /></mesh>
          : <OrganismAsset file={ant.form === 'queen' ? 'ant-queen' : ant.form === 'worker' ? 'ant-worker' : ant.form === 'larva' ? 'ant-larva' : 'ant-pupa'} shape={{ length: ant.form === 'queen' ? 0.2 : ant.form === 'worker' ? 0.115 : ant.form === 'larva' ? 0.065 : 0.08, base: 0, fallen: true }} health={ratio * 0.25} fallback={null} unavailable={antModelUnavailable} />}
      </group>)}
    </group>
    {selected && <Billboard position={[0, base + 0.01, 0]}><mesh><ringGeometry args={[0.065, 0.069, 40]} /><meshBasicMaterial color="#e8c783" transparent opacity={0.8} depthTest={false} side={DoubleSide} /></mesh></Billboard>}
    <group ref={hit} position={[0, base + 0.01, 0]}><mesh geometry={target} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(item.id) }}><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh></group>
  </group>
}

export function AntRemainsScene({ remains, colony, underground, selected, onSelect }: { remains: Remains[]; colony?: AntColony | null; underground: boolean; selected: number | null; onSelect: (id: number) => void }) {
  return <>{antRemainsInView(remains, colony, underground, selected).map((item) => <Carcass key={`${item.id}:${item.ant!.sourceId}:${item.ant!.form}`} item={item} selected={selected === item.id} onSelect={onSelect} />)}</>
}
