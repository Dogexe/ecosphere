import test from 'node:test'
import assert from 'node:assert/strict'
import { createMotor, disturb, drawnPosition, forgetMotor, motorProfiles, stepMotor } from '../src/scene/behaviour.ts'
import { isLand } from '../src/sim/land.ts'

const run = (id, kind, goal, seconds, start = goal, onStep = () => {}) => {
  const motor = createMotor(id, start.x, start.z, 0)
  for (let t = 0; t < seconds; t += 1 / 30) { stepMotor(motor, id, kind, goal, 1 / 30, 100 + t); onStep(motor, t) }
  return motor
}

test('an idling woodlouse walks in bouts, stops, and stays near where the ecology put it', () => {
  const goal = { x: -1.5, z: -1.2, heading: 0, activity: 'active' }
  const states = new Set()
  let stopped = 0, maxDistance = 0
  run(901, 'woodlouse', goal, 60, goal, (m) => {
    states.add(m.state)
    if (m.speed < 0.02) stopped += 1
    maxDistance = Math.max(maxDistance, Math.hypot(m.x - goal.x, m.z - goal.z))
    assert.ok(isLand(m.x, m.z, 0, 3.3))
  })
  assert.ok(states.has('walk') && states.has('pause') || states.has('probe'), [...states].join())
  assert.ok(stopped > 60 * 30 * 0.15, `stops sometimes (${stopped} still frames)`)
  assert.ok(maxDistance <= motorProfiles.woodlouse.leash * 3 + 1e-9)
  forgetMotor(901)
})

test('a motor catches up when the ecology moves its animal on, and settles to rest', () => {
  const goal = { x: 1.2, z: -1.4, heading: 0, activity: 'resting' }
  const motor = run(902, 'woodlouse', goal, 20, { x: 0.4, z: -1.4 })
  assert.ok(Math.hypot(motor.x - goal.x, motor.z - goal.z) < 0.1)
  assert.equal(motor.state, 'rest')
  assert.equal(drawnPosition(902).resting, true)
  forgetMotor(902)
  assert.equal(drawnPosition(902), undefined)
})

test('a tap close by makes a woodlouse bolt away from it', () => {
  const goal = { x: -1.5, z: -1.2, heading: 0, activity: 'active' }
  assert.ok(isLand(goal.x, goal.z, 0, 3.3))
  const motor = createMotor(903, goal.x, goal.z, 0)
  for (let i = 0; i < 30; i += 1) stepMotor(motor, 903, 'woodlouse', goal, 1 / 30, 50 + i / 30)
  const before = { x: motor.x, z: motor.z }
  disturb(goal.x + 0.2, goal.z, 51)
  for (let i = 0; i < 20; i += 1) stepMotor(motor, 903, 'woodlouse', goal, 1 / 30, 51 + i / 30)
  assert.ok(motor.state === 'startle')
  assert.ok(motor.x < before.x, 'moves away from the tap')
  forgetMotor(903)
})

test('two ants meeting on a trail stop briefly face to face (antennal contact)', () => {
  const a = createMotor(1_000_001, -1.5, -1.2, Math.PI / 2), b = createMotor(1_000_002, -1.2, -1.2, -Math.PI / 2)
  let met = false
  for (let i = 0; i < 90; i += 1) {
    const t = 200 + i / 30
    stepMotor(a, 1_000_001, 'ant', { x: -1.2, z: -1.2, heading: Math.PI / 2, activity: 'active' }, 1 / 30, t)
    stepMotor(b, 1_000_002, 'ant', { x: -1.5, z: -1.2, heading: -Math.PI / 2, activity: 'active' }, 1 / 30, t)
    if (a.state === 'probe' && a.greeted === t) met = true
  }
  assert.ok(met)
  forgetMotor(1_000_001); forgetMotor(1_000_002)
})

import { pondCenter, pondShape } from '../src/sim/pondShape.ts'

