import { useMemo } from 'react'
import { BufferAttribute, CatmullRomCurve3, Color, CylinderGeometry, ConeGeometry, LatheGeometry, MathUtils, TubeGeometry, Vector2, Vector3 } from 'three'
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js'
import type { Ground } from './semiReal'
import type { DecorKind } from '../sim/substrate'

/**
 * Odd objects the field goals unlock (2026-11-20): real geometry modelled from the
 * thing itself, sized on the jar's 19 mm-per-unit scale, in the soft low-poly
 * style of the rest of the jar. The fallen leaf reuses the Poly Haven scan
 * (JarSetting); everything here is procedural, so there is no new asset to license.
 *
 * - Glass marble: 16 mm (a standard "shooter" is 16-19 mm), clear glass round a twisted ribbon of colour.
 * - Snail shell: banded wood snail (Cepaea nemoralis), about 20 mm across, five dark spiral bands on cream.
 * - Acorn: English oak (Quercus robur), nut 15-25 mm long in a scaly cup.
 * - Quartz point: six-sided prisms with pyramid tips, the habit of rock crystal.
 */
const noRaycast = () => undefined
export const oddObjectSize: Partial<Record<DecorKind, number>> = { marble: 0.42, shell: 1.05, acorn: 1.0, leaf: 1.5, crystal: 1.3 }

function Marble({ size }: { size: number }) {
  const ribbon = useMemo(() => {
    const points = Array.from({ length: 9 }, (_, n) => {
      const t = n / 8, angle = t * Math.PI * 1.6
      return new Vector3(Math.cos(angle) * 0.32 * Math.sin(t * Math.PI), (t - 0.5) * 1.3, Math.sin(angle) * 0.32 * Math.sin(t * Math.PI))
    })
    return new TubeGeometry(new CatmullRomCurve3(points), 40, 0.11, 6, false)
  }, [])
  return <group position={[0, size * 0.82, 0]} scale={size}>
    <mesh geometry={ribbon} raycast={noRaycast} rotation={[0.4, 0, 0.3]}><meshStandardMaterial color="#2f7fa8" roughness={0.35} emissive="#0d3a52" emissiveIntensity={0.25} /></mesh>
    <mesh geometry={ribbon} raycast={noRaycast} rotation={[0.4, 2.1, 0.3]} scale={0.8}><meshStandardMaterial color="#e2a13c" roughness={0.35} /></mesh>
    <mesh castShadow raycast={noRaycast} renderOrder={2}>
      <sphereGeometry args={[1, 32, 20]} />
      <meshPhysicalMaterial color="#eaf6f3" transparent opacity={0.32} roughness={0.03} metalness={0} clearcoat={1} clearcoatRoughness={0.02} specularIntensity={1} depthWrite={false} />
    </mesh>
  </group>
}

