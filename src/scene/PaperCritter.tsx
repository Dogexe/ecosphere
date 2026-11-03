import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, DoubleSide, Group, MathUtils, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three'

/**
 * Prototype "paper" look: hand-drawn side-view cut-outs standing in the real
 * 3D jar. The cut-out always turns to face the camera, flips like a sheet of
 * paper when the animal changes direction, and animates its separate parts
 * (legs, antennae, breathing) in code. Visual only: nothing here reads or
 * changes the simulation.
 */
export const paperLook = (() => {
  try { return new URLSearchParams(window.location.search).get('look') === 'paper' } catch { return false }
})()

type Draw = (context: CanvasRenderingContext2D, width: number, height: number) => void

function paperTexture(width: number, height: number, draw: Draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.lineJoin = 'round'
  context.lineCap = 'round'
  draw(context, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Paper border, then a soft drop shade inside the border so the sheet reads as card. */
function cutOut(context: CanvasRenderingContext2D, path: Path2D, border: number) {
  context.save()
  context.strokeStyle = '#fbf6ea'
  context.lineWidth = border * 2
  context.shadowColor = 'rgba(40, 32, 20, 0.35)'
  context.shadowBlur = border * 0.8
  context.shadowOffsetY = border * 0.35
  context.stroke(path)
  context.restore()
  context.save()
  context.fillStyle = '#fbf6ea'
  context.fill(path)
  context.restore()
}

// Body silhouette in a 1024×512 canvas: head to the right, tail to the left.
const bodyTop = (x: number) => {
  // A domed back that is highest just behind the head and tapers into the tail fan.
  const t = (x - 150) / 720
  if (t <= 0 || t >= 1) return 380
  const dome = Math.sin(Math.PI * Math.pow(t, 0.85))
  return 382 - 210 * Math.pow(dome, 0.75)
}

function woodlouseBody(context: CanvasRenderingContext2D, width: number, height: number) {
  const silhouette = new Path2D()
  silhouette.moveTo(118, 372)
  for (let x = 150; x <= 870; x += 6) silhouette.lineTo(x, bodyTop(x))
  // Head: rounded and slightly lower than the first segment.
  silhouette.bezierCurveTo(905, 250, 945, 300, 940, 352)
  silhouette.bezierCurveTo(936, 386, 900, 398, 860, 396)
  silhouette.lineTo(190, 398)
  // Uropods: two short tail spikes.
  silhouette.lineTo(150, 392)
  silhouette.lineTo(92, 404)
  silhouette.lineTo(122, 386)
  silhouette.lineTo(80, 384)
  silhouette.closePath()

  cutOut(context, silhouette, 20)

  context.save()
  context.clip(silhouette)
  const shell = context.createLinearGradient(0, 160, 0, 400)
  shell.addColorStop(0, '#b7c6c4')
  shell.addColorStop(0.45, '#869aa0')
  shell.addColorStop(1, '#55636b')
  context.fillStyle = shell
  context.fillRect(0, 0, width, height)

  // Segment plates: thirteen overlapping bands, each with a pale trailing edge.
  const edges = [150, 205, 250, 290, 330, 400, 470, 540, 610, 680, 750, 815, 870]
  edges.forEach((x, index) => {
    const next = edges[index + 1] ?? 900
    const plate = context.createLinearGradient(x, 0, next, 0)
    plate.addColorStop(0, 'rgba(225, 232, 226, 0.55)')
    plate.addColorStop(0.18, 'rgba(225, 232, 226, 0)')
    plate.addColorStop(0.85, 'rgba(20, 28, 34, 0)')
    plate.addColorStop(1, 'rgba(20, 28, 34, 0.35)')
    context.fillStyle = plate
    context.fillRect(x, 0, next - x, height)
    context.strokeStyle = 'rgba(30, 38, 44, 0.55)'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(x, bodyTop(x) - 4)
    context.quadraticCurveTo(x - 10, 300, x + 2, 400)
    context.stroke()
  })
  // Pale mottling along the back, as on common rough woodlice.
  context.fillStyle = 'rgba(232, 226, 196, 0.55)'
  for (let index = 0; index < 26; index += 1) {
    const x = 220 + ((index * 97) % 600)
    const y = bodyTop(x) + 30 + ((index * 53) % 70)
    context.beginPath()
    context.ellipse(x, y, 9 + (index % 3) * 4, 5 + (index % 2) * 3, 0.3, 0, Math.PI * 2)
    context.fill()
  }
  // Glossy highlight along the dome.
  context.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  context.lineWidth = 10
  context.beginPath()
  for (let x = 260; x <= 760; x += 10) context[x === 260 ? 'moveTo' : 'lineTo'](x, bodyTop(x) + 22)
  context.stroke()
  // Underside shadow.
  const belly = context.createLinearGradient(0, 340, 0, 400)
  belly.addColorStop(0, 'rgba(20, 24, 28, 0)')
  belly.addColorStop(1, 'rgba(20, 24, 28, 0.55)')
  context.fillStyle = belly
  context.fillRect(0, 340, width, 60)
  // Eye.
  context.fillStyle = '#15191c'
  context.beginPath()
  context.ellipse(892, 318, 15, 12, -0.3, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = 'rgba(255, 255, 255, 0.85)'
  context.beginPath()
  context.arc(897, 313, 4, 0, Math.PI * 2)
  context.fill()
  context.restore()

  context.strokeStyle = '#2b333a'
  context.lineWidth = 5
  context.stroke(silhouette)
}

function woodlouseLeg(context: CanvasRenderingContext2D, width: number) {
  // Hip at the top centre; three joints bending forward, foot at the bottom.
  const leg = new Path2D()
  const points: [number, number][] = [[width / 2, 10], [width / 2 + 12, 80], [width / 2 - 6, 160], [width / 2 + 10, 238]]
  points.forEach(([x, y], index) => index ? leg.lineTo(x, y) : leg.moveTo(x, y))
  context.strokeStyle = '#fbf6ea'
  context.lineWidth = 30
  context.stroke(leg)
  context.strokeStyle = '#4a4f4c'
  context.lineWidth = 15
  context.stroke(leg)
  context.strokeStyle = '#8f9488'
  context.lineWidth = 7
  context.stroke(leg)
  context.fillStyle = '#3a3e3b'
  points.slice(1, 3).forEach(([x, y]) => { context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill() })
}

function woodlouseAntenna(context: CanvasRenderingContext2D, width: number, height: number) {
  // Base at the bottom left; a jointed whip curving up and forward.
  const antenna = new Path2D()
  antenna.moveTo(14, height - 14)
  antenna.bezierCurveTo(width * 0.35, height * 0.65, width * 0.55, height * 0.2, width - 14, 20)
  context.strokeStyle = '#fbf6ea'
  context.lineWidth = 24
  context.stroke(antenna)
  context.strokeStyle = '#4c5652'
  context.lineWidth = 11
  context.stroke(antenna)
  context.fillStyle = '#7c867f'
  for (let index = 1; index < 6; index += 1) {
    const t = index / 6
    const x = (1 - t) ** 3 * 14 + 3 * (1 - t) ** 2 * t * width * 0.35 + 3 * (1 - t) * t ** 2 * width * 0.55 + t ** 3 * (width - 14)
    const y = (1 - t) ** 3 * (height - 14) + 3 * (1 - t) ** 2 * t * height * 0.65 + 3 * (1 - t) * t ** 2 * height * 0.2 + t ** 3 * 20
    context.beginPath(); context.arc(x, y, 6, 0, Math.PI * 2); context.fill()
  }
}

let woodlouseSheets: { body: CanvasTexture; leg: CanvasTexture; antenna: CanvasTexture } | null = null
function sheets() {
  woodlouseSheets ??= {
    body: paperTexture(1024, 512, woodlouseBody),
    leg: paperTexture(64, 256, (context, width) => woodlouseLeg(context, width)),
    antenna: paperTexture(256, 160, woodlouseAntenna),
  }
  return woodlouseSheets
}

// Sheet sizes in the woodlouse's local units (its 3D model is 0.64 long).
const bodyWidth = 0.78, bodyHeight = 0.39
const toX = (px: number) => (px / 1024 - 0.5) * bodyWidth
const toY = (py: number) => (0.5 - py / 512) * bodyHeight
const legWidth = 0.035, legHeight = 0.1
/** Lifts the sheet so the feet stand on the same ground line as the 3D model. */
const lift = 0.11
const antennaWidth = 0.2, antennaHeight = 0.125
const plane = new PlaneGeometry(1, 1)
const pivotTop = new PlaneGeometry(1, 1).translate(0, -0.5, 0)
const pivotBaseLeft = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0)
const hips = [250, 330, 410, 490, 570, 650, 730]
const worldPosition = new Vector3()
const cameraRight = new Vector3()
const forward = new Vector3()

function paperMaterial(texture: CanvasTexture, tint = '#ffffff') {
  // A little self-light keeps the printed colours readable in shade, like card under a lamp.
  return new MeshStandardMaterial({ map: texture, color: new Color(tint), emissiveMap: texture, emissive: new Color('#ffffff'), emissiveIntensity: 0.28, alphaTest: 0.5, side: DoubleSide, roughness: 0.95, metalness: 0 })
}

/**
 * Side-view woodlouse cut-out. `heading` is the parent group's current yaw
 * (the animal's smoothed heading); the sheet cancels it to face the camera.
 */
export function PaperWoodlouse({ heading, moving, speed, health, juvenile, feeding }: {
  heading: RefObject<number>; moving: RefObject<boolean>; speed: number; health: number; juvenile: boolean; feeding: boolean
}) {
  const sheet = useRef<Group>(null)
  const flip = useRef<Group>(null)
  const body = useRef<Mesh>(null)
  const head = useRef<Group>(null)
  const nearLegs = useRef<(Mesh | null)[]>([])
  const farLegs = useRef<(Mesh | null)[]>([])
  const clock = useRef(0)
  const facing = useRef(1)
  const textures = sheets()
  const tint = useMemo(() => {
    const colour = new Color('#ffffff').lerp(new Color('#c9c6b2'), 1 - health)
    if (juvenile) colour.lerp(new Color('#f3eedc'), 0.5)
    return `#${colour.getHexString()}`
  }, [health, juvenile])
  const materials = useMemo(() => ({
    body: paperMaterial(textures.body, tint),
    leg: paperMaterial(textures.leg),
    farLeg: paperMaterial(textures.leg, '#8a8a80'),
    antenna: paperMaterial(textures.antenna),
  }), [textures, tint])

  useFrame(({ camera }, delta) => {
    if (!sheet.current || !flip.current) return
    const walking = !!moving.current
    clock.current += Math.min(delta, 0.05) * (walking ? Math.max(speed, 1) : 0.25)
    const time = clock.current
    // Turn the sheet to face the camera around the vertical axis only.
    sheet.current.parent!.getWorldPosition(worldPosition)
    // The parent group still turns with the animal, so undo that turn here.
    sheet.current.rotation.y = Math.atan2(camera.position.x - worldPosition.x, camera.position.z - worldPosition.z) - (heading.current ?? 0)
    // Face left or right on screen depending on which way the animal walks.
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
    forward.set(Math.sin(heading.current ?? 0), 0, Math.cos(heading.current ?? 0))
    const side = forward.dot(cameraRight)
    if (Math.abs(side) > 0.15) facing.current = Math.sign(side)
    const factor = 1 - Math.exp(-delta * 10)
    flip.current.scale.x = MathUtils.lerp(flip.current.scale.x, facing.current, factor)
    // The paper tilts slightly while flipping, like card turning over.
    flip.current.rotation.y = (1 - Math.abs(flip.current.scale.x)) * 0.6 * facing.current
    // Breathing and a small walking bob.
    if (body.current) {
      body.current.scale.y = bodyHeight * (1 + Math.sin(time * 2.2) * 0.012)
      body.current.position.y = toY(256) + (walking ? Math.abs(Math.sin(time * 19)) * 0.006 : 0)
    }
    if (head.current) head.current.rotation.z = Math.sin(time * 3.1) * 0.12 + Math.sin(time * 7.7) * 0.05 + (feeding ? Math.sin(time * 15) * 0.1 - 0.15 : 0)
    // A metachronal wave runs from back to front, like a real isopod gait.
    hips.forEach((_, index) => {
      const phase = time * 19 - index * 0.9
      const near = nearLegs.current[index], far = farLegs.current[index]
      if (near) near.rotation.z = walking ? Math.sin(phase) * 0.45 : Math.sin(time * 1.3 + index) * 0.03
      if (far) far.rotation.z = walking ? Math.sin(phase + Math.PI) * 0.45 : 0
    })
  })

  return (
    <group ref={sheet}>
      <group ref={flip} position={[0, lift, 0]}>
        {/* Far-side legs sit just behind the body, darker. */}
        {hips.map((x, index) => <mesh key={`far-${x}`} ref={(mesh) => { farLegs.current[index] = mesh }} geometry={pivotTop} material={materials.farLeg} position={[toX(x + 20), toY(372), -0.004]} scale={[legWidth, legHeight * 0.9, 1]} castShadow />)}
        <mesh ref={body} geometry={plane} material={materials.body} position={[0, toY(256), 0]} scale={[bodyWidth, bodyHeight, 1]} castShadow />
        {hips.map((x, index) => <mesh key={`near-${x}`} ref={(mesh) => { nearLegs.current[index] = mesh }} geometry={pivotTop} material={materials.leg} position={[toX(x), toY(380), 0.004]} scale={[legWidth, legHeight, 1]} castShadow />)}
        <group ref={head} position={[toX(905), toY(290), 0.006]}>
          <mesh geometry={pivotBaseLeft} material={materials.antenna} scale={[antennaWidth, antennaHeight, 1]} rotation={[0, 0, -0.35]} castShadow />
        </group>
      </group>
    </group>
  )
}
