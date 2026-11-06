import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, Color, Fog, MathUtils, SRGBColorSpace } from 'three'
import type { MeshBasicMaterial, MeshStandardMaterial } from 'three'
import type { World } from '../sim/ecosystem'
import { environmentAt } from '../sim/climate'
import { markRealistic } from './watercolor'
import { environmentScale } from './scale'

/*
 * The room around the jar (owner, 2026-11-04): the light has a source you can see.
 *
 * - By day the sun comes in through a window in the wall behind the jar, a
 *   little to the left of the usual view. Daylight's key light shines from
 *   that window (see `windowLight`), so the jar is lit from behind and above
 *   like a jar on a real windowsill.
 * - At night the window turns deep blue with a moon (the sill lamp was removed
 *   at the owner's request, 2026-11-06: it cluttered the view).
 * - The walls follow the light, so the room is bright and soft by day and
 *   dim at night, and the jar stays the brightest thing in view.
 */

/** The sill (JarSetting's Sill) ends at z = -5.5; the wall stands right behind it, like a real windowsill. */
/** `?hour=13` shows the room's light at that hour without touching the sim (for checking the look). */
const forcedHour = (() => { try { const value = new URLSearchParams(window.location.search).get('hour'); return value === null ? null : Number(value) } catch { return null } })()
export const lightingWorld = <T extends World>(world: T): T => forcedHour === null || !world.climate?.photoperiod ? world : { ...world, tick: forcedHour }

const wallX = -15, backZ = -5.6
const sillTop = environmentScale.soilSurfaceY - 4.8
/** Centre of the window opening in the back wall. */
export const windowCentre = { x: -3, y: sillTop + 0.6 + 5.5, width: 16, height: 11 }
/** Where the key light sits for a given sun height (0-1) and time of day: inside the window, higher at noon, moving along it through the day. */
export function windowLight(solar: number, hour: number) {
  const along = MathUtils.clamp((hour - 6) / 12, 0, 1)
  return [windowCentre.x + (along - 0.5) * windowCentre.width * 0.6, windowCentre.y - windowCentre.height * 0.2 + solar * windowCentre.height * 0.6, backZ - 9] as const
}

/** The back wall in four pieces around the window opening (x -30..30, y -12..28). */
const backWall = (() => {
  const x0 = -30, x1 = 30, y0 = -12, y1 = 28
  const wx0 = windowCentre.x - windowCentre.width / 2, wx1 = windowCentre.x + windowCentre.width / 2
  const wy0 = windowCentre.y - windowCentre.height / 2, wy1 = windowCentre.y + windowCentre.height / 2
  const piece = (xa: number, xb: number, ya: number, yb: number) => ({ x: (xa + xb) / 2, y: (ya + yb) / 2, width: xb - xa, height: yb - ya })
  return [piece(x0, x1, y0, wy0), piece(x0, x1, wy1, y1), piece(x0, wx0, wy0, wy1), piece(wx1, x1, wy0, wy1)]
})()

