import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AmbientLight, Color, DirectionalLight, HemisphereLight, MathUtils, Vector3 } from 'three'
import type { World } from '../sim/ecosystem'
import { environmentAt } from '../sim/climate'
import { lightingWorld, windowLight } from './Room'

/**
 * `dramatic` (paper look, after Drawquarium): low fill light and a strong key
 * so real soil, stone and water read with deep shadows, plus a warm grazing
 * accent from behind; the cartoon parts are near self-lit, so they pop.
 * `room`: the key light shines from the Room's window and the room's lamp
 * replaces the warm accent, so every light has a source you can see.
 */
export function Daylight({ world, dramatic = false, room = false }: { world: World; dramatic?: boolean; room?: boolean }) {
  const ambient = useRef<AmbientLight>(null)
  const hemisphere = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const sky = environmentAt(lightingWorld(world))
  const sun = new Color('#e0eee9').lerp(new Color('#fff4da'), world.light)
  const night = sky.phase === 'night'
  const tint = !sky.cycling ? sun : new Color(night ? '#a5bbdf' : '#e6bba4').lerp(sun, sky.solar)
  // In the room the key light comes in through the window, so its source is in view.
  const position = room ? new Vector3(...windowLight(sky.cycling ? sky.solar : 1, sky.cycling ? sky.hour : 12)) : !sky.cycling ? new Vector3(-5, 9, 6) : sky.solar > 0
    ? new Vector3(-7 * Math.cos((sky.hour - 6) * Math.PI / 12), 2 + sky.solar * 7, 4)
    : new Vector3(4, 7, -4)
  const brightness = sky.cycling ? sky.solar : 1
  const fill = dramatic ? 0.3 : 1, keyBoost = dramatic ? 1.35 : 1
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-delta * 5)
    if (ambient.current) ambient.current.intensity = MathUtils.lerp(ambient.current.intensity, (sky.cycling ? 0.55 + brightness * 0.7 : 1.25) * fill, blend)
    if (hemisphere.current) hemisphere.current.intensity = MathUtils.lerp(hemisphere.current.intensity, (sky.cycling ? 0.75 + brightness * 0.75 : 1.5) * fill, blend)
    if (key.current) {
      key.current.intensity = MathUtils.lerp(key.current.intensity, (sky.cycling ? 0.4 + sky.light * 2.5 : 1.15 + world.light * 1.6) * keyBoost, blend)
      key.current.color.lerp(tint, blend)
      key.current.position.lerp(position, blend)
    }
  })
  return <>
    <ambientLight ref={ambient} intensity={0.8} color={sky.cycling ? '#d9e5ec' : '#e4eee3'} />
    <hemisphereLight ref={hemisphere} args={['#edf6e9', '#a38368', 1]} />
    <directionalLight ref={key} position={[-5, 9, 6]} intensity={1} color={tint} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0002} />
    {/* In the room, light from the window bounces off the walls and comes back at the jar's front, soft and warm. */}
    {room && <directionalLight position={[2, 4, 12]} intensity={0.45 + brightness * 0.5} color="#ffe6c8" />}
    {dramatic && !room && <pointLight position={[4.5, 3.2, -4.5]} intensity={28} distance={14} decay={1.6} color="#ffb46b" />}
  </>
}
