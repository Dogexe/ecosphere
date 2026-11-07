import { useLayoutEffect, useMemo, useRef } from 'react'
import { BufferAttribute, Color, ConeGeometry, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three'
import type { BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { cutawayBox } from './NestCutaway'

/*
 * 3D moss cushions (owner, 2026-11-07: "anything bushy should be 3D"). Like real cushion moss
 * (Dicranum, Leucobryum), each cushion is a dense dome of upright shoots, each shoot a short stem
 * topped by a star of narrow leaves. Here every shoot is real geometry (no cards), drawn as one
 * instanced mesh for all cushions: dark olive at the base and between shoots, yellow-green at the
 * lit tips. A dark dome under the shoots fills the gaps so no soil shows through a cushion.
 */

export type Cushion = { x: number; y: number; z: number; radius: number; height: number }

function shootGeometry() {
  const parts: BufferGeometry[] = []
  parts.push(new CylinderGeometry(0.012, 0.016, 0.6, 4, 1, true).translate(0, 0.3, 0))
  // A star of six narrow leaves at the top, tilted out and up, and a smaller ring below.
  for (const [ring, y, tilt, length] of [[5, 0.6, 0.9, 0.32], [4, 0.42, 1.15, 0.26]] as const) {
    for (let k = 0; k < ring; k += 1) {
      const leaf = new ConeGeometry(0.035, length, 3, 1).translate(0, length / 2, 0).rotateZ(-tilt).rotateY(k / ring * Math.PI * 2 + y * 3).translate(0, y, 0)
      parts.push(leaf)
    }
  }
  const geometry = mergeGeometries(parts.map((part) => part.toNonIndexed()))!
  // Colour by height: deep olive at the base, bright yellow-green at the tips.
  const position = geometry.getAttribute('position'), colours = new Float32Array(position.count * 3)
  const base = new Color('#2c3f17'), tip = new Color('#9cba3c'), c = new Color()
  for (let v = 0; v < position.count; v += 1) { c.copy(base).lerp(tip, Math.min(1, Math.max(0, position.getY(v) / 0.85)) ** 1.4); colours.set([c.r, c.g, c.b], v * 3) }
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
  domeMaterial: new MeshStandardMaterial({ color: '#26361a', roughness: 1 }),
}

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

/** All the jar's moss cushions as two draws: the shoots and the dark domes under them. */
export function MossCushions3D({ cushions, shootSize = 0.42 }: { cushions: Cushion[]; shootSize?: number }) {
  const { shoot, dome, material, domeMaterial } = assets()
  const perCushion = (cushion: Cushion) => Math.round(Math.min(140, 30 + cushion.radius * cushion.radius * 240))
  const total = useMemo(() => cushions.reduce((sum, cushion) => sum + perCushion(cushion), 0), [cushions])
  const shoots = useRef<InstancedMesh>(null)
  const domes = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!shoots.current || !domes.current) return
    const dummy = new Object3D(), colour = new Color()
    let n = 0
    cushions.forEach((cushion, index) => {
      // No moss hanging over the nest cutaway's open face.
      if (cutawayBox.active && cushion.x + cushion.radius > cutawayBox.xMin && cushion.x - cushion.radius < cutawayBox.xMax && cushion.z + cushion.radius > cutawayBox.zFace) { dummy.scale.setScalar(0); dummy.updateMatrix(); domes.current!.setMatrixAt(index, dummy.matrix); return }
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