function paint(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function useViews() {
  return useMemo(() => ({
    // A soft rainy garden outside, as in concept image 12 (2026-11-07): overcast bright sky, deep
    // blurred greenery filling most of the pane, and rain beading and running on the window glass.
    day: paint(512, 400, (context) => {
      const sky = context.createLinearGradient(0, 0, 0, 400)
      sky.addColorStop(0, '#dfe6dc'); sky.addColorStop(0.35, '#c9d6bd'); sky.addColorStop(0.7, '#88a467'); sky.addColorStop(1, '#4f6b3c')
      context.fillStyle = sky; context.fillRect(0, 0, 512, 400)
      const sun = context.createRadialGradient(170, 90, 0, 170, 90, 240)
      sun.addColorStop(0, 'rgba(255,248,226,0.9)'); sun.addColorStop(1, 'rgba(255,240,200,0)')
      context.fillStyle = sun; context.fillRect(0, 0, 512, 400)
      context.filter = 'blur(18px)'
      let seed = 7
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      for (let index = 0; index < 40; index += 1) {
        const y = 90 + rand() * 300
        context.fillStyle = ['#7f9d5e', '#93b06c', '#5f7f45', '#a7bf80', '#4c6a37'][index % 5]
        context.globalAlpha = 0.55 + rand() * 0.35
        context.beginPath(); context.ellipse(rand() * 512, y, 30 + rand() * 50, 26 + rand() * 40, 0, 0, Math.PI * 2); context.fill()
      }
      context.globalAlpha = 1
      context.filter = 'none'
      // Rain on the pane: beads with a bright lower edge, and a few running trails.
      for (let index = 0; index < 260; index += 1) {
        const x = rand() * 512, y = rand() * 400, r = 0.8 + rand() * rand() * 3.2
        context.fillStyle = 'rgba(40,52,40,0.28)'; context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill()
        context.fillStyle = 'rgba(255,255,245,0.55)'; context.beginPath(); context.arc(x, y + r * 0.35, r * 0.55, 0, Math.PI * 2); context.fill()
      }
      context.strokeStyle = 'rgba(235,242,232,0.35)'; context.lineWidth = 1.4
      for (let index = 0; index < 14; index += 1) { const x = rand() * 512, y = rand() * 200; context.beginPath(); context.moveTo(x, y); context.bezierCurveTo(x + 3, y + 60, x - 3, y + 120, x + 2, y + 120 + rand() * 120); context.stroke() }
    }),
    // Night sky with a moon and a dark tree line.
    night: paint(512, 400, (context) => {
      const sky = context.createLinearGradient(0, 0, 0, 400)
      sky.addColorStop(0, '#0e1730'); sky.addColorStop(0.7, '#1d2c4c'); sky.addColorStop(1, '#141c2a')
      context.fillStyle = sky; context.fillRect(0, 0, 512, 400)
      const glow = context.createRadialGradient(360, 100, 0, 360, 100, 120)
      glow.addColorStop(0, 'rgba(210,225,255,0.55)'); glow.addColorStop(1, 'rgba(210,225,255,0)')
      context.fillStyle = glow; context.fillRect(0, 0, 512, 400)
      context.fillStyle = '#eef2ff'; context.beginPath(); context.arc(360, 100, 22, 0, Math.PI * 2); context.fill()
      context.filter = 'blur(10px)'; context.fillStyle = '#0b1220'
      for (let index = 0; index < 14; index += 1) { context.beginPath(); context.ellipse(index * 40 + 10, 330 + (index % 3) * 14, 50, 50, 0, 0, Math.PI * 2); context.fill() }
    }),
  }), [])
}

export function Room({ world }: { world: World }) {
  const views = useViews()
  const scene = useThree((state) => state.scene)
  const day = useRef<MeshBasicMaterial>(null)
  const walls = useRef<MeshStandardMaterial[]>([])
  const sky = environmentAt(lightingWorld(world))
  const solar = sky.cycling ? sky.solar : 1
  const wallDay = useMemo(() => new Color('#8a7c66'), []), wallNight = useMemo(() => new Color('#2a2c35'), [])
  const background = useMemo(() => new Color(), [])
  const fog = useMemo(() => new Fog('#2a2c35', 18, 48), [])
  const daylight = useRef(solar)
  useEffect(() => () => { scene.background = null; scene.fog = null }, [scene])

  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-delta * 3)
    daylight.current = MathUtils.lerp(daylight.current, solar, blend)
    const d = daylight.current
    if (day.current) day.current.opacity = MathUtils.smoothstep(d, 0.02, 0.35)
    for (const material of walls.current) if (material) material.color.copy(wallNight).lerp(wallDay, MathUtils.smoothstep(d, 0, 0.6))
    background.copy(wallNight).lerp(wallDay, MathUtils.smoothstep(d, 0, 0.6)).multiplyScalar(0.55)
    scene.background = background
    fog.color.copy(background)
    scene.fog = fog
  })

  const wall = (index: number) => (material: MeshStandardMaterial | null) => { if (material) { markRealistic(material); walls.current[index] = material } }
  // A dark stained frame recedes behind the jar instead of drawing bright bars across it.
  const frame = '#4a3a2e'
  return <group>
    {/* The back wall with the window, and a plain left wall. */}
    {backWall.map((piece, index) => <mesh key={index} position={[piece.x, piece.y, backZ]} receiveShadow><planeGeometry args={[piece.width, piece.height]} /><meshStandardMaterial ref={wall(index)} roughness={0.95} /></mesh>)}
    <mesh position={[wallX, 8, 10]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[60, 40]} /><meshStandardMaterial ref={wall(4)} roughness={0.95} /></mesh>
    <group position={[windowCentre.x, windowCentre.y, backZ - 0.4]}>
      <mesh><planeGeometry args={[windowCentre.width, windowCentre.height]} /><meshBasicMaterial map={views.night} toneMapped={false} fog={false} /></mesh>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[windowCentre.width, windowCentre.height]} /><meshBasicMaterial ref={day} map={views.day} color="#9a9a92" transparent toneMapped={false} fog={false} /></mesh>
      {/* Frame and glazing bars. */}
      {[-1, 1].map((side) => <mesh key={`v${side}`} position={[side * windowCentre.width / 2, 0, 0.3]}><boxGeometry args={[0.5, windowCentre.height + 0.5, 0.6]} /><meshStandardMaterial color={frame} roughness={0.6} /></mesh>)}
      {[-1, 1].map((side) => <mesh key={`h${side}`} position={[0, side * windowCentre.height / 2, 0.3]}><boxGeometry args={[windowCentre.width + 0.5, 0.5, 0.6]} /><meshStandardMaterial color={frame} roughness={0.6} /></mesh>)}
      <mesh position={[0, 0, 0.3]}><boxGeometry args={[0.25, windowCentre.height, 0.3]} /><meshStandardMaterial color={frame} roughness={0.6} /></mesh>
      <mesh position={[0, 0.8, 0.3]}><boxGeometry args={[windowCentre.width, 0.25, 0.3]} /><meshStandardMaterial color={frame} roughness={0.6} /></mesh>
    </group>
  </group>
}
