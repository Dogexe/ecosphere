import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial } from 'three'
import type { Group, Mesh } from 'three'
import { wallRadius } from './soilRoots'
import { environmentScale, groundShape } from './scale'

/*
 * 3D red earthworm (Eisenia fetida), owner's pick 2026-11-21. No free model with a licence the
 * game can use was found (searched 2026-11-21: CGTrader, TurboSquid and Free3D list only paid or
 * personal-use earthworms), so it is built here from the animal's real anatomy, like PondCrew3D:
 *
 * - A long cylinder of ring segments (about 100 in an adult), pointed at the head (prostomium)
 *   and blunter, slightly flattened at the tail.
 * - Tiger-striped: dark maroon segments with paler buff bands between them, which is how
 *   E. fetida is told from other worms (https://en.wikipedia.org/wiki/Eisenia_fetida).
 * - Adults carry the clitellum, a swollen paler saddle about a quarter to a third of the way
 *   back, where the cocoon forms (https://en.wikipedia.org/wiki/Clitellum).
 * - It moves by peristalsis: waves of contraction run back along the body while the body follows
 *   the path the head has burrowed (https://en.wikipedia.org/wiki/Earthworm#Locomotion).
 *
 * Like a real worm jar, the worm is shown where people see them: in a burrow pressed against the
 * glass. The sim keeps its position in the soil; the drawing moves it straight out to the wall at the
 * same bearing and a few millimetres under the soil surface (presentation only, like the ant nest).
 */

const rings = 64
const sides = 10
const maroon = new Color('#8a3a3a'), buff = new Color('#c9946e'), saddle = new Color('#c97c66'), pale = new Color('#a3726a')

/** Radius along the body (u = 0 head, 1 tail), as a share of the widest point. */
function profile(u: number, adult: boolean) {
  const head = Math.min(1, u / 0.09) ** 0.55
  const tail = Math.min(1, (1 - u) / 0.22) ** 0.6
  const clitellum = adult && u > 0.25 && u < 0.36 ? 1.14 : 1
  return Math.max(0.18, head) * Math.max(0.3, tail) * clitellum
}

type Point = { s: number; y: number }

/**
 * Is this worm at the glass this hour? Worms in a jar show along the glass only some of the time and
 * spend the rest out of sight in the soil (owner 2026-11-21: "why do the worms always sit at the glass").
 * Each worm keeps its own rhythm of about a day and a half, at the glass a little under half of it.
 */
export const wormAtGlass = (id: number, tick: number) => ((tick / 36 + id * 0.618) % 1 + 1) % 1 < 0.45

