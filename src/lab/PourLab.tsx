import { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BufferAttribute, Color, DoubleSide, DynamicDrawUsage, InstancedMesh, Mesh, Object3D, PlaneGeometry, BufferGeometry, Vector3 } from 'three'

/*
 * Pour lab (pour.html): a prototype of building a jar by pouring.
 * Gravel, charcoal and soil fall as a stream of grains, pile up on a height
 * field and slump when the pile is steeper than its angle of repose. Water
 * falls as drops, soaks into the soil (darkening it) and what the soil cannot
 * hold drains down to a water table in the gravel, visible through the glass.
 * Deliberately simple, game-feel physics; nothing here touches the game or saves.
 */

const R = 3.8
const N = 72
const cell = (2 * R) / (N - 1)
type Material = 'gravel' | 'charcoal' | 'soil' | 'water'
const layers = ['gravel', 'charcoal', 'soil'] as const
type Layer = typeof layers[number]
/** Angle of repose as max height step between neighbouring cells (tan of the angle × cell size). */
const repose: Record<Layer, number> = { gravel: Math.tan(0.62) * cell, charcoal: Math.tan(0.7) * cell, soil: Math.tan(0.78) * cell }
const colour: Record<Material, Color> = { gravel: new Color('#b9b2a6'), charcoal: new Color('#2b2a2a'), soil: new Color('#7a5236'), water: new Color('#7fb4d8') }
const wetSoil = new Color('#3f2a1b')
/** Soil holds up to this much water per unit thickness before it drains. */
const holding = 0.35
const porosity = 0.38

const index = (i: number, j: number) => j * N + i
const inside = new Uint8Array(N * N)
for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) inside[index(i, j)] = Math.hypot(-R + i * cell, -R + j * cell) <= R - cell * 0.5 ? 1 : 0

function makeState() {
  const state = { gravel: new Float32Array(N * N), charcoal: new Float32Array(N * N), soil: new Float32Array(N * N), water: new Float32Array(N * N), table: 0 }
  // ?demo=1 starts with layers already poured, to try water and the view through the glass straight away.
  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
      const k = j * N + i
      if (!inside[k]) continue
      const x = -R + i * cell, z = -R + j * cell
      state.gravel[k] = 0.55; state.charcoal[k] = 0.12
      state.soil[k] = 0.8 + Math.max(0, 1 - Math.hypot(x + 1.2, z + 0.8) / 2.2) * 0.9
    }
  }
  return state
}
type State = ReturnType<typeof makeState>
const top = (state: State, k: number) => state.gravel[k] + state.charcoal[k] + state.soil[k]
const topLayer = (state: State, k: number): Layer | null => state.soil[k] > 1e-4 ? 'soil' : state.charcoal[k] > 1e-4 ? 'charcoal' : state.gravel[k] > 1e-4 ? 'gravel' : null

/** Drop `amount` of a material in a small soft disc around (x, z). */
function deposit(state: State, material: Material, x: number, z: number, amount: number) {
  const ci = Math.round((x + R) / cell), cj = Math.round((z + R) / cell)
  const spread = 3
  let weight = 0
  for (let dj = -spread; dj <= spread; dj += 1) for (let di = -spread; di <= spread; di += 1) weight += Math.exp(-(di * di + dj * dj) / 4)
  for (let dj = -spread; dj <= spread; dj += 1) for (let di = -spread; di <= spread; di += 1) {
    const i = ci + di, j = cj + dj
    if (i < 0 || j < 0 || i >= N || j >= N || !inside[index(i, j)]) continue
    const share = amount * Math.exp(-(di * di + dj * dj) / 4) / weight
    const k = index(i, j)
    if (material === 'water') soak(state, k, share)
    else state[material][k] += share
  }
}

/** Water: the soil takes what it can hold; the rest drains to the gravel's water table (or pools on top). */
function soak(state: State, k: number, amount: number) {
  const capacity = state.soil[k] * holding
  const room = Math.max(0, capacity - state.water[k])
  const kept = Math.min(room, amount)
  state.water[k] += kept
  state.table += (amount - kept) * cell * cell / (Math.PI * R * R * porosity)
}

