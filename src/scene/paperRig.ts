/**
 * Paper cut-out rigs: an animal drawn from the side, facing right, as
 * full-canvas transparent PNG layers (one file per moving part). A small
 * rig.json says how big the drawing is in the world and where each part
 * turns. Pure data and maths only; the scene component does the drawing.
 */

/**
 * body breathes; leg steps in a back-to-front wave; antenna twitches; tail
 * sways; crawl bends one body sheet with a hump that runs tail to head (a
 * caterpillar's prolegs lift as the wave passes); oar rows with a fast
 * down-stroke and slow recovery (Daphnia swimming antennae).
 */
export type PaperMotion = 'body' | 'leg' | 'antenna' | 'tail' | 'crawl' | 'oar' | 'static'

export type PaperPart = {
  /** PNG file next to rig.json, drawn on the full canvas. */
  file: string
  motion: PaperMotion
  /** Turning point in canvas pixels (hip, antenna base…). Body parts breathe from it. */
  pivot: [number, number]
  /** Leg only: 'far' legs sit behind the body and step in opposite phase. */
  side: 'near' | 'far'
  /** Leg only: 0 = rearmost; the step wave runs from back to front. */
  order: number
  /** Extra copies of this layer, each given by its own pivot (e.g. seven identical legs). */
  repeat: [number, number][]
}

export type PaperRig = {
  canvas: [number, number]
  /** Tail tip and head tip in canvas x pixels, and the real length between them in world units. */
  length: { from: number; to: number; units: number }
  /** Canvas y of the feet (the ground line). */
  ground: number
  parts: PaperPart[]
}

const motions: PaperMotion[] = ['body', 'leg', 'antenna', 'tail', 'crawl', 'oar', 'static']
const fail = (why: string) => new Error(`Paper rig: ${why}`)

function point(value: unknown, width: number, height: number, label: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((n) => typeof n === 'number' && Number.isFinite(n))) throw fail(`${label} must be [x, y]`)
  const [x, y] = value as [number, number]
  if (x < 0 || x > width || y < 0 || y > height) throw fail(`${label} is outside the canvas`)
  return [x, y]
}

export function parseRig(value: unknown): PaperRig {
  if (!value || typeof value !== 'object') throw fail('not an object')
  const source = value as Record<string, unknown>
  const canvas = source.canvas
  if (!Array.isArray(canvas) || canvas.length !== 2 || !canvas.every((n) => Number.isInteger(n) && n > 0 && n <= 4096)) throw fail('canvas must be [width, height] up to 4096')
  const [width, height] = canvas as [number, number]
  const length = source.length as Record<string, unknown> | undefined
  if (!length || typeof length.from !== 'number' || typeof length.to !== 'number' || typeof length.units !== 'number' || !(length.to > length.from) || !(length.units > 0)) throw fail('length needs from < to and units > 0')
  if (typeof source.ground !== 'number' || source.ground < 0 || source.ground > height) throw fail('ground must be inside the canvas')
  if (!Array.isArray(source.parts) || !source.parts.length || source.parts.length > 64) throw fail('parts must list 1 to 64 layers')
  const parts = source.parts.map((raw, index): PaperPart => {
    if (!raw || typeof raw !== 'object') throw fail(`part ${index} is not an object`)
    const part = raw as Record<string, unknown>
    if (typeof part.file !== 'string' || !/^([\w-]+\.png|#[\w-]+)$/.test(part.file)) throw fail(`part ${index} needs a plain .png file name or an SVG #id`)
    const motion = (part.motion ?? 'static') as PaperMotion
    if (!motions.includes(motion)) throw fail(`part ${index} has unknown motion "${String(part.motion)}"`)
    const repeat = part.repeat === undefined ? [] : Array.isArray(part.repeat) ? part.repeat.map((item, copy) => point(item, width, height, `part ${index} repeat ${copy}`)) : null
    if (!repeat) throw fail(`part ${index} repeat must be a list of [x, y]`)
    return {
      file: part.file,
      motion,
      pivot: part.pivot === undefined ? [width / 2, source.ground as number] : point(part.pivot, width, height, `part ${index} pivot`),
      side: part.side === 'far' ? 'far' : 'near',
      order: typeof part.order === 'number' && Number.isFinite(part.order) ? part.order : 0,
      repeat,
    }
  })
  return { canvas: [width, height], length: { from: length.from, to: length.to, units: length.units }, ground: source.ground, parts }
}

export const unitsPerPixel = (rig: PaperRig) => rig.length.units / (rig.length.to - rig.length.from)

/**
 * Canvas pixels → the animal's local units: x along the body (0 at its
 * middle, head positive), y up from the ground line, which sits at `base`.
 */
export function toLocal(rig: PaperRig, [x, y]: [number, number], base: number): [number, number] {
  const scale = unitsPerPixel(rig)
  return [(x - (rig.length.from + rig.length.to) / 2) * scale, (rig.ground - y) * scale + base]
}

/** Every placed copy of every part, in draw order. Copies of a leg continue its order. */
export function placements(rig: PaperRig) {
  return rig.parts.flatMap((part) => [part.pivot, ...part.repeat].map((pivot, copy) => ({
    part, pivot, offset: [pivot[0] - part.pivot[0], pivot[1] - part.pivot[1]] as [number, number], order: part.order + copy,
  })))
}

/** Leg swing in radians: a back-to-front wave while walking, far legs half a step behind. */
export function legSwing(time: number, order: number, side: 'near' | 'far', walking: boolean, stride = 19) {
  if (!walking) return Math.sin(time * 1.3 + order) * 0.03
  return Math.sin(time * stride - order * 0.9 + (side === 'far' ? Math.PI : 0)) * 0.45
}

/**
 * Vector rigs: one `<animal>.svg` holds the whole animal. The root carries
 * data-length="from to units" and data-ground="y"; each moving part is a
 * `<g id data-motion data-pivot="x y">` (legs add data-side and data-order).
 * Coordinates are viewBox units. Groups without data-motion are ignored.
 */
export type SvgMeta = { viewBox: [number, number]; attrs: Record<string, string | undefined>; parts: { id: string; attrs: Record<string, string | undefined> }[] }

const numbers = (text: string | undefined) => (text ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number)

export function rigFromSvg(meta: SvgMeta): PaperRig {
  const [from, to, units] = numbers(meta.attrs['data-length'])
  const [width, height] = meta.viewBox.map((n) => Math.round(n)) as [number, number]
  return parseRig({
    canvas: [width, height],
    length: { from, to, units },
    ground: Number(meta.attrs['data-ground']),
    parts: meta.parts.map(({ id, attrs }) => {
      const pivot = numbers(attrs['data-pivot'])
      return {
        file: `#${id}`,
        motion: attrs['data-motion'],
        pivot: pivot.length === 2 ? pivot : undefined,
        side: attrs['data-side'],
        order: attrs['data-order'] === undefined ? undefined : Number(attrs['data-order']),
      }
    }),
  })
}

/** Crawl wave lift at u (0 tail .. 1 head), as a fraction of the sheet height. */
export function crawlLift(u: number, time: number, walking: boolean) {
  if (!walking) return 0
  const wave = Math.sin(u * Math.PI * 2.2 - time * 5)
  return Math.max(0, wave) ** 2 * 0.09
}

/** Oar stroke 0..1: quick power stroke (down), slow recovery. Beats slowly at rest. */
export function oarStroke(time: number, walking: boolean) {
  const phase = (time * (walking ? 2.6 : 1.3)) % 1
  return phase < 0.28 ? phase / 0.28 : 1 - (phase - 0.28) / 0.72
}