test('pond animals stay in the water and react to a tap in their own way', () => {
  const goal = { x: pondCenter.x, z: pondCenter.z, heading: 0, activity: 'active' }
  run(904, 'flea', goal, 30, goal, (m) => assert.ok(pondShape().signedDistance(m.x, m.z) <= 0, 'flea in water'))
  forgetMotor(904)

  // Shrimp: tail-flip backwards, away from the tap.
  const shrimp = createMotor(905, goal.x, goal.z, 0)
  for (let i = 0; i < 15; i += 1) stepMotor(shrimp, 905, 'shrimp', goal, 1 / 30, 300 + i / 30)
  const before = { x: shrimp.x, z: shrimp.z }, tap = { x: goal.x + 0.3, z: goal.z }
  disturb(tap.x, tap.z, 301)
  for (let i = 0; i < 5; i += 1) stepMotor(shrimp, 905, 'shrimp', goal, 1 / 30, 301 + i / 30)
  assert.equal(shrimp.state, 'startle')
  assert.ok(Math.hypot(shrimp.x - tap.x, shrimp.z - tap.z) > Math.hypot(before.x - tap.x, before.z - tap.z) + 0.05, 'shot away from the tap')
  forgetMotor(905)

  // Snail: withdraws and stays put.
  const snail = createMotor(906, goal.x, goal.z, 0)
  for (let i = 0; i < 30; i += 1) stepMotor(snail, 906, 'snail', goal, 1 / 30, 400 + i / 30)
  disturb(goal.x + 0.1, goal.z, 401)
  stepMotor(snail, 906, 'snail', goal, 1 / 30, 401)
  const still = { x: snail.x, z: snail.z }
  for (let i = 0; i < 30; i += 1) stepMotor(snail, 906, 'snail', goal, 1 / 30, 401 + i / 30)
  assert.ok(Math.hypot(snail.x - still.x, snail.z - still.z) < 0.005, 'snail froze')
  forgetMotor(906)
})

test('a hunting beetle runs prey down in bursts and the prey bolts', () => {
  const beetle = createMotor(910, -1.5, -1.2, Math.PI / 2), prey = createMotor(911, -0.9, -1.2, 0)
  const bGoal = { x: -1.5, z: -1.2, heading: 0, activity: 'active', hunting: true }, pGoal = { x: -0.9, z: -1.2, heading: 0, activity: 'active' }
  let chased = false, fled = false, closest = Infinity
  for (let i = 0; i < 150; i += 1) {
    const t = 500 + i / 30
    stepMotor(prey, 911, 'woodlouse', pGoal, 1 / 30, t)
    stepMotor(beetle, 910, 'beetle', bGoal, 1 / 30, t)
    if (beetle.chasing && beetle.state === 'walk') chased = true
    if (prey.state === 'startle') fled = true
    closest = Math.min(closest, Math.hypot(beetle.x - prey.x, beetle.z - prey.z))
  }
  assert.ok(chased, 'beetle chased')
  assert.ok(fled, 'prey fled')
  assert.ok(closest < 0.4, `beetle closed in (${closest.toFixed(2)})`)
  forgetMotor(910); forgetMotor(911)
})

test('a courting male woodlouse keeps close behind his partner', () => {
  const her = createMotor(920, -1.6, -1.0, 0), him = createMotor(921, -1.2, -1.3, 0)
  const herGoal = { x: -1.6, z: -1.0, heading: 0, activity: 'active', partner: 921, male: false }
  const hisGoal = { x: -1.3, z: -1.2, heading: 0, activity: 'active', partner: 920, male: true }
  let near = 0
  for (let i = 0; i < 300; i += 1) {
    const t = 700 + i / 30
    stepMotor(her, 920, 'woodlouse', herGoal, 1 / 30, t)
    stepMotor(him, 921, 'woodlouse', hisGoal, 1 / 30, t)
    if (i > 150 && Math.hypot(her.x - him.x, her.z - him.z) < motorProfiles.woodlouse.spacing * 1.2) near += 1
  }
  assert.ok(near > 100, `close behind her most of the time (${near}/149)`)
  forgetMotor(920); forgetMotor(921)
})

import { temperament, temperamentWords } from '../src/scene/behaviour.ts'

test('each animal has its own lasting temperament, and shy woodlice sometimes freeze', () => {
  assert.deepEqual(temperament(7), temperament(7))
  const bolds = Array.from({ length: 200 }, (_, id) => temperament(id).bold)
  assert.ok(Math.min(...bolds) < 0.1 && Math.max(...bolds) > 0.9, 'a spread of boldness')
  assert.ok(temperamentWords(3).length >= 2)
  // Across many shy woodlice tapped once, some freeze in place and some run.
  let froze = 0, ran = 0
  for (let id = 1000; id < 1200; id += 1) {
    if (temperament(id).bold > 0.3) continue
    const goal = { x: -1.5, z: -1.2, heading: 0, activity: 'active' }
    const m = createMotor(id, goal.x, goal.z, 0)
    stepMotor(m, id, 'woodlouse', goal, 1 / 30, 900 + id)
    disturb(goal.x + 0.1, goal.z, 900 + id)
    stepMotor(m, id, 'woodlouse', goal, 1 / 30, 900 + id)
    if (m.state === 'startle') { if (m.frozen) froze += 1; else ran += 1 }
    forgetMotor(id)
  }
  assert.ok(froze > 3 && ran > 3, `froze ${froze}, ran ${ran}`)
})
