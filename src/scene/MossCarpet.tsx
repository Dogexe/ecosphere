import { useMemo } from 'react'
import { Color, DoubleSide, ShaderMaterial } from 'three'
import type { BufferGeometry } from 'three'
import { environmentScale } from './scale'
import { MossTufts, mossCover, mossNoise } from './MossTufts'

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
const furLayers = 0

const common = /* glsl */ `
  uniform float waterY;
  // Hoskins' hash (no large sin arguments), identical in MossTufts' JS so tufts sit on the blanket.
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float cover(vec3 world, vec3 n) {
    float patchMask = noise(world.xz * 0.8) * 0.7 + noise(world.xz * 2.1) * 0.3;
    float c = smoothstep(0.38, 0.48, patchMask);
    c *= smoothstep(waterY, waterY + 0.12, world.y);          // none under or just above the water
    c *= smoothstep(0.45, 0.7, n.y);                           // none on steep banks
    c *= 1.0 - smoothstep(3.45, 3.7, length(world.xz));        // tucks down at the glass
    return c;
  }
  float thickness(vec3 world, vec3 n) {
    // Clumps about 5-10 mm across, rounded on top, with deep gaps between them.
    // Broad soft cushions (Codex moss loop r1: 60% lower, rounded, no ridges).
    // Small tight cushions (Codex moss loop r2: 40% amplitude, 2.5x frequency); MossTufts sits on top.
    // Overlapping rounded cushions about 2-3 tufts across (Codex moss loop r3).
    // Clustered domes 4-8 tufts across, 2-3 tufts high (Codex moss loop r4).
    float lumps = noise(world.xz * 1.8) * 0.75 + noise(world.xz * 4.5) * 0.25;
    return cover(world, n) * (0.03 + 0.2 * smoothstep(0.3, 0.8, lumps));
  }
`

function material(fur: number) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      waterY: { value: environmentScale.pondSurfaceY + 0.02 },
      fur: { value: fur },
      shade: { value: new Color('#2f3f12') },
      body: { value: new Color('#425719') },
      lit: { value: new Color('#5f7a18') },
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
        float lift = t + (fur > 0.0 ? fur * 0.07 : 0.0) - (t < 0.005 ? 0.02 : 0.0);
        vec4 moved = vec4(world + n * lift, 1.0);
        vWorld = moved.xyz; vNormal = bumped; vCover = cover(world, n); vThick = t;
        gl_Position = projectionMatrix * viewMatrix * moved;
      }`,
    fragmentShader: `
      uniform float fur; uniform vec3 shade; uniform vec3 body; uniform vec3 lit;
      ${common}
      varying vec3 vWorld; varying vec3 vNormal; varying float vCover; varying float vThick;
      void main() {
        if (vCover < 0.08 || vThick < 0.012) discard;
        if (fur > 0.0) {
          // Short fuzz: fine strands, thinner toward the top shell.
          // Seen edge-on, shells read as curtains: keep the fuzz on faces turned to the eye.
          if (abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld))) < 0.2) discard;
          // Small leafy sprays: 5-9 tapered strokes radiating from each tuft centre.
          vec2 cell = vWorld.xz * 62.0;
          vec2 id = floor(cell), f = fract(cell) - 0.5;
          float h = hash(id);
          float arms = 5.0 + floor(h * 5.0);
          float angle = atan(f.y, f.x) + h * 6.283;
          float stroke = pow(abs(cos(angle * arms * 0.5)), 6.0);
          float reach = (0.18 + 0.32 * stroke) * (1.0 - fur * 0.55);
          if (h < fur * 0.45 || length(f) > reach) discard;
        }
        // Two soft toon bands from the mound's normal, light from above and the window side.
        float facing = dot(normalize(vNormal), normalize(vec3(-0.35, 1.0, 0.25)));
        // Warm three-tone ramp with soft (about 20%) transitions.
        float tone = smoothstep(0.2, 0.55, facing) * 0.5 + smoothstep(0.6, 0.95, facing) * 0.5 + fur * 0.2;
        vec3 colour = tone < 0.5 ? mix(shade, body, tone * 2.0) : mix(body, lit, (tone - 0.5) * 2.0);
        float band = 0.82 + 0.18 * smoothstep(0.3, 0.7, facing);
        // Crevices between clumps stay dark, crowns catch the light.
        float crown = smoothstep(0.05, 0.13, vThick);
        colour *= band * (0.82 + 0.22 * crown) * (0.94 + 0.1 * noise(vWorld.xz * 4.0));
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/** The blanket's thickness at a world point, as the shader computes it (for seating the tufts). */
const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
export const blanketLift = (x: number, y: number, z: number, ny: number) => {
  const lumps = mossNoise(x * 1.8, z * 1.8) * 0.75 + mossNoise(x * 4.5, z * 4.5) * 0.25
  return mossCover(x, y, z, ny) * (0.03 + 0.2 * smooth(0.3, 0.8, lumps))
}

export function MossCarpet({ geometry, floor }: { geometry: BufferGeometry; floor: number }) {
  const materials = useMemo(() => [material(0), ...Array.from({ length: furLayers }, (_, index) => material((index + 1) / furLayers))], [])
  return <>
    {materials.map((m, index) => <mesh key={index} geometry={geometry} material={m} raycast={() => undefined} receiveShadow={index === 0} />)}
    <MossTufts surface={geometry} floor={floor} lift={blanketLift} />
  </>
}