/** One relaxation pass: the top material of any cell steeper than its repose slides to lower neighbours. */
function slump(state: State) {
  let moved = 0
  for (let j = 1; j < N - 1; j += 1) for (let i = 1; i < N - 1; i += 1) {
    const k = index(i, j)
    if (!inside[k]) continue
    const layer = topLayer(state, k)
    if (!layer) continue
    const h = top(state, k)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = index(i + di, j + dj)
      if (!inside[n]) continue
      const drop = h - top(state, n) - repose[layer]
      if (drop <= 0) continue
      const flow = Math.min(drop * 0.45, state[layer][k])
      state[layer][k] -= flow; state[layer][n] += flow
      if (layer === 'soil' && state.soil[k] > 0) {
        // wet soil carries its water with it
        const water = state.water[k] * flow / (state.soil[k] + flow)
        state.water[k] -= water; state.water[n] += water
      }
      moved += flow
    }
  }
  return moved
}

/** Soil moisture spreads slowly sideways. */
function wick(state: State) {
  for (let j = 1; j < N - 1; j += 1) for (let i = 1; i < N - 1; i += 1) {
    const k = index(i, j), n = index(i + 1, j), s = index(i, j + 1)
    for (const m of [n, s]) {
      if (!inside[k] || !inside[m]) continue
      const a = state.soil[k] > 0 ? state.water[k] / (state.soil[k] * holding) : 1, b = state.soil[m] > 0 ? state.water[m] / (state.soil[m] * holding) : 1
      if (state.soil[k] <= 0 || state.soil[m] <= 0) continue
      const flow = (a - b) * 0.02 * Math.min(state.soil[k], state.soil[m]) * holding
      state.water[k] -= flow; state.water[m] += flow
    }
  }
}

const MAX_GRAINS = 1400
type Grain = { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; material: Material }

