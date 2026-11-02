import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Color, PerspectiveCamera, Vector3 } from 'three'
import type { Creature, World } from '../sim/ecosystem'
import { defaultPond, pondCenter } from '../sim/pond'
import { environmentAt } from '../sim/climate'
import { constrainPondCamera, pondCameraLimits, pondEntryCamera } from './pondCamera'
import { animalWaterY } from './scale'

export type SurfacePose = { position: Vector3; target: Vector3; ready: boolean; width: number; height: number }

export function PondAtmosphere({ world }: { world: World }) {
  const pond = world.pond ?? defaultPond()
  const cloudiness = Math.min(1, pond.algae / 18 + pond.organic / 110)
  const daylight = environmentAt(world)
  const color = new Color('#a6c9bc').lerp(new Color('#718b68'), cloudiness)
  if (daylight.cycling) color.multiplyScalar(0.45 + daylight.solar * 0.55)
  return <>
    <color attach="background" args={[color]} />
    <fog attach="fog" args={[color, 0.12, 2.8 - cloudiness * 1.4]} />
  </>
}

export function PondControls({ creature, fish, surfacePose }: { creature: Creature | undefined; fish: Creature[]; surfacePose: SurfacePose }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const keyControls = useRef<ComponentRef<typeof OrbitControls> | null>(null)
  const { camera, gl, size } = useThree()
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const { near, far, fov } = camera
    const view = camera.view ? { ...camera.view } : null
    camera.near = 0.012
    camera.far = 8
    camera.fov = 54
    const entry = pondEntryCamera(fish)
    camera.position.set(entry.eye.x, entry.eye.y, entry.eye.z)
    camera.lookAt(entry.target.x, entry.target.y, entry.target.z)
    camera.updateProjectionMatrix()
    return () => {
      camera.near = near; camera.far = far; camera.fov = fov
      if (view?.enabled) camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height)
      else camera.clearViewOffset()
      camera.position.copy(surfacePose.position)
      camera.lookAt(surfacePose.target)
      camera.updateProjectionMatrix()
    }
  }, [camera, surfacePose])
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const portrait = size.width < size.height
    camera.fov = portrait ? 72 : 54
    if (portrait) camera.setViewOffset(size.width, size.height, size.width * 0.13, 0, size.width, size.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  useEffect(() => {
    gl.domElement.tabIndex = 0
    gl.domElement.setAttribute('role', 'img')
    gl.domElement.setAttribute('aria-label', 'Pond camera below water. Arrow keys pan.')
    return () => {
      if (keyControls.current?._domElementKeyEvents) keyControls.current.stopListenToKeyEvents()
      keyControls.current = null
    }
  }, [gl])
  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    if (keyControls.current !== orbit) {
      if (keyControls.current?._domElementKeyEvents) keyControls.current.stopListenToKeyEvents()
      orbit.listenToKeyEvents(gl.domElement)
      keyControls.current = orbit
    }
    if (creature) {
      const factor = 1 - Math.exp(-delta * 5)
      const dx = (creature.x - orbit.target.x) * factor
      const dy = (animalWaterY(creature.kind) - orbit.target.y) * factor
      const dz = (creature.z - orbit.target.z) * factor
      orbit.target.x += dx; orbit.target.y += dy; orbit.target.z += dz
      camera.position.x += dx; camera.position.y += dy; camera.position.z += dz
    }
    orbit.update()
    const safe = constrainPondCamera(camera.position, orbit.target, fish)
    camera.position.set(safe.eye.x, safe.eye.y, safe.eye.z)
    orbit.target.set(safe.target.x, safe.target.y, safe.target.z)
    camera.lookAt(orbit.target)
  }, -0.5)
  return <OrbitControls ref={controls} makeDefault target={[pondCenter.x, -0.05, pondCenter.z]} minDistance={pondCameraLimits.minDistance} maxDistance={pondCameraLimits.maxDistance} minPolarAngle={1.36} maxPolarAngle={1.78} enablePan screenSpacePanning panSpeed={0.55} rotateSpeed={0.55} enableDamping dampingFactor={0.08} />
}
