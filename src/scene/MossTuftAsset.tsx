import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Raycaster, Vector3 } from 'three'

/*
 * 3D moss tufts (owner's moss brief, 2026-11-08). Four modelled tuft variants
 * (scripts/build_moss_tufts.py -> public/assets/organisms/moss-tuft-{1..4}.glb), each a soil plinth
 * under overlapping rounded lobes covered by real leaflet rosettes, with a close (lod0) and a far
 * (lod1) mesh. All tufts are drawn through instanced meshes, one per variant and level; each instance
 * picks its level from its own distance to the camera. Per-instance colour carries the ecology:
 * r = browning (0 green .. 1 dead brown), g = brightness. Visual only; picking stays with the
 * organisms' own independent targets.
 */
export const tuftVariants = 4
const files = Array.from({ length: tuftVariants }, (_, n) => `${import.meta.env.BASE_URL}assets/organisms/moss-tuft-${n + 1}.glb`)

const levels = 3
let cache: BufferGeometry[][] | null = null
export function useMossTufts() {
  const gltfs = useGLTF(files)
  return useMemo(() => {
    if (cache) return cache
    const byLevel: BufferGeometry[][] = Array.from({ length: levels }, () => [])
    for (const gltf of gltfs) {
      const meshes: Record<string, BufferGeometry> = {}
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((object) => { const mesh = object as Mesh; if (mesh.isMesh) meshes[mesh.name] = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld) })
      const near = meshes.lod0, set = Array.from({ length: levels }, (_, l) => meshes[`lod${l}`] ?? meshes[`lod${l - 1}`] ?? near)
      // Unit width, base at y = 0, centred: the same transform for every level so they line up.
      near.computeBoundingBox()
      const box = near.boundingBox!, width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) || 1
      const centre = new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
      for (const g of new Set(set)) {
        g.translate(-centre.x, -centre.y, -centre.z); g.scale(1 / width, 1 / width, 1 / width); g.computeBoundingSphere()
        // Light each tuft as one soft cushion: normals mostly from a point below its middle, so the toon
        // bands follow the cushion (lit crown, shaded flanks) rather than every leaflet's own facet.
        const position = g.getAttribute('position'), normal = g.getAttribute('normal'), n = new Vector3(), d = new Vector3()
        for (let v = 0; v < position.count; v += 1) {
          d.set(position.getX(v), position.getY(v) + 0.25, position.getZ(v)).normalize()
          n.set(normal.getX(v), normal.getY(v), normal.getZ(v)).lerp(d, 0.75).normalize()
          normal.setXYZ(v, n.x, n.y, n.z)
        }
      }
      set.forEach((g, l) => byLevel[l].push(g))
    }
    cache = byLevel
    return cache
  }, [gltfs])
}
files.forEach((file) => useGLTF.preload(file))

let material: MeshStandardMaterial | null = null
/** Vertex-coloured moss; instance colour r browns it toward dead moss, g scales its brightness. */
export function mossTuftMaterial() {
  if (material) return material
  material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: DoubleSide })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', /* glsl */ `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor *= color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        // Drying moss turns olive then straw-brown, keeping its light and shade (soil stays soil).
        float luma = dot(vColor, vec3(0.3, 0.59, 0.11));
        float leafy = smoothstep(0.02, 0.12, vColor.g - vColor.r);
        // Olive first (#85804A), then straw (#A49770) as it dries further (Codex review).
        float b = instanceColor.r;
        vec3 olive = vec3(0.52, 0.5, 0.29) * (0.45 + 1.6 * luma), straw = vec3(0.64, 0.59, 0.44) * (0.4 + 1.6 * luma);
        vec3 dead = mix(olive, straw, smoothstep(0.45, 1.0, b));
        vColor = mix(vColor, dead, min(1.0, b * 1.4) * leafy) * instanceColor.g;
      #endif`)
  }
  material.customProgramCacheKey = () => 'moss-tuft'
  return material
}

export interface TuftSpot {
  position: Vector3
  /** Surface normal the tuft leans toward (only partly: moss grows up). */
  normal?: Vector3
  yaw: number
  /** Width in world units; the tuft is about 0.4-0.5 of this tall. */
  width: number
  /** Extra vertical squash (1 = as modelled). */
  squash?: number
  variant: number
  /** 0 healthy green .. 1 dead brown. */
  brown: number
  /** Brightness multiplier, about 1. */
  light?: number
}

