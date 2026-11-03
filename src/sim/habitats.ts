import { createWorld, introduceLife, placementIssue } from './ecosystem.ts'
import type { CreatureKind, PlantKind, World } from './ecosystem'

export type HabitatStart = 'garden' | 'woodland' | 'meadow' | 'bare' | 'wetland'

// A starter is an initial community, never a rule or bonus in simulateStep.
export const habitatStarts: { id: HabitatStart; name: string; subtitle: string; description: string; residents: string; experiment: string; icons: PlantKind[] }[] = [
  { id: 'garden', name: 'Mixed garden', subtitle: 'A little of everything', description: 'Bright light, varied moisture, and a mix of all four plants.', residents: '8 plants · 3 grazers · 2 woodlice', experiment: 'Try one beetle. Does less grazing leave more plants, or fewer kinds of life?', icons: ['bloom', 'fern', 'clover', 'moss'] },
  { id: 'woodland', name: 'Shaded floor', subtitle: 'Life beneath a canopy', description: 'Trees shape the light. Fern, moss, fungi and their tiny grazers share damp ground.', residents: '12 plants · 1 grazer · 3 woodlice · 2 springtails', experiment: 'Remove a tree. Compare local light and the understory as the canopy opens.', icons: ['tree', 'moss', 'fern', 'moss'] },
  { id: 'meadow', name: 'Sunny meadow', subtitle: 'Leaves in the light', description: 'Full sun and fertile soil favor blooms and clover. Water leaves faster here.', residents: '12 plants · 3 grazers · 1 woodlouse', experiment: 'Tend one dry pocket. Compare the plants there with an untouched corner.', icons: ['bloom', 'clover', 'bloom', 'clover'] },
  { id: 'bare', name: 'Bare ground', subtitle: 'Build your own food web', description: 'Living soil, an open canvas. Introduce producers before hungry consumers.', residents: 'No plants or animals · living soil remains', experiment: 'Start with plants. Add recyclers, then consumers, as their food becomes available.', icons: [] },
  { id: 'wetland', name: 'Living pond', subtitle: 'Two food webs, one world', description: 'Lily and reeds share water with algae, water fleas and a hungry little fish.', residents: '12 plants · 2 woodlice · 4 water fleas · 1 fish', experiment: 'Add organic matter to the pond. Follow oxygen and the organisms that need it.', icons: ['lily', 'reed', 'moss', 'lily'] },
]

const planting: Record<'woodland' | 'meadow', PlantKind[]> = {
  woodland: ['fern', 'tree', 'moss', 'tree', 'clover', 'fern', 'moss', 'moss', 'fern', 'grass', 'bloom', 'moss'],
  meadow: ['bloom', 'grass', 'bloom', 'clover', 'grass', 'bloom', 'moss', 'fern', 'grass', 'clover', 'grass', 'clover'],
}

export function createHabitatWorld(start: HabitatStart, seed = 2217): World {
  const base = createWorld(seed)
  if (start === 'garden') return base
  if (start === 'bare') return { ...base, plants: [], creatures: [] }
  if (start === 'wetland') {
    let world = createHabitatWorld('meadow', seed)
    world = { ...world, light: 0.78, climate: { temperatureC: 22, rainfall: 0.55 }, pond: { water: 85, nutrients: 12, organic: 6, oxygen: 68, algae: 4 }, plants: world.plants.slice(0, 9), creatures: [] }
    for (const [kind, x, z] of [['lily', -1.45, 0.3], ['lily', -0.65, 0.78], ['reed', -1.3, 1.3]] as const) world = introduceLife(world, kind, x, z)
    for (const [kind, x, z] of [['woodlouse', -2.5, -1.5], ['woodlouse', 1.85, 1.35], ['flea', -1.1, 0.35], ['flea', -1.55, 0.85], ['flea', -0.7, 0.6], ['flea', -1.1, 1.2], ['fish', -1.4, 1.1]] as const) world = introduceLife(world, kind, x, z)
    return { ...world, plants: world.plants.map((plant) => ({ ...plant, age: 90, development: 90, biomass: Math.max(plant.biomass, plant.capacity * 0.45) })), creatures: world.creatures.map((creature) => ({ ...creature, energy: creature.kind === 'fish' ? 85 : creature.kind === 'flea' ? 68 : creature.energy })) }
  }
  const shaded = start === 'woodland'
  const soil = base.soil.map((patch, index) => ({
    ...patch,
    water: (shaded ? [76, 70, 86, 78] : [44, 50, 62, 54])[index],
    nutrients: (shaded ? [44, 48, 42, 46] : [56, 68, 42, 58])[index],
    organic: (shaded ? [28, 24, 34, 30] : [8, 7, 12, 9])[index],
    fungi: (shaded ? [2.2, 1.8, 2.6, 2.3] : [0.6, 0.5, 0.8, 0.6])[index],
  }))
  const mean = (key: 'water' | 'nutrients' | 'organic') => soil.reduce((sum, patch) => sum + patch[key], 0) / soil.length
  let world: World = { ...base, soil, water: mean('water'), nutrients: mean('nutrients'), organic: mean('organic'), light: shaded ? 0.42 : 0.92, plants: [], creatures: [] }
  const positions = [...base.plants.map(({ x, z }) => [x, z]), [-0.3, -1], [0.8, -1.15], [0.65, 0.55], [0.5, 1.32]]
  planting[start].forEach((kind, index) => {
    const [x, z] = positions[index]
    // Fail visibly during development if a starter ever breaks placement rules.
    const issue = placementIssue(world, kind, x, z)
    if (issue) throw new Error(`Invalid ${start} planting: ${issue}`)
    world = introduceLife(world, kind, x, z)
  })
  // These are imported established plants at setup, not free growth in a step.
  world = { ...world, plants: world.plants.map((plant, index) => ({ ...plant, age: 90, development: 90, biomass: plant.capacity * (base.plants[index % base.plants.length].biomass / base.plants[index % base.plants.length].capacity) })) }
  const animals: [CreatureKind, number, number][] = shaded
    ? [['grazer', 2.5, 0.7], ['woodlouse', 1.3, 2.3], ['woodlouse', 1.85, 1.35], ['woodlouse', -1.65, -1.7], ['springtail', 1.55, -1.6], ['springtail', -1.15, -1.7]]
    : [['grazer', -2.05, -0.75], ['grazer', 1.7, -1.2], ['grazer', 0.95, 1.62], ['woodlouse', -2.5, -1.5]]
  for (const [kind, x, z] of animals) {
    const issue = placementIssue(world, kind, x, z)
    if (issue) throw new Error(`Invalid ${start} animal: ${issue}`)
    world = introduceLife(world, kind, x, z)
  }
  return world
}