/** A dextral helicoid: a growing tube coiled round a sloping axis (logarithmic spiral). */
function shellGeometry() {
  const turns = 4.2, U = turns * Math.PI * 2, growth = Math.log(14) / U
  const geometry = new ParametricGeometry((u, v, target) => {
    const angle = u * U, phi = v * Math.PI * 2, w = Math.exp(growth * (angle - U))
    const ring = 1 + 0.82 * Math.cos(phi)
    // Each whorl is the last one scaled down and lifted toward the apex.
    target.set(w * ring * Math.cos(angle), w * 0.82 * Math.sin(phi) + (1 - w) * 1.6, w * ring * Math.sin(angle))
  }, 140, 14)
  // Cream ground with five dark spiral bands, lighter toward the apex and at the lip.
  const uv = geometry.attributes.uv as BufferAttribute
  const colours = new Float32Array(uv.count * 3)
  const cream = new Color('#e8d79a'), band = new Color('#5a3a22'), apex = new Color('#c9b48a'), lip = new Color('#f4ead2')
  const colour = new Color()
  for (let k = 0; k < uv.count; k += 1) {
    const u = uv.getX(k), v = uv.getY(k)
    const ribbon = [0.08, 0.2, 0.42, 0.55, 0.68].some((centre, n) => Math.abs(v - centre) < (n < 2 ? 0.035 : 0.05))
    colour.copy(ribbon ? band : cream).lerp(apex, MathUtils.clamp(1 - u * 3, 0, 1) * 0.7)
    if (u > 0.985) colour.lerp(lip, 0.8)
    colours.set([colour.r, colour.g, colour.b], k * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!, width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
  geometry.translate(-(box.max.x + box.min.x) / 2, -box.min.y, -(box.max.z + box.min.z) / 2)
  geometry.scale(1 / width, 1 / width, 1 / width)
  return geometry
}

function Shell({ size }: { size: number }) {
  const geometry = useMemo(shellGeometry, [])
  // Lying on its side, mouth down, as an empty shell rests.
  return <mesh geometry={geometry} castShadow raycast={noRaycast} scale={size} rotation={[0, 0, Math.PI / 2 * 0.82]} position={[size * 0.32, size * 0.02, 0]}>
    <meshStandardMaterial vertexColors roughness={0.42} side={2} />
  </mesh>
}

function Acorn({ size }: { size: number }) {
  const [nut, cup] = useMemo(() => {
    const profile: Vector2[] = []
    for (let n = 0; n <= 16; n += 1) {
      const t = n / 16
      profile.push(new Vector2(0.001 + 0.32 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.75) * (t > 0.92 ? (1 - t) / 0.08 : 1), t))
    }
    const nut = new LatheGeometry(profile, 18)
    const cupProfile: Vector2[] = []
    for (let n = 0; n <= 8; n += 1) { const a = (n / 8) * Math.PI / 2; cupProfile.push(new Vector2(0.36 * Math.sin(a) + 0.001, 0.3 - 0.3 * Math.cos(a))) }
    const cup = new LatheGeometry(cupProfile.reverse(), 18)
    // Overlapping scales: push the cup's vertices out in a knobbly pattern.
    const position = cup.attributes.position as BufferAttribute
    for (let k = 0; k < position.count; k += 1) {
      const x = position.getX(k), y = position.getY(k), z = position.getZ(k)
      const bump = 1 + 0.06 * Math.sin(Math.atan2(z, x) * 9 + y * 40) * Math.sin(y * 30)
      position.setXYZ(k, x * bump, y, z * bump)
    }
    cup.computeVertexNormals()
    return [nut, cup]
  }, [])
  return <group scale={size} rotation={[0, 0, Math.PI / 2 - 0.12]} position={[0, size * 0.3, 0]}>
    <mesh geometry={nut} castShadow raycast={noRaycast} position={[0, -0.45, 0]}><meshStandardMaterial color="#a8743a" roughness={0.38} /></mesh>
    <mesh geometry={cup} castShadow raycast={noRaycast} position={[0, -0.6, 0]}><meshStandardMaterial color="#7a6646" roughness={0.95} side={2} /></mesh>
    <mesh castShadow raycast={noRaycast} position={[0, -0.66, 0]}><cylinderGeometry args={[0.03, 0.04, 0.12, 6]} /><meshStandardMaterial color="#5b4a33" roughness={0.9} /></mesh>
  </group>
}

function Crystal({ size }: { size: number }) {
  const [prism, tip] = useMemo(() => [new CylinderGeometry(1, 1, 1, 6, 1), new ConeGeometry(1, 1, 6, 1)], [])
  const points = [{ r: 0.17, h: 0.75, tilt: [0.12, 0, -0.1] }, { r: 0.12, h: 0.5, tilt: [0.5, 0.8, 0.35] }, { r: 0.09, h: 0.35, tilt: [-0.55, 2.2, -0.2] }]
  return <group scale={size}>
    {points.map(({ r, h, tilt }, n) => <group key={n} rotation={tilt as [number, number, number]} position={[n === 0 ? 0 : (n === 1 ? 0.14 : -0.12), -0.08, n === 0 ? 0 : (n === 1 ? 0.06 : 0.1)]}>
      <mesh geometry={prism} castShadow raycast={noRaycast} scale={[r, h, r]} position={[0, h / 2, 0]} renderOrder={2}>
        <meshPhysicalMaterial color="#f3f5f8" transparent opacity={0.62} roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} flatShading depthWrite={false} />
      </mesh>
      <mesh geometry={tip} castShadow raycast={noRaycast} scale={[r, r * 1.5, r]} position={[0, h + r * 0.75, 0]} renderOrder={2}>
        <meshPhysicalMaterial color="#f7f9fb" transparent opacity={0.7} roughness={0.08} clearcoat={1} flatShading depthWrite={false} />
      </mesh>
    </group>)}
  </group>
}

/** One odd object, seated on the ground at its spot. The leaf is drawn by JarSetting from its scan. */
export function OddObject({ kind, x, z, size, turn, ground }: { kind: DecorKind; x: number; z: number; size: number; turn: number; ground: Ground }) {
  const y = ground(x, z)
  return <group position={[x, y - 0.02, z]} rotation={[0, turn, 0]}>
    {kind === 'marble' ? <Marble size={size} /> : kind === 'shell' ? <Shell size={size} /> : kind === 'acorn' ? <Acorn size={size} /> : kind === 'crystal' ? <Crystal size={size} /> : null}
  </group>
}
