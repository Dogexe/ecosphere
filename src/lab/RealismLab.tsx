import { Suspense, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, Vignette } from '@react-three/postprocessing'
import type { DepthOfFieldEffect } from 'postprocessing'
import { Environment, MeshTransmissionMaterial, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import { BufferAttribute, CanvasTexture, Mesh, RepeatWrapping, Texture, Color, CylinderGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh, MathUtils, MeshStandardMaterial, Object3D, PlaneGeometry, Matrix3, SRGBColorSpace, Vector2, Vector3 } from 'three'
import { PaperAnimal } from '../scene/PaperCritter'
import { animalDimensions, millimetresPerUnit, realAdultLengthMm } from '../scene/scale'
import type { CreatureKind } from '../sim/ecosystem'
import { Fern, MossSprigs, paintify, ScannedProp } from '../scene/semiReal'
import { charcoalTexture, gravelTexture, makeNoise, mossTexture, soilSideTexture, soilTexture, stoneTexture, woodTexture } from './proceduralTextures'

/*
 * Realism test (lab.html): one jar on a windowsill with layered substrate,
 * a stone, a moss cushion and the paper woodlouse. Nothing here touches the
 * simulation; it only shows how far the look can go in a browser.
 * World units match the game: the woodlouse is 0.64 long (about 12 mm),
 * so one unit is about 19 mm and the jar is about 15 cm across.
 */

const query = new URLSearchParams(window.location.search)
/**
 * ?animal=<paper animal> shows another cut-out; ?animal=all lines every
 * one up at its real adult size (scale.ts realAdultLengthMm).
 */
const paperKinds: Record<string, CreatureKind> = { woodlouse: 'woodlouse', caterpillar: 'grazer', springtail: 'springtail', 'tiger-beetle': 'beetle', 'water-flea': 'flea' }
const lineup = query.get('animal') === 'all' ? Object.keys(paperKinds) : [query.get('animal') ?? 'woodlouse']
const paperRealScale = (animal: string) => {
  const kind = paperKinds[animal] ?? 'woodlouse'
  return realAdultLengthMm[kind] / millimetresPerUnit / animalDimensions[kind].sourceLength
}
const shot = query.get('shot')
/** Camera presets for screenshots: sill (whole windowsill), jar (default), close, macro (magnifier). */
const shots: Record<string, { position: [number, number, number]; target: [number, number, number]; fov: number }> = {
  sill: { position: [16, 12, 30], target: [0, 3.2, 0], fov: 32 },
  jar: { position: [9, 7.5, 15], target: [0, 3.2, 0], fov: 32 },
  close: { position: [1.7, 4.4, 2.9], target: [0.9, 2.5, 0.6], fov: 40 },
  macro: { position: [1.45, 2.75, 2.35], target: [1.0, 2.45, 0.9], fov: 40 },
}
const view = shots[shot ?? 'jar'] ?? shots.jar
/** ?still=1 renders only when something changes (for screenshots on slow software GPUs). */
const still = query.get('still') === '1'
/**
 * ?round=1: procedural first attempt. ?round=2: raw Poly Haven CC0 scans.
 * Round 3 (default): the same scans softened toward a painted, semi-real look
 * that suits the cartoon paper creatures (blurred colour maps, gentle normals,
 * clumped moss, warm soft light, a contact shadow and a light colour grade).
 */
const round = query.get('round') ?? '3'
const scanned = round !== '1'
const semi = round === '3'
/** ?time=morning (default, cool sky) or afternoon (warm gold): the two lighting keys from the painted references. */
const afternoon = query.get('time') === 'afternoon'
const ph = `${import.meta.env.BASE_URL}assets/lab/polyhaven/`
const R = 3.8
const terrain = makeNoise(101)
const soilTop = (x: number, z: number) => 2.25 + (terrain(x * 0.35 + 5, z * 0.35 + 5, 4) - 0.5) * 0.7 + Math.max(0, 1 - Math.hypot(x + 1.4, z + 0.6) / 1.8) * 0.45

function Substrate() {
  const textures = useMemo(() => ({ soil: soilTexture(0.55), gravel: gravelTexture(), charcoal: charcoalTexture(), side: soilSideTexture() }), [])
  const surface = useMemo(() => {
    const geometry = new PlaneGeometry(2 * R, 2 * R, 220, 220).rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position') as BufferAttribute
    for (let index = 0; index < position.count; index += 1) {
      let x = position.getX(index), z = position.getZ(index)
      const radius = Math.hypot(x, z)
      if (radius > R) { x *= R / radius; z *= R / radius }
      position.setXYZ(index, x, soilTop(x, z), z)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [])
  const band = (y0: number, y1: number) => new CylinderGeometry(R, R, y1 - y0, 128, 1, true).translate(0, (y0 + y1) / 2, 0)
  return <group>
    <mesh geometry={band(0, 0.95)} castShadow><meshStandardMaterial map={textures.gravel} roughness={0.85} side={DoubleSide} /></mesh>
    <mesh geometry={band(0.95, 1.2)} castShadow><meshStandardMaterial map={textures.charcoal} roughness={0.6} side={DoubleSide} /></mesh>
    <mesh geometry={band(1.2, 2.05)} castShadow><meshStandardMaterial map={textures.side} roughness={0.95} side={DoubleSide} /></mesh>
    <mesh geometry={surface} receiveShadow><meshStandardMaterial map={textures.soil.map} normalMap={textures.soil.normalMap} roughness={0.78} /></mesh>
  </group>
}

function Stone() {
  const { geometry, textures } = useMemo(() => {
    const geometry = new IcosahedronGeometry(1, 6)
    const noise = makeNoise(222)
    const position = geometry.getAttribute('position') as BufferAttribute
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index)
      const bump = 0.82 + noise(x * 1.6 + 3, y * 1.6 + z * 1.3 + 3, 5) * 0.4
      position.setXYZ(index, x * bump, y * bump * 0.72, z * bump)
    }
    geometry.computeVertexNormals()
    return { geometry, textures: stoneTexture() }
  }, [])
  return <mesh geometry={geometry} position={[-1.4, soilTop(-1.4, -0.6) + 0.15, -0.6]} rotation={[0.2, 0.7, 0.1]} scale={[1.25, 1.1, 1]} castShadow receiveShadow>
    <meshStandardMaterial map={textures.map} normalMap={textures.normalMap} roughness={0.9} />
  </mesh>
}

/** A cushion of moss: thousands of tiny upright shoots, denser and greener at the centre. */
function Moss({ x, z, radius, count }: { x: number; z: number; radius: number; count: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new CylinderGeometry(0.006, 0.014, 1, 4, 1).translate(0, 0.5, 0), [])
  useMemo(() => {
    queueMicrotask(() => {
      if (!mesh.current) return
      const dummy = new Object3D(), colour = new Color()
      const noise = makeNoise(x * 100 + z)
      let seed = 1
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      for (let index = 0; index < count; index += 1) {
        const angle = rand() * Math.PI * 2, distance = Math.sqrt(rand()) * radius
        const px = x + Math.cos(angle) * distance, pz = z + Math.sin(angle) * distance
        const centre = 1 - distance / radius
        const dome = Math.sqrt(Math.max(0, 1 - (distance / radius) ** 2)) * radius * 0.22
        const height = 0.025 + noise(px * 4, pz * 4) * 0.04
        dummy.position.set(px, soilTop(px, pz) + dome - 0.015, pz)
        dummy.rotation.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5)
        dummy.scale.set(1, height, 1)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(index, dummy.matrix)
        const tip = noise(px * 9, pz * 9)
        colour.setRGB(0.18 + tip * 0.16, 0.26 + centre * 0.08 + tip * 0.12, 0.09 + tip * 0.05, SRGBColorSpace)
        mesh.current.setColorAt(index, colour)
      }
      mesh.current.instanceMatrix.needsUpdate = true
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    })
  }, [x, z, radius, count])
  const procedural = useMemo(() => scanned ? null : mossTexture(), [])
  const scan = scanned ? useScan('moss_wood', [radius * 0.9, radius * 0.9]) : null
  const textures = scan ?? procedural!
  const cushion = useMemo(() => {
    const geometry = new PlaneGeometry(2 * radius, 2 * radius, 64, 64).rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position') as BufferAttribute
    for (let index = 0; index < position.count; index += 1) {
      let dx = position.getX(index), dz = position.getZ(index)
      const distance = Math.hypot(dx, dz)
      if (distance > radius) { dx *= radius / distance; dz *= radius / distance }
      const dome = Math.sqrt(Math.max(0, 1 - (Math.hypot(dx, dz) / radius) ** 2)) * radius * 0.22
      position.setXYZ(index, x + dx, soilTop(x + dx, z + dz) + dome - 0.01, z + dz)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [x, z, radius])
  if (semi) return <MossSprigs x={x} z={z} radius={radius} count={Math.round(count / 4)} ground={soilTop} />
  return <group>
    <mesh geometry={cushion} castShadow receiveShadow><meshStandardMaterial {...textures} roughness={0.95} /></mesh>
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} castShadow receiveShadow><meshStandardMaterial roughness={0.95} /></instancedMesh>
  </group>
}

/** Decorative grit scattered on the soil: 2–6 mm pebbles at true scale. */
function Grit({ count }: { count: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new IcosahedronGeometry(1, 2), [])
  useMemo(() => {
    queueMicrotask(() => {
      if (!mesh.current) return
      const dummy = new Object3D(), colour = new Color()
      let seed = 7
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      for (let index = 0; index < count; index += 1) {
        const angle = rand() * Math.PI * 2, distance = Math.sqrt(rand()) * (R - 0.15)
        const px = Math.cos(angle) * distance, pz = Math.sin(angle) * distance
        const size = 0.03 + rand() * 0.07
        dummy.position.set(px, soilTop(px, pz) + size * 0.3, pz)
        dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3)
        dummy.scale.set(size * (0.8 + rand() * 0.5), size * 0.7, size)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(index, dummy.matrix)
        const tone = 0.22 + rand() * 0.3
        colour.setRGB(tone, tone * 0.9, tone * 0.8, SRGBColorSpace)
        mesh.current.setColorAt(index, colour)
      }
      mesh.current.instanceMatrix.needsUpdate = true
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    })
  }, [count])
  return <instancedMesh ref={mesh} args={[geometry, undefined, count]} castShadow receiveShadow><meshStandardMaterial roughness={0.85} /></instancedMesh>
}

