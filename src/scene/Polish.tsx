import { Bloom, EffectComposer, N8AO, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Finishing passes for the paper look, the ones HD-2D style games lean on
 * to make drawn things sit in a 3D diorama instead of floating over it
 * (tilt-shift depth of field, bloom, light and shadow; see Wikipedia
 * "HD-2D"):
 *
 * - ambient occlusion darkens soil where plants, stones and animals touch it,
 *   which is what grounds them;
 * - soft bloom lets sunlit water and bright leaves glow a little;
 * - a tilt-shift band keeps the jar sharp and softens the near and far room,
 *   so it reads as a small diorama;
 * - a vignette pulls the eye to the jar.
 *
 * Phones get a lighter set (half-resolution AO at its cheapest quality, no
 * tilt-shift). ?polish=0 turns all of it off for comparison.
 */
export const polishLook = (() => { try { return new URLSearchParams(window.location.search).get('polish') !== '0' } catch { return true } })()

export function Polish({ light }: { light: boolean }) {
  return <EffectComposer multisampling={light ? 0 : 4} enableNormalPass={false}>
    <N8AO halfRes quality={light ? 'performance' : 'medium'} aoRadius={0.45} distanceFalloff={0.6} intensity={light ? 2.2 : 2.8} color="#1a120c" />
    <Bloom mipmapBlur intensity={0.22} luminanceThreshold={0.9} luminanceSmoothing={0.15} />
    <>{!light && <TiltShift2 blur={0.12} taper={0.6} start={[0.5, 0.0]} end={[0.5, 1.0]} />}</>
    <Vignette offset={0.32} darkness={0.55} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>
}
