import { useEffect, useRef, useState } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { makeNestGeometry } from './nestGeometry'
import type { NestShape } from './nestGeometry'

// Measured meshing was27–57ms on the host. Keep it off the render thread.
// Requests are transient; old worlds/views can never receive a stale result.
export function useNestGeometry(shape: NestShape, active: boolean) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const worker = useRef<Worker | null>(null), revision = useRef(0)
  const latest = useRef(shape), fallback = useRef(false)
  latest.current = shape
  useEffect(() => {
    if (!active) { setGeometry(null); return }
    fallback.current = false
    let instance: Worker
    try { instance = new Worker(new URL('./nestGeometry.worker.ts', import.meta.url), { type: 'module' }) }
    catch { fallback.current = true; return }
    worker.current = instance
    instance.onmessage = (event: MessageEvent<{ id: number; position: Float32Array; color: Float32Array; normal: Float32Array; elapsed: number }>) => {
      if (event.data.id !== revision.current) return
      const next = new BufferGeometry()
      next.setAttribute('position', new Float32BufferAttribute(event.data.position, 3))
      next.setAttribute('color', new Float32BufferAttribute(event.data.color, 3))
      next.setAttribute('normal', new Float32BufferAttribute(event.data.normal, 3))
      next.userData.nestMeshing = `worker ${event.data.elapsed.toFixed(1)}ms`
      next.computeBoundingSphere(); setGeometry(next)
    }
    instance.onerror = () => {
      if (worker.current !== instance) return
      instance.terminate(); worker.current = null; fallback.current = true
      const next = makeNestGeometry(latest.current); next.userData.nestMeshing = 'main thread fallback'; setGeometry(next)
    }
    return () => { revision.current++; instance.terminate(); worker.current = null }
  }, [active])
  useEffect(() => {
    if (!active) return
    const id = ++revision.current
    if (worker.current) worker.current.postMessage({ id, shape })
    else if (fallback.current) { const next = makeNestGeometry(shape); next.userData.nestMeshing = 'main thread fallback'; setGeometry(next) }
  }, [active, shape.nodes, shape.edges])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry
}
