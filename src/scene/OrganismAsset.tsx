import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BufferAttribute, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three'
import type { Box3, BufferGeometry, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from './organismModel'
import type { ModelShape, OrganismFile } from './organismModel'
import { plantDimensions, plantModelScale } from './scale'
import type { PlantKind } from '../sim/ecosystem'
import { hasScanPlant, ScanPlant } from './ScanPlant'
import { DrawnPlant, drawnLook, hasDrawnPlant } from './DrawnPlant'
import { FloatingRosette, HairgrassTuft } from './paperNature'
import { naturalLook, paperLook } from './PaperCritter'
import { MossClump } from './MossTuftAsset'

const models = new Map<OrganismFile, Promise<GLTF | null>>()
export const modelUnavailable = (name: string, retry: () => void) => <Html center><button className="asset-retry" type="button" onClick={(event) => { event.stopPropagation(); retry() }}>{name} model unavailable · Retry</button></Html>
export const antModelUnavailable = (retry: () => void) => modelUnavailable('Ant', retry)
// Faceted low-poly plants (Quaternius clover and fern) read as hard facets under the banded toon light.
// Welding their vertices and averaging normals keeps the low-poly silhouette but shades the form softly,
// as ART_DIRECTION.md's "soft organic low-poly" asks (phase 1 of the target-look plan, 2026-11-22).
const softShaded = new Set<OrganismFile>(['natural-clover', 'natural-fern', 'leaf-grazer'])
/** Plant kinds whose natural-look 3D model has shipped (phase 3). */
const naturalPlantFiles = new Set<PlantKind>(['bloom', 'tree'])
function softenNormals(root: Object3D) {
  root.traverse((node) => {
    if (!(node instanceof Mesh) || node instanceof SkinnedMesh) return
    node.geometry = smoothNormalsByPosition(node.geometry)
    // GLTFLoader turns on flatShading for meshes exported without normals; that would ignore the new ones.
    for (const material of [node.material].flat()) { (material as MeshStandardMaterial).flatShading = false; material.needsUpdate = true }
  })
}
/** Averages face normals over every vertex at the same position, ignoring UV and colour seams (which stop a weld). */
export function smoothNormalsByPosition(source: BufferGeometry) {
  const geometry = source.clone()
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const count = index ? index.count : position.count
  const key = (i: number) => `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`
  const sums = new Map<string, Vector3>()
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), face = new Vector3()
  for (let t = 0; t < count; t += 3) {
    const [i, j, k] = index ? [index.getX(t), index.getX(t + 1), index.getX(t + 2)] : [t, t + 1, t + 2]
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, j); c.fromBufferAttribute(position, k)
    face.subVectors(c, b).cross(a.sub(b)) // area-weighted
    for (const v of [i, j, k]) { const id = key(v); const sum = sums.get(id); if (sum) sum.add(face); else sums.set(id, face.clone()) }
  }
  const normals = new Float32Array(position.count * 3)
  for (let v = 0; v < position.count; v++) {
    const n = (sums.get(key(v)) ?? new Vector3(0, 1, 0)).clone().normalize()
    normals.set([n.x, n.y, n.z], v * 3)
  }
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  return geometry
}
function loadOrganism(file: OrganismFile) {
  let pending = models.get(file)
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 15000)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/organisms/${file}.glb`, { signal: controller.signal })
        if (!response.ok) return null
        const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')
        if (softShaded.has(file)) softenNormals(gltf.scene)
        return gltf
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
    let again = 0
    void loadOrganism(file).then((value) => {
      if (!alive) return
      setSource(value); setFailed(!value)
      // A slow or busy device can miss the fetch timeout; plants then sat on their fallback for good with no
      // Retry label. Try again by itself, a few times, before leaving it to the player's Retry.
      if (!value && attempt < 3) again = window.setTimeout(() => setAttempt((value) => value + 1), 4000 * (attempt + 1))
    })
    return () => { alive = false; window.clearTimeout(again) }
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

export function PlantAsset({ kind, health, flowering, fallback, seed = 0, cover = 1 }: { kind: PlantKind; health: number; flowering: boolean; fallback: ReactNode; seed?: number; cover?: number }) {
  // Natural look: a moss plant is a clump of the modelled 3D moss tufts; its biomass grows the clump, its fit browns it.
  if (naturalLook && kind === 'moss') { const { spread, height } = plantDimensions.moss; return <Suspense fallback={fallback}><MossClump seed={seed} cover={cover} health={health} spread={spread} height={height} /></Suspense> }
  // Natural look: the painted leaves on 3D stems without ink lines for the broadleaf, violets, clover and fern;
  // grass, reeds and lilies use the low-poly models.
  // Natural look: Quaternius's low-poly clover (round pads on stalks, as in the owner's reference).
  // Quaternius CC0 low-poly fern, one style with the clover (2026-11-07).
  if (naturalLook && kind === 'fern') { const { spread, height } = plantDimensions.fern; return <OrganismAsset file="natural-fern" shape={{ spread, height, base: 0 }} health={health} flowering={flowering} fallback={fallback} /> }
  if (naturalLook && kind === 'clover') { const { spread, height } = plantDimensions.clover; return <OrganismAsset file="natural-clover" shape={{ spread, height, base: 0 }} health={health} flowering={flowering} fallback={fallback} /> }
  // Phase 3 of the target-look plan (2026-11-22): real 3D violet and broadleaf replace the painted cards in the
  // natural look; the painted plant stays as the fallback while the model loads or if it is missing.
  if (naturalLook && (kind === 'bloom' || kind === 'tree') && naturalPlantFiles.has(kind)) {
    // Keep each model near its own proportions instead of stretching it into the painted card's box: the violet
    // is a low rosette (Viola odorata: about 10-15 cm tall, wider than tall), the broadleaf a clump taller than wide.
    const { spread, height } = kind === 'bloom'
      ? { spread: plantDimensions.bloom.spread * 1.15, height: plantDimensions.bloom.spread * 1.15 * 0.6 }
      : { spread: plantDimensions.tree.height * 0.92, height: plantDimensions.tree.height * 1.08 }
    const painted = drawnLook && hasDrawnPlant(kind) ? <Suspense fallback={fallback}><DrawnPlant kind={kind} seed={seed} health={health} flowering={flowering} /></Suspense> : fallback
    return <OrganismAsset file={kind === 'bloom' ? 'natural-violet' : 'natural-broadleaf'} shape={{ spread, height, base: 0 }} health={health} flowering={flowering} fallback={painted} />
  }
  if (paperLook && drawnLook && hasDrawnPlant(kind) && (!naturalLook || kind === 'tree' || kind === 'bloom')) return <Suspense fallback={fallback}><DrawnPlant kind={kind} seed={seed} health={health} flowering={flowering} /></Suspense>
  if (paperLook && !naturalLook && hasScanPlant(kind)) return <ScanPlant kind={kind} seed={seed} health={health} fallback={fallback} />
  if (paperLook && kind === 'lily') return <FloatingRosette health={health} seed={seed} />
  if (paperLook && kind === 'reed') return <HairgrassTuft health={health} seed={seed} height={plantDimensions.reed.height} spread={plantDimensions.reed.spread} />
  if (kind !== 'clover' && kind !== 'grass' && kind !== 'bloom' && kind !== 'tree' && kind !== 'lily' && kind !== 'reed') return <>{fallback}</>
  const { spread, height } = plantDimensions[kind]
  // Match the existing floating-pad anchor without changing the fallback/root.
  const base = kind === 'lily' ? 0.025 * plantModelScale('lily')[1] : 0
  return <OrganismAsset file={kind} shape={{ spread, height, base }} health={health} flowering={flowering} fallback={fallback} />
}
