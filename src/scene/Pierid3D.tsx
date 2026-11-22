import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { DoubleSide, LatheGeometry, MathUtils, Shape, ShapeGeometry, Vector2 } from 'three'
import type { Group } from 'three'
import { groundShape } from './scale'

/*
 * Cabbage white (Pieris rapae) chrysalis and butterfly, owner's pick 2026-11-22. Built from the
 * animal's anatomy like Earthworm3D, as soft low-poly 3D:
 *
 * - Chrysalis: angular, about 18-20 mm, pointed at the head end with a ridge on the back; green or
 *   buff to match where it hangs, held upright by a silk girdle. Through the last day the wings show
 *   through the case (https://en.wikipedia.org/wiki/Pieris_rapae).
 * - Butterfly: white wings with grey-black forewing tips; one black spot on each forewing in the male,
 *   two in the female; undersides yellowish. Wingspan 32-47 mm (same source). Drawn at 32 mm, as the
 *   caterpillar is drawn small (scale.ts), so it still fits the jar.
 * - It rests and sips with wings closed upright over the back, as butterflies do, and flaps fast in flight.
 * Presentation only: the sim keeps its ground position; the flight height is drawn here.
 */

const mmPerUnit = 19
const wingspan = 32 / mmPerUnit
const chrysalisLength = 14 / mmPerUnit

const chrysalisProfile = [
  [0, 0], [0.05, 0.04], [0.12, 0.16], [0.17, 0.34], [0.2, 0.5], [0.16, 0.66], [0.11, 0.8], [0.05, 0.94], [0, 1],
].map(([r, y]) => new Vector2(r, y))
const chrysalisGeometry = new LatheGeometry(chrysalisProfile, 6)

function wingShape(points: number[][]) {
  const shape = new Shape()
  shape.moveTo(points[0][0], points[0][1])
  // A smooth outline through the given points, closed back to the wing base.
  shape.splineThru(points.slice(1).map(([x, y]) => new Vector2(x, y)))
  shape.closePath()
  return new ShapeGeometry(shape, 8)
}
// Right wings in the wing's own plane: x out from the body, y forward. Mirrored for the left side.
const forewing = wingShape([[0, 0.02], [0.18, 0.3], [0.44, 0.34], [0.52, 0.2], [0.5, 0.02], [0.36, -0.06], [0, -0.04]])
const forewingTip = wingShape([[0.3, 0.32], [0.44, 0.345], [0.515, 0.2], [0.5, 0.06], [0.45, 0.2], [0.36, 0.27]])
const hindwing = wingShape([[0, -0.03], [0.26, -0.02], [0.4, -0.12], [0.4, -0.3], [0.22, -0.38], [0.08, -0.3], [0, -0.1]])

export type PieridPhase = 'pupa' | 'butterfly'

