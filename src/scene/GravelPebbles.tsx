import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cellX, inside, substrateCell, substrateSize, topLayer } from '../sim/substrate'
import type { Substrate } from '../sim/substrate'
import { useFrame } from '@react-three/fiber'
import { Color, Euler, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three'
import type { BufferGeometry } from 'three'

/*
 * Low-poly gravel pebbles (owner's gravel brief, 2026-11-08): the drainage layer was a flat shader
 * pattern, and the pour grains were one icosahedron. Asset-first: the Poly Haven namaqualand stone
 * scans used at the pond are photographic and ~2k triangles each, wrong for soft low-poly and for
 * hundreds of copies, so the existing low-poly pour grain (an icosahedron) is adapted instead into
 * eight irregular pebble shapes: each vertex pushed in or out by a seeded amount, then the whole
 * flattened, stretched or chipped. Flat shaded, one shared material, instance colours, one
 * InstancedMesh per shape (8 draw calls). Visual only: the gravel layer's depth comes from the sim.
 */
export const pebbleShapes = 8
const palette = ['#7c7469', '#655d54', '#938672', '#73624f', '#9d907b', '#45413c', '#86735f', '#58524b'].map((hex) => new Color(hex))

function seeded(seed: number) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }

let shapes: BufferGeometry[] | null = null
/** Eight unit-size pebble geometries (about 1 across), flat shaded. */
export function pebbleGeometries() {
  if (shapes) return shapes
  shapes = Array.from({ length: pebbleShapes }, (_, k) => {
    const rand = seeded(k * 17 + 3)
    const g = new IcosahedronGeometry(0.5, k % 3 === 0 ? 0 : 1).toNonIndexed()
    const p = g.getAttribute('position')
    // Same push for vertices that share a position, so the surface stays closed.
    const pushes = new Map<string, number>()
    const roundness = [0.35, 0.18, 0.12, 0.3, 0.2, 0.15, 0.4, 0.22][k]
    for (let v = 0; v < p.count; v += 1) {
      const key = `${p.getX(v).toFixed(3)},${p.getY(v).toFixed(3)},${p.getZ(v).toFixed(3)}`
      if (!pushes.has(key)) pushes.set(key, 1 + (rand() - 0.5) * roundness * 2)
      const f = pushes.get(key)!
      p.setXYZ(v, p.getX(v) * f, p.getY(v) * f, p.getZ(v) * f)
    }
    // Rounded, flattened, elongated, slightly angular.
    const [sx, sy, sz] = [[1, 0.7, 0.95], [1.35, 0.55, 0.9], [1, 0.85, 1], [1.6, 0.6, 0.8], [1.1, 0.45, 1.05], [0.95, 0.75, 0.85], [1.25, 0.8, 1], [1.45, 0.5, 1.2]][k]
    g.scale(sx, sy, sz)
    // A chipped face on a few: flatten everything past a plane.
    if (k % 4 === 1) for (let v = 0; v < p.count; v += 1) if (p.getX(v) > 0.38) p.setX(v, 0.38 + (p.getX(v) - 0.38) * 0.2)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  })
  return shapes
}

let shared: MeshStandardMaterial | null = null
export function pebbleMaterial() {
  return shared ??= new MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: true })
}

export interface Pebble { position: Vector3; rotation: Quaternion; scale: Vector3; shape: number; colour: Color }

/** A random pebble tint from the restrained palette (warm grey, muted brown, beige, charcoal). */
export function pebbleColour(rand: () => number, out = new Color()) {
  const a = palette[Math.floor(rand() * palette.length)], b = palette[Math.floor(rand() * palette.length)]
  return out.copy(a).lerp(b, rand() * 0.4).multiplyScalar(0.9 + rand() * 0.2)
}