function Pouring({ material, pouring, aim }: { material: Material; pouring: React.MutableRefObject<boolean>; aim: React.MutableRefObject<Vector3> }) {
  const state = useMemo(makeState, [])
  const grains = useMemo<Grain[]>(() => Array.from({ length: MAX_GRAINS }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, material: 'soil' })), [])
  const grainMesh = useRef<InstancedMesh>(null)
  const surface = useRef<Mesh>(null)
  const walls = useRef<Mesh>(null)
  const pool = useRef<Mesh>(null)
  const tableBand = useRef<Mesh>(null)
  const next = useRef(0)
  const dummy = useMemo(() => new Object3D(), [])
  const tint = useMemo(() => new Color(), [])
  const surfaceGeometry = useMemo(() => {
    const geometry = new PlaneGeometry(2 * R, 2 * R, N - 1, N - 1).rotateX(-Math.PI / 2)
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(N * N * 3), 3))
    return geometry
  }, [])
  // The strata seen through the glass: a ring of quads per layer around the jar wall.
  const ring = 160
  const wallGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    const bands = 4 // gravel, water table, charcoal, soil
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(ring * bands * 6 * 3), 3).setUsage(DynamicDrawUsage))
    return geometry
  }, [])

  const heightAt = (x: number, z: number) => {
    const i = Math.min(N - 1, Math.max(0, Math.round((x + R) / cell))), j = Math.min(N - 1, Math.max(0, Math.round((z + R) / cell)))
    return top(state, index(i, j))
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    // spawn a stream from a spout above the aim point
    if (pouring.current) {
      const rate = material === 'water' ? 70 : 55
      for (let n = 0; n < Math.ceil(rate * dt * 4); n += 1) {
        const grain = grains[next.current]; next.current = (next.current + 1) % MAX_GRAINS
        const angle = Math.random() * Math.PI * 2, spread = Math.random() * 0.12
        Object.assign(grain, { alive: true, x: aim.current.x + Math.cos(angle) * spread, y: 8.5, z: aim.current.z + Math.sin(angle) * spread, vx: (Math.random() - 0.5) * 0.3, vy: -6, vz: (Math.random() - 0.5) * 0.3, material })
      }
    }
    let count = 0
    for (const grain of grains) {
      if (!grain.alive) continue
      grain.vy -= 22 * dt
      grain.x += grain.vx * dt; grain.y += grain.vy * dt; grain.z += grain.vz * dt
      const ground = Math.max(heightAt(grain.x, grain.z), grain.material === 'water' ? 0 : -1)
      if (grain.y <= ground) {
        grain.alive = false
        if (Math.hypot(grain.x, grain.z) < R - 0.1) deposit(state, grain.material, grain.x, grain.z, grain.material === 'water' ? 0.05 : 0.03)
        continue
      }
      dummy.position.set(grain.x, grain.y, grain.z)
      const size = grain.material === 'gravel' ? 0.07 : grain.material === 'water' ? 0.045 : 0.05
      dummy.scale.set(size, grain.material === 'water' ? size * 2.2 : size, size)
      dummy.updateMatrix()
      grainMesh.current!.setMatrixAt(count, dummy.matrix)
      grainMesh.current!.setColorAt(count, colour[grain.material])
      count += 1
    }
    grainMesh.current!.count = count
    grainMesh.current!.instanceMatrix.needsUpdate = true
    if (grainMesh.current!.instanceColor) grainMesh.current!.instanceColor.needsUpdate = true

    for (let pass = 0; pass < 8; pass += 1) if (slump(state) < 1e-5) break
    wick(state)
    // the water table slowly wets the soil from below through the charcoal (capillary rise), very gently
    updateSurface()
    updateWalls()
  })

  function updateSurface() {
    const position = surfaceGeometry.getAttribute('position') as BufferAttribute
    const colours = surfaceGeometry.getAttribute('color') as BufferAttribute
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
      const k = index(i, j)
      // PlaneGeometry rotated: vertex order runs along x then z
      const v = j * N + i
      // cells outside the jar are pulled onto its rim so the surface stays round
      const x = -R + i * cell, z = -R + j * cell, r = Math.hypot(x, z), limit = R - 0.02
      const nearest = inside[k] ? k : index(Math.round((x * Math.min(1, (R - cell) / r) + R) / cell), Math.round((z * Math.min(1, (R - cell) / r) + R) / cell))
      position.setX(v, r > limit ? x * limit / r : x); position.setZ(v, r > limit ? z * limit / r : z)
      const h = top(state, nearest)
      position.setY(v, h + 0.001)
      const layer = topLayer(state, nearest)
      if (!layer) tint.set('#cfd8d4')
      else if (layer === 'soil') tint.copy(colour.soil).lerp(wetSoil, Math.min(1, state.water[nearest] / Math.max(1e-4, state.soil[nearest] * holding)))
      else tint.copy(colour[layer])
      colours.setXYZ(v, tint.r, tint.g, tint.b)
    }
    position.needsUpdate = true; colours.needsUpdate = true
    surfaceGeometry.computeVertexNormals()
    // water that rises above the ground pools as a sheet
    const highest = state.table
    pool.current!.position.y = highest
    // only show pooled water where it rises above the gravel surface somewhere
    pool.current!.visible = highest > 0.08 && state.gravel.some((g, k) => inside[k] && g < highest)
  }

  function updateWalls() {
    const position = wallGeometry.getAttribute('position') as BufferAttribute
    const colours = wallGeometry.getAttribute('color') as BufferAttribute
    let v = 0
    const put = (x: number, y: number, z: number, c: Color) => { position.setXYZ(v, x, y, z); colours.setXYZ(v, c.r, c.g, c.b); v += 1 }
    const edge = (angle: number) => {
      const x = Math.cos(angle) * (R - cell), z = Math.sin(angle) * (R - cell)
      const k = index(Math.round((x + R) / cell), Math.round((z + R) / cell))
      const g = state.gravel[k], c = state.charcoal[k], s = state.soil[k]
      return { x: Math.cos(angle) * R, z: Math.sin(angle) * R, g, c, s, wet: s > 0 ? Math.min(1, state.water[k] / (s * holding)) : 0 }
    }
    const blue = colour.water, soilTone = new Color()
    for (let step = 0; step < ring; step += 1) {
      const a = edge(step / ring * Math.PI * 2), b = edge((step + 1) / ring * Math.PI * 2)
      const band = (y0a: number, y1a: number, y0b: number, y1b: number, ca: Color, cb: Color) => {
        put(a.x, y0a, a.z, ca); put(b.x, y0b, b.z, cb); put(b.x, y1b, b.z, cb)
        put(a.x, y0a, a.z, ca); put(b.x, y1b, b.z, cb); put(a.x, y1a, a.z, ca)
      }
      band(0, a.g, 0, b.g, colour.gravel, colour.gravel)
      const wa = Math.min(state.table, a.g), wb = Math.min(state.table, b.g)
      band(0.002, wa, 0.002, wb, blue, blue)
      band(a.g, a.g + a.c, b.g, b.g + b.c, colour.charcoal, colour.charcoal)
      const sa = soilTone.copy(colour.soil).lerp(wetSoil, a.wet).clone(), sb = new Color().copy(colour.soil).lerp(wetSoil, b.wet)
      band(a.g + a.c, a.g + a.c + a.s, b.g + b.c, b.g + b.c + b.s, sa, sb)
    }
    position.needsUpdate = true; colours.needsUpdate = true
    wallGeometry.computeVertexNormals()
    tableBand.current!.visible = false
  }

  ;(window as unknown as { pourState?: State }).pourState = state
  return <group>
    <instancedMesh ref={grainMesh} args={[undefined, undefined, MAX_GRAINS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
    <mesh ref={surface} geometry={surfaceGeometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
    <mesh ref={walls} geometry={wallGeometry}>
      <meshStandardMaterial vertexColors roughness={0.9} side={DoubleSide} />
    </mesh>
    <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <circleGeometry args={[R - 0.05, 64]} />
      <meshStandardMaterial color="#6fa6cc" transparent opacity={0.45} roughness={0.1} />
    </mesh>
    <mesh ref={tableBand} visible={false}><boxGeometry /></mesh>
    {/* the aim target: a disc the pointer rays hit */}
  </group>
}

function Glass() {
  return <group>
    <mesh position={[0, 4.6, 0]}>
      <cylinderGeometry args={[R + 0.08, R + 0.08, 9.2, 96, 1, true]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.07} roughness={0.02} clearcoat={1} side={DoubleSide} depthWrite={false} />
    </mesh>
    <mesh position={[0, 9.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[R + 0.08, 0.1, 12, 96]} />
      <meshStandardMaterial color="#dfe8e4" roughness={0.2} />
    </mesh>
    <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[R + 0.08, 96]} />
      <meshStandardMaterial color="#cfd8d4" roughness={0.3} />
    </mesh>
    <mesh position={[0, -0.6, 0]} receiveShadow>
      <boxGeometry args={[30, 1, 16]} />
      <meshStandardMaterial color="#c79a6b" roughness={0.8} />
    </mesh>
  </group>
}

const tools: { id: Material; label: string; hint: string }[] = [
  { id: 'gravel', label: 'กรวด', hint: 'ชั้นล่างสุด ช่วยระบายน้ำ' },
  { id: 'charcoal', label: 'ถ่าน', hint: 'ชั้นบางๆ กันกลิ่นอับ' },
  { id: 'soil', label: 'ดิน', hint: 'กดค้างที่เดิมจะเป็นเนิน' },
  { id: 'water', label: 'น้ำ', hint: 'ซึมเข้าดิน ส่วนเกินลงไปขังที่กรวด' },
]

function PourLab() {
  const [material, setMaterial] = useState<Material>('gravel')
  const pouring = useRef(false)
  const aim = useRef(new Vector3())
  const target = (event: ThreeEvent<PointerEvent>) => { aim.current.copy(event.point); aim.current.y = 0 }
  return <>
    <Canvas shadows camera={{ position: [0, 12, 12.5], fov: 40 }} onPointerUp={() => { pouring.current = false }} onPointerLeave={() => { pouring.current = false }}>
      <color attach="background" args={['#efe6d6']} />
      <hemisphereLight args={['#fff5e2', '#6b5440', 0.9]} />
      <directionalLight position={[-6, 14, 8]} intensity={2} color="#fff0d8" castShadow />
      <Glass />
      <Pouring material={material} pouring={pouring} aim={aim} />
      {/* invisible catcher for the pointer: a horizontal disc across the jar mouth */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event) => { event.stopPropagation(); target(event); pouring.current = true }}
        onPointerMove={(event) => target(event)}>
        <circleGeometry args={[R - 0.2, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <OrbitControls makeDefault target={[0, 1.2, 0]} enablePan={false} minDistance={6} maxDistance={24} maxPolarAngle={1.45} mouseButtons={{ LEFT: undefined as unknown as number, MIDDLE: 1, RIGHT: 0 }} touches={{ ONE: undefined as unknown as number, TWO: 2 }} />
    </Canvas>
    <div className="pour-hud">
      <strong>เทลงโหล</strong>
      <div className="pour-tools">{tools.map((tool) => <button key={tool.id} type="button" className={material === tool.id ? 'on' : ''} onClick={() => setMaterial(tool.id)}>{tool.label}</button>)}</div>
      <small>{tools.find((tool) => tool.id === material)!.hint}</small>
      <small className="pour-how">กดค้างบนโหลเพื่อเท · หมุนกล้อง: คลิกขวาลาก / สองนิ้ว</small>
      <button type="button" className="pour-reset" onClick={() => window.location.reload()}>เริ่มใหม่</button>
    </div>
  </>
}

createRoot(document.getElementById('pour')!).render(<PourLab />)
