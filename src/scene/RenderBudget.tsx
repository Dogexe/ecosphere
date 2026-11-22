import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Mesh, Sphere } from 'three'

/*
 * Render budget (phase 1 of the target-look plan, 2026-11-22). The baseline sheet measured ~700 draw calls a
 * frame against a 300 budget; the shadow pass was ~150 of them.
 * - The key light's shadow map is redrawn every other frame instead of every frame. Animals move a few
 *   hundredths of a unit per frame, so a one-frame-old shadow is not visible.
 * - Meshes smaller than `tinyCaster` (world radius, about 1 mm) stop casting shadows: at the 1024 shadow map
 *   their shadow is under one texel, so it cost a draw call and showed nothing. They still receive shadows.
 * Presentation only.
 */
const tinyCaster = 0.05
const sphere = new Sphere()

export function RenderBudget() {
  const { gl, scene } = useThree()
  const frame = useRef(0)
  const lastSweep = useRef(-1)
  useEffect(() => {
    const previous = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => { gl.shadowMap.autoUpdate = previous }
  }, [gl])
  useFrame(({ clock }) => {
    frame.current++
    if (frame.current % 2 === 0) gl.shadowMap.needsUpdate = true
    const now = clock.elapsedTime
    if (now - lastSweep.current < 1) return
    lastSweep.current = now
    scene.traverse((node) => {
      if (!(node instanceof Mesh) || !node.castShadow || !node.geometry) return
      if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere()
      const bounds = node.geometry.boundingSphere
      if (!bounds) return
      sphere.copy(bounds).applyMatrix4(node.matrixWorld)
      // Instanced meshes cover many spots; only judge single meshes.
      if (!(node as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh && sphere.radius < tinyCaster) node.castShadow = false
    })
  })
  return null
}
