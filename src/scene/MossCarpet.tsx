import { Suspense, useEffect, useMemo, useState } from 'react'
import { Color, DoubleSide, ShaderMaterial } from 'three'
import type { BufferGeometry } from 'three'
import { environmentScale } from './scale'
import { Vector3 } from 'three'
import { MossTufts, mossCover, mossHash, mossNoise, tuftKind } from './MossTufts'
import { MossTuftField, tuftVariants } from './MossTuftAsset'
import type { TuftSpot } from './MossTuftAsset'

/*
 * Moss for the natural look (owner's moss reference, 2026-11-07): thick, soft, rounded mounds of moss
 * that roll over the land in lumpy waves, lit yellow-green on top and shaded olive underneath, with a
 * short fuzz only at the surface. Built on the ground surface in the vertex shader:
 *
 * - a solid blanket: the ground pushed up along its normal by a lumpy thickness (two octaves of smooth
 *   noise, faded out in bare patches, under the pond, on steep banks and at the glass), with the normal
 *   tilted by the thickness gradient so the mounds shade as mounds;
 * - a few fur shells just above the blanket, cut by a fine noise, so the surface reads soft.
 *
 * Toon light: two soft bands from the mound's own normal. Visual only.
 */
const furLayers = 6
/** With the modelled 3D tufts the tufts are the cushions, so the blanket under them stays low. */
const domeScale = tuftKind === 'glb' ? 0.35 : 1

const common = /* glsl */ `
  uniform float waterY;
  uniform float domes;
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float cover(vec3 world, vec3 n) {
    float patchMask = noise(world.xz * 0.8) * 0.7 + noise(world.xz * 2.1) * 0.3;
    float c = smoothstep(0.36, 0.6, patchMask);   // gentle cushion edges, no cliffs
    c *= smoothstep(waterY, waterY + 0.12, world.y);          // none under or just above the water
    c *= smoothstep(0.75, 0.9, n.y);                           // none on steep banks
    c *= 1.0 - smoothstep(3.68, 3.8, length(world.xz));        // runs to the glass
    return c;
  }
  float thickness(vec3 world, vec3 n) {
    // Clumps about 5-10 mm across, rounded on top, with deep gaps between them.
    // Separate rounded cushions with creases between them (Codex, 2026-11-08): each jittered cell is a dome.
    vec2 q = world.xz * 2.4, qi = floor(q); float nearest = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)); vec2 c = o + 0.5 + 0.4 * (vec2(hash(qi + o), hash(qi + o + 17.0)) - 0.5); nearest = min(nearest, length(c - fract(q))); }
    float dome = sqrt(max(0.0, 1.0 - pow(nearest / 0.72, 2.0)));
    float lumps = dome * 0.8 + noise(world.xz * 9.0) * 0.2;
    return cover(world, n) * (0.05 + 0.22 * lumps) * domes;
  }
`

