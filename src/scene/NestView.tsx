import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Vector3 } from 'three'
import type { Ant, AntColony } from '../sim/colony'
import { antPosition, nestChamberRadius } from '../sim/colony'
import { nestFrame, nestCameraSettings } from './nestGeometry'
import type { SurfacePose } from './PondView'
import type { Remains } from '../sim/life'

export function NestControls({ colony, ant, focusBrood, broodId, chamber, surfacePose, remains, antCenters, broodCenters }: { broodCenters: Map<number, Vector3>; antCenters: Map<number, Vector3>; colony: AntColony; ant?: Ant; focusBrood: boolean; broodId: number | null; chamber: number | null; surfacePose: SurfacePose; remains?: Remains }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const keyControls = useRef<ComponentRef<typeof OrbitControls> | null>(null)
  const { camera, gl, size } = useThree()
  const frame = useMemo(() => nestFrame(colony), [colony.nodes])
  const initialTarget = useRef(frame.center.clone())
  const roomAuto = useRef(true)
  useEffect(() => { roomAuto.current = true }, [chamber, focusBrood, broodId, remains?.id])
  const settings = nestCameraSettings(colony, size.width, size.height)
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const { near, far, fov } = camera, view = camera.view ? { ...camera.view } : null
    camera.near = 0.008; camera.far = 12; camera.fov = 45
    camera.position.copy(frame.center).addScaledVector(frame.normal, settings.distance)
    camera.lookAt(frame.center); camera.updateProjectionMatrix()
    return () => {
      camera.near = near; camera.far = far; camera.fov = fov
      if (view?.enabled) camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height)
      else camera.clearViewOffset()
      camera.position.copy(surfacePose.position); camera.lookAt(surfacePose.target); camera.updateProjectionMatrix()
    }
  }, [camera, surfacePose])
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    camera.fov = settings.fov
    camera.far = Math.max(12, settings.maxDistance + settings.radius * 2 + 1)
    if (size.width >= 760) camera.setViewOffset(size.width, size.height, settings.offsetX, settings.offsetY, size.width, size.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  useEffect(() => {
    gl.domElement.tabIndex = 0; gl.domElement.setAttribute('role', 'img')
    gl.domElement.setAttribute('aria-label', 'Soil cutaway camera. Arrow keys pan.')
    const key = (event: KeyboardEvent) => {
      if (!event.key.startsWith('Arrow')) return
      roomAuto.current = false
      gl.domElement.dataset.cameraInput = `${event.key}/${event.code}`
    }
    gl.domElement.addEventListener('keydown', key)
    return () => {
      gl.domElement.removeEventListener('keydown', key)
      if (keyControls.current?._domElementKeyEvents) keyControls.current.stopListenToKeyEvents()
      keyControls.current = null
    }
  }, [gl])
  const follow = useRef<string | null>(null)
  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    if (keyControls.current !== orbit) { orbit.listenToKeyEvents(gl.domElement); keyControls.current = orbit }
    if (ant || roomAuto.current && (focusBrood || chamber !== null || remains)) {
      const p = ant ? antCenters.get(ant.id) ?? antPosition(colony, ant) : remains?.ant ? { x: remains.x, y: remains.ant.y - 0.03, z: remains.z } : colony.nodes.find((node) => chamber !== null ? node.id === chamber : node.role === 'brood') ?? frame.center
      const key = ant ? `ant:${ant.id}` : remains ? `remains:${remains.id}` : `room:${chamber ?? `brood:${broodId}`}`
      const broodCenter = focusBrood && broodId !== null && chamber === null ? broodCenters.get(broodId) : undefined
      const target = !ant && !remains && broodCenter ? broodCenter.clone() : new Vector3(p.x, p.y, p.z)
      const factor = 1 - Math.exp(-delta * 6), change = target.sub(orbit.target).multiplyScalar(factor)
      orbit.target.add(change); camera.position.add(change)
      if (follow.current !== key) {
        const room = colony.nodes.find((node) => node.id === (chamber ?? colony.nodes.find((node) => node.role === 'brood')?.id))
        const roomDistance = room ? Math.max(0.75, nestChamberRadius(room) * 1.3 / (Math.tan(settings.fov * Math.PI / 360) * size.width / Math.max(1, size.height) * (size.width >= 760 ? 0.62 : 0.90))) : 0.75
        camera.position.copy(orbit.target).addScaledVector(frame.normal, ant ? 0.65 : remains ? remains.ant?.form === 'queen' ? 0.65 : 0.45 : roomDistance)
        follow.current = key
      }
    } else follow.current = null
    const displacement = orbit.target.clone().sub(frame.center)
    if (displacement.length() > settings.radius) {
      const constrained = displacement.setLength(settings.radius).add(frame.center).sub(orbit.target)
      orbit.target.add(constrained); camera.position.add(constrained)
    }
    orbit.update()
  }, -0.5)
  return <OrbitControls ref={controls} makeDefault target={initialTarget.current} minDistance={0.16} maxDistance={settings.maxDistance} minPolarAngle={0.12} maxPolarAngle={3.02} enablePan screenSpacePanning panSpeed={0.45} rotateSpeed={0.55} enableDamping dampingFactor={0.08} onStart={() => { roomAuto.current = false }} />
}
