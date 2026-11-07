import { useMemo } from 'react'
import { Color, ShaderMaterial } from 'three'
import type { BufferGeometry } from 'three'
import { environmentScale } from './scale'

/*
 * Moss carpet for the natural look (owner's reference, 2026-11-07: "moss like this"): a soft, fuzzy
 * green carpet over most of the land, as in the reference concept, rather than separate lumps.
 * Shell fur: the ground surface drawn several more times, each copy lifted a little along its normal
 * and cut by a fine noise, so the layers build up tiny tufts. Patches leave some bare soil, and
 * nothing grows under the pond's water, on steep banks or in the nest windows. Colour runs from deep
 * olive at the base to warm yellow-green at the tips; light is a soft two-band ramp to match the
 * toon look. Visual only.
 */
const layers = 7
const height = 0.17

export function MossCarpet({ geometry }: { geometry: BufferGeometry }) {
  const materials = useMemo(() => Array.from({ length: layers }, (_, index) => {
    const t = (index + 1) / layers
    return new ShaderMaterial({
      uniforms: {
        layer: { value: t },
        lift: { value: t * height },
        waterY: { value: environmentScale.pondSurfaceY + 0.03 },
        base: { value: new Color('#4f7a22') },
        tip: { value: new Color('#b8dc52') },
      },
      vertexShader: `
        uniform float lift; varying vec3 vWorld; varying vec3 vNormal;
        void main() {
          vec3 p = position + normal * lift;
          vec4 world = modelMatrix * vec4(p, 1.0);
          vWorld = world.xyz; vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float layer; uniform float waterY; uniform vec3 base; uniform vec3 tip;
        varying vec3 vWorld; varying vec3 vNormal;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
        void main() {
          // Only on land above the water, on gentle slopes, inside the jar.
          if (vWorld.y < waterY || vNormal.y < 0.55 || length(vWorld.xz) > 3.72) discard;
          // Large soft patches: most of the land is mossy, a few bare spots and paths.
          float patchMask = noise(vWorld.xz * 0.9) * 0.7 + noise(vWorld.xz * 2.3) * 0.3;
          float cover = smoothstep(0.22, 0.38, patchMask);
          // Tufts: each strand is a fine cell whose height varies, thinning toward its tip.
          vec2 cell = vWorld.xz * 48.0;
          float strand = hash(floor(cell)) * cover;
          vec2 inCell = fract(cell) - 0.5;
          float radius = 0.62 * (1.0 - layer * 0.6);
          if (strand < layer || length(inCell) > radius) discard;
          // Mounded clumps: lower layers everywhere, upper layers only on clump crowns.
          if (layer > 0.5 && noise(vWorld.xz * 4.0) < (layer - 0.4) * 0.9) discard;
          vec3 colour = mix(base, tip, layer);
          colour *= 0.85 + 0.25 * noise(vWorld.xz * 3.0);
          float lit = 0.85 + 0.25 * smoothstep(0.55, 0.85, vNormal.y);
          gl_FragColor = vec4(colour * lit, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  }), [])
  return <>{materials.map((material, index) => <mesh key={index} geometry={geometry} material={material} raycast={() => undefined} renderOrder={1} />)}</>
}