/** Loads a Poly Haven texture set (colour, normal, roughness, optional height) tiled `repeat` times. */
function useScan(id: string, repeat: [number, number], height = false) {
  const files = { map: `${ph}${id}/${id}_diff_1k.jpg`, normalMap: `${ph}${id}/${id}_nor_gl_1k.jpg`, roughnessMap: `${ph}${id}/${id}_rough_1k.jpg`, ...(height ? { displacementMap: `${ph}${id}/${id}_disp_1k.jpg` } : {}) }
  const set = useTexture(files) as Record<string, Texture>
  useMemo(() => {
    for (const [key, texture] of Object.entries(set)) {
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.repeat.set(...repeat)
      texture.anisotropy = 8
      if (key === 'map') texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
    }
  }, [set, repeat])
  return useMemo(() => semi ? { ...set, map: paintify(set.map, '', 1), normalScale: new Vector2(0.6, 0.6) } : set, [set])
}

/** A soft dark blob under a creature so it sits on the ground instead of floating. */
function ContactBlob({ width, depth }: { width: number; depth: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(30,20,12,0.75)'); gradient.addColorStop(0.55, 'rgba(30,20,12,0.35)'); gradient.addColorStop(1, 'rgba(30,20,12,0)')
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128)
    return new CanvasTexture(canvas)
  }, [])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1}>
    <planeGeometry args={[width, depth]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>
}

