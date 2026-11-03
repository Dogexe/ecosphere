import { ExtrudeGeometry, Path, Shape, ShapeGeometry } from 'three'
import { environmentScale } from './scale.ts'
import { pondCenter } from '../sim/pond.ts'

// Existing asset kits cannot fit the solver's exact pond anchor. This small
// terrain cutout preserves that footprint instead of covering fish with soil.
function surface(radius: number) {
  const outline = new Shape()
  outline.absarc(0, 0, radius, 0, Math.PI * 2, false)
  const pond = new Path()
  pond.absarc(pondCenter.x, -pondCenter.z, environmentScale.pondRadius, 0, Math.PI * 2, true)
  outline.holes.push(pond)
  return outline
}
const cap = new ExtrudeGeometry(surface(environmentScale.islandRadius), { depth: 0.26, bevelEnabled: false, curveSegments: 48 })
cap.translate(0, 0, -0.26)
export const terrainGeometry = { cap, surface: new ShapeGeometry(surface(3.63), 48) }
