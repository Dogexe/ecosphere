import { forwardRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform } from 'three'

/*
 * Underwater look (phase 2 of the target-look plan, 2026-11-22). Scene fog does not reach the soil and
 * gravel shaders, so the pond view showed dry brown bank under a black sky. This pass works on the final
 * image instead, so every material gets it:
 * - water colour thickens with distance from the camera (depth buffer), like light lost in water;
 * - a soft moving caustic net brightens near surfaces, as sunlight through a rippling surface does;
 * - the top of the view lightens toward the surface (Snell's window), and the far depths cool and darken.
 * `clarity` (0 murky .. 1 clear) comes from the pond's algae and organic matter, `light` from the daylight.
 * Presentation only.
 */
const fragment = /* glsl */ `
uniform vec3 waterColor;
uniform vec3 deepColor;
uniform float clarity;
uniform float light;
uniform float time;

float causticNet(vec2 p) {
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    float s = float(i) + 1.0;
    vec2 q = p * (1.4 + s * 0.7) + vec2(time * 0.21 * s, -time * 0.17 * s);
    sum += abs(sin(q.x + sin(q.y * 1.3 + time * 0.4)) * sin(q.y + sin(q.x * 1.1 - time * 0.3)));
  }
  return pow(1.0 - sum / 3.0, 6.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float distance = -getViewZ(depth);
  float reach = mix(0.9, 3.2, clarity);
  float haze = 1.0 - exp(-distance / reach);
  vec3 water = mix(waterColor, deepColor, smoothstep(0.35, 0.0, uv.y)) * light;
  vec3 color = inputColor.rgb;
  // Caustics fade with distance and are strongest on what is near and lit.
  float net = causticNet(uv * vec2(9.0, 5.0) + distance * 0.6);
  color += net * 0.38 * light * (1.0 - haze) * clamp(dot(color, vec3(0.33)) * 2.5, 0.0, 1.0);
  color = mix(color, water, clamp(haze, 0.0, 0.93));
  // Snell's window: the surface glows above.
  color += vec3(0.75, 0.9, 0.85) * light * smoothstep(0.62, 1.0, uv.y) * 0.28 * clarity;
  outputColor = vec4(color, inputColor.a);
}
`

class UnderwaterImpl extends Effect {
  constructor() {
    super('UnderwaterEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['waterColor', new Uniform(new Color('#6fa89a'))],
        ['deepColor', new Uniform(new Color('#2f5a5a'))],
        ['clarity', new Uniform(0.8)],
        ['light', new Uniform(1)],
        ['time', new Uniform(0)],
      ]),
    })
  }
}

export const Underwater = forwardRef<UnderwaterImpl, { clarity: number; light: number; tint: string }>(function Underwater({ clarity, light, tint }, ref) {
  const effect = useMemo(() => new UnderwaterImpl(), [])
  effect.uniforms.get('clarity')!.value = clarity
  effect.uniforms.get('light')!.value = light
  ;(effect.uniforms.get('waterColor')!.value as Color).set(tint)
  useFrame((_, delta) => { effect.uniforms.get('time')!.value += Math.min(delta, 0.05) })
  return <primitive ref={ref} object={effect} dispose={null} />
})