function ScannedSubstrate() {
  const soil = useScan('forest_ground_04', [1.6, 1.6], true)
  const pebbles = useScan('clean_pebbles', [8, 0.32])
  const side = useMemo(() => ({ charcoal: charcoalTexture(), side: soilSideTexture() }), [])
  const surface = useMemo(() => {
    const geometry = new PlaneGeometry(2 * R, 2 * R, 220, 220).rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position') as BufferAttribute
    for (let index = 0; index < position.count; index += 1) {
      let x = position.getX(index), z = position.getZ(index)
      const radius = Math.hypot(x, z)
      if (radius > R) { x *= R / radius; z *= R / radius }
      position.setXYZ(index, x, soilTop(x, z), z)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [])
  const band = (y0: number, y1: number) => new CylinderGeometry(R, R, y1 - y0, 128, 1, true).translate(0, (y0 + y1) / 2, 0)
  return <group>
    <mesh geometry={band(0, 0.95)} castShadow><meshStandardMaterial {...pebbles} side={DoubleSide} /></mesh>
    <mesh geometry={band(0.95, 1.2)} castShadow><meshStandardMaterial map={side.charcoal} roughness={0.6} side={DoubleSide} /></mesh>
    <mesh geometry={band(1.2, 2.05)} castShadow><meshStandardMaterial map={side.side} roughness={0.95} side={DoubleSide} /></mesh>
    {/* Damp soil reads darker; the scan is dry forest floor. */}
    <mesh geometry={surface} receiveShadow><meshStandardMaterial {...soil} color={semi ? "#a8927c" : "#9a8f84"} displacementScale={semi ? 0.06 : 0.12} displacementBias={semi ? -0.03 : -0.06} /></mesh>
  </group>
}

/** One rock from Poly Haven "Rock Moss Set 01" (photogrammetry scan). */
function ScannedStone() {
  const { nodes } = useGLTF(`${ph}rock_moss_set_01/rock_moss_set_01_1k.gltf`)
  const rock = nodes.rock_moss_set_01_rock01 as Mesh
  const material = useMemo(() => {
    if (!semi) return rock.material
    const source = rock.material as MeshStandardMaterial
    const painted = source.clone()
    if (source.map) { painted.map = paintify(source.map, 'saturate(0.25) brightness(1.25)'); painted.map.repeat.set(1, 1); painted.map.flipY = source.map.flipY }
    painted.normalScale = new Vector2(0.4, 0.4)
    painted.color = new Color('#ece8e2')
    return painted
  }, [rock])
  const placement = { position: [-1.4, soilTop(-1.4, -0.6) + 0.25, -0.6] as [number, number, number], rotation: [0, 0.9, 0] as [number, number, number], scale: 0.95 }
  // Semi-real: a cap of moss sprigs on the upward-facing top of the stone, as in the reference.
  const top = useMemo(() => {
    if (!semi) return []
    const matrix = new Object3D()
    matrix.position.set(...placement.position); matrix.rotation.set(...placement.rotation); matrix.scale.setScalar(placement.scale); matrix.updateMatrix()
    const position = rock.geometry.getAttribute('position'), normal = rock.geometry.getAttribute('normal')
    const spots: Vector3[] = [], up = new Vector3()
    const turn = new Matrix3().getNormalMatrix(matrix.matrix)
    for (let index = 0; index < position.count; index += 3) {
      up.fromBufferAttribute(normal, index).applyMatrix3(turn).normalize()
      if (up.y > 0.6) spots.push(new Vector3().fromBufferAttribute(position, index).applyMatrix4(matrix.matrix))
    }
    const highest = Math.max(...spots.map((spot) => spot.y))
    return spots.filter((spot) => spot.y > highest - 0.45)
  }, [rock])
  return <>
    <mesh geometry={rock.geometry} material={material} {...placement} castShadow receiveShadow />
    {top.length > 0 && <MossSprigs x={0} z={0} radius={1} count={420} spots={top} scale={0.8} ground={soilTop} />}
  </>
}

function ScannedSill() {
  const oak = useScan('oak_veneer_01', [1.5, 0.7])
  return <mesh position={[0, -0.6, 1]} receiveShadow>
    <boxGeometry args={[30, 1, 14]} />
    <meshStandardMaterial {...oak} />
  </mesh>
}

function Jar() {
  return <group>
    <mesh position={[0, 4.6, 0]}>
      <cylinderGeometry args={[R + 0.15, R + 0.15, 9.2, 96, 1, true]} />
      {/* Clear glass: owner asked for it to read see-through. Low opacity with sharp
          reflections instead of a low-resolution refraction pass, which blurred the jar contents. */}
      {semi
        ? <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0.02} metalness={0} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={1.4} side={DoubleSide} depthWrite={false} />
        : <MeshTransmissionMaterial thickness={0.2} roughness={0} ior={1.5} chromaticAberration={0.01} anisotropicBlur={0} distortion={0.02} distortionScale={0.2} backside={false} samples={4} resolution={512} side={DoubleSide} />}
    </mesh>
    <mesh position={[0, 9.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[R + 0.12, 0.12, 12, 96]} />
      <meshPhysicalMaterial color="#dfe8e4" transmission={0.6} roughness={0.1} thickness={0.2} />
    </mesh>
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[R + 0.15, 96]} />
      <meshStandardMaterial color="#b7c3be" transparent opacity={semi ? 0.15 : 0.35} roughness={0.1} />
    </mesh>
  </group>
}

function Sill() {
  const wood = useMemo(() => woodTexture(), [])
  return <mesh position={[0, -0.6, 1]} receiveShadow>
    <boxGeometry args={[30, 1, 14]} />
    <meshStandardMaterial map={wood.map} normalMap={wood.normalMap} roughness={0.55} />
  </mesh>
}

/** A bright window behind the jar: soft garden and sky, blurred as if out of focus. */
function Window() {
  const view = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 320
    const context = canvas.getContext('2d')!
    const sky = context.createLinearGradient(0, 0, 0, 320)
    if (semi && afternoon) { sky.addColorStop(0, '#fff6dc'); sky.addColorStop(0.55, '#f6e2a8'); sky.addColorStop(0.75, '#d9d79a'); sky.addColorStop(1, '#b7c27e') }
    else if (semi) { sky.addColorStop(0, '#cfe4f4'); sky.addColorStop(0.5, '#e6efe6'); sky.addColorStop(0.75, '#b9cf9c'); sky.addColorStop(1, '#8fb070') }
    else { sky.addColorStop(0, '#dfeefa'); sky.addColorStop(0.5, '#f4f1e2'); sky.addColorStop(0.62, '#9fb889'); sky.addColorStop(1, '#5f7d4f') }
    context.fillStyle = sky
    context.fillRect(0, 0, 512, 320)
    if (semi && afternoon) {
      // Semi-real: a warm low sun glowing through the window, as in the painted reference.
      const sun = context.createRadialGradient(120, 70, 0, 120, 70, 260)
      sun.addColorStop(0, 'rgba(255,248,220,1)'); sun.addColorStop(1, 'rgba(255,236,180,0)')
      context.fillStyle = sun; context.fillRect(0, 0, 512, 320)
    }
    context.filter = 'blur(14px)'
    for (let index = 0; index < 14; index += 1) {
      context.fillStyle = semi ? (afternoon ? (index % 2 ? '#c3c78a' : '#d0cf95') : (index % 2 ? '#9fbf84' : '#b3cc95')) : index % 2 ? '#6f8f5c' : '#86a36a'
      context.beginPath(); context.ellipse(index * 40 + 10, 190 + (index % 3) * 12, 50, 40, 0, 0, Math.PI * 2); context.fill()
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [])
  return <group position={[0, 9, -13]}>
    <mesh><planeGeometry args={[34, 20]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
    {[-8.5, 8.5].map((x) => <mesh key={x} position={[x, 0, 0.2]}><boxGeometry args={[0.6, 20, 0.6]} /><meshStandardMaterial color="#eeeae2" roughness={0.6} /></mesh>)}
    <mesh position={[0, 2, 0.2]}><boxGeometry args={[34, 0.5, 0.5]} /><meshStandardMaterial color="#eeeae2" roughness={0.6} /></mesh>
  </group>
}

/**
 * Magnifier zoom: one continuous camera. As you zoom in, the view eases down
 * towards eye level (so side-view paper animals read well), the orbit centre
 * drifts to the animal, and a macro-lens depth of field narrows.
 * `zoom` 0 = whole jar, 1 = magnifier.
 */
const jarCentre = new Vector3(0, 3.2, 0)
const goal = new Vector3()
function MagnifierRig({ subject }: { subject: Vector3 }) {
  const controls = useThree((state) => state.controls) as unknown as { target: Vector3; minPolarAngle: number; maxPolarAngle: number } | null
  const dof = useRef<DepthOfFieldEffect>(null)
  const settle = useRef(still ? 5 : 0)
  useFrame(({ camera, invalidate }) => {
    // In ?still=1 screenshots, draw a few extra frames so the rig settles.
    if (settle.current > 0) { settle.current -= 1; invalidate() }
    if (!controls) return
    const distance = camera.position.distanceTo(controls.target)
    const near = 1 - MathUtils.smoothstep(distance, 1.6, 14)
    goal.copy(jarCentre).lerp(subject, near)
    controls.target.lerp(goal, still ? 0.3 : 0.08)
    const centre = MathUtils.lerp(0.95, 1.38, near)
    controls.minPolarAngle = centre - MathUtils.lerp(0.65, 0.14, near)
    controls.maxPolarAngle = centre + MathUtils.lerp(0.4, 0.1, near)
    const effect = dof.current
    if (effect) {
      effect.target = controls.target
      effect.bokehScale = MathUtils.lerp(0.6, 5, near)
      effect.cocMaterial.worldFocusRange = MathUtils.lerp(9, 0.7, near)
    }
  })
  return <EffectComposer multisampling={0}>
    <DepthOfField ref={dof} worldFocusRange={9} bokehScale={1} resolutionScale={0.5} />
    <>{semi && <>
      <HueSaturation saturation={0.08} />
      <BrightnessContrast brightness={0.02} contrast={-0.06} />
      <Vignette offset={0.35} darkness={0.45} />
    </>}</>
  </EffectComposer>
}

/**
 * ?animal=all: every paper animal side by side at real adult size on a plain
 * card with a millimetre ruler (one world unit = 19 mm), for checking scale.
 */
function Lineup() {
  const heading = useRef(Math.PI / 2)
  const moving = useRef(false)
  const unit = 1 / millimetresPerUnit
  let cursor = 0
  const spots = lineup.map((animal) => {
    const kind = paperKinds[animal]
    const length = realAdultLengthMm[kind] * unit
    const x = cursor + length / 2
    cursor += length + 6 * unit
    return { animal, x, y: kind === 'flea' ? 0.06 : 0 }
  })
  const middle = cursor / 2
  return <Canvas dpr={[1, 2]} camera={{ position: [middle, cursor * 0.18, cursor * 1.4], fov: 30 }} frameloop={still ? 'demand' : 'always'}>
    <color attach="background" args={['#efe6d2']} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[2, 4, 5]} intensity={1.4} />
    <mesh position={[middle, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[cursor + 1, 1.5]} /><meshStandardMaterial color="#e4d6b8" /></mesh>
    {Array.from({ length: Math.ceil(cursor / unit) + 1 }, (_, mm) => (
      <mesh key={mm} position={[mm * unit, -0.03 - (mm % 10 === 0 ? 0.06 : mm % 5 === 0 ? 0.035 : 0.0175), 0.3]}>
        <boxGeometry args={[0.008, mm % 10 === 0 ? 0.12 : mm % 5 === 0 ? 0.07 : 0.035, 0.001]} /><meshBasicMaterial color="#5b4a3a" />
      </mesh>
    ))}
    <mesh position={[cursor / 2, -0.03, 0.3]}><boxGeometry args={[cursor + 0.008, 0.008, 0.001]} /><meshBasicMaterial color="#5b4a3a" /></mesh>
    <Suspense fallback={null}>
      {spots.map(({ animal, x, y }) => <group key={animal} position={[x, y, 0]} rotation={[0, heading.current, 0]} scale={paperRealScale(animal)}>
        <PaperAnimal animal={animal} base={0} heading={heading} moving={moving} speed={1} health={1} juvenile={false} feeding={false} />
      </group>)}
    </Suspense>
    <OrbitControls makeDefault target={[middle, 0.15, 0]} />
  </Canvas>
}

function Lab() {
  if (query.get('animal') === 'all') return <Lineup />
  const heading = useRef(Math.PI / 2 + 0.25)
  const moving = useRef(true)
  const bug: [number, number] = [1.0, 0.9]
  const subject = useMemo(() => new Vector3(bug[0], soilTop(bug[0], bug[1]) + 0.12, bug[1]), [])
  return <Canvas shadows={semi ? 'soft' : true} dpr={[1, 2]} camera={{ position: view.position, fov: view.fov }} gl={{ antialias: true }} frameloop={still ? 'demand' : 'always'}>
    <Environment files={scanned ? `${ph}artist_workshop/artist_workshop_1k.hdr` : `${import.meta.env.BASE_URL}assets/lab/apartment.exr`} background backgroundBlurriness={semi ? 0.85 : 0.55} backgroundIntensity={0.9} environmentIntensity={0.8} />
    <directionalLight position={semi && !afternoon ? [10, 16, -8] : [-12, 14, -10]} intensity={semi && !afternoon ? 2.2 : 2.6} color={semi && !afternoon ? '#f2f4ff' : '#ffe2b8'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={12} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
    {semi && <hemisphereLight args={[afternoon ? '#fff1d6' : '#e4f0ff', '#5a4632', afternoon ? 0.55 : 0.7]} />}
    <Window />
    <Suspense fallback={null}>
      {scanned ? <><ScannedSill /><ScannedSubstrate /><ScannedStone /></> : <><Sill /><Substrate /><Stone /></>}
      <Moss x={-0.2} z={-1.6} radius={1.5} count={14000} />
      <Moss x={2.0} z={-0.4} radius={0.9} count={6000} />
      {semi && <>
        {/* Reference: moss covers most of the floor, with a clear patch of soil where the woodlouse walks. */}
        <Moss x={-2.2} z={1.0} radius={1.1} count={7000} />
        <Moss x={0.3} z={2.5} radius={0.95} count={6000} />
        <Moss x={2.5} z={1.9} radius={0.8} count={4500} />
        <Moss x={-0.7} z={0.5} radius={0.55} count={2500} />
        <Moss x={-2.7} z={-1.4} radius={0.8} count={4000} />
        <MossSprigs x={0} z={0} radius={3.5} count={260} flat scale={0.6} ground={soilTop} />
        <Fern x={0.1} z={-0.3} ground={soilTop} />
        {/* Owner: the hand-drawn leaf and twig did not match the scanned set, so these are Poly Haven CC0 scans too. */}
        <ScannedProp file="dry_quiver_leaf/dry_quiver_leaf_1k.gltf" node="dry_quiver_leaf_a" x={0.15} z={1.05} length={0.95} turn={0.4} ground={soilTop} />
        <ScannedProp file="dry_quiver_leaf/dry_quiver_leaf_1k.gltf" node="dry_quiver_leaf_a" x={2.0} z={0.75} length={0.8} turn={-1.6} ground={soilTop} />
        <ScannedProp file="dry_quiver_leaf/dry_quiver_leaf_1k.gltf" node="dry_quiver_leaf_a" x={1.9} z={-1.6} length={0.8} turn={-0.9} ground={soilTop} />
        <ScannedProp file="dry_branches_medium_01/dry_branches_medium_01_1k.gltf" node="dry_branches_medium_01_c" x={0.4} z={0.2} length={1.3} turn={0.3} ground={soilTop} />
      </>}
    </Suspense>
    {!scanned && <Grit count={260} />}
    {lineup.map((animal, index) => {
      const x = bug[0] + (index - (lineup.length - 1) / 2) * 0.9, z = bug[1]
      return <group key={animal} position={[x, soilTop(x, z) - (scanned ? 0.05 : 0), z]} rotation={[0, heading.current, 0]} scale={paperRealScale(animal)}>
        {semi && <ContactBlob width={0.85} depth={0.32} />}
        <PaperAnimal animal={animal} base={0} heading={heading} moving={moving} speed={1} health={1} juvenile={false} feeding={false} />
      </group>
    })}
    <Jar />
    <OrbitControls makeDefault target={view.target} minDistance={1.1} maxDistance={40} enableDamping />
    <MagnifierRig subject={subject} />
  </Canvas>
}

createRoot(document.getElementById('lab')!).render(<Lab />)
