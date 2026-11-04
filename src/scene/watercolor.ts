import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial, Sphere } from 'three'
import type { Material, Object3D } from 'three'

/*
 * Watercolour paper look (owner's direction 2026-11-04, after Drawquarium):
 * the jar stays a 3D scene, but everything except soil, stone and water is
 * shaded like a watercolour on rough paper. Done in each material's own
 * shader (no extra full-screen pass), so it costs almost nothing:
 *
 * - light is softened into a few washes instead of smooth shading;
 * - shadows go a little cool and violet, as paint does;
 * - pigment pools darker toward silhouette edges;
 * - paper grain, fixed to the screen, shows through every wash.
 *
 * Materials marked `userData.realistic` (soil, stones, pebbles, water) keep
 * their physical shading. Small stylised things stop casting sun shadows,
 * since at this size the shadow map spends most of its time on them.
 */

export const markRealistic = <T extends Material>(material: T) => { material.userData.realistic = true; return material }

const chunk = /* glsl */ `
  {
    vec3 paint = gl_FragColor.rgb;
    float light = dot(paint, vec3(0.299, 0.587, 0.114));
    // Washes: pull the light toward three soft bands.
    float band = floor(light * 3.0 + 0.5) / 3.0;
    float washed = mix(light, band, 0.7);
    paint *= washed / max(light, 0.001);
    // Cool, slightly violet shadows; warm lights.
    paint = mix(paint * vec3(0.86, 0.88, 1.04), paint * vec3(1.03, 1.0, 0.95), smoothstep(0.15, 0.75, light));
    // Pigment pools at the edges of each shape.
    vec3 viewDir = normalize(vViewPosition);
    float rim = 1.0 - abs(dot(normalize(normal), viewDir));
    paint *= 1.0 - 0.42 * pow(rim, 2.0);
    // A soft pencil line where the surface turns away.
    paint *= 1.0 - 0.35 * smoothstep(0.82, 0.97, rim);
    // Paper grain: two scales of screen-space noise.
    vec2 cell = gl_FragCoord.xy;
    float fine = fract(sin(dot(floor(cell * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
    vec2 coarse = floor(cell / 7.0);
    float blot = fract(sin(dot(coarse, vec2(39.3468, 11.1351))) * 24634.6345);
    paint *= 0.93 + 0.07 * fine + 0.09 * blot;
    // A touch less saturated, like pigment on paper.
    float grey = dot(paint, vec3(0.333));
    paint = mix(vec3(grey), paint, 0.85);
    // Paper shows through thin washes.
    gl_FragColor.rgb = mix(paint, vec3(0.98, 0.95, 0.89), 0.14);
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
      .replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', tiled ? 'vec4 sampledDiffuseColor = texture2D( map, vMapUv );' : 'vec4 sampledDiffuseColor = texture2D( map, vMapUv, 2.0 );')
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
