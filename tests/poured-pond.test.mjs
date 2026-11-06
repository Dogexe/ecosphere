import test from 'node:test'
import assert from 'node:assert/strict'
import defaultJar from '../src/sim/defaultJar.json' with { type: 'json' }
import { createHabitatWorld, habitatStarts } from '../src/sim/habitats.ts'
import { stepWorld, isLand, placementIssue } from '../src/sim/ecosystem.ts'
import { isAquatic, isPondPosition, pondCenter, pondShape, setPondShape } from '../src/sim/pond.ts'
import { maskShape } from '../src/sim/pondShape.ts'
import { adoptPouredJar } from '../src/sim/pouredPond.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import { walkOnLand } from '../src/sim/land.ts'

test('the default poured jar holds an uneven pond that runs from the old round one out to the front glass', () => {
  const shape = maskShape(defaultJar)
  assert.ok(shape.volume > 6 && shape.volume < 15, `volume ${shape.volume}`)
  // The old pond's middle is still water, and the pond reaches the front glass (+z, radius 3.77) so you can look into it from the side.
  assert.ok(shape.signedDistance(pondCenter.x, pondCenter.z) < 0)
  assert.ok(shape.signedDistance(pondCenter.x, 3.3) < 0)
  // Not a circle: the shore's distance from the centre varies by more than a few mm.
  const reach = Array.from({ length: 24 }, (_, n) => { const a = n / 24 * Math.PI * 2; let r = 0; while (shape.signedDistance(shape.center.x + Math.cos(a) * r, shape.center.z + Math.sin(a) * r) < 0 && r < 4) r += 0.02; return r })
  assert.ok(Math.max(...reach) - Math.min(...reach) > 0.3, `shore radii ${Math.min(...reach).toFixed(2)}–${Math.max(...reach).toFixed(2)}`)
  setPondShape(null)
})

test('every starter world moves into the poured jar intact and keeps running', () => {
  for (const start of habitatStarts) {
    const world = adoptPouredJar(createHabitatWorld(start.id, 2217), defaultJar)
    assert.equal(world.plants.length, createHabitatWorld(start.id, 2217).plants.length)
    assert.equal(world.creatures.length, createHabitatWorld(start.id, 2217).creatures.length)
    for (const item of [...world.plants, ...world.creatures]) assert.ok(isAquatic(item.kind) ? isPondPosition(item.x, item.z) : isLand(item.x, item.z), `${start.id} ${item.kind} at ${item.x.toFixed(2)},${item.z.toFixed(2)}`)
    let next = world
    for (let hour = 0; hour < 48; hour += 1) next = stepWorld(next)
    assert.deepEqual(parseSave(serializeSave(next)).creatures.length, next.creatures.length)
    for (const creature of next.creatures) assert.ok(isAquatic(creature.kind) ? isPondPosition(creature.x, creature.z) : isLand(creature.x, creature.z), `${start.id} ${creature.kind} wandered to ${creature.x.toFixed(2)},${creature.z.toFixed(2)}`)
  }
  setPondShape(null)
})

test('a poured pond decides where water life may go, and walkers follow its shore', () => {
  const world = adoptPouredJar(createHabitatWorld('bare', 3), defaultJar)
  const { center } = pondShape()
  assert.equal(placementIssue(world, 'lily', center.x, center.z), null)
  assert.match(placementIssue(world, 'lily', 2.5, -1.5) ?? '', /pond/)
  // A walker heading straight across the pond goes round it instead.
  setPondShape(defaultJar)
  let walker = { id: 1, x: center.x, z: -2.0, heading: 0 }
  assert.ok(isLand(walker.x, walker.z))
  for (let step = 0; step < 120; step += 1) { const moved = walkOnLand(walker, center.x, center.z + 2.1, 0.08); walker = { ...walker, ...moved }; assert.ok(isLand(walker.x, walker.z), `step ${step} at ${walker.x.toFixed(2)},${walker.z.toFixed(2)}`) }
  setPondShape(null)
})

test('without a poured jar the pond is the same round one', () => {
  setPondShape(null)
  assert.equal(pondShape().kind, 'circle')
  assert.ok(isPondPosition(pondCenter.x + 1.57, pondCenter.z))
  assert.ok(!isPondPosition(pondCenter.x + 1.59, pondCenter.z))
})