const up = new Vector3(0, 1, 0)

/**
 * Draws a set of tuft spots with per-instance level of detail chosen by on-screen size (world width
 * over camera distance): `near` is the distance at which a 0.5-wide tuft leaves its close mesh; it
 * drops to the overview mesh at 2.5x that distance. Small outlying tufts so drop sooner.
 */
export function MossTuftField({ spots, near = 3.8, shadows = false }: { spots: TuftSpot[]; near?: number; shadows?: boolean }) {
  const geometries = useMossTufts()
  const shared = mossTuftMaterial()
  const capacity = useMemo(() => Array.from({ length: tuftVariants }, (_, v) => Math.max(1, spots.filter((spot) => spot.variant % tuftVariants === v).length)), [spots])
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const matrices = useMemo(() => spots.map((spot) => {
    const tilt = new Quaternion().setFromUnitVectors(up, (spot.normal ?? up).clone().lerp(up, 0.5).normalize())
    const turn = new Quaternion().setFromAxisAngle(up, spot.yaw)
    const height = spot.width * (spot.squash ?? 1)
    return new Matrix4().compose(spot.position, tilt.multiply(turn), new Vector3(spot.width, height, spot.width))
  }), [spots])
  const colours = useMemo(() => spots.map((spot) => new Color(Math.min(1, Math.max(0, spot.brown)), spot.light ?? 1, 0)), [spots])
  const state = useRef({ camera: new Vector3(Infinity, 0, 0), spots: null as TuftSpot[] | null, world: new Vector3(), origin: new Matrix4() })
  // Instance colours must exist before the first draw so the shader is compiled with them.
  useLayoutEffect(() => {
    meshes.current.forEach((mesh, index) => {
      if (!mesh) return
      const size = capacity[index % tuftVariants]
      if (!mesh.instanceColor || mesh.instanceColor.count < size) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(size * 3), 3)
      mesh.count = 0
    })
    state.current.spots = null
  }, [capacity])
  useFrame(({ camera }) => {
    const s = state.current, first = meshes.current[0]
    if (!first) return
    first.parent?.updateWorldMatrix(true, false)
    const origin = first.parent?.matrixWorld ?? s.origin
    // Re-sort only when the camera moved noticeably or the spots changed.
    const local = s.world.copy(camera.position)
    if (s.spots === spots && local.distanceToSquared(s.camera) < 0.04) return
    s.camera.copy(local); s.spots = spots
    const counts = new Array(tuftVariants * levels).fill(0)
    const scale = origin.getMaxScaleOnAxis(), close = 0.5 / near, mid = close * 0.4
    const p = new Vector3()
    spots.forEach((spot, i) => {
      const variant = spot.variant % tuftVariants
      p.copy(spot.position).applyMatrix4(origin)
      const size = spot.width * scale / Math.max(0.01, p.distanceTo(camera.position))
      const level = size > close ? 0 : size > mid ? 1 : 2
      const mesh = meshes.current[level * tuftVariants + variant]
      if (!mesh) return
      const n = counts[level * tuftVariants + variant]++
      mesh.setMatrixAt(n, matrices[i])
      mesh.setColorAt(n, colours[i])
    })
    meshes.current.forEach((mesh, index) => {
      if (!mesh) return
      mesh.count = counts[index]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  })
  return <>
    {geometries.flatMap((level, l) => level.map((geometry, v) => <instancedMesh key={`${l}:${v}:${capacity[v]}`} ref={(mesh) => { meshes.current[l * tuftVariants + v] = mesh }} args={[geometry, shared, capacity[v]]} castShadow={shadows && l === 0} receiveShadow raycast={() => undefined} />))}
  </>
}

const hash = (n: number, k: number) => { const s = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s) }

/**
 * A living moss plant from the simulation drawn as a clump of tufts inside its plant footprint
 * (plantDimensions.moss: about 0.72 wide, 0.17 tall). `cover` (biomass / capacity) sets how many
 * tufts of the clump have grown; `health` (the plant's habitat fit, 0..1) browns them as it falls.
 * The plant's own growth scale is applied by its parent group.
 */
