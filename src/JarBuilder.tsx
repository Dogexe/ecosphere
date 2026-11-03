import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Color, DoubleSide, InstancedMesh, MOUSE, Object3D, TOUCH, Vector3 } from 'three'
import { deposit, emptySubstrate, heightAt, jarRadius, layerDepths, puddles, saveSubstrate, settle } from './sim/substrate'
import type { DecorKind, Pourable, SavedSubstrate, Substrate } from './sim/substrate'
import { pondCenter } from './sim/pond'
import { layerColours, updateLayered, useLayerMaterials, useLayeredGeometry } from './scene/LayeredGround'
import { DecorPiece } from './scene/JarSetting'

/*
 * Building the jar: the first thing a new world asks for. Pour gravel,
 * charcoal and soil by holding on the jar, place stones and wood, then water
 * it so the fresh soil settles. Planting, animals and sealing follow in the
 * game itself. Physics lives in sim/substrate.ts; this file is the view and
 * the falling grains.
 *
 * Depth guide: UVM Extension terrarium guide, 1-2 in (25-50 mm) of gravel,
 * a thin layer of charcoal, 2-3 in (50-75 mm) of soil
 * (https://www.uvm.edu/news/extension/terrarium-gardening). 1 unit ≈ 19 mm.
 */

const R = jarRadius
const mm = (units: number) => Math.round(units * 19)
type Step = Pourable | 'decor'
const steps: { id: Step; label: string; hint: string; range?: [number, number] }[] = [
  { id: 'gravel', label: 'Gravel', hint: 'Drainage at the bottom. Guides suggest 25–50 mm.', range: [1.3, 2.6] },
  { id: 'charcoal', label: 'Charcoal', hint: 'A thin layer, a few millimetres, keeps the bottom fresh.', range: [0.1, 0.5] },
  { id: 'soil', label: 'Soil', hint: 'Guides suggest 50–75 mm. Fresh soil is loose and slides; damp soil holds a hill.', range: [2.6, 3.9] },
  { id: 'decor', label: 'Stones & wood', hint: 'Tap the soil to set a stone or a piece of wood. Tap one again to take it out.' },
  { id: 'water', label: 'Water', hint: 'Water settles the fresh soil and firms it. Pour fast and it puddles in the hollows before soaking in; once the gravel is full, it floods.' },
]
const grainColour: Record<Pourable, Color> = { gravel: layerColours.gravel, charcoal: layerColours.charcoal, soil: layerColours.soil, water: layerColours.water }
/** Depth (per cell) each grain adds where it lands; tuned so a layer takes about 15 s of pouring (a cell is ~3.7 mm across). */
const perGrain: Record<Pourable, number> = { gravel: 0.6, charcoal: 0.2, soil: 0.6, water: 0.25 }
const MAX_GRAINS = 900
type Grain = { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; material: Pourable }

type SurfaceEvents = { onPointerDown: (event: ThreeEvent<PointerEvent>) => void; onPointerMove: (event: ThreeEvent<PointerEvent>) => void }

/** Keep every layer below the jar's shoulder (the glass is 9.8 units tall). */
const BRIM = 8

function Pouring({ state, material, pouring, aim, onChange, events }: { state: Substrate; material: Pourable | null; pouring: React.MutableRefObject<boolean>; aim: React.MutableRefObject<Vector3>; onChange: () => void; events: SurfaceEvents }) {
  const grains = useMemo<Grain[]>(() => Array.from({ length: MAX_GRAINS }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, material: 'soil' })), [])
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useLayeredGeometry()
  const materials = useLayerMaterials()
  const next = useRef(0)
  const dummy = useMemo(() => new Object3D(), [])
  const changed = useRef(0)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (pouring.current && material && (material === 'water' || heightAt(state, aim.current.x, aim.current.z) < BRIM)) {
      // Spawn by real time (up to a quarter second) so a slow frame rate still pours at the same rate.
      for (let n = 0; n < Math.ceil(220 * Math.min(delta, 0.25)); n += 1) {
        const item = grains[next.current]; next.current = (next.current + 1) % MAX_GRAINS
        // A grain still in the air when its slot is reused lands where it is: nothing poured is lost.
        if (item.alive && Math.hypot(item.x, item.z) < R - 0.1) deposit(state, item.material, item.x, item.z, perGrain[item.material])
        const angle = Math.random() * Math.PI * 2, spread = Math.sqrt(Math.random()) * 0.35
        Object.assign(item, { alive: true, x: aim.current.x + Math.cos(angle) * spread, y: 9, z: aim.current.z + Math.sin(angle) * spread, vx: (Math.random() - 0.5) * 0.3, vy: -6, vz: (Math.random() - 0.5) * 0.3, material })
      }
    }
    let count = 0
    for (const item of grains) {
      if (!item.alive) continue
      item.vy -= 22 * dt
      item.x += item.vx * dt; item.y += item.vy * dt; item.z += item.vz * dt
      if (item.y <= heightAt(state, item.x, item.z)) {
        item.alive = false
        if (Math.hypot(item.x, item.z) < R - 0.1) deposit(state, item.material, item.x, item.z, perGrain[item.material])
        continue
      }
      dummy.position.set(item.x, item.y, item.z)
      const size = item.material === 'gravel' ? 0.08 : item.material === 'water' ? 0.05 : 0.055
      dummy.scale.set(size, item.material === 'water' ? size * 2.2 : size, size)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(count, dummy.matrix)
      mesh.current!.setColorAt(count, grainColour[item.material])
      count += 1
    }
    mesh.current!.count = count
    mesh.current!.instanceMatrix.needsUpdate = true
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true
    settle(state)
    updateLayered(geometry, state)
    // Refresh the depth readout a few times a second, not every frame.
    changed.current += dt
    if (changed.current > 0.25) { changed.current = 0; onChange() }
  })
  return <group>
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_GRAINS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
    <mesh geometry={geometry.surface} material={materials.surface} receiveShadow castShadow {...events} />
    <mesh geometry={geometry.walls} material={materials.walls} />
    <mesh geometry={geometry.puddles} material={materials.puddles} raycast={() => undefined} renderOrder={2} />
  </group>
}

