import type { Plant } from '../sim/ecosystem'
import { plantStage } from '../sim/life.ts'
import { plantDimensions, plantGroundY, plantGrowthScale, plantSeedDimensions } from './scale.ts'

// Presentation framing only: no changes to anatomy, picking or solver ranges.
export function plantCameraFocus(plant: Plant, aspect: number, fov = 38, sidePanel = false) {
  const growth = plantGrowthScale(plant)
  const stage = plantStage(plant)
  const cotyledons = ['germinating', 'seedling'].includes(stage) && !['moss', 'fern', 'lily', 'reed'].includes(plant.kind)
  const seed = plantSeedDimensions[plant.kind]
  const spread = stage === 'seed' ? Math.max(seed.length, seed.width) : (cotyledons ? 0.35 : plantDimensions[plant.kind].spread) * growth
  const height = stage === 'seed' ? seed.height : (cotyledons ? 0.28 : plantDimensions[plant.kind].height) * growth
  // A conservative sphere fits all orbit headings, with portrait margin.
  const radius = Math.hypot(spread, spread, height) / 2
  const halfAngle = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, Math.max(0.25, aspect) * (sidePanel ? 0.64 : 1)))
  const distance = Math.max(['seed', 'germinating', 'seedling'].includes(stage) ? 0.04 : 1.7, radius / Math.sin(halfAngle) * 1.2)
  return { key: `plant:${plant.id}`, x: plant.x, z: plant.z, y: plantGroundY(plant) + height / 2,
    distance, maxDistance: Math.max(21, distance) }
}
