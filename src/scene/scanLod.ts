import type { BufferGeometry } from 'three'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'

/**
 * Poly Haven scans carry far more triangles than a few-millimetre prop needs
 * on screen (a fallen quiver leaf is about 26 000, a pebble-sized rock up to
 * 16 000). Each source geometry is simplified once, keeping `keep` of its
 * vertices, and the result is shared by every copy. Normal maps keep the
 * surface relief on the realistic stones.
 */
const cache = new Map<BufferGeometry, Map<number, BufferGeometry>>()
export function lighter(geometry: BufferGeometry, keep: number) {
  let byKeep = cache.get(geometry)
  if (!byKeep) { byKeep = new Map(); cache.set(geometry, byKeep) }
  let light = byKeep.get(keep)
  if (!light) {
    const count = geometry.getAttribute('position').count
    try { light = count > 1500 ? new SimplifyModifier().modify(geometry, Math.floor(count * (1 - keep))) : geometry } catch { light = geometry }
    if (light !== geometry) light.computeVertexNormals()
    byKeep.set(keep, light)
  }
  return light
}
