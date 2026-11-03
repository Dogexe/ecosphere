// Perspective target diameter is expressed in CSS pixels, never mesh units.
export const animalTargetPixels = 28
export function worldPickRadius(distance: number, fovDegrees: number, viewportHeight: number) {
  return distance * Math.tan(fovDegrees * Math.PI / 360) * animalTargetPixels / Math.max(1, viewportHeight)
}
