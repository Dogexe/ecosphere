import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AmbientLight, Color, DirectionalLight, HemisphereLight, MathUtils, Vector3 } from 'three'
import type { World } from '../sim/ecosystem'
import { environmentAt } from '../sim/climate'

export function Daylight({ world }: { world: World }) {
  const ambient = useRef<AmbientLight>(null)
  const hemisphere = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const sky = environmentAt(world)
  const sun = new Color('#e0eee9').lerp(new Color('#fff4da'), world.light)
  const night = sky.phase === 'night'
  const tint = !sky.cycling ? sun : new Color(night ? '#a5bbdf' : '#e6bba4').lerp(sun, sky.solar)
  const position = !sky.cycling ? new Vector3(-5, 9, 6) : sky.solar > 0
    ? new Vector3(-7 * Math.cos((sky.hour - 6) * Math.PI / 12), 2 + sky.solar * 7, 4)
    : new Vector3(4, 7, -4)
  const brightness = sky.cycling ? sky.solar : 1
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-delta * 5)
    if (ambient.current) ambient.current.intensity = MathUtils.lerp(ambient.current.intensity, sky.cycling ? 0.55 + brightness * 0.7 : 1.25, blend)
    if (hemisphere.current) hemisphere.current.intensity = MathUtils.lerp(hemisphere.current.intensity, sky.cycling ? 0.75 + brightness * 0.75 : 1.5, blend)
    if (key.current) {
      key.current.intensity = MathUtils.lerp(key.current.intensity, sky.cycling ? 0.4 + sky.light * 2.5 : 1.15 + world.light * 1.6, blend)
      key.current.color.lerp(tint, blend)
      key.current.position.lerp(position, blend)
    }
  })
  return <>
    <ambientLight ref={ambient} intensity={0.8} color={sky.cycling ? '#d9e5ec' : '#e4eee3'} />
    <hemisphereLight ref={hemisphere} args={['#edf6e9', '#a38368', 1]} />
    <directionalLight ref={key} position={[-5, 9, 6]} intensity={1} color={tint} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0002} />
  </>
}