export function Earthworm3D({ id, x, z, tick, inSoil = false, length, adult, feeding, speed, health, selected, onClick, children }: {
  id: number; x: number; z: number; tick: number; inSoil?: boolean
  length: number; adult: boolean; feeding: boolean; speed: number; health: number; selected: boolean
  onClick: (event: ThreeEvent<MouseEvent>) => void; children?: ReactNode
}) {
  const head = useRef<Group>(null)
  const mesh = useRef<Mesh>(null)
  // Arc length round the wall and height, for a point at the glass at the worm's bearing.
  const target = (): Point => {
    // Underground view: the soil is see-through, so the worm is drawn where it really is, its body in
    // the upright plane through it (s = x, at its z).
    if (inSoil) return { s: x, y: environmentScale.soilSurfaceY - (feeding ? 0.22 : 0.62) }
    const angle = Math.atan2(z, x)
    const wx = Math.cos(angle) * wallRadius, wz = Math.sin(angle) * wallRadius
    const surface = environmentScale.soilSurfaceY + groundShape.offset(wx * 0.97, wz * 0.97)
    // Feeding worms come up under the litter; otherwise they rest deeper, a centimetre or so down.
    return { s: angle * wallRadius, y: surface - (feeding ? 0.22 : 0.62) }
  }
  const state = useRef<{ path: Point[]; t: number; heading: number; away: number; z: number } | null>(null)
  if (!state.current) {
    const start = target()
    // Lay the body out level behind the head at first, as if it had come along its burrow.
    state.current = { path: Array.from({ length: 24 }, (_, i) => ({ s: start.s - i * length / 20, y: start.y + Math.sin(i * 0.5) * 0.04 })), t: 0, heading: 0, away: inSoil || wormAtGlass(id, tick) ? 0 : 1, z }
  }
  const radius = Math.max(0.025, length * 0.045)
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const count = (rings + 1) * sides
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3))
    const colours = new Float32Array(count * 3), c = new Color()
    for (let ring = 0; ring <= rings; ring += 1) {
      const u = ring / rings
      // Every other ring is a pale band between segments; the saddle is one paler orange-pink block.
      c.copy(maroon).lerp(buff, ring % 2 ? 0.32 : 0.04).lerp(pale, u > 0.85 ? (u - 0.85) * 2.5 : 0)
      if (adult && u > 0.25 && u < 0.36) c.copy(saddle)
      for (let k = 0; k < sides; k += 1) colours.set([c.r, c.g, c.b], (ring * sides + k) * 3)
    }
    g.setAttribute('color', new BufferAttribute(colours, 3))
    const index: number[] = []
    for (let ring = 0; ring < rings; ring += 1) for (let k = 0; k < sides; k += 1) {
      const a = ring * sides + k, b = ring * sides + (k + 1) % sides, c2 = a + sides, d = b + sides
      index.push(a, b, c2, b, d, c2)
    }
    g.setIndex(index)
    return g
  }, [adult])
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0 }), [])
  // Seen through the soil in the Underground view: ghosted, so a worm passing the nest never hides it.
  material.transparent = inSoil; material.opacity = inSoil ? 0.42 : 1; material.depthWrite = !inSoil
  material.color.setScalar(0.55 + 0.45 * health)
  material.emissive.set(selected ? '#3a2a20' : '#000000')

  useFrame((_, delta) => {
    const memory = state.current!
    const goal = target()
    const path = memory.path
    const lead = path[0]
    // The head burrows toward the sim's spot at a few millimetres a second of play.
    const gap = Math.hypot(goal.s - lead.s, goal.y - lead.y)
    const moving = speed > 0 && gap > 0.04
    if (moving) {
      // The head turns gradually toward where it is going, so the burrow curves instead of kinking back.
      const pace = Math.max(1, Math.min(speed, 3))
      const want = Math.atan2(goal.y - lead.y, goal.s - lead.s)
      const turn = Math.atan2(Math.sin(want - memory.heading), Math.cos(want - memory.heading))
      memory.heading += Math.max(-1, Math.min(1, turn)) * Math.min(1, delta * 1.6 * pace)
      const step = Math.min(gap, delta * 0.3 * pace)
      const next = { s: lead.s + Math.cos(memory.heading) * step, y: lead.y + Math.sin(memory.heading) * step }
      // Keep to the soil: not out into the air, not down into the gravel.
      const surface = goal.y + (feeding ? 0.22 : 0.62)
      next.y = Math.max(surface - 1.25, Math.min(surface - 0.12, next.y))
      if (Math.hypot(next.s - path[1].s, next.y - path[1].y) > length / 20) path.unshift(next)
      else path[0] = next
      if (path.length > 40) path.length = 40
    }
    // Retreat from the glass into the soil, or come back to it, over a few seconds.
    memory.away += ((inSoil || wormAtGlass(id, tick) ? 0 : 1) - memory.away) * Math.min(1, delta * 0.8)
    memory.z += (z - memory.z) * Math.min(1, delta * 2)
    memory.t += moving ? delta * 6 : delta * 1.2
    const t = memory.t
    // Body points at equal arc steps back along the burrowed path.
    const flat: [number, number][] = []
    let segment = 0, along = 0
    for (let ring = 0; ring <= rings; ring += 1) {
      const want = ring / rings * length
      while (segment < path.length - 2 && along + Math.hypot(path[segment + 1].s - path[segment].s, path[segment + 1].y - path[segment].y) < want) {
        along += Math.hypot(path[segment + 1].s - path[segment].s, path[segment + 1].y - path[segment].y); segment += 1
      }
      const a = path[segment], b = path[Math.min(path.length - 1, segment + 1)]
      const span = Math.max(1e-6, Math.hypot(b.s - a.s, b.y - a.y)), f = Math.min(1, (want - along) / span)
      const s = a.s + (b.s - a.s) * f
      let y = a.y + (b.y - a.y) * f
      // A resting worm's head still probes a little.
      if (ring < 6 && !moving) y += Math.sin(t * 1.3) * 0.012 * (6 - ring) / 6
      flat.push([s, y])
    }
    // A worm's body is soft: smooth the burrow's corners into curves (a few averaging passes).
    for (let pass = 0; pass < 6; pass += 1) for (let i = 1; i < flat.length - 1; i += 1) {
      flat[i] = [(flat[i - 1][0] + flat[i][0] * 2 + flat[i + 1][0]) / 4, (flat[i - 1][1] + flat[i][1] * 2 + flat[i + 1][1]) / 4]
    }
    const r = wallRadius - radius * 0.35 - memory.away * 0.6
    const centre = flat.map(([s, y]): [number, number, number] => inSoil ? [s, y, memory.z] : [Math.cos(s / wallRadius) * r, y, Math.sin(s / wallRadius) * r])
    const position = geometry.getAttribute('position') as BufferAttribute
    const normal = geometry.getAttribute('normal') as BufferAttribute
    for (let ring = 0; ring <= rings; ring += 1) {
      const p = centre[ring], q = centre[Math.min(rings, ring + 1)], o = centre[Math.max(0, ring - 1)]
      let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2]
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl
      // Frame: outward from the jar's axis, and the side direction across it.
      let nx = inSoil ? 0 : p[0], nz = inSoil ? 1 : p[2]; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl
      let bx = ty * nz, by = tz * nx - tx * nz, bz = -ty * nx
      const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl
      const u = ring / rings
      // Peristalsis: a wave of thickening runs back along the body while it moves.
      const wave = moving ? 1 + 0.13 * Math.sin(u * 16 - t) : 1 + 0.03 * Math.sin(u * 9 - t)
      const rr = radius * profile(u, adult) * wave
      for (let k = 0; k < sides; k += 1) {
        const a = k / sides * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a)
        // Slightly flattened toward the tail, as in lumbricids.
        const flat = u > 0.7 ? 1 - (u - 0.7) * 0.6 : 1
        const ox = nx * ca * flat + bx * sa, oy = by * sa, oz = nz * ca * flat + bz * sa
        position.setXYZ(ring * sides + k, p[0] + ox * rr, p[1] + oy * rr, p[2] + oz * rr)
        normal.setXYZ(ring * sides + k, ox, oy, oz)
      }
    }
    position.needsUpdate = true
    normal.needsUpdate = true
    geometry.computeBoundingSphere()
    if (head.current) head.current.position.set(centre[0][0], centre[0][1], centre[0][2])
    if (mesh.current) mesh.current.visible = memory.away < 0.97
  })
  return <>
    <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} castShadow onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onClick(event) }} />
    <group ref={head}>{children}</group>
  </>
}
