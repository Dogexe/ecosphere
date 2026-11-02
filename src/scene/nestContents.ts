import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { antSupportOffset } from './antSupport.ts'

export const eggBounds = new Box3(new Vector3(-0.007, -0.048, -0.012), new Vector3(0.007, -0.032, 0.012))
export const grainBounds = new Box3(new Vector3(-0.012, -0.008, -0.018), new Vector3(0.012, 0.008, 0.018))

export function nurseryOrigin(room: { x: number; y: number; z: number }, index: number) {
  // Separate cohorts across the bed. Vertical-only rows would collapse onto
  // the same floor once supported, making independent cohorts unselectable.
  return new Vector3(room.x + ((index % 3) - 1) * 0.085, room.y - 0.03, room.z + (Math.floor(index / 3) - 1) * 0.05)
}

// Contents settle along world gravity, independent of the imported model axes.
// Bounds are copied: asset normalization and cohort growth remain untouched.
export function nestContentOffset(field: (x: number, y: number, z: number) => number, origin: Vector3, bounds: Box3, rotation: Quaternion, count = 1) {
  const envelope = bounds.clone().applyMatrix4(new Matrix4().makeRotationFromQuaternion(rotation))
  envelope.max.y += Math.max(0, count - 1) * 0.017
  return antSupportOffset(field, origin, new Quaternion(), envelope.expandByScalar(0.003), 1)
}
