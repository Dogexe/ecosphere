import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, Object3D } from 'three'
import type { Ground } from './semiReal'

/*
 * Condensation running down the inside of a sealed, fogged jar (2026-11-03).
 *
 * Vapour condenses on the glass as fine beads. A bead stays pinned until it
 * has grown to a few millimetres (water's capillary length is about 2.7 mm),
 * then slides, sweeping up the beads below it and leaving a clear streak, and
 * stops where the glass meets the ground. That is where the sim's
 * condensation returns to the soil and, where the shore reaches the glass, to
 * the pond (closeWaterCycle in sim/seal.ts). Decoration only: the amount of
 * water is the sim's.
 *
 * At about 19 mm per unit a 4 mm bead is 0.2 units; the beads here are drawn a
 * little larger so they read from the default camera.
 */

const count = 90
/** Fine pinned beads that mist the glass, as in concept image 12; more show as the fog thickens. */
const mistCount = 1600
const noRaycast = () => undefined

type Bead = { angle: number; y: number; size: number; wait: number; speed: number; start: number }

/** Random but fixed per slot, so the pattern does not jump between renders. */
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

export function GlassDroplets({ fog, radiusAt, top, ground }: { fog: number; radiusAt: (y: number) => number; top: number; ground: Ground }) {
  const beads = useRef<InstancedMesh>(null)
  const trails = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const state = useMemo<Bead[]>(() => Array.from({ length: count }, (_, n) => ({ angle: hash(n) * Math.PI * 2, y: top - hash(n + 50) * 3, size: 0.025 + hash(n + 90) * 0.03, wait: hash(n + 130) * 14, speed: 0, start: 0 })).map((bead) => ({ ...bead, start: bead.y })), [top])
  // Where each bead's path meets the ground, just inside the glass.
  const floorAt = (angle: number) => { const r = radiusAt(-1) - 0.24; return ground(Math.cos(angle) * r, Math.sin(angle) * r) + 0.04 }
  const mist = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = mist.current
    if (!mesh) return
    for (let n = 0; n < mistCount; n += 1) {
      const angle = hash(n + 7000) * Math.PI * 2
      // Mostly on the upper glass, where the cooler air meets it.
      const ground0 = floorAt(angle), low = ground0 + 0.15 + (top - ground0) * 0.3, y = low + (top - low) * Math.sqrt(hash(n + 9000))
      const r = radiusAt(y) - 0.015
      // Three bead sizes, mostly tiny, flattened against the glass.
      const pick = hash(n + 11000), size = (pick < 0.7 ? 0.014 : pick < 0.92 ? 0.03 : 0.058) * (0.85 + hash(n + 12000) * 0.3)
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r)
      dummy.rotation.set(0, -angle + Math.PI / 2, 0)
      dummy.scale.set(size, size * (1 + hash(n + 13000) * 0.3), size * 0.4)
      dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, radiusAt, ground, dummy])
  useFrame((_, delta) => {
    if (mist.current) mist.current.count = Math.round(mistCount * Math.min(1, Math.max(0, (fog - 0.2) / 0.5)))
    const step = Math.min(delta, 0.1)
    const show = fog > 0.2
    state.forEach((bead, n) => {
      if (!show) { bead.wait = hash(n + 130) * 14; bead.speed = 0; bead.y = bead.start = top - hash(n + 50) * 3 }
      else if (bead.wait > 0) { bead.wait -= step * (0.4 + fog); bead.size = Math.min(0.075, bead.size + step * 0.002 * fog) }
      else {
        // Sliding: speeds up to a steady few cm per second, with a stutter where it catches on smaller beads.
        bead.speed = Math.min(0.35 + bead.size * 4, bead.speed + step * 0.8)
        bead.y -= bead.speed * step * (0.6 + 0.4 * Math.abs(Math.sin(bead.y * 7 + n)))
        if (bead.y <= floorAt(bead.angle)) {
          const slot = n + Math.floor(performance.now() / 997)
          bead.angle = hash(slot) * Math.PI * 2
          bead.y = bead.start = top - 0.2 - hash(slot + 50) * 3
          bead.size = 0.025 + hash(slot + 90) * 0.025
          bead.wait = 3 + hash(slot + 130) * 18
          bead.speed = 0
        }
      }
      const r = radiusAt(bead.y) - 0.02, x = Math.cos(bead.angle) * r, z = Math.sin(bead.angle) * r
      dummy.position.set(x, bead.y, z)
      dummy.rotation.set(0, -bead.angle + Math.PI / 2, 0)
      const s = show ? bead.size : 0
      dummy.scale.set(s, s * (bead.speed > 0 ? 1.35 : 1), s * 0.45)
      dummy.updateMatrix()
      beads.current?.setMatrixAt(n, dummy.matrix)
      const length = show && bead.speed > 0 ? bead.start - bead.y : 0
      dummy.position.set(x, bead.y + length / 2, z)
      dummy.scale.set(s * 0.5, Math.max(1e-4, length), 1)
      dummy.updateMatrix()
      trails.current?.setMatrixAt(n, dummy.matrix)
    })
    if (beads.current) beads.current.instanceMatrix.needsUpdate = true
    if (trails.current) trails.current.instanceMatrix.needsUpdate = true
  })
  return <group>
    <instancedMesh ref={mist} args={[undefined, undefined, mistCount]} raycast={noRaycast} renderOrder={3} frustumCulled={false}>
      <sphereGeometry args={[1, 7, 5]} />
      <meshPhysicalMaterial color="#f4fbff" transparent opacity={0.4} roughness={0.02} clearcoat={1} envMapIntensity={2.4} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={beads} args={[undefined, undefined, count]} raycast={noRaycast} renderOrder={3} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshPhysicalMaterial color="#f4fbff" transparent opacity={0.32} roughness={0.02} clearcoat={1} envMapIntensity={2} depthWrite={false} />
    </instancedMesh>
    {/* The streak a sliding bead wipes clear of fog: a faint darker line. */}
    <instancedMesh ref={trails} args={[undefined, undefined, count]} raycast={noRaycast} renderOrder={3} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#e6f0ed" transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  </group>
}
