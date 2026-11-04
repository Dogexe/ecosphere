import test from 'node:test'
import assert from 'node:assert/strict'
import { stepWorld } from '../src/sim/ecosystem.ts'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { sealWorld } from '../src/sim/seal.ts'
import { serializeSave } from '../src/sim/saves.ts'
import { awayDuration, awayHours, awayLimitHours, awayLines, catchUp, hourMs, liveAway, startReport } from '../src/sim/away.ts'

const same = (a, b) => assert.deepEqual(JSON.parse(serializeSave(a)), JSON.parse(serializeSave(b)))

test('one model hour passes for each whole real hour away; spare minutes carry over', () => {
  assert.deepEqual(awayHours(1000, 1000 + 40 * 60 * 1000), { hours: 0, carryMs: 40 * 60 * 1000, capped: false })
  assert.deepEqual(awayHours(1000, 1000 + 5 * hourMs + 20 * 60 * 1000), { hours: 5, carryMs: 20 * 60 * 1000, capped: false })
  assert.deepEqual(awayHours(1000, 1000 + 90 * 24 * hourMs), { hours: awayLimitHours, carryMs: 0, capped: true })
})

test('a clock set backwards, a missing save time or nonsense never runs the jar', () => {
  assert.equal(awayHours(5 * hourMs, hourMs).hours, 0)
  assert.equal(awayHours(0, 100 * hourMs).hours, 0)
  assert.equal(awayHours(Number.NaN, 100 * hourMs).hours, 0)
})

test('time away is the unchanged solver, hour for hour', () => {
  const start = beginDaylitWorld(createHabitatWorld('woodland', 7))
  let direct = start
  for (let hour = 0; hour < 72; hour += 1) direct = stepWorld(direct)
  const away = catchUp(start, [], 72)
  same(away.world, direct)
  assert.equal(away.report.hours, 72)
  assert.equal(away.history.length, 73)
  assert.equal(away.history.at(-1).tick, direct.tick)
})

test('living through an absence in slices gives the same jar as all at once', () => {
  const start = beginDaylitWorld(createHabitatWorld('wetland', 3))
  const whole = catchUp(start, [], 100)
  const report = startReport(start, false)
  let part = { world: start, history: [] }
  for (const slice of [30, 30, 40]) part = liveAway(part.world, part.history, slice, report)
  same(part.world, whole.world)
  assert.deepEqual(report, whole.report)
  assert.deepEqual(part.history, whole.history)
})

test('an open jar left for weeks dries out and the notes say so; a sealed one keeps its water', () => {
  const open = catchUp(beginDaylitWorld(createHabitatWorld('garden', 7)), [], 21 * 24)
  assert.ok(open.report.soilWater.after < open.report.soilWater.before - 20)
  assert.ok(awayLines(open.report).some((line) => line.includes('dried out')))
  const sealed = catchUp(sealWorld(beginDaylitWorld(createHabitatWorld('woodland', 7)), 30), [], 21 * 24)
  assert.ok(sealed.report.soilWater.after > sealed.report.soilWater.before - 15)
  assert.ok(sealed.world.plants.length > 0)
})

test('the report notices a sealed jar reaching its goal while away', () => {
  const { report } = catchUp(sealWorld(beginDaylitWorld(createHabitatWorld('woodland', 7)), 7), [], 8 * 24)
  assert.equal(report.seal.reachedGoal, true)
  assert.ok(awayLines(report)[0].includes('goal'))
})

test('away time reads as days and hours', () => {
  assert.equal(awayDuration(1), '1 hour')
  assert.equal(awayDuration(48), '2 days')
  assert.equal(awayDuration(77), '3 days and 5 hours')
})
