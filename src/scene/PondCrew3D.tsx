import { useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, CatmullRomCurve3, Color, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import type { BufferGeometry, Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * 3D ramshorn snail and cherry shrimp for the pond (owner, 2026-11-07: "make the animals 3D").
 * No CC0/CC-BY model of either species was found (searched CGTrader, Sketchfab listings and
 * general web, 2026-11-07: only paid or unlicensed shrimp, no ramshorn), so they are built here
 * from their real anatomy, at unit length facing +z with the base at y = 0, like the other
 * organism models. The watercolor pass gives them the same drawn finish as everything alive.
 *
 * - Ramshorn snail (Planorbella duryi): a flat planispiral shell, about 3.5 whorls coiled in one
 *   plane and carried upright along the body; a dark red-brown foot and two long thin tentacles
 *   with the eyes at their bases (https://en.wikipedia.org/wiki/Ramshorn_snail).
 * - Cherry shrimp (Neocaridina davidi): carapace with a short rostrum, six abdominal segments
 *   curving down to a tail fan of telson plus two uropods each side, one long pair of antennae,
 *   short antennules, stalked black eyes, five pairs of thin walking legs and small swimmerets
 *   (https://en.wikipedia.org/wiki/Neocaridina_davidi).
 * Visual only: sizes come from scale.ts, the sim is unchanged.
 */

const tube = (points: Vector3[], radius: number, segments = 12, radial = 6) => new TubeGeometry(new CatmullRomCurve3(points), segments, radius, radial, false)
const paint = (geometry: BufferGeometry, colour: Color) => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const count = g.getAttribute('position').count, colours = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) colours.set([colour.r, colour.g, colour.b], i * 3)
  g.setAttribute('color', new BufferAttribute(colours, 3))
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name)
  return g
}

function snailShell() {
  // A planispiral: the tube's radius grows with each turn and the whorls touch, all in the y-z plane.
  const points: Vector3[] = [], radii: number[] = []
  const turns = 3.5, steps = 140, growth = Math.log(4.2) / (turns * Math.PI * 2)
  for (let i = 0; i <= steps; i += 1) {
    const angle = i / steps * turns * Math.PI * 2, r = 0.045 * Math.exp(growth * angle)
    points.push(new Vector3(0, Math.sin(angle) * r, Math.cos(angle) * r))
    radii.push(r * 0.55)
  }
  const curve = new CatmullRomCurve3(points)
  const geometry = new TubeGeometry(curve, steps, 1, 10, false)
  // Scale each ring of the tube to its whorl's thickness, flattened side to side.
  const position = geometry.getAttribute('position'), colours = new Float32Array(position.count * 3)
  const shell = new Color('#a3402a'), band = new Color('#5e2015'), c = new Color()
  for (let ring = 0; ring <= steps; ring += 1) {
    const centre = curve.getPointAt(ring / steps), radius = radii[ring]
    for (let k = 0; k <= 10; k += 1) {
      const v = ring * 11 + k
      const offset = new Vector3(position.getX(v), position.getY(v), position.getZ(v)).sub(centre).multiplyScalar(radius)
      offset.x *= 0.75
      position.setXYZ(v, centre.x + offset.x, centre.y + offset.y, centre.z + offset.z)
      // Growth lines: faint darker bands across the whorl.
      c.copy(shell).lerp(band, 0.35 * Math.max(0, Math.sin(ring * 1.7)) + 0.25 * (1 - ring / steps))
      colours.set([c.r, c.g, c.b], v * 3)
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.deleteAttribute('uv')
  geometry.computeVertexNormals()
  return geometry
}

function snailBody() {
  const foot = new SphereGeometry(1, 16, 10).scale(0.13, 0.06, 0.48).translate(0, 0.06, 0.08)
  const head = new SphereGeometry(1, 12, 8).scale(0.11, 0.08, 0.12).translate(0, 0.1, 0.42)
  const flesh = new Color('#6e2a1e')
  const parts = [paint(foot, flesh), paint(head, flesh)]
  // Two long thin tentacles from the head, eyes at their bases.
  for (const side of [-1, 1]) {
    parts.push(paint(tube([new Vector3(side * 0.05, 0.13, 0.46), new Vector3(side * 0.12, 0.2, 0.6), new Vector3(side * 0.2, 0.22, 0.74)], 0.012, 8, 5), flesh))
    parts.push(paint(new SphereGeometry(0.022, 8, 6).translate(side * 0.07, 0.15, 0.44), new Color('#140d0b')))
  }
  return mergeGeometries(parts)!
}

function shrimpBody() {
  const red = new Color('#c4291f'), deep = new Color('#8e1712'), clear = new Color('#e8806e'), black = new Color('#0e0a0a')
  const parts: BufferGeometry[] = []
  // Carapace and rostrum.
  parts.push(paint(new SphereGeometry(1, 18, 12).scale(0.1, 0.1, 0.2).translate(0, 0.17, 0.22), red))
  parts.push(paint(tube([new Vector3(0, 0.2, 0.38), new Vector3(0, 0.22, 0.48), new Vector3(0, 0.24, 0.55)], 0.012, 6, 5), deep))
  // Six abdominal segments, humped at the third, curving down toward the tail.
  const spine = new CatmullRomCurve3([new Vector3(0, 0.18, 0.06), new Vector3(0, 0.21, -0.06), new Vector3(0, 0.2, -0.18), new Vector3(0, 0.15, -0.3), new Vector3(0, 0.1, -0.4)])
  for (let s = 0; s < 6; s += 1) {
    const t = (s + 0.5) / 6, at = spine.getPointAt(t), size = 0.085 * (1 - t * 0.45)
    parts.push(paint(new SphereGeometry(1, 14, 10).scale(size, size * 1.05, 0.07).translate(at.x, at.y, at.z), s % 2 ? red : deep.clone().lerp(red, 0.5)))
  }
  // Tail fan: telson and two uropods each side, flattened blades.
  const tail = spine.getPointAt(1)
  for (const [angle, length] of [[0, 0.1], [-0.45, 0.09], [0.45, 0.09], [-0.85, 0.08], [0.85, 0.08]] as const) {
    const blade = new SphereGeometry(1, 10, 6).scale(0.03, 0.008, length).translate(0, 0, -length).rotateY(angle)
    parts.push(paint(blade.translate(tail.x, tail.y - 0.01, tail.z), clear))
  }
  // Stalked black eyes, long antennae sweeping back, short antennules.
  for (const side of [-1, 1]) {
    parts.push(paint(new SphereGeometry(0.022, 8, 6).translate(side * 0.06, 0.22, 0.38), black))
    parts.push(paint(tube([new Vector3(side * 0.03, 0.2, 0.4), new Vector3(side * 0.12, 0.27, 0.6), new Vector3(side * 0.22, 0.24, 0.45), new Vector3(side * 0.3, 0.2, 0.05)], 0.005, 16, 4), deep))
    parts.push(paint(tube([new Vector3(side * 0.02, 0.21, 0.41), new Vector3(side * 0.05, 0.25, 0.5), new Vector3(side * 0.08, 0.26, 0.56)], 0.005, 6, 4), deep))
    // Five pairs of thin walking legs under the carapace.
    for (let leg = 0; leg < 5; leg += 1) {
      const z = 0.32 - leg * 0.05
      parts.push(paint(tube([new Vector3(side * 0.05, 0.12, z), new Vector3(side * 0.13, 0.08, z + 0.01), new Vector3(side * 0.16, 0.0, z - 0.01)], 0.007, 6, 4), clear))
    }
    // Small swimmerets under the abdomen.
    for (let s = 0; s < 4; s += 1) {
      const at = spine.getPointAt((s + 0.5) / 6)
      parts.push(paint(new SphereGeometry(1, 6, 4).scale(0.012, 0.035, 0.02).translate(side * 0.04, at.y - 0.09, at.z), clear))
    }
  }
  const body = mergeGeometries(parts)!
  // Centre on the body's length (unit length along z) with the legs' tips at y = 0.
  body.computeBoundingBox()
  const box = body.boundingBox!
  return body.translate(0, -box.min.y, -(box.min.z + box.max.z) / 2)
}

let built: { shell: BufferGeometry; snail: BufferGeometry; shrimp: BufferGeometry; material: MeshStandardMaterial } | null = null
const parts = () => built ??= { shell: snailShell(), snail: snailBody(), shrimp: shrimpBody(), material: new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }) }

/** One pond crew animal in 3D. `moving` drives a small walking bob; `health` dulls the colour. */
export function PondCrew3D({ kind, moving, health }: { kind: 'snail' | 'shrimp'; moving: MutableRefObject<boolean>; health: number }) {
  const { shell, snail, shrimp, material } = parts()
  const tinted = useMemo(() => { const m = material.clone(); m.color.setScalar(0.55 + 0.45 * health); return m }, [material, health])
  const body = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!body.current) return
    const t = clock.elapsedTime
    body.current.position.y = moving.current ? Math.abs(Math.sin(t * (kind === 'shrimp' ? 14 : 3))) * 0.012 : 0
    body.current.rotation.z = kind === 'shrimp' && moving.current ? Math.sin(t * 9) * 0.03 : 0
  })
  return <group ref={body}>
    {kind === 'snail'
      ? <><mesh geometry={snail} material={tinted} castShadow /><mesh geometry={shell} material={tinted} position={[0, 0.42, -0.06]} castShadow /></>
      : <mesh geometry={shrimp} material={tinted} castShadow />}
  </group>
}