/** Eases the camera round the jar when the turn buttons are pressed. */
function Spin({ turn }: { turn: React.MutableRefObject<number> }) {
  const { camera, controls } = useThree() as unknown as { camera: { position: Vector3 }; controls: { target: Vector3; update: () => void } | null }
  useFrame((_, delta) => {
    if (Math.abs(turn.current) < 1e-4 || !controls) return
    const step = turn.current * Math.min(1, delta * 6)
    turn.current -= step
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new Vector3(0, 1, 0), step)
    camera.position.copy(controls.target).add(offset)
    controls.update()
  })
  return null
}

function Glass() {
  return <group>
    <mesh position={[0, 4.9, 0]} raycast={() => undefined}>
      <cylinderGeometry args={[R + 0.12, R + 0.12, 9.8, 96, 1, true]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0.02} clearcoat={1} side={DoubleSide} depthWrite={false} />
    </mesh>
    <mesh position={[0, 9.8, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => undefined}>
      <torusGeometry args={[R + 0.1, 0.12, 12, 96]} />
      <meshStandardMaterial color="#dfe8e4" roughness={0.2} />
    </mesh>
    <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
      <circleGeometry args={[R + 0.12, 96]} />
      <meshStandardMaterial color="#cfd8d4" roughness={0.3} />
    </mesh>
    <mesh position={[0, -0.56, 1.5]} receiveShadow raycast={() => undefined}>
      <boxGeometry args={[30, 1, 14]} />
      <meshStandardMaterial color="#c99d6e" roughness={0.8} />
    </mesh>
  </group>
}

/** Where the pond will be dug once the game starts: a dashed ring on the soil. */
function PondMarker({ state }: { state: Substrate }) {
  const y = layerDepths(state).gravel + layerDepths(state).charcoal + layerDepths(state).soil + 0.05
  return <mesh position={[pondCenter.x, y, pondCenter.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
    <ringGeometry args={[pondCenter.radius - 0.04, pondCenter.radius, 64]} />
    <meshBasicMaterial color="#6fa6cc" transparent opacity={0.55} depthWrite={false} />
  </mesh>
}

export function JarBuilder({ onFinish, onCancel }: { onFinish: (substrate: SavedSubstrate, wetness: Substrate) => void; onCancel: () => void }) {
  const state = useMemo(emptySubstrate, [])
  const [step, setStep] = useState<Step>('gravel')
  const [decorKind, setDecorKind] = useState<DecorKind>('stone')
  const [, setTick] = useState(0)
  const pouring = useRef(false)
  const aim = useRef(new Vector3())
  const turn = useRef(0)
  const depths = layerDepths(state)
  const pools = puddles(state)
  if (location.search.includes('debug')) (window as unknown as { __jar: unknown }).__jar = { state, pouring, aim, step }
  const current = steps.find((item) => item.id === step)!
  const depthOf = (id: Step) => id === 'gravel' ? depths.gravel : id === 'charcoal' ? depths.charcoal : id === 'soil' ? depths.soil : 0
  const target = (event: ThreeEvent<PointerEvent>) => { aim.current.set(event.point.x, 0, event.point.z) }
  const place = (event: ThreeEvent<PointerEvent>) => {
    const { x, z } = event.point
    if (Math.hypot(x, z) > R - 0.4 || Math.hypot(x - pondCenter.x, z - pondCenter.z) < pondCenter.radius + 0.2) return
    const hit = state.decor.findIndex((item) => Math.hypot(item.x - x, item.z - z) < item.size * 0.5)
    if (hit >= 0) state.decor.splice(hit, 1)
    else if (state.decor.length < 12) state.decor.push({ kind: decorKind, x, z, size: decorKind === 'stone' ? 0.8 + ((state.decor.length * 37) % 7) / 10 : 1.4, turn: (state.decor.length * 2.39) % (Math.PI * 2) })
    setTick((value) => value + 1)
  }
  const ground = (x: number, z: number) => heightAt(state, x, z)
  return <div className="jar-builder">
    <Canvas shadows camera={{ position: [0, 15, 11.5], fov: 38 }} onPointerUp={() => { pouring.current = false }} onPointerLeave={() => { pouring.current = false }}>
      <color attach="background" args={['#efe6d6']} />
      <hemisphereLight args={['#fff5e2', '#6b5440', 0.9]} />
      <directionalLight position={[-6, 14, 8]} intensity={2.2} color="#fff0d8" castShadow />
      <Glass />
      <Suspense fallback={null}>
        <Pouring state={state} material={step === 'decor' ? null : step} pouring={pouring} aim={aim} onChange={() => setTick((value) => value + 1)}
          events={{ onPointerDown: (event) => { event.stopPropagation(); if (step === 'decor') place(event); else { target(event); pouring.current = true } }, onPointerMove: (event) => target(event) }} />
        {state.decor.map((item, index) => <DecorPiece key={`${index}:${item.x}`} item={item} index={index} ground={ground} />)}
      </Suspense>
      {depths.soil > 0.3 && <PondMarker state={state} />}
      {/* One finger or the left button pours; two fingers turn and zoom, the right button turns, the wheel zooms. */}
      <OrbitControls makeDefault target={[0, 2.8, 0]} enablePan={false} minDistance={7} maxDistance={26} maxPolarAngle={1.5} mouseButtons={{ LEFT: undefined as unknown as MOUSE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }} touches={{ ONE: undefined as unknown as TOUCH, TWO: TOUCH.DOLLY_ROTATE }} />
      <Spin turn={turn} />
    </Canvas>
    <div className="builder-turn" aria-label="Turn the jar">
      <button type="button" aria-label="Turn left" onClick={() => { turn.current -= Math.PI / 4 }}>⟲</button>
      <button type="button" aria-label="Turn right" onClick={() => { turn.current += Math.PI / 4 }}>⟳</button>
    </div>
    <section className="builder-card" aria-label="Build your jar">
      <span className="eyebrow">BUILD YOUR JAR</span>
      <div className="builder-steps" role="tablist">
        {steps.map((item, index) => <button key={item.id} role="tab" aria-selected={step === item.id} className={step === item.id ? 'on' : ''} type="button" onClick={() => setStep(item.id)}><i>{index + 1}</i>{item.label}</button>)}
      </div>
      <p>{current.hint}</p>
      {current.range && <div className="builder-depth"><span>{mm(depthOf(step))} mm</span><meter min={0} max={current.range[1] * 1.4} low={current.range[0]} high={current.range[1]} optimum={(current.range[0] + current.range[1]) / 2} value={depthOf(step)} /><small>aim for {mm(current.range[0])}–{mm(current.range[1])} mm</small></div>}
      {step === 'decor' && <div className="builder-kinds"><button type="button" className={decorKind === 'stone' ? 'on' : ''} onClick={() => setDecorKind('stone')}>Stone</button><button type="button" className={decorKind === 'log' ? 'on' : ''} onClick={() => setDecorKind('log')}>Wood</button><small>{state.decor.length}/12 placed</small></div>}
      {step === 'water' && <div className="builder-depth"><span>{Math.round(depths.loose * 100)}% loose</span><small>{pools.cover > 0.01 ? `Standing water over ${Math.round(pools.cover * 100)}% of the floor, ${mm(pools.depth / Math.max(pools.cover, 1e-3))} mm deep on average.` : 'Fresh soil settles over the first two or three waterings.'}</small></div>}
      <small className="builder-how">Hold on the jar to pour. Turn it with the arrows, two fingers or a right-drag.</small>
      <div className="builder-actions">
        <button type="button" className="text-button" onClick={onCancel}>Back</button>
        <button type="button" className="load-experiment" disabled={depths.soil < 0.5} onClick={() => onFinish(saveSubstrate(state), state)}>Plant and fill it <span aria-hidden="true">↗</span></button>
      </div>
    </section>
  </div>
}
