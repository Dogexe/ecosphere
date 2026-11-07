import { useLayoutEffect, useMemo, useRef } from 'react'
import { BufferAttribute, Color, InstancedMesh, MeshStandardMaterial, Object3D, IcosahedronGeometry, SphereGeometry } from 'three'
import type { BufferGeometry } from 'three'

/*
 * 3D moss cushions (owner, 2026-11-07: "anything bushy should be 3D"). Like real cushion moss
 * (Dicranum, Leucobryum), each cushion is a dense dome of upright shoots, each shoot a short stem
 * topped by a star of narrow leaves. Here every shoot is real geometry (no cards), drawn as one
 * instanced mesh for all cushions: dark olive at the base and between shoots, yellow-green at the
 * lit tips. A dark dome under the shoots fills the gaps so no soil shows through a cushion.
 */

export type Cushion = { x: number; y: number; z: number; radius: number; height: number }

/**
 * One moss puff: a soft rounded lump (owner's reference, 2026-11-07, and Codex: "rounded, overlapping
 * masses, restrained detail"). Many overlapping puffs make a cushion with a bumpy, clean silhouette.
 * Darker underneath, lighter yellow-green on top, so the toon light reads as soft bands.
 */
function shootGeometry() {
  const geometry = new IcosahedronGeometry(0.5, 2).translate(0, 0.35, 0)
  const position = geometry.getAttribute('position'), colours = new Float32Array(position.count * 3)
  const base = new Color('#4d7322'), tip = new Color('#9cc244'), c = new Color()
  for (let v = 0; v < position.count; v += 1) {
    // A little lumpiness so neighbouring puffs never look identical.
    const x = position.getX(v), y = position.getY(v), z = position.getZ(v), bump = 1 + 0.08 * Math.sin(x * 9 + z * 7) * Math.sin(y * 8)
    position.setXYZ(v, x * bump, 0.35 + (y - 0.35) * bump, z * bump)
    c.copy(base).lerp(tip, Math.min(1, Math.max(0, (y - 0.05) / 0.75))); colours.set([c.r, c.g, c.b], v * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.deleteAttribute('uv')
  geometry.computeVertexNormals()
  return geometry
}

let shared: { shoot: BufferGeometry; dome: BufferGeometry; material: MeshStandardMaterial; domeMaterial: MeshStandardMaterial } | null = null
const assets = () => shared ??= {
  shoot: shootGeometry(),
  dome: new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  material: new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  domeMaterial: new MeshStandardMaterial({ color: '#4a6b22', roughness: 1 }),
}

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

/** All the jar's moss cushions as two draws: the shoots and the dark domes under them. */
export function MossCushions3D({ cushions, shootSize = 0.27 }: { cushions: Cushion[]; shootSize?: number }) {
  const { shoot, dome, material, domeMaterial } = assets()
  const perCushion = (cushion: Cushion) => Math.round(Math.min(140, 30 + cushion.radius * cushion.radius * 220))
  const total = useMemo(() => cushions.reduce((sum, cushion) => sum + perCushion(cushion), 0), [cushions])
  const shoots = useRef<InstancedMesh>(null)
  const domes = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!shoots.current || !domes.current) return
    const dummy = new Object3D(), colour = new Color()
    let n = 0
    cushions.forEach((cushion, index) => {
      dummy.position.set(cushion.x, cushion.y - 0.02, cushion.z); dummy.rotation.set(0, 0, 0)
      dummy.scale.set(cushion.radius * 0.92, cushion.height * 0.85, cushion.radius * 0.92); dummy.updateMatrix()
      domes.current!.setMatrixAt(index, dummy.matrix)
      const count = perCushion(cushion)
      for (let k = 0; k < count; k += 1) {
        const seed = index * 1000 + k, angle = hash(seed) * Math.PI * 2, reach = Math.sqrt(hash(seed + 1))
        const r = reach * cushion.radius, rise = Math.sqrt(Math.max(0, 1 - reach * reach))
        // Shoots stand on the dome and lean outward with it, so the cushion keeps a rounded outline.
        dummy.position.set(cushion.x + Math.cos(angle) * r, cushion.y + rise * cushion.height * 0.8 - 0.03, cushion.z + Math.sin(angle) * r)
        dummy.rotation.set(Math.sin(angle) * reach * 0.9, hash(seed + 2) * Math.PI * 2, -Math.cos(angle) * reach * 0.9)
        const size = shootSize * (0.75 + hash(seed + 3) * 0.5) * (1 - reach * 0.3)
        dummy.scale.setScalar(size); dummy.updateMatrix()
        shoots.current!.setMatrixAt(n, dummy.matrix)
        const light = 0.8 + hash(seed + 4) * 0.35
        colour.setRGB(light, light, light * 0.95)
        shoots.current!.setColorAt(n, colour)
        n += 1
      }
    })
    shoots.current.count = n
    shoots.current.instanceMatrix.needsUpdate = true
    if (shoots.current.instanceColor) shoots.current.instanceColor.needsUpdate = true
    domes.current.count = cushions.length
    domes.current.instanceMatrix.needsUpdate = true
  }, [cushions, shootSize])
  return <>
    <instancedMesh ref={domes} args={[dome, domeMaterial, Math.max(1, cushions.length)]} receiveShadow raycast={() => undefined} />
    <instancedMesh ref={shoots} args={[shoot, material, Math.max(1, total)]} receiveShadow raycast={() => undefined} frustumCulled={false} />
  </>
}
