import { Suspense, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Environment, MeshTransmissionMaterial, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import { BufferAttribute, CanvasTexture, Mesh, RepeatWrapping, Texture, Color, CylinderGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh, Object3D, PlaneGeometry, SRGBColorSpace } from 'three'
import { PaperAnimal } from '../scene/PaperCritter'
import { charcoalTexture, gravelTexture, makeNoise, mossTexture, soilSideTexture, soilTexture, stoneTexture, woodTexture } from './proceduralTextures'

/*
 * Realism test (lab.html): one jar on a windowsill with layered substrate,
 * a stone, a moss cushion and the paper woodlouse. Nothing here touches the
 * simulation; it only shows how far the look can go in a browser.
 * World units match the game: the woodlouse is 0.64 long (about 12 mm),
 * so one unit is about 19 mm and the jar is about 15 cm across.
 */

const query = new URLSearchParams(window.location.search)
const close = query.get('shot') === 'close'
/** ?still=1 renders only when something changes (for screenshots on slow software GPUs). */
const still = query.get('still') === '1'
/** Round 2 (default) uses Poly Haven CC0 scans; ?round=1 shows the procedural first attempt. */
const scanned = query.get('round') !== '1'
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
  return set
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
    <mesh geometry={surface} receiveShadow><meshStandardMaterial {...soil} color="#9a8f84" displacementScale={0.12} displacementBias={-0.06} /></mesh>
  </group>
}

/** One rock from Poly Haven "Rock Moss Set 01" (photogrammetry scan). */
function ScannedStone() {
  const { nodes } = useGLTF(`${ph}rock_moss_set_01/rock_moss_set_01_1k.gltf`)
  const rock = nodes.rock_moss_set_01_rock01 as Mesh
  return <mesh geometry={rock.geometry} material={rock.material} position={[-1.4, soilTop(-1.4, -0.6) + 0.25, -0.6]} rotation={[0, 0.9, 0]} scale={0.95} castShadow receiveShadow />
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
      <MeshTransmissionMaterial thickness={0.2} roughness={0} ior={1.5} chromaticAberration={0.01} anisotropicBlur={0} distortion={0.02} distortionScale={0.2} backside={false} samples={4} resolution={512} side={DoubleSide} />
    </mesh>
    <mesh position={[0, 9.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[R + 0.12, 0.12, 12, 96]} />
      <meshPhysicalMaterial color="#dfe8e4" transmission={0.6} roughness={0.1} thickness={0.2} />
    </mesh>
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[R + 0.15, 96]} />
      <meshStandardMaterial color="#b7c3be" transparent opacity={0.35} roughness={0.1} />
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
    sky.addColorStop(0, '#dfeefa'); sky.addColorStop(0.5, '#f4f1e2'); sky.addColorStop(0.62, '#9fb889'); sky.addColorStop(1, '#5f7d4f')
    context.fillStyle = sky
    context.fillRect(0, 0, 512, 320)
    context.filter = 'blur(14px)'
    for (let index = 0; index < 14; index += 1) {
      context.fillStyle = index % 2 ? '#6f8f5c' : '#86a36a'
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

function Lab() {
  const heading = useRef(Math.PI / 2 + 0.25)
  const moving = useRef(true)
  const bug: [number, number] = [1.0, 0.9]
  return <Canvas shadows dpr={[1, 2]} camera={close ? { position: [1.7, 4.4, 2.9], fov: 40 } : { position: [9, 7.5, 15], fov: 32 }} gl={{ antialias: true }} frameloop={still ? 'demand' : 'always'}>
    <Environment files={scanned ? `${ph}artist_workshop/artist_workshop_1k.hdr` : `${import.meta.env.BASE_URL}assets/lab/apartment.exr`} background backgroundBlurriness={0.55} backgroundIntensity={0.9} environmentIntensity={0.8} />
    <directionalLight position={[-12, 14, -10]} intensity={2.6} color="#ffe2b8" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={12} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
    <Window />
    <Suspense fallback={null}>
      {scanned ? <><ScannedSill /><ScannedSubstrate /><ScannedStone /></> : <><Sill /><Substrate /><Stone /></>}
      <Moss x={-0.2} z={-1.6} radius={1.5} count={14000} />
      <Moss x={2.0} z={-0.4} radius={0.9} count={6000} />
    </Suspense>
    {!scanned && <Grit count={260} />}
    <group position={[bug[0], soilTop(bug[0], bug[1]), bug[1]]} rotation={[0, heading.current, 0]}>
      <PaperAnimal animal="woodlouse" base={0} heading={heading} moving={moving} speed={1} health={1} juvenile={false} feeding={false} />
    </group>
    <Jar />
    <OrbitControls target={close ? [0.9, 2.5, 0.6] : [0, 3.2, 0]} />
  </Canvas>
}

createRoot(document.getElementById('lab')!).render(<Lab />)