/**
 * The gravel seen through the glass, as packed 3D pebbles along the jar wall. `line(angle)` gives the
 * gravel top (local y) at each angle round the jar; `soil` is the soil colour for the few crumbs
 * that intrude between the top pebbles. Pebbles sit centred on the soil wall so their inner half is
 * hidden (embedded) and flattened against the glass outside. Big stones first, then small fillers
 * in the gaps (rejection against a spatial hash), with an uneven top edge.
 */
export function packGravel(line: (angle: number) => number, wallRadius: number, glassGap: number, soil: Color, seed = 1) {
  const rand = seeded(seed)
  const pebbles: Pebble[] = []
  const circumference = 2 * Math.PI * wallRadius
  const cell = 0.12, grid = new Map<string, { a: number; y: number; r: number }[]>()
  const key = (a: number, y: number) => `${Math.floor(a / cell)},${Math.floor(y / cell)}`
  const free = (a: number, y: number, r: number) => {
    const ia = Math.floor(a / cell), iy = Math.floor(y / cell)
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) for (const o of grid.get(`${(ia + dx)},${iy + dy}`) ?? []) {
      let da = Math.abs(o.a - a); da = Math.min(da, circumference - da)
      if (Math.hypot(da, o.y - y) < (o.r + r) * 0.78) return false     // slight overlaps allowed
    }
    return true
  }
  const add = (a: number, y: number, r: number, colour: Color, flat = 1) => {
    const list = grid.get(key(a, y)); const entry = { a, y, r }; if (list) list.push(entry); else grid.set(key(a, y), [entry])
    const angle = a / wallRadius, centre = wallRadius - r * 0.2
    // Flattened against the glass: the pebble's own z axis points out through the glass, and it is
    // never thicker than the gap to the glass (its inner part is hidden in the soil wall: embedded).
    const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle))
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), outward).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (rand() - 0.5) * 1.1 + (rand() < 0.5 ? Math.PI : 0)))   // long axes lie roughly level, as settled gravel does
    const half = Math.min(r * 0.9, wallRadius + glassGap - centre - 0.012)
    const size = 0.85 + rand() * 0.3
    pebbles.push({ position: new Vector3(outward.x * centre, y, outward.z * centre), rotation, scale: new Vector3(r * 2 * size, r * 2 * flat * size, half * 2), shape: Math.floor(rand() * pebbleShapes), colour })
  }
  // Big stones, then medium, then small fillers.
  for (const [count, rMin, rMax] of [[260, 0.09, 0.15], [520, 0.055, 0.09], [1100, 0.025, 0.05]] as const) {
    for (let n = 0; n < count * 3; n += 1) {
      const a = rand() * circumference, top = line(a / wallRadius)
      if (top < 0.03) continue
      const r = rMin + (rMax - rMin) * rand()
      // Uneven top edge: the highest stones stand a little proud into the soil, others stop short.
      const proud = rand() < 0.25 ? r * 0.45 : -r * 0.35   // a few top stones stand a little into the soil
      const y = r * 0.5 + rand() * Math.max(0, top - r * 0.5 + proud)
      if (!free(a, y, r)) continue
      add(a, y, r, pebbleColour(rand), 0.75 + rand() * 0.35)
      if (pebbles.length > 1800) break
    }
  }
  // Soil intrusion: soil crumbs between the top stones.
  for (let n = 0; n < 500; n += 1) {
    const a = rand() * circumference, top = line(a / wallRadius)
    if (top < 0.05) continue
    const r = 0.025 + 0.035 * rand(), y = top - r * (0.2 + rand() * 1.5)
    if (!free(a, y, r * 0.7)) continue
    add(a, y, r, soil.clone().multiplyScalar(0.38 + rand() * 0.14), 0.6)
  }
  return pebbles
}

