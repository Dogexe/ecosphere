import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { legSwing, parseRig, placements, toLocal, unitsPerPixel } from '../src/scene/paperRig.ts'

const woodlouse = JSON.parse(readFileSync(new URL('../public/assets/paper/woodlouse/rig.json', import.meta.url), 'utf8'))

test('the woodlouse rig is valid and matches its real length', () => {
  const rig = parseRig(woodlouse)
  assert.ok(Math.abs(unitsPerPixel(rig) * (rig.length.to - rig.length.from) - 0.64) < 1e-12)
  // 7 far legs + body + 7 near legs + antenna, far legs drawn first.
  const placed = placements(rig)
  assert.equal(placed.length, 16)
  assert.equal(placed[0].part.side, 'far')
  assert.deepEqual(placed.filter((item) => item.part.side === 'near' && item.part.motion === 'leg').map((item) => item.order), [0, 1, 2, 3, 4, 5, 6])
  for (const part of rig.parts) assert.doesNotThrow(() => readFileSync(new URL(`../public/assets/paper/woodlouse/${part.file}`, import.meta.url)))
})

test('canvas pixels map to the body middle and the ground line', () => {
  const rig = parseRig(woodlouse)
  const [x, y] = toLocal(rig, [(rig.length.from + rig.length.to) / 2, rig.ground], -0.09)
  assert.equal(x, 0)
  assert.equal(y, -0.09)
  const [head] = toLocal(rig, [rig.length.to, rig.ground], 0)
  assert.ok(Math.abs(head - 0.32) < 1e-12)
})

test('repeated legs keep their own pivots and offsets', () => {
  const rig = parseRig(woodlouse)
  const near = placements(rig).filter((item) => item.part.file === 'leg-near.png')
  assert.deepEqual(near[3].offset, [near[3].pivot[0] - near[0].pivot[0], near[3].pivot[1] - near[0].pivot[1]])
})

test('broken rigs are refused with a reason', () => {
  assert.throws(() => parseRig({ ...woodlouse, canvas: [0, 10] }), /canvas/)
  assert.throws(() => parseRig({ ...woodlouse, length: { from: 10, to: 5, units: 1 } }), /length/)
  assert.throws(() => parseRig({ ...woodlouse, parts: [{ file: '../secret.png' }] }), /png/)
  assert.throws(() => parseRig({ ...woodlouse, parts: [{ file: 'a.png', motion: 'dance' }] }), /motion/)
  assert.throws(() => parseRig({ ...woodlouse, parts: [{ file: 'a.png', pivot: [99999, 1] }] }), /outside/)
})

test('legs step in a back-to-front wave with far legs half a step behind', () => {
  assert.ok(Math.abs(legSwing(1, 0, 'near', true) + legSwing(1, 0, 'far', true)) < 1e-12)
  assert.notEqual(legSwing(1, 0, 'near', true), legSwing(1, 1, 'near', true))
  assert.ok(Math.abs(legSwing(1, 2, 'near', false)) <= 0.03)
})
