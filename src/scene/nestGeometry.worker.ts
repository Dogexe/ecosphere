import { makeNestGeometry } from './nestGeometry'
import type { NestShape } from './nestGeometry'

self.onmessage = (event: MessageEvent<{ id: number; shape: NestShape }>) => {
  const started = performance.now()
  const geometry = makeNestGeometry(event.data.shape)
  const position = geometry.getAttribute('position').array as Float32Array
  const color = geometry.getAttribute('color').array as Float32Array
  const normal = geometry.getAttribute('normal').array as Float32Array
  self.postMessage({ id: event.data.id, position, color, normal, elapsed: performance.now() - started }, { transfer: [position.buffer, color.buffer, normal.buffer] })
  geometry.dispose()
}
