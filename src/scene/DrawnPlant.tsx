import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { InstancedMesh, Object3D, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Matrix4, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TubeGeometry, Vector3 } from 'three'
import type { Material, Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PlantKind } from '../sim/ecosystem'
import { plantDimensions } from './scale'
import { sprigTexture } from './semiReal'

/*
 * Drawn plants (owner, 2026-11-04). The look follows Drawquarium: hand-drawn
 * plants against real soil and water. The build follows EthrA: painted art on
 * simple 3D, so plants hold up as the camera orbits. No plant is one card
 * turned to the camera. Each GPT painting is a paper piece, placed the way the
 * real plant holds it:
 *
 * - Leaves on 3D stems.
 *   - clover (Oxalis): leaves held flat on curved stalks.
 *   - violet: heart leaves tilted out, flowers nodding on arched stems.
 *   - Calathea: leaves on their own petioles, tilted out.
 *   - fern: fronds arching out from the crown.
 * - Crossed cards: grass and reed tufts, whose thin blades look alike from every side.
 * - Flat on water or soil: lily pads, fallen oak leaves.
 * - Mushrooms: a side painting on crossed cards, with the cap painting laid
 *   over it as seen from above.
 *
 * - Moss: a patch of small sprig cards, two crossed planes each, like the jar's
 *   moss carpet (owner, 2026-11-04: keep the sprig patches, in the new palette).
 *
 * Art: the owner's picks (paper-gen/plants/) painted again as separate parts
 * (paper-gen/plant-parts/ on design-candidates), then cut out by
 * scripts/paper-plants/. Every piece of one plant that shares a painting is
 * merged into one mesh, so a plant costs only a few draws. Tips sway a
 * little, and health fades the plant toward a dry tone.
 */

const folder = `${import.meta.env.BASE_URL}assets/paper/plants/`
/** `?drawn=0` keeps the earlier plants, for comparing. */
export const drawnLook = (() => { try { return new URLSearchParams(window.location.search).get('drawn') !== '0' } catch { return true } })()
export const drawnKinds: PlantKind[] = ['moss', 'grass', 'clover', 'bloom', 'tree', 'fern', 'lily', 'reed']
export const hasDrawnPlant = (kind: PlantKind) => drawnKinds.includes(kind)

const files: Partial<Record<PlantKind, string[]>> = {
  clover: ['leaf-1', 'leaf-2', 'leaf-3', 'flower'],
  bloom: ['leaf-1', 'leaf-2', 'leaf-3', 'flower-1', 'flower-2', 'flower-side'],
  tree: ['leaf-1', 'leaf-2', 'leaf-3', 'leaf-4', 'leaf-5', 'leaf-6', 'base'],
  fern: ['frond-1', 'frond-2', 'frond-3'],
  grass: ['tuft-1', 'tuft-2'],
  reed: ['tuft-1', 'tuft-2', 'stalk-1', 'stalk-2', 'stalk-3'],
  lily: ['pad-1', 'pad-2', 'pad-3', 'flower-top', 'flower-side'],
}
const url = (kind: string, name: string) => `${folder}${kind}/${name}.webp`

const sway = { value: 0 }
const dry = new Color('#b39a6c')
const stemGreen = new Color('#7f9a52')
const materials = new Map<string, Material>()
const healthStep = (health: number) => Math.round(Math.max(0, Math.min(1, health)) * 4) / 4

/**
 * A paper material: the painting's own alpha cuts it out, and both faces are
 * lit as the front, since a paper piece has no dark back. With `bend`, the
 * top of the piece sways a little.
 */
