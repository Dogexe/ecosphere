import { useMemo } from 'react'
import { Color, DoubleSide, ShaderMaterial } from 'three'
import type { BufferGeometry } from 'three'
import { environmentScale } from './scale'

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

const common = /* glsl */ `
  uniform float waterY;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float cover(vec3 world, vec3 n) {
    float patchMask = noise(world.xz * 0.8) * 0.7 + noise(world.xz * 2.1) * 0.3;
    float c = smoothstep(0.3, 0.42, patchMask);
    c *= smoothstep(waterY, waterY + 0.12, world.y);          // none under or just above the water
    c *= smoothstep(0.45, 0.7, n.y);                           // none on steep banks
    c *= 1.0 - smoothstep(3.45, 3.7, length(world.xz));        // tucks down at the glass
    return c;
  }
  float thickness(vec3 world, vec3 n) {
    // Clumps about 5-10 mm across, rounded on top, with deep gaps between them.
    float lumps = noise(world.xz * 3.0) * 0.4 + smoothstep(0.25, 0.75, noise(world.xz * 9.0)) * 0.6;
    return cover(world, n) * (0.05 + 0.24 * lumps);
  }
`

function material(fur: number) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      waterY: { value: environmentScale.pondSurfaceY + 0.02 },
      fur: { value: fur },
      shade: { value: new Color('#24440f') },
      lit: { value: new Color('#a9d64a') },
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
      uniform float fur; uniform vec3 shade; uniform vec3 lit;
      ${common}
      varying vec3 vWorld; varying vec3 vNormal; varying float vCover; varying float vThick;
      void main() {
        if (vCover < 0.08 || vThick < 0.012) discard;
        if (fur > 0.0) {
          // Short fuzz: fine strands, thinner toward the top shell.
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
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

export function MossCarpet({ geometry }: { geometry: BufferGeometry }) {
  const materials = useMemo(() => [material(0), ...Array.from({ length: furLayers }, (_, index) => material((index + 1) / furLayers))], [])
  return <>{materials.map((m, index) => <mesh key={index} geometry={geometry} material={m} raycast={() => undefined} receiveShadow={index === 0} />)}</>
}
