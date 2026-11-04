import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial, Sphere } from 'three'
import type { Material, Object3D } from 'three'

/*
 * Cartoon-against-real look (owner's direction 2026-11-04, after Drawquarium):
 * the jar stays a 3D scene under dramatic light; plants, leaves, mushrooms
 * and animals are drawn as flat, bright cartoon colour with two soft tones
 * and an ink edge, while soil, stone and water stay physically lit. Done in
 * each material's own shader (no extra full-screen pass), so it costs
 * almost nothing.
 *
 * Materials marked `userData.realistic` (soil, stones, pebbles, water) keep
 * their physical shading. Small stylised things stop casting sun shadows,
 * since at this size the shadow map spends most of its time on them.
 */

export const markRealistic = <T extends Material>(material: T) => { material.userData.realistic = true; return material }

const chunk = /* glsl */ `
  {
    // Cartoon against the real scene (Drawquarium): the drawn things are
    // close to self-lit flat colour with two soft tones, so they pop out of
    // the deep shadows the real soil, stone and water fall into.
    vec3 albedo = diffuseColor.rgb;
    float base = max(dot(albedo, vec3(0.299, 0.587, 0.114)), 0.02);
    float lit = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)) / base;
    // Two soft tones, but shadow and occlusion still darken it, so it sits in the scene.
    float tone = mix(0.4, 1.04, smoothstep(0.16, 0.55, lit));
    vec3 paint = albedo * tone;
    // A little of the light's colour, so sunset still reads.
    vec3 hue = gl_FragColor.rgb / max(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)), 0.001);
    paint *= mix(vec3(1.0), hue, 0.2);
    // Brighter, more saturated colour.
    float grey = dot(paint, vec3(0.333));
    paint = mix(vec3(grey), paint, 1.25) * 1.06;
    // Ink line where the surface turns away from the eye.
    vec3 viewDir = normalize(vViewPosition);
    float rim = 1.0 - abs(dot(normalize(normal), viewDir));
    paint *= 1.0 - 0.55 * smoothstep(0.78, 0.95, rim);
    // Faint paper grain.
    float fine = fract(sin(dot(floor(gl_FragCoord.xy * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
    paint *= 0.97 + 0.05 * fine;
    gl_FragColor.rgb = paint;
  }
`

function paint(material: MeshStandardMaterial) {
  if (material.userData.watercolor || material.userData.realistic) return
  material.userData.watercolor = true
  // Paper does not need fine surface relief: drop the costly maps.
  material.normalMap = null
  material.roughnessMap = null
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    // Wash out fine texture detail by reading a blurrier mip level.
    // (Not on tiled surfaces such as the wooden sill, where it smears into streaks.)
    const tiled = !!material.map && (material.map.repeat.x > 1.01 || material.map.repeat.y > 1.01)
    shader.fragmentShader = shader.fragmentShader
      .replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', tiled ? 'vec4 sampledDiffuseColor = texture2D( map, vMapUv );' : 'vec4 sampledDiffuseColor = texture2D( map, vMapUv, 1.5 );')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${chunk}`)
  }
  const key = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${key ? key() : ''}|watercolor`
  material.needsUpdate = true
}

const sphere = new Sphere()
/** Below this world radius a stylised mesh casts no sun shadow (about 6 mm). */
const smallShadow = 0.3

function visit(object: Object3D) {
  const mesh = object as Mesh
  if (!mesh.isMesh) return
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]
  let realistic = false
  for (const material of materials) {
    if (material.userData.realistic) realistic = true
    // Glass and water stay clear: a paper tint on them would veil the whole jar.
    else if ((material as MeshStandardMaterial).isMeshStandardMaterial && !material.transparent) paint(material as MeshStandardMaterial)
  }
  if (!realistic && mesh.castShadow && !mesh.userData.keepShadow) {
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
    sphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld)
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || sphere.radius < smallShadow) mesh.castShadow = false
  }
}

/** Repaints new materials as they appear (plants grow, animals arrive) once a second. */
export function Watercolor() {
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    const run = () => scene.traverse(visit)
    run()
    const timer = window.setInterval(run, 1000)
    return () => window.clearInterval(timer)
  }, [scene])
  return null
}
