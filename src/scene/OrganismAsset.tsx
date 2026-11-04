import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Box3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from './organismModel'
import type { ModelShape, OrganismFile } from './organismModel'
import { plantDimensions, plantModelScale } from './scale'
import type { PlantKind } from '../sim/ecosystem'
import { hasScanPlant, ScanPlant } from './ScanPlant'
import { DrawnPlant, drawnLook, hasDrawnPlant } from './DrawnPlant'
import { FloatingRosette, HairgrassTuft } from './paperNature'
import { paperLook } from './PaperCritter'

const models = new Map<OrganismFile, Promise<GLTF | null>>()
export const modelUnavailable = (name: string, retry: () => void) => <Html center><button className="asset-retry" type="button" onClick={(event) => { event.stopPropagation(); retry() }}>{name} model unavailable · Retry</button></Html>
export const antModelUnavailable = (retry: () => void) => modelUnavailable('Ant', retry)
function loadOrganism(file: OrganismFile) {
  let pending = models.get(file)
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 6000)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/organisms/${file}.glb`, { signal: controller.signal })
        if (!response.ok) return null
        return await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')
      } catch { return null } finally { window.clearTimeout(timeout) }
    })()
    models.set(file, pending)
    void pending.then((value) => { if (!value && models.get(file) === pending) models.delete(file) })
  }
  return pending
}

export function OrganismAsset({ file, shape, fallback, moving, feeding = false, speed = 0, health = 1, flowering = true, juvenile = false, unavailable, onBounds }: {
  file: OrganismFile; shape: ModelShape; fallback: ReactNode; moving?: RefObject<boolean>
  feeding?: boolean; speed?: number; health?: number; flowering?: boolean; juvenile?: boolean
  unavailable?: (retry: () => void) => ReactNode
  onBounds?: (bounds: Box3) => void
}) {
  const [source, setSource] = useState<GLTF | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const retry = (event: Event) => { if ((event as CustomEvent<string>).detail === file) setAttempt((value) => value + 1) }
    window.addEventListener('ecosphere:model-retry', retry)
    return () => window.removeEventListener('ecosphere:model-retry', retry)
  }, [file])
  useEffect(() => {
    let alive = true
    setSource(null)
    setFailed(false)
    void loadOrganism(file).then((value) => { if (alive) { setSource(value); setFailed(!value) } })
    return () => { alive = false }
  }, [file, attempt])
  // Shape values are fixed per biological role, independent from growth/needs.
  const shapeKey = JSON.stringify(shape)
  const instance = useMemo(() => source ? instantiateOrganism(source, JSON.parse(shapeKey) as ModelShape) : null, [source, shapeKey])
  useLayoutEffect(() => {
    if (!instance) return
    instance.setAppearance(health, flowering, juvenile)
  }, [instance, health, flowering, juvenile])
  useLayoutEffect(() => {
    if (instance && onBounds) onBounds(instance.bounds.clone())
  }, [instance, onBounds])
  useFrame((_, delta) => instance?.animate(feeding ? 'eat' : moving?.current ? 'walk' : 'idle', delta, speed))
  useEffect(() => () => instance?.dispose(), [instance])
  return instance ? <primitive object={instance.root} dispose={null} /> : <>{failed && unavailable ? unavailable(() => window.dispatchEvent(new CustomEvent('ecosphere:model-retry', { detail: file }))) : fallback}</>
}

export function PlantAsset({ kind, health, flowering, fallback, seed = 0 }: { kind: PlantKind; health: number; flowering: boolean; fallback: ReactNode; seed?: number }) {
  if (paperLook && drawnLook && hasDrawnPlant(kind)) return <Suspense fallback={fallback}><DrawnPlant kind={kind} seed={seed} health={health} flowering={flowering} /></Suspense>
  if (paperLook && hasScanPlant(kind)) return <ScanPlant kind={kind} seed={seed} health={health} fallback={fallback} />
  if (paperLook && kind === 'lily') return <FloatingRosette health={health} seed={seed} />
  if (paperLook && kind === 'reed') return <HairgrassTuft health={health} seed={seed} height={plantDimensions.reed.height} spread={plantDimensions.reed.spread} />
  if (kind !== 'clover' && kind !== 'grass' && kind !== 'bloom' && kind !== 'tree' && kind !== 'lily' && kind !== 'reed') return <>{fallback}</>
  const { spread, height } = plantDimensions[kind]
  // Match the existing floating-pad anchor without changing the fallback/root.
  const base = kind === 'lily' ? 0.025 * plantModelScale('lily')[1] : 0
  return <OrganismAsset file={kind} shape={{ spread, height, base }} health={health} flowering={flowering} fallback={fallback} />
}
