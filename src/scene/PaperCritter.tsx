import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three'
import { bodyPath, crawlLift, legSwing, oarStroke, parseRig, placements, rigFromSvg, toLocal, unitsPerPixel } from './paperRig'
import type { PaperMotion, PaperRig } from './paperRig'
import { animalScaleMode, groundShape } from './scale'

/**
 * Paper look (prototype, `?look=paper`): hand-drawn side-view cut-outs
 * standing in the real 3D jar. Each animal is a folder of full-canvas PNG
 * layers plus rig.json (see ASSETS.md "Paper cut-out sprites"). The sheet
 * turns to face the camera, flips like card when the animal changes
 * direction, and its parts are animated in code. Visual only: nothing here
 * reads or changes the simulation.
 */
export const paperLook = (() => {
  try { return new URLSearchParams(window.location.search).get('look') === 'paper' } catch { return false }
})()
// The semi-real jar draws every animal at its real adult size.
animalScaleMode.real = paperLook

/** A layer cropped to its drawn pixels so mostly-empty canvases cost little GPU memory. */
type Sheet = { texture: CanvasTexture; left: number; top: number; width: number; height: number }
type Loaded = { rig: PaperRig; sheets: Map<string, Sheet> }

async function loadImage(url: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return image
}

/** `scale` = raster pixels per rig pixel (vector parts are drawn sharper than their rig grid). */
function crop(image: HTMLImageElement, scale = 1): Sheet {
  const full = document.createElement('canvas')
  full.width = image.naturalWidth
  full.height = image.naturalHeight
  const context = full.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const { data, width, height } = context.getImageData(0, 0, full.width, full.height)
  let left = width, right = -1, top = height, bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 8) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) { left = 0; top = 0; right = 0; bottom = 0 }
  const pad = 2
  left = Math.max(0, left - pad); top = Math.max(0, top - pad)
  right = Math.min(width - 1, right + pad); bottom = Math.min(height - 1, bottom + pad)
  const canvas = document.createElement('canvas')
  canvas.width = right - left + 1
  canvas.height = bottom - top + 1
  canvas.getContext('2d')!.drawImage(full, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return { texture, left: left / scale, top: top / scale, width: canvas.width / scale, height: canvas.height / scale }
}

/** Raster pixels per SVG unit: high enough for the magnifier view to stay crisp. */
const vectorScale = 2

/** One vector file: each `g[data-motion]` part is drawn alone at `vectorScale`. */
async function loadSvgAnimal(url: string): Promise<Loaded | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName !== 'svg') throw new Error('not an SVG')
  const box = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const groups = [...root.querySelectorAll('g[data-motion][id]')]
  const attrs = (element: Element) => Object.fromEntries([...element.attributes].map((a) => [a.name, a.value]))
  const rig = rigFromSvg({ viewBox: [box[2], box[3]], attrs: attrs(root), parts: groups.map((group) => ({ id: group.id, attrs: attrs(group) })) })
  const serializer = new XMLSerializer()
  const sheets = new Map<string, Sheet>()
  await Promise.all(groups.map(async (group) => {
    const copy = root.cloneNode(true) as Element
    copy.querySelectorAll('g[data-motion][id]').forEach((other) => { if (other.id !== group.id) other.remove() })
    copy.setAttribute('width', String(box[2] * vectorScale))
    copy.setAttribute('height', String(box[3] * vectorScale))
    const blob = URL.createObjectURL(new Blob([serializer.serializeToString(copy)], { type: 'image/svg+xml' }))
    try { sheets.set(`#${group.id}`, crop(await loadImage(blob), vectorScale)) } finally { URL.revokeObjectURL(blob) }
  }))
  return { rig, sheets }
}

