/**
 * How moss looks for a moisture fit m (the moss moisture term of the sim's habitat fit, 0..1): it
 * browns as it dries (fully brown below ~0.05) and thins only when very dry. A fresh default jar
 * (soil water 58) gives m ~0.58: green, full cover.
 */
export function mossLook(m: number) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return { brown: clamp((0.45 - m) / 0.4), cover: 0.35 + 0.65 * clamp(m / 0.25) }
}