/** Draws pebbles with one InstancedMesh per shape. Matrices are written only when `pebbles` changes. */
export function PebbleField({ pebbles, castShadow = false }: { pebbles: Pebble[]; castShadow?: boolean }) {
  const geometries = pebbleGeometries(), material = pebbleMaterial()
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const capacity = useMemo(() => Array.from({ length: pebbleShapes }, (_, k) => Math.max(16, Math.ceil(pebbles.filter((p) => p.shape === k).length * 1.2 / 64) * 64)), [pebbles])
  const dummy = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    const counts = new Array(pebbleShapes).fill(0)
    for (const p of pebbles) {
      const mesh = meshes.current[p.shape]; if (!mesh) continue
      const n = counts[p.shape]++
      if (n >= mesh.instanceMatrix.count) continue
      dummy.position.copy(p.position); dummy.quaternion.copy(p.rotation); dummy.scale.copy(p.scale); dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix); mesh.setColorAt(n, p.colour)
    }
    meshes.current.forEach((mesh, k) => { if (!mesh) return; mesh.count = Math.min(counts[k], mesh.instanceMatrix.count); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere() })
  }, [pebbles, capacity, dummy])
  return <>{geometries.map((geometry, k) => <instancedMesh key={`${k}:${capacity[k]}`} ref={(mesh) => { meshes.current[k] = mesh }} args={[geometry, material, capacity[k]]} castShadow={castShadow} receiveShadow raycast={() => undefined} />)}</>
}

/**
 * Gravel pebbles for a layered substrate (game and jar builder): the packed layer against the glass,
 * from the wall's gravel line (written by updateLayered), and loose pebbles lying on top wherever
 * gravel is the top layer (while pouring). Repacked only when the gravel changes, at most about three
 * times a second, never per frame otherwise.
 */
export function SubstrateGravel({ state, line, wallRadius, glassGap, soil, makeGround }: { state: Substrate; line: Float32Array; wallRadius: number; glassGap: number; soil: Color; makeGround: () => (x: number, z: number) => number }) {
  const signature = useRef(''), last = useRef(-1)
  const [pebbles, setPebbles] = useState<Pebble[]>([])
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.33) return
    last.current = clock.elapsedTime
    let sum = 0, exposed = 0
    for (let k = 0; k < line.length; k += 1) sum += line[k]
    for (let k = 0; k < state.gravel.length; k += 1) if (inside[k] && topLayer(state, k) === 'gravel') exposed += state.gravel[k]
    const next = `${sum.toFixed(2)}|${exposed.toFixed(2)}`
    if (next === signature.current) return
    signature.current = next
    const n = line.length
    const at = (angle: number) => { const f = (((angle / (2 * Math.PI)) % 1) + 1) % 1 * n, i = Math.floor(f) % n, t = f - Math.floor(f); return line[i] * (1 - t) + line[(i + 1) % n] * t }
    const packed = packGravel(at, wallRadius, glassGap, soil, 7)
    // Loose pebbles on exposed gravel (a few per cell), lying flat-ish on the smoothed top.
    const rand = seeded(91), ground = makeGround()   // the substrate may have changed in place (pouring)
    for (let k = 0; k < state.gravel.length && packed.length < 6500; k += 1) {
      if (!inside[k] || topLayer(state, k) !== 'gravel') continue
      const i = k % substrateSize, j = Math.floor(k / substrateSize)
      for (let m = 0; m < 3; m += 1) {
        const x = cellX(i) + (rand() - 0.5) * substrateCell, z = cellX(j) + (rand() - 0.5) * substrateCell
        if (Math.hypot(x, z) > wallRadius - 0.12) continue
        const r = 0.055 + 0.07 * rand() * rand()
        packed.push({ position: new Vector3(x, ground(x, z) - r * 0.25, z), rotation: new Quaternion().setFromEuler(new Euler((rand() - 0.5) * 0.6, rand() * 6.283, (rand() - 0.5) * 0.6)), scale: new Vector3(r * 2, r * 1.3, r * 2).multiplyScalar(0.85 + rand() * 0.3), shape: Math.floor(rand() * pebbleShapes), colour: pebbleColour(rand) })
      }
    }
    setPebbles(packed)
  })
  return <PebbleField pebbles={pebbles} />
}
