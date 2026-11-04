import { Suspense, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { lighter } from './scanLod'
import type { Material } from 'three'
import type { PlantKind } from '../sim/ecosystem'
import { plantDimensions } from './scale'
import { polyHaven } from './semiReal'

/*
 * Scanned plants for the paper look (2026-11-03). Each plant kind takes one
 * of the small variants in a Poly Haven CC0 scan set and is scaled to the
 * kind's mature size in scale.ts, so it keeps the jar's 19 mm-per-unit scale:
 *
 * - tree: a young Calathea orbifolia (owner's choice). Terrarium shops sell it
 *   as a baby plant; here it matures at about 5 cm, about half the glass height.
 * - clover: Oxalis (Poly Haven "Shrub Sorrel"). Real leaflets are 4-13 mm on
 *   1-7 cm stalks (VicFlora, Oxalis corniculata).
 * - fern: two small clumps of Fern 02, as a young fern about 2 cm high.
 *
 * Health fades the leaves toward the shared dry-leaf tone, like the other plants.
 */

type Scan = { id: string; variants: string[] }
const scans: Partial<Record<PlantKind, Scan>> = {
  tree: { id: 'calathea_orbifolia_01', variants: ['calathea_orbifolia_01_d', 'calathea_orbifolia_01_e'] },
  clover: { id: 'shrub_sorrel_01', variants: ['shrub_sorrel_01_a', 'shrub_sorrel_01_b', 'shrub_sorrel_01_d', 'shrub_sorrel_01_e'] },
  fern: { id: 'fern_02', variants: ['fern_02_a', 'fern_02_d'] },
}

export const hasScanPlant = (kind: PlantKind) => kind in scans
const url = (scan: Scan) => `${polyHaven}${scan.id}/${scan.id}_1k.gltf`

const dry = new Color('#b39a6c')
const tinted = new Map<string, MeshStandardMaterial>()
/** One material per scan and health step, shared by every plant in that state. */
function healthMaterial(source: Material, key: string, health: number) {
  const step = Math.round(Math.max(0, Math.min(1, health)) * 4)
  const name = `${key}:${step}`
  let material = tinted.get(name)
  if (!material) {
    material = (source as MeshStandardMaterial).clone()
    material.color = new Color('#ffffff').lerp(dry, (1 - step / 4) * 0.75)
    material.metalness = 0
    tinted.set(name, material)
  }
  return material
}

function Scanned({ kind, scan, seed, health }: { kind: PlantKind; scan: Scan; seed: number; health: number }) {
  const { nodes } = useGLTF(url(scan))
  const object = useMemo(() => {
    const name = scan.variants[Math.abs(seed) % scan.variants.length]
    const source = nodes[name] as Mesh | undefined
    if (!source) return null
    const mesh = new Mesh(lighter(source.geometry, 0.35), healthMaterial(source.material as Material, scan.id, health))
    mesh.castShadow = true; mesh.receiveShadow = true
    const box = new Box3().setFromBufferAttribute(source.geometry.getAttribute('position') as never)
    const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3())
    const target = plantDimensions[kind]
    // Fit the mature height, but never wider than the kind's spread.
    const scale = Math.min(target.height / size.y, target.spread / Math.max(size.x, size.z))
    mesh.scale.setScalar(scale)
    mesh.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale)
    mesh.raycast = () => undefined
    const turn = new Group()
    turn.rotation.y = (seed * 2.39) % (Math.PI * 2)
    turn.add(mesh)
    return turn
  }, [nodes, scan, seed, health, kind])
  return object ? <primitive object={object} /> : null
}

export function ScanPlant({ kind, seed, health, fallback }: { kind: PlantKind; seed: number; health: number; fallback: ReactNode }) {
  const scan = scans[kind]
  if (!scan) return <>{fallback}</>
  return <Suspense fallback={fallback}><Scanned kind={kind} scan={scan} seed={seed} health={health} /></Suspense>
}
