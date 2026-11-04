import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { BufferAttribute, Color, DoubleSide, LatheGeometry, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector2 } from 'three'
import type { Texture } from 'three'
import type { PlantKind } from '../sim/ecosystem'
import { plantDimensions } from './scale'

/*
 * Drawn plants (owner, 2026-11-04): Drawquarium's hand-drawn plants, built
 * the EthrA way so they hold up while the camera orbits. No plant is a
 * single card turned to the camera; each GPT painting becomes paper pieces
 * placed in 3D by the plant's real shape:
 *
 * - grass: crossed cards, three copies of the tuft painting a third of a
 *   turn apart, as tufts of thin blades look the same from every side.
 * - moss: the painted cushion wrapped on a dome (its outline revolved), so
 *   it has volume from above.
 * - fallen leaves (litter): flat pieces lying on the soil, gently cupped.
 *
 * Art: owner's picks from paper-gen/plants/ on design-candidates (grass 1,
 * moss 3, fallen-leaf 2), cut out by scripts/paper-plants/.
 * Cards sway a little at the top; health fades them toward a dry tone.
 */

const folder = `${import.meta.env.BASE_URL}assets/paper/plants/`
/** `?drawn=0` keeps the earlier plants, for comparing. */
export const drawnLook = (() => { try { return new URLSearchParams(window.location.search).get('drawn') !== '0' } catch { return true } })()
export const drawnKinds: PlantKind[] = ['grass', 'moss']
export const hasDrawnPlant = (kind: PlantKind) => drawnKinds.includes(kind)

const sway = { value: 0 }
const dry = new Color('#b39a6c')

function prepare(texture: Texture) {
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * A paper material: the painting's own alpha cuts it out, both faces lit as
 * the front (a card has no dark back), and `bend` sways the top of the card.
 */
function paperMaterial(map: Texture, health: number, bend: boolean) {
  const material = new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, roughness: 0.9, metalness: 0 })
  material.color = new Color('#ffffff').lerp(dry, (1 - Math.max(0, Math.min(1, health))) * 0.7)
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')
    if (!bend) return
    shader.uniforms.swayTime = sway
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float swayTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Tips sway a little, each plant on its own phase (from its world position).
        vec4 rootWorld = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float phase = rootWorld.x * 1.7 + rootWorld.z * 2.3;
        float lift = uv.y * uv.y;
        transformed.x += sin(swayTime * 1.1 + phase) * 0.035 * lift;
        transformed.z += sin(swayTime * 0.8 + phase * 1.3) * 0.025 * lift;`)
  }
  material.customProgramCacheKey = () => bend ? 'paper-sway' : 'paper'
  return material
}

/** Card geometry with normals tipped up, so a card is lit like the leaves around it rather than by its facing. */
function card(width: number, height: number) {
  const geometry = new PlaneGeometry(width, height).translate(0, height / 2, 0)
  const normal = geometry.getAttribute('normal') as BufferAttribute
  for (let v = 0; v < normal.count; v += 1) normal.setXYZ(v, 0, 0.8, 0.6)
  return geometry
}

function Tuft({ kind, health, seed }: { kind: PlantKind; health: number; seed: number }) {
  const texture = prepare(useTexture(`${folder}grass-tuft.png`))
  const { height } = plantDimensions[kind]
  const parts = useMemo(() => {
    const image = texture.image as { width: number; height: number }
    const geometry = card(height * image.width / image.height, height)
    return { geometry, material: paperMaterial(texture, health, true) }
  }, [texture, health, height])
  return <group rotation={[0, (seed * 2.39) % Math.PI, 0]}>
    {[0, 1, 2].map((index) => <mesh key={index} geometry={parts.geometry} material={parts.material} rotation={[0, index * Math.PI / 3, 0]} raycast={() => undefined} />)}
  </group>
}

/** The cushion's outline, read from the painting's alpha, as height (0-1) at a distance (0-1) from its middle. */
function outline(image: CanvasImageSource & { width: number; height: number }) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  const top = (x: number) => { for (let y = 0; y < height; y += 1) if (data[(y * width + Math.round(x)) * 4 + 3] > 128) return 1 - y / height; return 0 }
  return (r: number) => (top((0.5 - r * 0.5) * (width - 1)) + top((0.5 + r * 0.5) * (width - 1))) / 2
}

function Cushion({ kind, health, seed }: { kind: PlantKind; health: number; seed: number }) {
  const texture = prepare(useTexture(`${folder}moss-cushion.png`))
  const { spread, height } = plantDimensions[kind]
  const parts = useMemo(() => {
    const profile = outline(texture.image as HTMLImageElement)
    const points: Vector2[] = []
    const steps = 16
    for (let index = 0; index <= steps; index += 1) {
      const r = 1 - index / steps
      points.push(new Vector2(r * spread / 2, Math.max(0.002, profile(Math.min(0.98, r)) * height * (r > 0.97 ? 0 : 1))))
    }
    const geometry = new LatheGeometry(points, 24)
    geometry.computeVertexNormals()
    // The flanks take the painting projected from the side, so the dome matches it in profile. The top,
    // where a side projection would smear, reads the middle of the cushion as if seen from above.
    const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), normal = geometry.getAttribute('normal')
    for (let v = 0; v < position.count; v += 1) {
      const x = position.getX(v), y = position.getY(v), z = position.getZ(v)
      const side = 0.04 + Math.min(1, y / Math.max(0.001, height)) * 0.9
      const above = 0.2 + (z / spread + 0.5) * 0.6
      const t = Math.min(1, Math.max(0, (Math.abs(normal.getY(v)) - 0.45) / 0.4))
      const blend = t * t * (3 - 2 * t)
      uv.setXY(v, 0.5 + x / spread * (0.94 + (0.4 - 0.94) * blend), side + (above - side) * blend)
    }
    const material = paperMaterial(texture, health, false)
    material.alphaTest = 0
    return { geometry, material }
  }, [texture, health, spread, height])
  return <mesh geometry={parts.geometry} material={parts.material} rotation={[0, seed * 1.3, 0]} castShadow receiveShadow raycast={() => undefined} />
}

/** Keeps the shared sway clock running. */
function Clock() {
  useFrame(({ clock }) => { sway.value = clock.elapsedTime })
  return null
}

export function DrawnPlant({ kind, health, seed }: { kind: PlantKind; health: number; seed: number }) {
  return <>
    <Clock />
    {kind === 'moss' ? <Cushion kind={kind} health={health} seed={seed} /> : <Tuft kind={kind} health={health} seed={seed} />}
  </>
}

const leafFiles = [1, 2, 3].map((index) => `${folder}oak-leaf-${index}.png`)
/** Fallen oak leaves for litter: flat paper pieces, a little cupped, lying on the soil. */
export function useFallenLeaves() {
  const textures = useTexture(leafFiles) as Texture[]
  return useMemo(() => textures.map((texture) => {
    prepare(texture)
    const image = texture.image as { width: number; height: number }
    const geometry = new PlaneGeometry(1, image.height / image.width, 6, 4).rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position')
    // Cupped across and curled at the tips, like a dry leaf.
    for (let v = 0; v < position.count; v += 1) { const x = position.getX(v), z = position.getZ(v); position.setY(v, z * z * 0.35 + x * x * 0.1) }
    geometry.computeVertexNormals()
    const material = paperMaterial(texture, 1, false)
    // Dry leaves sit in the soil's shade: a little duller than the living plants.
    material.color.set('#d2c2ae')
    return { geometry, material }
  }), [textures])
}