function material(fur: number) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      waterY: { value: environmentScale.pondSurfaceY + 0.02 },
      domes: { value: domeScale },
      fur: { value: fur },
      shade: { value: new Color('#24440f') },
      // Under the modelled tufts the blanket is the shaded floor between cushions: a warm olive.
      lit: { value: new Color(tuftKind === 'glb' ? '#6e8a26' : '#93bf34') },
      brown: { value: 0 },
    },
    vertexShader: `
      uniform float fur;
      ${common}
      varying vec3 vWorld; varying vec3 vNormal; varying float vCover; varying float vThick;
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 n = normalize(mat3(modelMatrix) * normal);
        float t = thickness(world, n);
        // Tilt the normal by the thickness gradient, so mounds are lit on top and shaded at their foot.
        float e = 0.02;
        float tx = thickness(world + vec3(e, 0.0, 0.0), n), tz = thickness(world + vec3(0.0, 0.0, e), n);
        vec3 bumped = normalize(n - vec3((tx - t) / e, 0.0, (tz - t) / e) * 1.4);
        float lift = t + (fur > 0.0 ? fur * 0.07 * domes : 0.0) - (t < 0.005 ? 0.02 : 0.0);
        vec4 moved = vec4(world + n * lift, 1.0);
        vWorld = moved.xyz; vNormal = bumped; vCover = cover(world, n); vThick = t;
        gl_Position = projectionMatrix * viewMatrix * moved;
      }`,
    fragmentShader: `
      uniform float fur; uniform vec3 shade; uniform vec3 lit; uniform float brown;
      ${common}
      varying vec3 vWorld; varying vec3 vNormal; varying float vCover; varying float vThick;
      void main() {
        if (vCover < 0.08 || vThick < 0.012) discard;
        if (fur > 0.0) {
          // Short fuzz: fine strands, thinner toward the top shell.
          // Fur only on gently sloping crowns: on the mounds' front faces it read as vertical curtains (Codex).
          if (normalize(vNormal).y < 0.72) discard;
          // Shell fur seen at a grazing angle stacks into a vertical curtain (owner/Codex): fade the
          // outer shells out as the view flattens, so only the base blanket shows edge-on.
          float facingView = abs(dot(normalize(cameraPosition - vWorld), normalize(vNormal)));
          if (facingView < 0.25 + fur * 0.45) discard;
          vec2 cell = vWorld.xz * 38.0;
          if (hash(floor(cell)) < fur * 0.8 || length(fract(cell) - 0.5) > 0.5 - fur * 0.3) discard;
        }
        // Two soft toon bands from the mound's normal, light from above and the window side.
        float facing = dot(normalize(vNormal), normalize(vec3(-0.35, 1.0, 0.25)));
        float band = 0.55 + 0.25 * smoothstep(0.35, 0.5, facing) + 0.2 * smoothstep(0.75, 0.85, facing);
        vec3 colour = mix(shade, lit, smoothstep(0.4, 0.95, facing) * 0.8 + fur * 0.25);
        // Crevices between clumps stay dark, crowns catch the light.
        float crown = smoothstep(0.06, 0.22, vThick);
        colour *= band * (0.6 + 0.45 * crown) * (0.92 + 0.12 * noise(vWorld.xz * 4.0));
        // Drying moss (the sim's soil moisture, JarSetting): toward straw brown, keeping its light and shade.
        colour = mix(colour, vec3(0.5, 0.4, 0.2) * (0.4 + 1.6 * dot(colour, vec3(0.3, 0.59, 0.11))), brown);
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/** The mound thickness the shader computes, for seating moss sprigs on the crowns. */
export const blanketLift = (x: number, y: number, z: number, ny: number, domes = domeScale) => {
  const qx = x * 2.4, qz = z * 2.4, ix = Math.floor(qx), iz = Math.floor(qz)
  let nearest = 9
  for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) {
    const cx = i + 0.5 + 0.4 * (mossHash(ix + i, iz + j) - 0.5), cz = j + 0.5 + 0.4 * (mossHash(ix + i + 17, iz + j + 17) - 0.5)
    nearest = Math.min(nearest, Math.hypot(cx - (qx - ix), cz - (qz - iz)))
  }
  const dome = Math.sqrt(Math.max(0, 1 - (nearest / 0.72) ** 2))
  const lumps = dome * 0.8 + mossNoise(x * 9, z * 9) * 0.2
  return mossCover(x, y, z, ny) * (0.05 + 0.22 * lumps) * domes
}

/** Moss condition at a ground point, from the simulation's soil (JarSetting): 0..1 browning and tuft cover. */
export type MossState = (x: number, z: number) => { brown: number; cover: number }

/**
 * One modelled 3D tuft (MossTuftAsset) on the crown of each moss cushion cell of the blanket, so the
 * blanket's lumps are real overlapping leafy tufts close up and at the overview. Browning and cover
 * follow the local soil's moss moisture fit.
 */
function crownSpots(surface: BufferGeometry, floor: number, state?: MossState): TuftSpot[] {
  const position = surface.getAttribute('position'), normal = surface.getAttribute('normal')
  // Coarse buckets of surface vertices to find the ground under a cell centre.
  const bucket = new Map<string, number[]>(), key = (x: number, z: number) => `${Math.floor(x * 4)},${Math.floor(z * 4)}`
  for (let v = 0; v < position.count; v += 1) { const k = key(position.getX(v), position.getZ(v)); const list = bucket.get(k); if (list) list.push(v); else bucket.set(k, [v]) }
  const spots: TuftSpot[] = []
  for (let iz = -10; iz <= 10; iz += 1) for (let ix = -10; ix <= 10; ix += 1) {
    const x = (ix + 0.5 + 0.4 * (mossHash(ix, iz) - 0.5)) / 2.4, z = (iz + 0.5 + 0.4 * (mossHash(ix + 17, iz + 17) - 0.5)) / 2.4
    let best = -1, distance = Infinity
    for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) for (const v of bucket.get(`${Math.floor(x * 4) + dx},${Math.floor(z * 4) + dz}`) ?? []) {
      const d = Math.hypot(position.getX(v) - x, position.getZ(v) - z); if (d < distance) { distance = d; best = v }
    }
    if (best < 0 || distance > 0.3) continue
    const y = position.getY(best), ny = normal.getY(best)
    const cover = mossCover(x, y + floor, z, ny)
    if (cover < 0.3) continue
    const local = state?.(x, z) ?? { brown: 0, cover: 1 }
    if (mossHash(ix + 5, iz + 9) > local.cover) continue
    const lift = blanketLift(x, y + floor, z, ny)
    // Fewer tall cushions among lower ones (Codex): one in four is large, the rest small and low.
    const tall = mossHash(ix + 19, iz + 23) < 0.3, size = (tall ? 0.62 : 0.5) * (0.85 + 0.3 * mossHash(ix + 3, iz + 1))
    spots.push({
      position: new Vector3(x, y + lift - 0.01 - 0.1 * size, z), normal: new Vector3(normal.getX(best), ny, normal.getZ(best)),
      yaw: mossHash(ix + 7, iz + 3) * Math.PI * 2, width: size * (0.7 + 0.3 * cover), squash: (tall ? 0.9 : 0.68) + 0.15 * mossHash(ix, iz + 11),
      variant: Math.floor(mossHash(ix + 11, iz + 2) * tuftVariants), brown: Math.min(1, local.brown * (0.8 + 0.4 * mossHash(ix + 2, iz + 8))),
      light: 0.92 + 0.16 * mossHash(ix + 13, iz + 4),
    })
    // Low outlying tufts around the cushion (Codex: taper the edge into scattered low growth, so
    // the cushions do not sit on the ground like buns). One or two, small and flat.
    const outliers = mossHash(ix + 29, iz + 31) < 0.55 ? 2 : 1
    for (let k = 0; k < outliers; k += 1) {
      const angle = mossHash(ix + 37 + k, iz + 41) * Math.PI * 2, reach = size * (0.48 + 0.2 * mossHash(ix + k, iz + 43))
      const fx = x + Math.cos(angle) * reach, fz = z + Math.sin(angle) * reach
      let near = best, nearDistance = Infinity
      for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) for (const v of bucket.get(`${Math.floor(fx * 4) + dx},${Math.floor(fz * 4) + dz}`) ?? []) {
        const d = Math.hypot(position.getX(v) - fx, position.getZ(v) - fz); if (d < nearDistance) { nearDistance = d; near = v }
      }
      const fy = position.getY(near), fny = normal.getY(near)
      if (mossCover(fx, fy + floor, fz, fny) < 0.2) continue
      const small = size * (0.36 + 0.14 * mossHash(ix + 47 + k, iz + 53))
      spots.push({
        position: new Vector3(fx, fy + blanketLift(fx, fy + floor, fz, fny) - 0.12 * small, fz), normal: new Vector3(normal.getX(near), fny, normal.getZ(near)),
        yaw: mossHash(ix + 59 + k, iz + 61) * Math.PI * 2, width: small, squash: 0.5 + 0.15 * mossHash(ix + 67 + k, iz),
        variant: (Math.floor(mossHash(ix + 11, iz + 2) * tuftVariants) + 1 + k) % tuftVariants, brown: Math.min(1, local.brown * (0.8 + 0.4 * mossHash(ix + 71 + k, iz + 8))),
        light: 0.9 + 0.16 * mossHash(ix + 73 + k, iz + 4),
      })
    }
  }
  return spots
}

export function MossCarpet({ geometry, floor, state, stateKey = '' }: { geometry: BufferGeometry; floor: number; state?: MossState; stateKey?: string }) {
  const materials = useMemo(() => [material(0), ...Array.from({ length: furLayers }, (_, index) => material((index + 1) / furLayers))], [])
  // Seated after the ground has been written (LayeredGround's layout effect), and rebuilt only when the
  // quantized moss condition (stateKey) changes, not every sim tick.
  const [spots, setSpots] = useState<TuftSpot[]>([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tuftKind === 'glb') setSpots(crownSpots(geometry, floor, state)) }, [geometry, floor, stateKey])
  // The blanket browns with the jar's mean moss condition (sampled over the soil).
  useEffect(() => {
    let sum = 0, count = 0
    for (let x = -3; x <= 3; x += 1.5) for (let z = -3; z <= 3; z += 1.5) { sum += state?.(x, z).brown ?? 0; count += 1 }
    for (const m of materials) m.uniforms.brown.value = sum / count * 0.85
  }, [materials, stateKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    {materials.map((m, index) => <mesh key={index} geometry={geometry} material={m} raycast={() => undefined} receiveShadow={index === 0} />)}
    {/* Modelled 3D moss tufts on the cushion crowns (owner's moss brief); ?mosstuft=shoot|fern keeps the earlier sprigs. */}
    <Suspense fallback={null}>{tuftKind === 'glb' ? <MossTuftField spots={spots} /> : <MossTufts surface={geometry} floor={floor} lift={blanketLift} crownsOnly />}</Suspense>
  </>
}
