import { createWorld, introduceLife } from '../sim/ecosystem.ts'
import type { PlantKind, World } from '../sim/ecosystem'

// Opt-in, paused capacity fixture. It uses the same placement rules as play.
export function createStressWorld(dry = false) {
  let world: World = { ...createWorld(), plants: [], creatures: [] }
  const kinds: PlantKind[] = ['clover', 'fern', 'bloom', 'moss', 'grass', 'tree']
  for (let x = -2.8; x <= 2.8; x += 0.72) {
    for (let z = -2.8; z <= 2.8; z += 0.72) {
      if (world.plants.length < 29) world = introduceLife(world, kinds[world.plants.length % kinds.length], x, z)
    }
  }
  for (const [kind, x, z] of [['lily', -1.45, 0.3], ['lily', -0.65, 0.78], ['reed', -1.3, 1.3]] as const) world = introduceLife(world, kind, x, z)
  for (let x = -1.8; x < -0.4; x += 0.24) for (let z = 0.1; z < 1.4; z += 0.24) {
    world = introduceLife(world, 'flea', x, z)
    world = introduceLife(world, 'fish', x, z)
  }
  for (const plant of world.plants) {
    world = introduceLife(world, 'grazer', plant.x, plant.z)
    world = introduceLife(world, 'woodlouse', plant.x, plant.z)
    world = introduceLife(world, 'beetle', plant.x, plant.z)
    world = introduceLife(world, 'springtail', plant.x, plant.z)
  }
  return { ...world, pond: dry ? { ...world.pond, water: 8.05, oxygen: 6.44 } : world.pond, plants: world.plants.map((plant) => ({ ...plant, age: 90, development: 90, biomass: plant.capacity * 0.8 })) }
}
