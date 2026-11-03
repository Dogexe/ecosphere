import { writeFileSync } from 'node:fs'
import { createWorld } from '../src/sim/ecosystem.ts'
import { antMaterialError, introduceColony, stepAntColony } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'

export function antFixture() {
  const base = createWorld(2217)
  const world = introduceColony({ ...base, tick: 8, creatures: [], plants: [
    { id: 0, kind: 'clover', x: 1.2, z: 1.7, biomass: 8, capacity: 8.8, age: 90, development: 90 },
    { id: 1, kind: 'grass', x: 1.9, z: 1.15, biomass: 6, capacity: 6.5, age: 90, development: 90 },
    { id: 2, kind: 'bloom', x: 2.25, z: 1.7, biomass: 8, capacity: 8.8, age: 90, development: 90 },
  ].map((plant) => ({ ...plant, parentId: null, lastReproduction: -1 })), climate: { temperatureC: 22, rainfall: 0 } }, 1.7, 1.7)
  // Historical fixture stays planar/no-construction, preserving old lifecycle
  // and the exact neighboring-tunnel contact regression. New nests test below.
  const layout = [[0, 0.045], [0, -0.16], [0.06, -0.34], [0.4, -0.39], [-0.26, -0.44], [-0.5, -0.54]]
  world.colony.nodes = world.colony.nodes.map((node, i) => ({ ...node, x: 1.7 + layout[i][0], y: layout[i][1], z: 1.7 }))
  delete world.colony.construction
  return world
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/probe_ant_colony.mjs')) {
  let world = antFixture()
  const counts = {}, samples = [], checkpoints = {}
  let error = 0
  for (let i = 0; i < 720; i++) {
    const result = stepAntColony(world)
    world = { ...result.world, tick: world.tick + 1 }
    error = Math.max(error, Math.abs(antMaterialError(world.colony)))
    for (const event of result.events) {
      counts[event.action] = (counts[event.action] ?? 0) + 1
      if (!checkpoints[event.action]) {
        checkpoints[event.action] = world.tick
        writeFileSync(`artifacts/ant-${event.action}-checkpoint.json`, serializeSave(world))
      }
    }
    if (i % 48 === 0) {
      parseSave(serializeSave(world))
      samples.push({ tick: world.tick, food: world.colony.food, queenGut: world.colony.queen?.gut,
        workers: world.colony.workers.length, brood: world.colony.brood.map((cohort) => [cohort.stage, cohort.age, cohort.material]),
        tasks: world.colony.workers.map((ant) => [ant.id, ant.activity, ant.location]) })
    }
  }
  const report = { counts, checkpoints, maxMaterialError: error, samples }
  writeFileSync('artifacts/ant-colony-probe.json', JSON.stringify(report, null, 2))
  console.log({ counts, checkpoints, maxMaterialError: error, finalWorkers: world.colony.workers.length, finalBrood: world.colony.brood.length, food: world.colony.food })
}
