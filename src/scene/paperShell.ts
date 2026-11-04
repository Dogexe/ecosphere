import { BufferAttribute, BufferGeometry, CanvasTexture } from 'three'

/**
 * A painted side view wrapped onto a rounded 3D body ("paper 3D"): the
 * drawing's own outline gives the body's height along its length, each
 * cross-section is a half-ellipse over a flat belly, and the painting is
 * projected from the side so the near and far flanks both show it while the
 * back shows its upper rows. Seen from the side it matches the flat cut-out;
 * from any other angle it has real volume, so it can turn with the camera.
 *
 * Geometry lives in the cut-out's unit square (x, y in -0.5..0.5, scaled by
 * the mesh like the flat plane), but z is in the animal's own units, since
 * the mesh's z scale stays 1.
 */
export type Shell = {
  geometry: BufferGeometry
  /** Half-width of the body at a point along its length, u in 0..1 tail to head, in units. */
  halfWidth: (u: number) => number
  /** Base y of each vertex and its u, for bending the body along its joints each frame. */
  baseY: Float32Array
  u: Float32Array
}

/** Columns along the body and steps around each cross-section. */
const columns = 48, around = 18

export function shellGeometry(texture: CanvasTexture, widthUnits: number, halfWidthRatio: number): Shell {
  const canvas = texture.image as HTMLCanvasElement
  const { data, width, height } = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height)
  // Top and bottom of the drawing in each column, in the unit square.
  const top = new Float32Array(columns + 1), bottom = new Float32Array(columns + 1)
  let tallest = 0
  for (let column = 0; column <= columns; column += 1) {
    const x = Math.min(width - 1, Math.round(column / columns * (width - 1)))
    let first = -1, last = -1
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] < 128) continue
      if (first < 0) first = y
      last = y
    }
    if (first < 0) { first = last = Math.round(height * 0.7) }
    top[column] = 0.5 - first / height
    bottom[column] = 0.5 - last / height
    tallest = Math.max(tallest, top[column] - bottom[column])
  }
  // Half-width follows the body's height (in units), so the ends round off.
  const widest = halfWidthRatio * widthUnits
  const halfWidthAt = (column: number) => widest * Math.sqrt(Math.max(0, (top[column] - bottom[column]) / (tallest || 1)))
  const count = (columns + 1) * (around + 1)
  const positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2)
  const baseY = new Float32Array(count), us = new Float32Array(count)
  // Keep clear of the sticker's pale border on the back, which would smear across the top.
  const inset = 0.05
  for (let column = 0; column <= columns; column += 1) {
    const u = column / columns
    const rise = Math.max(0, top[column] - bottom[column])
    for (let step = 0; step <= around; step += 1) {
      const angle = step / around * Math.PI
      const lift = Math.sin(angle)
      // Texture row: part height-true (matches the side view), part angle-true (spreads the back).
      const sideways = 1 - Math.abs(angle - Math.PI / 2) / (Math.PI / 2)
      const row = bottom[column] + rise * (1 - inset) * (0.45 * lift + 0.55 * sideways)
      const index = column * (around + 1) + step
      const y = bottom[column] + rise * lift
      positions.set([u - 0.5, y, halfWidthAt(column) * Math.cos(angle)], index * 3)
      uvs.set([u, row + 0.5], index * 2)
      baseY[index] = y
      us[index] = u
    }
  }
  const indices: number[] = []
  for (let column = 0; column < columns; column += 1) {
    for (let step = 0; step < around; step += 1) {
      const a = column * (around + 1) + step, b = a + around + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return {
    geometry,
    halfWidth: (u) => halfWidthAt(Math.round(Math.min(1, Math.max(0, u)) * columns)),
    baseY,
    u: us,
  }
}