export function Pierid3D({ id, x, z, heading, phase, flying, feeding, resting, emerging, speed, children, onClick }: {
  id: number; x: number; z: number; heading: number; phase: PieridPhase
  flying: boolean; feeding: boolean; resting: boolean; emerging: number; speed: number
  children?: ReactNode; onClick: (event: ThreeEvent<MouseEvent>) => void
}) {
  const group = useRef<Group>(null)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const clock = useRef(id * 1.7)
  const female = id % 2 === 0
  const green = id % 3 !== 0
  const caseColor = useMemo(() => {
    const base = green ? [0.55, 0.66, 0.36] : [0.72, 0.64, 0.45]
    // In the last day the white wings show through the case.
    return `rgb(${base.map((value) => Math.round(MathUtils.lerp(value, 0.88, emerging * 0.7) * 255)).join(',')})`
  }, [green, emerging])
  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05) * Math.max(0.25, speed)
    const node = group.current
    if (!node) return
    const t = clock.current
    const ground = 0.05 + groundShape.offset(node.position.x, node.position.z)
    const factor = 1 - Math.exp(-delta * 3)
    node.position.x = MathUtils.lerp(node.position.x, x, factor)
    node.position.z = MathUtils.lerp(node.position.z, z, factor)
    if (phase === 'pupa') {
      node.position.y = ground
      node.rotation.set(0, heading, 0.18)
      return
    }
    // Perched on a flower or leaf when still; up in the jar air, weaving, while flying.
    const height = flying ? 1.05 + Math.sin(t * 1.3 + id) * 0.25 : resting ? 0.32 : 0.42
    node.position.y = MathUtils.lerp(node.position.y, ground + height + (flying ? Math.sin(t * 9) * 0.04 : 0), 1 - Math.exp(-delta * 2.5))
    const turn = Math.atan2(Math.sin(heading - node.rotation.y), Math.cos(heading - node.rotation.y))
    node.rotation.y += turn * factor
    node.rotation.x = flying ? -0.18 : 0
    // Wing angle from flat: closed upright at rest, a slow open-close while sipping, fast beats in flight.
    const open = flying ? 0.55 + Math.sin(t * 26) * 0.95 : resting ? 1.45 : 1.15 + Math.sin(t * 2.2) * 0.3 * (feeding ? 1 : 0.4)
    if (right.current) right.current.rotation.z = open
    if (left.current) left.current.rotation.z = -open
  })
  return (
    <group ref={group} name={`pierid-${phase}`} position={[x, 0.3, z]} rotation={[0, heading, 0]} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onClick(event) }}>
      {children}
      {phase === 'pupa' ? (
        <group rotation={[-0.35, 0, 0]}>
          <mesh geometry={chrysalisGeometry} scale={[chrysalisLength * 0.9, chrysalisLength, chrysalisLength * 0.75]} castShadow>
            <meshStandardMaterial color={caseColor} roughness={0.75} flatShading />
          </mesh>
          {/* Silk girdle and the pad it hangs from. */}
          <mesh position={[0, chrysalisLength * 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[chrysalisLength * 0.19, 0.006, 4, 12]} />
            <meshStandardMaterial color="#f3efe3" roughness={1} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, 0.004, 0]} scale={[0.05, 0.008, 0.05]}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshStandardMaterial color="#efeadb" roughness={1} />
          </mesh>
        </group>
      ) : (
        <group scale={wingspan}>
          {/* Body: head, thorax and a slim abdomen, dusted grey-black. */}
          <mesh position={[0, 0, 0.06]} scale={[0.035, 0.035, 0.11]} castShadow>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#3d3a36" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0, -0.12]} scale={[0.024, 0.024, 0.13]} castShadow>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#4a4640" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.005, 0.18]} scale={0.03}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#2f2c29" roughness={0.6} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.03, 0.07, 0.25]} rotation={[1.0, 0, -side * 0.3]}>
              <cylinderGeometry args={[0.003, 0.003, 0.2, 3]} />
              <meshStandardMaterial color="#2b2926" roughness={0.8} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <group key={side} ref={side > 0 ? right : left} position={[side * 0.02, 0.01, 0.04]} scale={[side, 1, 1]}>
              <group rotation={[Math.PI / 2, 0, 0]}>
                <mesh geometry={forewing} castShadow>
                  <meshStandardMaterial color="#f5f2e6" roughness={0.85} side={DoubleSide} />
                </mesh>
                {/* Markings on both faces: grey-black tip and the spots (one in males, two in females). */}
                {[0.002, -0.002].map((lift) => <group key={lift} position={[0, 0, lift]}>
                  <mesh geometry={forewingTip}>
                    <meshStandardMaterial color="#55534d" roughness={0.9} side={DoubleSide} />
                  </mesh>
                  {(female ? [[0.3, 0.14], [0.27, 0.03]] : [[0.3, 0.12]]).map(([sx, sy], index) => (
                    <mesh key={index} position={[sx, sy, 0]} scale={0.022}>
                      <circleGeometry args={[1, 8]} />
                      <meshStandardMaterial color="#3a3834" roughness={0.9} side={DoubleSide} />
                    </mesh>
                  ))}
                </group>)}
                <mesh geometry={hindwing} position={[0, 0, -0.001]} castShadow>
                  <meshStandardMaterial color="#f0ebcf" roughness={0.85} side={DoubleSide} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}
