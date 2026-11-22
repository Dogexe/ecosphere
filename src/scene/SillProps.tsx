import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Mesh } from 'three'

/*
 * Natural look windowsill props (phase 6, 2026-11-22): Kenney CC0 potted plant, books and cup, adapted
 * by scripts/adapt_room_props.py (smooth normals, warm palette, origin at base centre). They sit beside
 * the jar so the sill reads as a lived-in room, scaled down from real size so they frame the jar
 * instead of competing with it. Visual only.
 */
const base = `${import.meta.env.BASE_URL}assets/room/`
const props = [
  { file: 'sill-plant.glb', scale: 9, x: -6.6, z: -2, turn: 0.5 },
  { file: 'sill-books.glb', scale: 32, x: 7.4, z: -3, turn: -0.5 },
  { file: 'sill-mug.glb', scale: 7.5, x: 6.3, z: 0.6, turn: 2.6 },
]
for (const prop of props) useGLTF.preload(base + prop.file)

function Prop({ file, scale, x, z, turn, y }: (typeof props)[number] & { y: number }) {
  const { scene } = useGLTF(base + file)
  const object = useMemo(() => {
    const copy = scene.clone()
    copy.traverse((node) => { if ((node as Mesh).isMesh) { node.castShadow = true; node.receiveShadow = true; node.raycast = () => undefined } })
    return copy
  }, [scene])
  return <primitive object={object} position={[x, y, z]} rotation={[0, turn, 0]} scale={scale} />
}

export function SillProps({ y }: { y: number }) {
  return <>{props.map((prop) => <Prop key={prop.file} {...prop} y={y} />)}</>
}
