import type { BufferAttribute, BufferGeometry } from 'three'

/**
 * Draw only the visible part of a square water sheet. Pond and puddle sheets are full M×M grids whose
 * vertex alpha is 0 wherever there is no water, so most of their triangles drew nothing (27k each, phase 7
 * census 2026-11-22). This keeps the quads with any alpha above zero in the index, and rebuilds it only
 * when that set changes. Call after writing the colours and before computeVertexNormals.
 */
export function trimSheet(geometry: BufferGeometry, M: number) {
  const colours = geometry.getAttribute('color') as BufferAttribute
  const alpha = colours.array as Float32Array
  const wet = (v: number) => alpha[v * 4 + 3] > 0
  const order: number[] = []
  let signature = 0
  for (let j = 0; j < M - 1; j += 1) for (let i = 0; i < M - 1; i += 1) {
    const a = j * M + i, b = a + M, c = a + 1, d = b + 1
    if (!(wet(a) || wet(b) || wet(c) || wet(d))) continue
    // Same winding as PlaneGeometry: (a, b, c) and (b, d, c).
    order.push(a, b, c, b, d, c)
    signature = (signature * 31 + a) | 0
  }
  const key = `${order.length}:${signature}`
  if (geometry.userData.trimKey === key) return
  geometry.userData.trimKey = key
  geometry.setIndex(order)
}