const cache = new Map<string, Promise<Loaded | null>>()
function loadPaperAnimal(animal: string) {
  let pending = cache.get(animal)
  if (!pending) {
    const folder = `${import.meta.env.BASE_URL}assets/paper/${animal}/`
    pending = (async () => {
      try {
        // A vector rig (animal.svg) wins over PNG layers + rig.json.
        const vector = await loadSvgAnimal(`${folder}${animal}.svg`).catch(() => null)
        if (vector) return vector
        const response = await fetch(`${folder}rig.json`)
        if (!response.ok) return null
        const rig = parseRig(await response.json())
        const files = [...new Set(rig.parts.map((part) => part.file))]
        const images = await Promise.all(files.map((file) => loadImage(folder + file)))
        return { rig, sheets: new Map(files.map((file, index) => [file, crop(images[index])])) }
      } catch (error) {
        console.warn(`Paper ${animal} could not load`, error)
        return null
      }
    })()
    cache.set(animal, pending)
    void pending.then((value) => { if (!value && cache.get(animal) === pending) cache.delete(animal) })
  }
  return pending
}

const plane = new PlaneGeometry(1, 1)
const worldPosition = new Vector3()
const cameraRight = new Vector3()
const forward = new Vector3()
const shade = { far: '#8a8a80', near: '#ffffff' }

/** A woodlouse/caterpillar frass pellet: a tiny dark oval of paper. */
const frass = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 32; canvas.height = 32
  const context = canvas.getContext('2d')!
  context.fillStyle = '#4a3a2c'
  context.beginPath(); context.ellipse(16, 18, 13, 9, 0, 0, Math.PI * 2); context.fill()
  context.fillStyle = '#6b5644'
  context.beginPath(); context.ellipse(12, 14, 5, 3, -0.3, 0, Math.PI * 2); context.fill()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return new MeshStandardMaterial({ map: texture, alphaTest: 0.5, side: DoubleSide, roughness: 1 })
})()

/** The sleep "z": a hand-lettered paper sticker that floats up and fades. */
const zMaterial = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const context = canvas.getContext('2d')!
  context.font = 'bold 52px Georgia, serif'
  context.textAlign = 'center'; context.textBaseline = 'middle'
  context.lineWidth = 10; context.strokeStyle = '#fbf6ea'; context.strokeText('z', 32, 30)
  context.fillStyle = '#5b4a3a'; context.fillText('z', 32, 30)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return new MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, depthWrite: false, side: DoubleSide })
})()

function paperMaterial(texture: CanvasTexture, tint: string) {
  // A little self-light keeps printed colours readable in shade, like card under a lamp.
  return new MeshStandardMaterial({ map: texture, color: new Color(tint), emissiveMap: texture, emissive: new Color(tint), emissiveIntensity: 0.12, alphaTest: 0.5, side: DoubleSide, roughness: 0.95, metalness: 0 })
}

type Piece = { motion: PaperMotion; side: 'near' | 'far'; order: number }

const samplePoint = new Vector3()
const sheetScale = new Vector3()
/** Ground samples taken along the body, tail to head. */
const groundSamples = 12

/**
 * Height of the real ground under the cut-out, relative to the ground under
 * its middle, as a function of local x (tail negative, head positive). The
 * sheet's x axis is what the player sees as the body's length, so the
 * ground is sampled along it in the world (groundShape is the poured
 * heightfield the sim's animals stand on). Samples ease toward new values so
 * a walking animal settles instead of snapping. Visual only.
 */
function groundProfile(sheet: Group, facing: number, tail: number, head: number, samples: number[], ease: number) {
  sheet.getWorldScale(sheetScale)
  const scale = sheetScale.y || 1
  const sign = Math.sign(facing) || 1
  sheet.localToWorld(samplePoint.set(0, 0, 0))
  const middle = groundShape.offset(samplePoint.x, samplePoint.z)
  const span = head - tail
  const limit = span * 0.35
  for (let index = 0; index <= groundSamples; index += 1) {
    sheet.localToWorld(samplePoint.set((tail + span * index / groundSamples) * sign, 0, 0))
    const target = MathUtils.clamp((groundShape.offset(samplePoint.x, samplePoint.z) - middle) / scale, -limit, limit)
    samples[index] = samples[index] === undefined ? target : MathUtils.lerp(samples[index], target, ease)
  }
  return (x: number) => {
    const at = MathUtils.clamp((x - tail) / span, 0, 1) * groundSamples
    const low = Math.floor(at), high = Math.min(groundSamples, low + 1)
    return MathUtils.lerp(samples[low], samples[high], at - low)
  }
}