function paperMaterial(map: Texture | null, health: number, bend: boolean) {
  const key = `${map?.uuid ?? 'stem'}|${healthStep(health)}|${bend}`
  let material = materials.get(key)
  if (material) return material
  const standard = new MeshStandardMaterial({ map, alphaTest: map ? 0.5 : 0, side: DoubleSide, roughness: 0.9, metalness: 0, color: map ? '#ffffff' : stemGreen })
  standard.color.lerp(dry, (1 - healthStep(health)) * 0.7)
  ;(standard as unknown as { defines: Record<string, string> }).defines = { SEMI_REAL: '' }
  standard.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        {
          // Ink line round the drawing (concept art, 2026-11-06): where a nearby texel is
          // outside the cut-out, darken to ink. The width wobbles along the edge like a pen line.
          // About 1.6 screen pixels wide however near the leaf is, but at least 1.5 texels.
          vec2 texel = 1.0 / vec2(textureSize(map, 0));
          float wobble = 1.0 + 0.45 * sin(vMapUv.x * 61.0 + vMapUv.y * 47.0) * sin(vMapUv.y * 23.0 - vMapUv.x * 17.0);
          vec2 reach = max(fwidth(vMapUv) * 1.6, texel * 1.5) * wobble;
          float outside = 0.0;
          for (int k = 0; k < 8; k++) {
            float angle = float(k) * 0.7853982;
            outside = max(outside, 1.0 - smoothstep(0.35, 0.55, texture2D(map, vMapUv + vec2(cos(angle), sin(angle)) * reach).a));
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.08, 0.06), outside * 0.92);
        }
        #endif`)
      // Backlight through the leaf (2026-11-07, after how big-budget games light foliage, e.g. the
      // backlit grass of Crimson Desert): the window is behind the jar, so leaves between the
      // sun and the camera glow with their own colour, and their edges catch a warm rim.
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 toLight = directionalLights[0].direction;
          float through = pow(clamp(dot(geometryViewDir, -toLight), 0.0, 1.0), 2.0);
          float rim = pow(1.0 - abs(dot(normalize(normal), geometryViewDir)), 3.0);
          vec3 sun = directionalLights[0].color;
          reflectedLight.indirectDiffuse += diffuseColor.rgb * diffuseColor.rgb * sun * 0.45 * through;
          reflectedLight.directSpecular += sun * vec3(1.0, 0.9, 0.7) * rim * through * 0.12;
        }
        #endif`)
    if (!bend) return
    shader.uniforms.swayTime = sway
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float swayTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Tips sway a little, each plant on its own phase (from its world position).
        vec4 rootWorld = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float phase = rootWorld.x * 1.7 + rootWorld.z * 2.3;
        float lift = uv.y * uv.y;
        transformed.x += sin(swayTime * 1.1 + phase) * 0.03 * lift;
        transformed.z += sin(swayTime * 0.8 + phase * 1.3) * 0.02 * lift;`)
  }
  standard.customProgramCacheKey = () => bend ? 'paper-ink-glow-sway' : 'paper-ink-glow'
  materials.set(key, standard)
  return standard
}

function prepare(texture: Texture) {
  if (texture.colorSpace !== SRGBColorSpace) { texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4; texture.needsUpdate = true }
  return texture
}

type Piece = { geometry: BufferGeometry; texture: Texture | null; bend: boolean }
const aspect = (texture: Texture) => { const image = texture.image as { width: number; height: number }; return image.width / image.height }

/** Lights a piece mostly from above, like the leaves around it, rather than by which way it faces. */
function soften(geometry: BufferGeometry, up = 0.6) {
  geometry.computeVertexNormals()
  const normal = geometry.getAttribute('normal') as BufferAttribute, n = new Vector3()
  for (let v = 0; v < normal.count; v += 1) { n.fromBufferAttribute(normal, v).multiplyScalar(1 - up); n.y += up; n.normalize(); normal.setXYZ(v, n.x, n.y, n.z) }
  return geometry
}

/**
 * An upright card, base at the origin, facing +z. Real leaves are never flat
 * boards: `cup` curves it across, `curl` arches it back along its height (a
 * leaf bowing on its stalk), `lean` bends it sideways and `twist` turns its
 * top about the stalk.
 */
function upright(texture: Texture, height: number, { cup = 0, curl = 0, lean = 0, twist = 0, rows = 8 } = {}) {
  const width = height * aspect(texture)
  const geometry = new PlaneGeometry(width, height, 4, rows).translate(0, height / 2, 0)
  const position = geometry.getAttribute('position')
  for (let v = 0; v < position.count; v += 1) {
    const px = position.getX(v), x = px / width, t = position.getY(v) / height
    const z = -cup * x * x * width - curl * t * t * height, turn = twist * t
    position.setXYZ(v, px * Math.cos(turn) - z * Math.sin(turn) + lean * t * t * height, position.getY(v) * (1 - curl * curl * t * 0.3), px * Math.sin(turn) + z * Math.cos(turn))
  }
  return soften(geometry)
}

/** A card lying flat, centred on the origin, its painting's top pointing along -z. */
function flat(texture: Texture, width: number, cup = 0) {
  const depth = width / aspect(texture)
  const geometry = new PlaneGeometry(width, depth, 4, 4).rotateX(-Math.PI / 2)
  const position = geometry.getAttribute('position')
  for (let v = 0; v < position.count; v += 1) { const x = position.getX(v) / width, z = position.getZ(v) / depth; position.setY(v, cup * (x * x + z * z) * width) }
  return soften(geometry, 0.3)
}

/** A frond laid along an arc: it leaves the crown steeply and bends out until its tip droops. */
function frond(texture: Texture, length: number, rise: number, droop: number) {
  const width = length * aspect(texture), rows = 12
  const geometry = new PlaneGeometry(width, length, 2, rows).translate(0, length / 2, 0)
  const position = geometry.getAttribute('position')
  const centre: { r: number; y: number }[] = [{ r: 0, y: 0 }]
  for (let row = 1; row <= rows; row += 1) {
    const angle = rise + (droop - rise) * (row - 0.5) / rows, step = length / rows, last = centre[row - 1]
    centre.push({ r: last.r + Math.cos(angle) * step, y: last.y + Math.sin(angle) * step })
  }
  for (let v = 0; v < position.count; v += 1) {
    const at = Math.round(position.getY(v) / length * rows), point = centre[Math.max(0, Math.min(rows, at))]
    position.setXYZ(v, position.getX(v), point.y, point.r)
  }
  return soften(geometry, 0.5)
}

const stemCache = new Map<string, BufferGeometry>()
/** A thin 3D stem through the given points. */
function stem(points: Vector3[], radius: number) {
  const key = `${points.map((point) => point.toArray().map((value) => value.toFixed(3)).join(',')).join(';')}|${radius}`
  let geometry = stemCache.get(key)
  if (!geometry) { geometry = new TubeGeometry(new CatmullRomCurve3(points), 8, radius, 5, false); stemCache.set(key, geometry) }
  return geometry.clone()
}

const place = (geometry: BufferGeometry, { x = 0, y = 0, z = 0, yaw = 0, tilt = 0, roll = 0, scale = 1 }) =>
  geometry.applyMatrix4(new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(yaw)).multiply(new Matrix4().makeRotationX(tilt)).multiply(new Matrix4().makeRotationZ(roll)).multiply(new Matrix4().makeScale(scale, scale, scale)))

/** A small seeded random stream, so one plant always grows the same shape. */
function random(seed: number) {
  let state = (Math.abs(Math.floor(seed)) * 9301 + 49297) % 233280 || 1
  return () => { state = (state * 9301 + 49297) % 233280; return state / 233280 }
}
const golden = 2.39996

function build(kind: PlantKind, textures: Record<string, Texture>, seed: number, flowering: boolean): Piece[] {
  const { spread, height } = plantDimensions[kind]
  const rand = random(seed + 1)
  const pieces: Piece[] = []
  const add = (geometry: BufferGeometry, texture: Texture | null, bend = false) => pieces.push({ geometry, texture, bend })
  const turn = rand() * Math.PI * 2

  if (kind === 'grass' || kind === 'reed') {
    // Three crossed copies of the tuft; reeds add a few single stalks around it.
    const tuft = textures[rand() < 0.5 ? 'tuft-1' : 'tuft-2']
    for (let index = 0; index < 3; index += 1) add(place(upright(tuft, height, { cup: 0.15 }), { yaw: turn + index * Math.PI / 3 }), tuft, true)
    if (kind === 'reed') for (let index = 0; index < 3; index += 1) {
      const texture = textures[`stalk-${index + 1}`], angle = turn + index * golden, reach = spread * 0.3
      for (const cross of [0, Math.PI / 2]) add(place(upright(texture, height * (1 + rand() * 0.15)), { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach, yaw: angle + cross }), texture, true)
    }
  }

  if (kind === 'clover') {
    // Oxalis: trifoliate leaves held flat on 1-7 cm stalks, leaflets 4-13 mm (VicFlora).
    const count = 7
    for (let index = 0; index < count; index += 1) {
      const angle = turn + index * golden, reach = spread * (0.12 + rand() * 0.26), top = height * (0.35 + rand() * 0.4)
      const tip = new Vector3(Math.cos(angle) * reach, top, Math.sin(angle) * reach)
      // Stalks rise from the crown, wander a little and bow out under the leaf.
      const side = (rand() - 0.5) * 0.25
      add(stem([new Vector3(0, 0, 0), new Vector3(tip.x * 0.1 - tip.z * side, top * 0.4, tip.z * 0.1 + tip.x * side), new Vector3(tip.x * 0.55, top * 0.92, tip.z * 0.55), tip], 0.01), null)
      const leaf = textures[`leaf-${1 + index % 3}`]
      add(place(flat(leaf, spread * (0.34 + rand() * 0.14), 0.08 + rand() * 0.12), { x: tip.x, y: tip.y, z: tip.z, yaw: -angle + Math.PI / 2 + (rand() - 0.5) * 1.4, tilt: (rand() - 0.5) * 0.4, roll: 0.05 + rand() * 0.25 }), leaf, true)
    }
    if (flowering) for (let index = 0; index < 2; index += 1) {
      const angle = turn + 1 + index * 2.8, reach = spread * 0.15, top = height * 0.98
      const tip = new Vector3(Math.cos(angle) * reach, top, Math.sin(angle) * reach)
      add(stem([new Vector3(0, 0, 0), new Vector3(tip.x * 0.4, top * 0.6, tip.z * 0.4), tip], 0.009), null)
      add(place(flat(textures.flower, spread * 0.14), { x: tip.x, y: tip.y + 0.01, z: tip.z, yaw: angle, tilt: 0.3 }), textures.flower)
    }
  }

  if (kind === 'bloom') {
    // Violet: heart leaves tilted out from the crown, flowers nodding on arched stems.
    for (let index = 0; index < 5; index += 1) {
      const angle = turn + index * golden, leaf = textures[`leaf-${1 + index % 3}`]
      add(place(upright(leaf, height * (0.58 + rand() * 0.25), { cup: 0.15 + rand() * 0.2, curl: 0.1 + rand() * 0.2, lean: (rand() - 0.5) * 0.3, twist: (rand() - 0.5) * 0.6 }), { yaw: Math.PI / 2 - angle + (rand() - 0.5) * 0.4, tilt: 0.35 + rand() * 0.6, roll: (rand() - 0.5) * 0.3 }), leaf, true)
    }
    if (flowering) for (let index = 0; index < 2; index += 1) {
      const angle = turn + 0.8 + index * 3.1, reach = spread * 0.22, top = height * (0.85 + index * 0.12)
      const tip = new Vector3(Math.cos(angle) * reach, top, Math.sin(angle) * reach)
      add(stem([new Vector3(0, 0, 0), new Vector3(tip.x * 0.2, top * 0.8, tip.z * 0.2), new Vector3(tip.x * 0.7, top * 1.02, tip.z * 0.7), tip], 0.01), null)
      const face = textures[`flower-${index + 1}`], size = height * 0.3
      // The flower faces out and a little down; a side painting crosses it so it keeps its shape edge-on.
      add(place(upright(face, size), { x: tip.x, y: tip.y - size * 0.5, z: tip.z, yaw: Math.PI / 2 - angle, tilt: 0.25 }), face)
      add(place(upright(textures['flower-side'], size), { x: tip.x, y: tip.y - size * 0.5, z: tip.z, yaw: -angle }), textures['flower-side'])
    }
  }

  if (kind === 'tree') {
    // Fittonia (nerve plant), as in concept image 12 (owner, 2026-11-07: plants must match the cover):
    // a low mound of soft stems, each ending in opposite pairs of broad pink-veined leaves that
    // splay out and up toward the light, the lower pairs larger and flatter.
    for (let index = 0; index < 5; index += 1) {
      const angle = turn + index * golden, reach = spread * (0.1 + rand() * 0.2), top = height * (0.28 + rand() * 0.3)
      const tip = new Vector3(Math.cos(angle) * reach, top, Math.sin(angle) * reach)
      add(stem([new Vector3(0, 0, 0), new Vector3(tip.x * 0.3, top * 0.45, tip.z * 0.3), tip], 0.016), null)
      for (const [level, size, tilt] of [[1, 0.5, 0.65], [0.55, 0.6, 1.0], [0.15, 0.62, 1.3]] as const) {
        const at = new Vector3(tip.x * (0.35 + 0.65 * level), top * level, tip.z * (0.35 + 0.65 * level))
        for (const side of [0, Math.PI]) {
          const out = angle + side + (level < 1 ? Math.PI / 2 : 0) + (rand() - 0.5) * 0.5
          const leaf = textures[`leaf-${1 + Math.floor(rand() * 6)}`]
          add(place(upright(leaf, height * size * (0.85 + rand() * 0.3), { cup: 0.2 + rand() * 0.2, curl: 0.12 + rand() * 0.2, lean: (rand() - 0.5) * 0.25, twist: (rand() - 0.5) * 0.5 }), { x: at.x, y: at.y - 0.02, z: at.z, yaw: Math.PI / 2 - out, tilt: tilt + rand() * 0.3, roll: (rand() - 0.5) * 0.3 }), leaf, true)
        }
      }
    }
    const base = textures.base
    for (const cross of [0, Math.PI / 2]) add(place(upright(base, height * 0.22), { yaw: turn + cross }), base)
  }

  if (kind === 'fern') {
    // Fronds unroll from the crown and arch out, the older ones lower.
    for (let index = 0; index < 7; index += 1) {
      const angle = turn + index * golden, texture = textures[`frond-${1 + index % 3}`]
      const length = spread * (0.42 + rand() * 0.16)
      add(place(frond(texture, length, 1.3 - index * 0.07 - rand() * 0.15, -0.1 - rand() * 0.5), { yaw: Math.PI / 2 - angle + (rand() - 0.5) * 0.35, roll: (rand() - 0.5) * 0.5 }), texture, true)
    }
  }

  if (kind === 'lily') {
    // Pads float flat on the surface (the plant's origin sits a little under it), about
    // 10-14 mm across like frogbit, so they read on the water as in concept image 12.
    for (let index = 0; index < 3; index += 1) {
      const angle = turn + index * golden, reach = index === 0 ? 0 : spread * 0.55, pad = textures[`pad-${index + 1}`]
      add(place(flat(pad, spread * (1.05 - index * 0.2), 0.03 + rand() * 0.04), { x: Math.cos(angle) * reach, y: 0.03 + index * 0.002, z: Math.sin(angle) * reach, yaw: rand() * Math.PI * 2 }), pad)
    }
    if (flowering) {
      const size = spread * 0.3
      add(place(flat(textures['flower-top'], size), { y: size * 0.35, yaw: turn }), textures['flower-top'])
      for (const cross of [0, Math.PI / 2]) add(place(upright(textures['flower-side'], size * 0.5), { yaw: turn + cross }), textures['flower-side'])
    }
  }
  return pieces
}

/** Merges the pieces that share a painting, so the plant draws in a few calls. */
function merge(pieces: Piece[]) {
  const groups = new Map<string, { texture: Texture | null; bend: boolean; geometries: BufferGeometry[] }>()
  for (const piece of pieces) {
    const key = `${piece.texture?.uuid ?? 'stem'}|${piece.bend}`
    const group = groups.get(key) ?? { texture: piece.texture, bend: piece.bend, geometries: [] }
    // Stems carry no uv-based sway; drop attributes the cards do not share before merging.
    group.geometries.push(piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) => ({ geometry: mergeGeometries(group.geometries)!, texture: group.texture, bend: group.bend }))
}

/** Keeps the shared sway clock running. */
function Clock() {
  useFrame(({ clock }) => { sway.value = clock.elapsedTime })
  return null
}

const sprigCard = (() => {
  let geometry: BufferGeometry | null = null
  return () => geometry ??= soften(mergeGeometries([new PlaneGeometry(1, 1).translate(0, 0.5, 0), new PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)])!, 0.5)
})()
const sprigMaps = new Map<number, Texture>()

/** A moss plant as a patch of sprigs, domed in the middle and ragged at the edge. */
function MossPatch({ health, seed }: { health: number; seed: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const { spread } = plantDimensions.moss
  const count = 110, radius = spread * 0.9
  const material = useMemo(() => {
    const variant = Math.abs(seed) % 3
    let map = sprigMaps.get(variant)
    if (!map) { map = sprigTexture(variant * 131 + 7); sprigMaps.set(variant, map) }
    return paperMaterial(map, health, true)
  }, [seed, health])
  useLayoutEffect(() => {
    if (!mesh.current) return
    const rand = random(seed + 3), dummy = new Object3D()
    for (let index = 0; index < count; index += 1) {
      const angle = rand() * Math.PI * 2, edge = Math.sqrt(rand()) * (0.75 + 0.25 * Math.sin(angle * 3 + seed))
      const size = (0.2 + rand() * 0.12) * (1 - edge * 0.35)
      dummy.position.set(Math.cos(angle) * edge * radius, Math.sqrt(Math.max(0, 1 - edge * edge)) * radius * 0.12 - 0.02, Math.sin(angle) * edge * radius)
      dummy.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5)
      dummy.scale.set(size, size * (0.9 + rand() * 0.4), size)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [seed, radius])
  return <instancedMesh ref={mesh} args={[sprigCard(), material, count]} frustumCulled={false} raycast={() => undefined} />
}

export function DrawnPlant({ kind, health, seed, flowering = false }: { kind: PlantKind; health: number; seed: number; flowering?: boolean }) {
  if (kind === 'moss') return <><Clock /><MossPatch health={health} seed={seed} /></>
  return <PaperPlant kind={kind} health={health} seed={seed} flowering={flowering} />
}

function PaperPlant({ kind, health, seed, flowering }: { kind: PlantKind; health: number; seed: number; flowering: boolean }) {
  const names = files[kind] ?? []
  const loaded = useTexture(names.map((name) => url(kind, name))) as Texture[]
  // The cut-out shape only changes with the plant itself; health just swaps the (cached) tint, so a
  // plant hovering at a health step no longer re-merges its geometry every sim tick.
  const pieces = useMemo(() => {
    const textures = Object.fromEntries(names.map((name, index) => [name, prepare(loaded[index])]))
    return merge(build(kind, textures, seed, flowering))
  }, [kind, loaded, seed, flowering]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => pieces.forEach((piece) => piece.geometry.dispose()), [pieces])
  const step = healthStep(health)
  const meshes = useMemo(() => pieces.map((piece) => ({ geometry: piece.geometry, material: paperMaterial(piece.texture, step, piece.bend) })), [pieces, step])
  return <>
    <Clock />
    {meshes.map((mesh, index) => <mesh key={index} geometry={mesh.geometry} material={mesh.material} raycast={() => undefined} />)}
  </>
}

const leafFiles = [1, 2, 3, 4, 5].map((index) => url('fallen-leaf', `oak-${index}`))
/** Fallen oak leaves for litter: flat paper pieces, a little cupped, lying on the soil. */
export function useFallenLeaves() {
  const textures = useTexture(leafFiles) as Texture[]
  return useMemo(() => textures.map((texture) => {
    prepare(texture)
    const geometry = flat(texture, 1, 0.12)
    // Dry leaves sit in the soil's shade: drawn a step duller than the living plants.
    return { geometry, material: paperMaterial(texture, 0.75, false) }
  }), [textures])
}

const mushroomFiles = ['side-1', 'side-2', 'side-3', 'cap-1', 'cap-2'].map((name) => url('mushroom', name))
/** A drawn mushroom: the side painting on two crossed cards, the cap painting laid in it as seen from above. */
export function DrawnMushroom({ height, lean = 0, variant = 0 }: { height: number; lean?: number; variant?: number }) {
  const textures = useTexture(mushroomFiles) as Texture[]
  // Built at unit height and scaled, so a growing mushroom keeps one geometry.
  const meshes = useMemo(() => {
    textures.forEach(prepare)
    const side = textures[variant % 3], cap = textures[3 + variant % 2]
    const width = aspect(side)
    const pieces: Piece[] = [0, Math.PI / 2].map((cross) => ({ geometry: place(upright(side, 1), { yaw: cross }), texture: side, bend: false }))
    pieces.push({ geometry: place(flat(cap, width * 0.84, 0.08), { y: 0.8 }), texture: cap, bend: false })
    return merge(pieces).map((piece) => ({ geometry: piece.geometry, material: paperMaterial(piece.texture, 1, piece.bend) }))
  }, [textures, variant])
  useEffect(() => () => meshes.forEach((mesh) => mesh.geometry.dispose()), [meshes])
  return <group rotation={[lean * 0.6, variant * 1.7, lean]} scale={height}>
    {meshes.map((mesh, index) => <mesh key={index} geometry={mesh.geometry} material={mesh.material} raycast={() => undefined} />)}
  </group>
}
