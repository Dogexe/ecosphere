import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// Small seeded value-noise toolkit for lab textures (no image downloads needed).
function random(seed: number) {
  let state = seed >>> 0
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 }
}

export function makeNoise(seed: number) {
  const rand = random(seed)
  const size = 256
  const grid = new Float32Array(size * size).map(() => rand())
  const at = (x: number, y: number) => grid[((y & 255) << 8) | (x & 255)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const value = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  return (x: number, y: number, octaves = 5) => {
    let sum = 0, amplitude = 0.5, frequency = 1, norm = 0
    for (let octave = 0; octave < octaves; octave += 1) {
      sum += value(x * frequency, y * frequency) * amplitude
      norm += amplitude
      amplitude *= 0.5
      frequency *= 2.03
    }
    return sum / norm
  }
}

type Paint = (x: number, y: number) => [number, number, number, number]

/** Builds a colour texture and a matching normal map from a height field. */
export function paintTexture(size: number, paint: Paint, strength = 2, repeat = 1) {
  const colour = document.createElement('canvas')
  colour.width = colour.height = size
  const context = colour.getContext('2d')!
  const image = context.createImageData(size, size)
  const heights = new Float32Array(size * size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, h] = paint(x / size, y / size)
      const index = (y * size + x) * 4
      image.data[index] = r; image.data[index + 1] = g; image.data[index + 2] = b; image.data[index + 3] = 255
      heights[y * size + x] = h
    }
  }
  context.putImageData(image, 0, 0)
  const normal = document.createElement('canvas')
  normal.width = normal.height = size
  const normalContext = normal.getContext('2d')!
  const normals = normalContext.createImageData(size, size)
  const height = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength
      const length = Math.hypot(dx, dy, 1)
      const index = (y * size + x) * 4
      normals.data[index] = (-dx / length * 0.5 + 0.5) * 255
      normals.data[index + 1] = (dy / length * 0.5 + 0.5) * 255
      normals.data[index + 2] = (1 / length * 0.5 + 0.5) * 255
      normals.data[index + 3] = 255
    }
  }
  normalContext.putImageData(normals, 0, 0)
  const map = new CanvasTexture(colour)
  map.colorSpace = SRGBColorSpace
  const normalMap = new CanvasTexture(normal)
  for (const texture of [map, normalMap]) {
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(repeat, repeat)
    texture.anisotropy = 8
  }
  return { map, normalMap }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number) => Math.min(255, Math.max(0, v))

/** Damp forest soil: dark brown with crumbs, fibres and pale grit. */
export function soilTexture(wetness: number) {
  const noise = makeNoise(11), crumbs = makeNoise(29), grit = makeNoise(53)
  return paintTexture(512, (x, y) => {
    const base = noise(x * 6, y * 6)
    const crumb = crumbs(x * 48, y * 48, 3)
    const speck = grit(x * 140, y * 140, 2)
    const dark = 1 - wetness * 0.45
    let r = mix(58, 92, base) * dark, g = mix(42, 66, base) * dark, b = mix(30, 44, base) * dark
    if (crumb > 0.62) { r *= 0.72; g *= 0.72; b *= 0.72 }
    if (speck > 0.8) { r = mix(r, 150, 0.6); g = mix(g, 132, 0.6); b = mix(b, 108, 0.6) }
    return [clamp(r), clamp(g), clamp(b), base * 0.6 + crumb * 0.5]
  }, 6, 3)
}

/** Weathered grey stone: fine granular speckle, soft mottling and a few lichen spots. */
export function stoneTexture() {
  const noise = makeNoise(7), grain = makeNoise(91), lichen = makeNoise(131)
  return paintTexture(1024, (x, y) => {
    const base = noise(x * 4, y * 4)
    const speck = grain(x * 260, y * 260, 2)
    const spot = lichen(x * 14, y * 14, 4)
    let tone = mix(112, 150, base) + (speck - 0.5) * 70
    let r = tone, g = tone * 0.98, b = tone * 0.94
    if (spot > 0.7) { const t = Math.min(1, (spot - 0.7) * 6) * 0.6; r = mix(r, 176, t); g = mix(g, 178, t); b = mix(b, 140, t) }
    return [clamp(r), clamp(g), clamp(b), base * 0.5 + speck * 0.5]
  }, 3, 1)
}

/** Gravel drainage layer seen through the glass: packed rounded pebbles. */
export function gravelTexture() {
  const size = 512
  const rand = random(5)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = '#6b5e50'
  context.fillRect(0, 0, size, size)
  for (let index = 0; index < 900; index += 1) {
    const x = rand() * size, y = rand() * size, radius = 6 + rand() * 14
    const tone = 120 + rand() * 90
    const gradient = context.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.1, x, y, radius)
    gradient.addColorStop(0, `rgb(${tone + 40}, ${tone + 30}, ${tone + 15})`)
    gradient.addColorStop(0.7, `rgb(${tone}, ${tone - 12}, ${tone - 28})`)
    gradient.addColorStop(1, `rgb(${tone * 0.45}, ${tone * 0.4}, ${tone * 0.35})`)
    context.fillStyle = gradient
    context.beginPath()
    context.ellipse(x, y, radius, radius * (0.65 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2)
    context.fill()
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.repeat.set(5, 1)
  return map
}

/** Horticultural charcoal band: near-black chips with glints. */
export function charcoalTexture() {
  const noise = makeNoise(77)
  const { map } = paintTexture(256, (x, y) => {
    const v = noise(x * 30, y * 10, 3)
    const glint = v > 0.72 ? 40 : 0
    return [clamp(22 + v * 30 + glint), clamp(21 + v * 28 + glint), clamp(22 + v * 26 + glint), v]
  }, 2, 1)
  map.repeat.set(6, 1)
  return map
}

/** Soil seen in cross-section through the glass, with roots. */
export function soilSideTexture() {
  const noise = makeNoise(19), roots = makeNoise(41)
  const { map } = paintTexture(512, (x, y) => {
    const v = noise(x * 12, y * 6)
    const root = Math.abs(roots(x * 6, y * 18, 3) - 0.5) < 0.012
    const r = root ? 176 : mix(44, 84, v), g = root ? 150 : mix(32, 60, v), b = root ? 110 : mix(24, 40, v)
    return [r, g, b, v]
  }, 2, 1)
  map.repeat.set(4, 1)
  return map
}

/** Light oak for the windowsill. */
export function woodTexture() {
  const noise = makeNoise(3), grain = makeNoise(17)
  return paintTexture(512, (x, y) => {
    const ring = Math.sin((y * 40 + noise(x * 2, y * 3) * 8) * Math.PI) * 0.5 + 0.5
    const fine = grain(x * 4, y * 120, 3)
    const t = ring * 0.35 + fine * 0.65
    return [clamp(mix(160, 196, t)), clamp(mix(132, 164, t)), clamp(mix(100, 126, t)), t]
  }, 1.5, 1)
}

/** Moss cushion surface: tiny leafy shoots read as dense green speckle with dark gaps. */
export function mossTexture() {
  const noise = makeNoise(303), leaf = makeNoise(307)
  return paintTexture(512, (x, y) => {
    const patch = noise(x * 5, y * 5)
    const shoot = leaf(x * 180, y * 180, 2)
    const gap = shoot < 0.32 ? 0.45 : 1
    const r = mix(52, 104, shoot) * gap, g = mix(78, 132, shoot) * gap * (0.9 + patch * 0.2), b = mix(30, 52, shoot) * gap
    return [clamp(r), clamp(g), clamp(b), shoot * 0.8 + patch * 0.2]
  }, 5, 4)
}
