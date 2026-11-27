import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { lastDisturbance } from './behaviour'
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

/*
 * Butterfly behaviour (2026-11-27, owner: realistic, lively behaviour):
 * - Flight is the jinking, up-and-down flutter of small whites: short legs of flight in changing
 *   directions with brief glides between bursts of wing beats.
 * - Perched in the light it basks with its wings held part-open in a V, which reflects sunlight onto
 *   its body (reflectance basking of pierids, Kingsolver 1987, Evolution 41:472-490); while sipping or resting the wings close
 *   upright, with now and then a quick flick.
 * - A tap close by puts it up into the air for a few seconds.
 */

export function Pierid3D({ id, x, z, heading, phase, flying, feeding, resting, emerging, speed, children, onClick }: {
  id: number; x: number; z: number; heading: number; phase: PieridPhase
  flying: boolean; feeding: boolean; resting: boolean; emerging: number; speed: number
  children?: ReactNode; onClick: (event: ThreeEvent<MouseEvent>) => void
}) {
  const group = useRef<Group>(null)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const clock = useRef(id * 1.7)
  const flight = useRef({ ox: 0, oz: 0, oy: 0, leg: 0, glide: 0, flick: 0, scared: 0, startled: -Infinity })
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
    const f = flight.current
    // A tap nearby flushes a perched butterfly for a few seconds.
    const tap = lastDisturbance(), now = performance.now() / 1000
    if (phase === 'butterfly' && speed > 0 && tap.at !== f.startled && now - tap.at < 0.4 && Math.hypot(tap.x - node.position.x, tap.z - node.position.z) < 1.3) { f.startled = tap.at; f.scared = 2.5 + Math.random() * 2; f.leg = 0 }
    const dt = Math.min(delta, 0.05) * (speed > 0 ? Math.min(speed, 3) : 0)
    f.scared = Math.max(0, f.scared - dt)
    const airborne = flying || f.scared > 0
    // Flight: a new short leg in a new direction every half second or so, with glides between bursts.
    f.leg -= dt; f.glide -= dt; f.flick -= dt
    if (airborne && f.leg <= 0) {
      const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.6
      f.ox = Math.sin(a) * r; f.oz = Math.cos(a) * r; f.oy = (Math.random() - 0.4) * 0.5
      f.leg = 0.35 + Math.random() * 0.8
      if (Math.random() < 0.35) f.glide = 0.2 + Math.random() * 0.3
    }
    if (!airborne) { f.ox *= 0.9; f.oz *= 0.9; f.oy *= 0.9 }
    const factor = 1 - Math.exp(-delta * (airborne ? 4.5 : 3))
    const before = { x: node.position.x, z: node.position.z }
    node.position.x = MathUtils.lerp(node.position.x, x + f.ox, factor)
    node.position.z = MathUtils.lerp(node.position.z, z + f.oz, factor)
    // Keep inside the glass.
    const r = Math.hypot(node.position.x, node.position.z)
    if (r > 3.2) { node.position.x *= 3.2 / r; node.position.z *= 3.2 / r }
    if (phase === 'pupa') {
      node.position.y = ground
      node.rotation.set(0, heading, 0.18)
      return
    }
    // Perched on a flower or leaf when still; up in the jar air, weaving, while flying.
    const height = airborne ? 1.05 + f.oy + Math.sin(t * 1.3 + id) * 0.2 : resting ? 0.32 : 0.42
    node.position.y = MathUtils.lerp(node.position.y, ground + height + (airborne ? Math.sin(t * 9) * 0.05 : 0), 1 - Math.exp(-delta * (airborne ? 4 : 2.5)))
    // Face the way it is flying; perched, face the ecology's heading.
    const mx = node.position.x - before.x, mz = node.position.z - before.z
    const want = airborne && Math.hypot(mx, mz) > 1e-4 ? Math.atan2(mx, mz) : heading
    const turn = Math.atan2(Math.sin(want - node.rotation.y), Math.cos(want - node.rotation.y))
    node.rotation.y += turn * (1 - Math.exp(-delta * (airborne ? 8 : 3)))
    node.rotation.x = airborne ? -0.18 : 0
    // Wing angle from flat (1.45 = closed upright): beats in flight with short glides; basking part-open
    // in a V when perched in daylight; closed while sipping or resting, with an occasional flick.
    if (!airborne && f.flick <= 0 && Math.random() < dt * 0.25) f.flick = 0.25
    const flick = f.flick > 0 ? Math.sin(f.flick / 0.25 * Math.PI) * 0.9 : 0
    const open = airborne ? f.glide > 0 ? 0.35 + Math.sin(t * 3) * 0.05 : 0.55 + Math.sin(t * 26) * 0.95
      : resting ? 1.45 - flick * 0.3 : feeding ? 1.35 - flick + Math.sin(t * 2.2) * 0.1 : 0.85 + Math.sin(t * 0.7 + id) * 0.08 - flick * 0.4
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
