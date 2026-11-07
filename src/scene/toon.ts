import { ShaderChunk } from 'three'

/*
 * Toon light for the natural look (owner's art direction 2026-11-07, Codex review: "use a softly
 * stepped three-band ramp on plants, terrain, rocks and wood"). Instead of patching every material,
 * the direct-light term of three's standard and Lambert lighting is remapped once, before any shader
 * compiles: light falls off in three soft bands (lit, half-lit, shade) rather than a smooth gradient,
 * which is what gives stylized 3D games their painted, cel-shaded read. Specular highlights are
 * softened the same way. Shadows and fill light are unchanged, so shade never goes black.
 */
const smooth = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );'
const banded = `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	dotNL = 0.18 * smoothstep( 0.0, 0.06, dotNL ) + 0.42 * smoothstep( 0.18, 0.28, dotNL ) + 0.4 * smoothstep( 0.55, 0.66, dotNL );`

let applied = false
export function applyToonLighting() {
  if (applied) return
  applied = true
  ShaderChunk.lights_physical_pars_fragment = ShaderChunk.lights_physical_pars_fragment.replace(smooth, banded)
  ShaderChunk.lights_lambert_pars_fragment = ShaderChunk.lights_lambert_pars_fragment.replace(smooth, banded)
}