/** A crawling body bends along its length, so it gets its own finely split sheet. */
const crawlSegments = 32

/**
 * Side-view cut-out of one animal. `heading` is the parent group's current
 * yaw (the animal's smoothed heading; defaults to the parent's rotation.y);
 * the sheet cancels it to face the camera.
 * `base` is the local height of the feet, matching the 3D model it replaces.
 */
export function PaperAnimal({ animal, base, heading, moving, speed, health, juvenile, feeding, resting = false, pooping = false, courting = false, bend = 'ground' }: {
  animal: string; base: number; heading?: RefObject<number>; moving: RefObject<boolean>; speed: number; health: number; juvenile: boolean; feeding: boolean
  /** Scheduled rest from the simulation (climate.ts scheduledRest): still, antennae down, slow breaths, a paper "z". */
  resting?: boolean
  /** Waste is actually returned to the soil now (digesting gut, or a bite's waste share): drops a frass pellet now and then. */
  pooping?: boolean
  /** Woodlouse courtship from the simulation: antennae drum and the body sways toward the partner. */
  courting?: boolean
  /**
   * 'ground' lays the body on uneven ground, bending only at the rig's real
   * joints and only as far as each joint turns; 'none' for swimmers.
   */
  bend?: 'ground' | 'none'
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    let alive = true
    void loadPaperAnimal(animal).then((value) => { if (alive) setLoaded(value) })
    return () => { alive = false }
  }, [animal])
  const sheet = useRef<Group>(null)
  const flip = useRef<Group>(null)
  const pivots = useRef<(Group | null)[]>([])
  const clock = useRef(0)
  /** Behaviour clock: real time while the world runs, so eating and sleeping keep their own pace. */
  const life = useRef(0)
  const pellet = useRef<Mesh>(null)
  const snooze = useRef<Mesh>(null)
  const profile = useRef<number[]>([])
  const facing = useRef(1)
  const tint = useMemo(() => {
    const colour = new Color('#ffffff').lerp(new Color('#c9c6b2'), 1 - health)
    if (juvenile) colour.lerp(new Color('#f3eedc'), 0.5)
    return colour
  }, [health, juvenile])

  const pieces = useMemo(() => {
    if (!loaded) return []
    const { rig, sheets } = loaded
    const scale = unitsPerPixel(rig)
    const materials = new Map<string, MeshStandardMaterial>()
    return placements(rig).map(({ part, pivot, offset, order }, index) => {
      const drawn = sheets.get(part.file)!
      const key = `${part.file}:${part.side}`
      if (!materials.has(key)) materials.set(key, paperMaterial(drawn.texture, `#${new Color(part.motion === 'leg' ? shade[part.side] : '#ffffff').multiply(tint).getHexString()}`))
      const [x, y] = toLocal(rig, pivot, base)
      // Centre of the drawn pixels relative to this copy's pivot, in units.
      const centreX = (drawn.left + drawn.width / 2 + offset[0] - pivot[0]) * scale
      const centreY = (pivot[1] - (drawn.top + drawn.height / 2 + offset[1])) * scale
      // Later layers sit a hair in front so paper layers never z-fight.
      const depth = index * 0.0015 - (part.motion === 'leg' && part.side === 'far' ? 0.004 : 0)
      const bends = part.motion === 'crawl' || (part.motion === 'body' && bend === 'ground')
      const geometry = bends ? new PlaneGeometry(1, 1, crawlSegments, 1) : plane
      return { piece: { motion: part.motion, side: part.side, order } as Piece, x, y, depth, centreX, centreY, width: drawn.width * scale, height: drawn.height * scale, material: materials.get(key)!, geometry }
    })
  }, [loaded, base, tint, bend])

  const rowing = pieces.some(({ piece }) => piece.motion === 'oar')
  // Where the tail and head sit, and how tall the body is, for the pellet and the sleep "z".
  const marks = useMemo(() => {
    if (!loaded) return null
    const { rig } = loaded
    const [tail] = toLocal(rig, [rig.length.from, rig.ground], base)
    const [head] = toLocal(rig, [rig.length.to, rig.ground], base)
    const top = Math.max(base, ...pieces.filter(({ piece }) => piece.motion === 'body' || piece.motion === 'crawl').map(({ y, centreY, height }) => y + centreY + height / 2))
    const joints = rig.joints.at.map((at) => toLocal(rig, [at, rig.ground], base)[0])
    return { tail, head, top, length: rig.length.units, joints, limit: rig.joints.limit }
  }, [loaded, pieces, base])
  useFrame(({ camera }, delta) => {
    if (!sheet.current || !flip.current) return
    const walking = !!moving.current && !resting
    clock.current += Math.min(delta, 0.05) * (walking ? Math.max(speed, 1) : 0.25)
    if (speed > 0) life.current += Math.min(delta, 0.05)
    const time = clock.current, now = life.current
    // Eating: the head dips in quick nibbles. Asleep: everything slows and settles.
    const nibble = feeding && !resting ? Math.abs(Math.sin(now * 9)) : 0
    const breath = resting ? Math.sin(now * 1.1) * 0.025 : Math.sin(now * 2.2) * 0.012
    // Face the camera around the vertical axis; the parent still turns with the animal, so undo that.
    const parent = sheet.current.parent!
    const yaw = heading?.current ?? parent.rotation.y
    parent.getWorldPosition(worldPosition)
    sheet.current.rotation.y = Math.atan2(camera.position.x - worldPosition.x, camera.position.z - worldPosition.z) - yaw
    // Face left or right on screen depending on which way the animal walks.
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
    forward.set(Math.sin(yaw), 0, Math.cos(yaw))
    const side = forward.dot(cameraRight)
    if (Math.abs(side) > 0.15) facing.current = Math.sign(side)
    const factor = 1 - Math.exp(-delta * 10)
    flip.current.scale.x = MathUtils.lerp(flip.current.scale.x, facing.current, factor)
    flip.current.rotation.y = (1 - Math.abs(flip.current.scale.x)) * 0.6 * facing.current
    const stroke = rowing ? oarStroke(time, walking) : 0
    const ground = bend === 'none' || !marks ? null : groundProfile(sheet.current, flip.current.scale.x, marks.tail, marks.head, profile.current, factor)
    // Rigid plates between real joints, each joint turning only so far: legs and feelers ride along.
    const flex = ground && marks ? bodyPath(ground, marks.tail, marks.head, marks.joints, marks.limit) : null
    pieces.forEach(({ piece, x, y, centreX, width, height, geometry }, index) => {
      const pivot = pivots.current[index]
      if (!pivot) return
      if (geometry !== plane && piece.motion === 'body') {
        // The body lies along the jointed path: straight plates, bends only at joints.
        const position = geometry.attributes.position
        for (let vertex = 0; vertex < position.count; vertex += 1) {
          const u = vertex % (crawlSegments + 1) / crawlSegments
          position.setY(vertex, (vertex <= crawlSegments ? 0.5 : -0.5) + (flex ? flex(x + centreX + (u - 0.5) * width) / height : 0))
        }
        position.needsUpdate = true
      } else if (flex && piece.motion !== 'crawl') pivot.position.y = y + flex(x)
      if (piece.motion === 'crawl') {
        const position = geometry.attributes.position
        for (let vertex = 0; vertex < position.count; vertex += 1) {
          const u = vertex % (crawlSegments + 1) / crawlSegments
          // The segments bunch up where the hump passes and stretch behind it, and the head nibbles when eating.
          const bunch = walking ? Math.sin(u * Math.PI * 2.2 - time * 5 - Math.PI / 2) * 0.01 : 0
          const dip = u > 0.86 ? (u - 0.86) / 0.14 * nibble * 0.07 : 0
          const lie = flex ? flex(x + centreX + (u - 0.5) * width) / height : 0
          position.setXY(vertex, u - 0.5 + bunch, (vertex <= crawlSegments ? 0.5 : -0.5) + crawlLift(u, time, walking) - dip + lie)
        }
        position.needsUpdate = true
        pivot.scale.y = 1 + breath
        return
      }
      if (piece.motion === 'oar') { pivot.rotation.z = 0.3 - stroke * 0.75; return }
      if (piece.motion === 'leg') pivot.rotation.z = legSwing(time, piece.order, piece.side, walking)
      else if (piece.motion === 'antenna') pivot.rotation.z = resting ? -0.35 + Math.sin(now * 1.1 + piece.order) * 0.03
        : courting ? Math.sin(now * 24 + piece.order * 2) * 0.18
        : Math.sin(time * 3.1 + piece.order) * 0.12 + Math.sin(time * 7.7) * 0.05 + (feeding ? Math.sin(now * 15) * 0.1 - 0.15 : 0)
      else if (piece.motion === 'tail') pivot.rotation.z = Math.sin(time * 2.4) * 0.08
      else if (piece.motion === 'body') {
        pivot.scale.y = 1 + breath
        pivot.rotation.z = -nibble * 0.035
        pivot.position.x = courting ? Math.sin(now * 3) * 0.008 : MathUtils.lerp(pivot.position.x, 0, factor)
        pivot.position.y = y + (geometry === plane && flex ? flex(x) : 0) + (rowing ? stroke * 0.012 : walking ? Math.abs(Math.sin(time * 19)) * 0.006 : resting ? -0.004 : 0)
      }
    })
    if (marks && pellet.current) {
      // One frass pellet every few seconds: it drops from the tail end, rests, then shrinks away.
      const phase = now % 4.5, size = marks.length * 0.045
      const shown = pooping && phase < 3
      pellet.current.visible = shown
      if (shown) {
        const fall = Math.min(1, phase / 0.35)
        pellet.current.position.set(marks.tail + size, MathUtils.lerp(base + (marks.top - base) * 0.35 + (flex ? flex(marks.tail) : 0), base + size * 0.3 + (ground ? ground(marks.tail + size) : 0), fall * fall), 0.006)
        pellet.current.scale.setScalar(size * (phase > 2.4 ? (3 - phase) / 0.6 : 1))
      }
    }
    if (marks && snooze.current) {
      snooze.current.visible = resting
      if (resting) {
        const rise = (now * 0.35) % 1
        snooze.current.position.set(marks.head - marks.length * 0.1 + rise * marks.length * 0.08, marks.top + marks.length * (0.08 + rise * 0.14), 0.01)
        snooze.current.scale.setScalar(marks.length * (0.12 + rise * 0.08))
        ;(snooze.current.material as MeshBasicMaterial).opacity = Math.sin(rise * Math.PI)
      }
    }
  })

  if (!loaded) return null
  return (
    <group ref={sheet}>
      <group ref={flip}>
        {pieces.map(({ x, y, depth, centreX, centreY, width, height, material, geometry }, index) => (
          <group key={index} ref={(group) => { pivots.current[index] = group }} position={[x, y, depth]}>
            <mesh geometry={geometry} material={material} position={[centreX, centreY, 0]} scale={[width, height, 1]} castShadow />
          </group>
        ))}
        <mesh ref={pellet} geometry={plane} material={frass} visible={false} />
        <mesh ref={snooze} geometry={plane} material={zMaterial} visible={false} />
      </group>
    </group>
  )
}
