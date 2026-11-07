import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, InstancedMesh, MeshBasicMaterial, Object3D, SRGBColorSpace } from 'three'
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

/*
 * A water bead on glass is a tiny lens: mostly clear, with a dark rim where it
 * bends light from the dark room, a bright crescent at the bottom where it
 * focuses the window behind, and a small specular glint at the top (concept
 * image 12). Drawn once to a canvas and shared by every bead.
 */
function beadTexture() {
  const size = 64, canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const c = canvas.getContext('2d')!
  const mid = size / 2, r = size / 2 - 3
  // Clear body with a slight cool tint.
  c.fillStyle = 'rgba(225,238,236,0.10)'; c.beginPath(); c.arc(mid, mid, r, 0, Math.PI * 2); c.fill()
  // Dark rim, heavier at the top.
  const rim = c.createRadialGradient(mid, mid + 3, r * 0.55, mid, mid, r)
  rim.addColorStop(0, 'rgba(20,30,28,0)'); rim.addColorStop(0.8, 'rgba(20,30,28,0.28)'); rim.addColorStop(1, 'rgba(20,30,28,0.55)')
  c.fillStyle = rim; c.beginPath(); c.arc(mid, mid, r, 0, Math.PI * 2); c.fill()
  // Bright focused crescent at the bottom.
  c.save(); c.beginPath(); c.arc(mid, mid, r - 1, 0, Math.PI * 2); c.clip()
  const glow = c.createRadialGradient(mid, mid + r * 0.55, 0, mid, mid + r * 0.55, r * 0.7)
  glow.addColorStop(0, 'rgba(255,252,236,0.85)'); glow.addColorStop(1, 'rgba(255,252,236,0)')
  c.fillStyle = glow; c.fillRect(0, 0, size, size); c.restore()
  // Specular glint, upper left.
  c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.ellipse(mid - r * 0.38, mid - r * 0.42, r * 0.17, r * 0.11, -0.6, 0, Math.PI * 2); c.fill()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
/** The streak a sliding bead wipes clear: two faint edges, brightest just behind the bead, fading uphill. */
function trailTexture() {
  const w = 16, h = 64, canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const c = canvas.getContext('2d')!
  for (let y = 0; y < h; y += 1) {
    const fade = Math.pow(y / h, 1.6)
    c.fillStyle = `rgba(30,40,38,${0.35 * fade})`; c.fillRect(0, y, 2, 1); c.fillRect(w - 2, y, 2, 1)
    c.fillStyle = `rgba(255,255,248,${0.22 * fade})`; c.fillRect(3, y, 2, 1)
    c.fillStyle = `rgba(220,235,232,${0.05 * fade})`; c.fillRect(2, y, w - 4, 1)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
let shared: { bead: MeshBasicMaterial; trail: MeshBasicMaterial } | null = null
const materials = () => shared ??= {
  bead: new MeshBasicMaterial({ map: beadTexture(), transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false }),
  trail: new MeshBasicMaterial({ map: trailTexture(), transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false }),
}

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
      const ground0 = floorAt(angle), low = ground0 + 0.15 + (top - ground0) * 0.5, y = low + (top - low) * Math.pow(hash(n + 9000), 0.35)
      const r = radiusAt(y) - 0.015
      // Three bead sizes, mostly tiny, flattened against the glass.
      const pick = hash(n + 11000), size = (pick < 0.62 ? 0.016 : pick < 0.9 ? 0.034 : 0.066) * (0.85 + hash(n + 12000) * 0.3)
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r)
      dummy.rotation.set(0, -angle + Math.PI / 2, 0)
      dummy.scale.set(size * 2, size * 2 * (1 + hash(n + 13000) * 0.25), 1)
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
      dummy.scale.set(s * 2, s * 2 * (bead.speed > 0 ? 1.3 : 1), 1)
      dummy.updateMatrix()
      beads.current?.setMatrixAt(n, dummy.matrix)
      // The wiped streak only shows for the last centimetre or so; above that the mist closes in again.
      const length = show && bead.speed > 0 ? Math.min(0.28, bead.start - bead.y) : 0
      dummy.position.set(x, bead.y + length / 2, z)
      dummy.scale.set(s * 1.4, Math.max(1e-4, length), 1)
      dummy.updateMatrix()
      trails.current?.setMatrixAt(n, dummy.matrix)
    })
    if (beads.current) beads.current.instanceMatrix.needsUpdate = true
    if (trails.current) trails.current.instanceMatrix.needsUpdate = true
  })
  const { bead, trail } = materials()
  return <group>
    <instancedMesh ref={mist} args={[undefined, undefined, mistCount]} raycast={noRaycast} renderOrder={3} frustumCulled={false} material={bead}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
    <instancedMesh ref={beads} args={[undefined, undefined, count]} raycast={noRaycast} renderOrder={3} frustumCulled={false} material={bead}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
    <instancedMesh ref={trails} args={[undefined, undefined, count]} raycast={noRaycast} renderOrder={3} frustumCulled={false} material={trail}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  </group>
}