export function MossClump({ seed, cover, health, spread, height }: { seed: number; cover: number; health: number; spread: number; height: number }) {
  const grown = Math.max(1, Math.min(6, 1 + Math.round(Math.max(0, cover) * 5)))
  const brown = Math.round(Math.min(1, Math.max(0, 1 - health)) * 20) / 20
  const spots = useMemo(() => Array.from({ length: grown }, (_, k) => {
    const angle = k * 2.39996 + seed, reach = k === 0 ? 0 : spread * (0.18 + 0.1 * hash(seed, k))
    const width = spread * (k === 0 ? 0.62 : 0.42 + 0.12 * hash(seed, k + 9))
    return {
      position: new Vector3(Math.cos(angle) * reach, -0.045 * width, Math.sin(angle) * reach),
      yaw: hash(seed, k + 3) * Math.PI * 2, width, squash: height / (width * 0.45),
      variant: (seed + k) % tuftVariants, brown: Math.min(1, brown * (0.85 + 0.3 * hash(seed, k + 5))), light: 0.95 + 0.1 * hash(seed, k + 7),
    } satisfies TuftSpot
  }), [grown, brown, seed, spread, height])
  return <MossTuftField spots={spots} near={2.6} />
}

/**
 * Moss growing on a prop (log, stone): after the prop's meshes appear, rays are cast straight down
 * onto it on a jittered grid, and wherever its surface faces up a tuft is seated. `density` is tufts
 * per square world unit of the prop's footprint; `brown` comes from the local soil's moss fit.
 */
export function MossOnProp({ children, density = 14, width = 0.32, brown = 0, cover = 1, seed = 1 }: { children: ReactNode; density?: number; width?: number; brown?: number; cover?: number; seed?: number }) {
  const holder = useRef<Group>(null)
  const [found, setFound] = useState<{ position: Vector3; normal: Vector3 }[] | null>(null)
  const tries = useRef(0)
  useFrame(() => {
    if (found || !holder.current || tries.current > 240) return
    tries.current += 1
    const target = holder.current.children[0] as Object3D | undefined
    let meshCount = 0
    target?.traverse((object) => { if ((object as Mesh).isMesh) meshCount += 1 })
    if (!target || !meshCount) return
    holder.current.updateWorldMatrix(true, true)
    const box = new Box3().setFromObject(target)
    if (box.isEmpty()) return
    const inverse = holder.current.matrixWorld.clone().invert()
    const ray = new Raycaster(), hits: { position: Vector3; normal: Vector3 }[] = []
    const area = (box.max.x - box.min.x) * (box.max.z - box.min.z), count = Math.min(220, Math.round(area * density))
    for (let k = 0; k < count * 3 && hits.length < count; k += 1) {
      const x = box.min.x + hash(seed, k) * (box.max.x - box.min.x), z = box.min.z + hash(seed, k + 1000) * (box.max.z - box.min.z)
      ray.set(new Vector3(x, box.max.y + 1, z), new Vector3(0, -1, 0))
      const hit = ray.intersectObject(target, true)[0]
      if (!hit?.face) continue
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      if (normal.y < 0.55) continue
      hits.push({ position: hit.point.applyMatrix4(inverse), normal: normal.transformDirection(inverse) })
    }
    setFound(hits)
  })
  const spots = useMemo(() => (found ?? []).filter((_, k) => hash(seed, k + 77) < cover).map((hit, k) => ({
    position: hit.position.clone().addScaledVector(hit.normal, -0.035), normal: hit.normal, yaw: hash(seed, k + 5) * Math.PI * 2,
    width: width * (0.7 + 0.6 * hash(seed, k + 9)), squash: 0.8, variant: k % tuftVariants,
    brown: Math.min(1, brown * (0.8 + 0.4 * hash(seed, k + 3))), light: 0.92 + 0.16 * hash(seed, k + 11),
  } satisfies TuftSpot)), [found, brown, cover, seed, width])
  return <group ref={holder}>
    {children}
    {spots.length > 0 && <MossTuftField spots={spots} />}
  </group>
}

export { mossLook } from './mossLook'
