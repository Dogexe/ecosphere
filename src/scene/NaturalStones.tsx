import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Color, MeshStandardMaterial, Object3D } from 'three'
import type { BufferGeometry, InstancedMesh, Mesh } from 'three'

/*
 * Soft low-poly stones for the natural look (2026-11-11): Quaternius Stylized Nature MegaKit rocks
 * (CC0) adapted by scripts/adapt_rocks.py into public/assets/organisms/natural-rocks.glb. They replace
 * the Poly Haven photo-scanned dressing stones and pond pebbles, whose photographic textures clashed
 * with the low-poly plants, gravel and soil. Vertex colours from the gravel's palette, one shared
 * material. Visual only: nothing here touches the simulation.
 */
const file = `${import.meta.env.BASE_URL}assets/organisms/natural-rocks.glb`
useGLTF.preload(file)

type Ground = (x: number, z: number) => number
export const rockNodes = ['rock1', 'rock2', 'rock3'] as const
const pebbleNodes = ['pebble1', 'pebble2', 'pebble3', 'pebble4', 'pebble5']

let dry: MeshStandardMaterial | null = null, wet: MeshStandardMaterial | null = null
function stoneMaterial(isWet = false) {
  if (isWet) return wet ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, color: new Color(0.62, 0.66, 0.6) })
  return dry ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })
}

function useStoneGeometry(node: string) {
  const { nodes } = useGLTF(file)
  return (nodes[node] as Mesh).geometry as BufferGeometry
}

/** One stone sitting in the soil: unit footprint scaled to `width`, sunk by `sink` of its width. */
export function NaturalStone({ node, x, z, width, turn, ground, sink = 0.14 }: { node: string; x: number; z: number; width: number; turn: number; ground: Ground; sink?: number }) {
  const geometry = useStoneGeometry(node)
  return <mesh geometry={geometry} material={stoneMaterial()} position={[x, ground(x, z) - sink * width, z]} rotation={[0, turn, 0]} scale={width} castShadow receiveShadow />
}

export interface PebbleSpot { x: number; z: number; size: number; turn: number; wet: boolean; lift: number }

/** Pebbles along the bank and on the pond bed: one instanced mesh per shape and wetness (at most 10 draws). */
export function NaturalPebbles({ spots, ground }: { spots: PebbleSpot[]; ground: Ground }) {
  const { nodes } = useGLTF(file)
  const groups = useMemo(() => {
    const out: { geometry: BufferGeometry; wet: boolean; spots: (PebbleSpot & { tilt: number })[] }[] = []
    pebbleNodes.forEach((node, shape) => [false, true].forEach((isWet) => {
      const mine = spots.map((spot, n) => ({ ...spot, n })).filter((spot) => spot.n % pebbleNodes.length === shape && spot.wet === isWet)
      if (mine.length) out.push({ geometry: (nodes[node] as Mesh).geometry, wet: isWet, spots: mine.map((spot) => ({ ...spot, tilt: ((spot.n * 0.618) % 1 - 0.5) * 0.25 })) })
    }))
    return out
  }, [nodes, spots])
  return <>{groups.map((group, k) => <PebbleSet key={k} {...group} ground={ground} />)}</>
}

function PebbleSet({ geometry, wet: isWet, spots, ground }: { geometry: BufferGeometry; wet: boolean; spots: (PebbleSpot & { tilt: number })[]; ground: Ground }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const holder = new Object3D()
    spots.forEach((spot, k) => {
      holder.position.set(spot.x, ground(spot.x, spot.z) - spot.size * 0.24 + spot.lift, spot.z)
      holder.rotation.set(spot.tilt, spot.turn, spot.tilt * 0.6)
      // Pebbles are flatter than the dressing stones: squash a little in height.
      holder.scale.set(spot.size, spot.size * 0.8, spot.size)
      holder.updateMatrix()
      mesh.setMatrixAt(k, holder.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [spots, ground])
  return <instancedMesh ref={ref} name="pebbles" args={[geometry, stoneMaterial(isWet), spots.length]} castShadow={!isWet} receiveShadow raycast={() => undefined} />
}
