/*
 * Moment-to-moment behaviour of land animals (owner, 2026-11-26: "creature behaviour as realistic and dynamic
 * as possible, nice to just watch"). Visual only.
 *
 * The ecology decides once per model hour where an animal goes and what it is doing (feeding, resting,
 * fleeing). Real small animals do not glide in straight lines between such points: they walk in bouts and
 * stop, turn, probe with their antennae, crowd together to rest and bolt when disturbed. This layer runs every
 * frame and gives each animal a "motor" that does those things while staying on a leash around the position
 * the ecology chose, so nothing here changes the simulation, the save or the food web.
 *
 * Species profiles and their sources:
 * - Woodlouse (Porcellio scaber): intermittent stop-go walking; orthokinesis, i.e. more and faster walking
 *   in dry air and settling in damp (Gunn 1937, J Exp Biol 14:178-186, https://doi.org/10.1242/jeb.14.2.178);
 *   aggregation while resting, touching each other (Broly, Deneubourg & Devigne 2013, Insectes Sociaux
 *   60:419-435, https://doi.org/10.1007/s00040-013-0313-7); walking about 1 cm/s.
 * - Springtail (the game's Mesaphorura model, Tullbergiidae): a blind soil-dwelling springtail with a
 *   reduced springing organ, so it creeps slowly with frequent pauses and does not jump (Hopkin 1997,
 *   Biology of the Springtails, Oxford UP). It flinches and backs off when disturbed instead.
 * - Tiger beetle: pursues prey in run-stop-run bursts, because at full speed its eyes cannot resolve the
 *   prey and it must stop to look again (Gilbert 1997, J Comp Physiol A 181:217-230,
 *   https://doi.org/10.1007/s003590050108).
 * - Harvester ant worker: runs at about 3.4 cm/s (Pogonomyrmex rugosus, J Exp Biol 181:49) along the
 *   trail the colony model lays, and stops for brief antennal contacts when it meets a nestmate; those
 *   contacts are how workers read each other's task (Greene & Gordon 2003, Nature 423:32,
 *   https://doi.org/10.1038/423032a; Gordon 2010, Ant Encounters, Princeton UP).
 * - Caterpillar (cabbage white larva): slow crawling with pauses, and side-to-side head casting while it
 *   searches for food (Dethier 1959, Can Entomol 91:554-561, on lepidopteran larval search).
 */
import { isLand } from '../sim/land.ts'

export type MotorState = 'walk' | 'pause' | 'probe' | 'feed' | 'rest' | 'startle'
export interface Motor {
  x: number; z: number; heading: number
  /** Current ground speed, world units per second. */
  speed: number
  state: MotorState
  /** Seconds left in the current state. */
  timer: number
  /** Heading the animal is turning toward. */
  aim: number
  seed: number
  /** Start of a probing sweep (for the side-to-side look). */
  sweep: number
  /** Last disturbance this motor reacted to. */
  startled: number
  /** When it last stopped to touch antennae. */
  greeted: number
}

export interface MotorProfile {
  walk: number; run: number
  /** Radians per second the body can turn. */
  turn: number
  walkBout: [number, number]; pauseBout: [number, number]
  /** Chance that a pause is spent probing (antenna sweep, head casting) instead of standing still. */
  probe: number
  /** How far the animal may roam around the ecology's position while idling. */
  wander: number
  /** Beyond this distance from the ecology's position it stops dawdling and travels. */
  leash: number
  /** How strongly the heading wobbles while walking (path sinuosity). */
  wobble: number
  /** Reaction distance to a tap and how it reacts. */
  scare: number
  scareStyle: 'bolt' | 'flinch'
  /** Distance kept from same-kind neighbours unless resting together. */
  spacing: number
  /** Rest touching others of the same kind. */
  huddle: boolean
  /** Stop for a brief antennal contact on meeting another of its kind (ants). */
  greet?: boolean
}

// 1 unit is about 19 mm (SCALE_BIBLE.md), so 1 cm/s is about 0.53 units/s.
export const motorProfiles: Record<'woodlouse' | 'springtail' | 'beetle' | 'grazer' | 'ant', MotorProfile> = {
  woodlouse: { walk: 0.5, run: 1.3, turn: 4, walkBout: [1.2, 4], pauseBout: [0.6, 3], probe: 0.55, wander: 0.35, leash: 0.45, wobble: 1.1, scare: 0.9, scareStyle: 'bolt', spacing: 0.32, huddle: true },
  springtail: { walk: 0.05, run: 0.1, turn: 5, walkBout: [0.8, 2.5], pauseBout: [0.8, 3.5], probe: 0.4, wander: 0.08, leash: 0.1, wobble: 2, scare: 0.25, scareStyle: 'flinch', spacing: 0.035, huddle: true },
  beetle: { walk: 0.9, run: 3.2, turn: 7, walkBout: [0.25, 0.7], pauseBout: [0.3, 1.2], probe: 0.3, wander: 0.5, leash: 0.6, wobble: 0.5, scare: 1.1, scareStyle: 'bolt', spacing: 0.45, huddle: false },
  ant: { walk: 1.3, run: 2.4, turn: 9, walkBout: [1.5, 4], pauseBout: [0.15, 0.5], probe: 0.7, wander: 0.1, leash: 0.14, wobble: 1.4, scare: 0.7, scareStyle: 'bolt', spacing: 0.06, huddle: false, greet: true },
  grazer: { walk: 0.12, run: 0.2, turn: 1.6, walkBout: [2, 5], pauseBout: [1, 4], probe: 0.6, wander: 0.25, leash: 0.35, wobble: 0.4, scare: 0.5, scareStyle: 'flinch', spacing: 0.4, huddle: false },
}

export type MotorKind = keyof typeof motorProfiles

const rand = (motor: Motor) => { motor.seed = (motor.seed * 16807) % 2147483647; return motor.seed / 2147483647 }
const between = (motor: Motor, [a, b]: [number, number]) => a + (b - a) * rand(motor)
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

export function createMotor(id: number, x: number, z: number, heading: number): Motor {
  return { x, z, heading, speed: 0, state: 'pause', timer: 0.2 + (id % 7) * 0.15, aim: heading, seed: 1 + ((id * 7919) % 2147483646), sweep: 0, startled: -Infinity, greeted: -Infinity }
}

/* Taps on the ground disturb nearby animals. Kept outside React so every motor can read it cheaply. */
let disturbance = { x: 0, z: 0, at: -Infinity }
export function disturb(x: number, z: number, at = performance.now() / 1000) { disturbance = { x, z, at } }

/* Where each animal is drawn, so picking and the follow camera aim at the body and not the ecology's point. */
const drawn = new Map<number, { x: number; z: number; kind: MotorKind; resting: boolean }>()
export function drawnPosition(id: number) { return drawn.get(id) }
export function forgetMotor(id: number) { drawn.delete(id) }
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __motors: typeof drawn }).__motors = drawn

export interface MotorGoal {
  x: number; z: number; heading: number
  activity: 'feeding' | 'resting' | 'fleeing' | 'active'
  /** 0 damp .. 1 dry: woodlice walk more and faster in dry air (orthokinesis). */
  dryness?: number
}

/** Advances one motor by `dt` seconds toward the ecology's goal. `now` is in seconds. Returns the motor. */
export function stepMotor(motor: Motor, id: number, kind: MotorKind, goal: MotorGoal, dt: number, now: number): Motor {
  const profile = motorProfiles[kind]
  dt = Math.min(dt, 0.1)
  const dx = goal.x - motor.x, dz = goal.z - motor.z, far = Math.hypot(dx, dz)
  const towardGoal = Math.atan2(dx, dz)
  const dry = kind === 'woodlouse' ? goal.dryness ?? 0.3 : 0.3
  const pace = 0.75 + dry * 0.6

  // A tap nearby: bolt away, or flinch and back off. Only once per tap.
  const tapAge = now - disturbance.at
  if (tapAge < 0.4 && disturbance.at !== motor.startled && Math.hypot(disturbance.x - motor.x, disturbance.z - motor.z) < profile.scare) {
    motor.startled = disturbance.at
    motor.state = 'startle'
    motor.aim = Math.atan2(motor.x - disturbance.x, motor.z - disturbance.z) + (rand(motor) - 0.5) * 0.8
    motor.timer = profile.scareStyle === 'bolt' ? between(motor, [0.6, 1.3]) : between(motor, [0.25, 0.5])
    if (profile.scareStyle === 'flinch') motor.heading = wrap(motor.heading + (rand(motor) - 0.5) * 0.6)
  }

  motor.timer -= dt
  if (motor.state === 'startle') {
    if (motor.timer <= 0) { motor.state = 'pause'; motor.timer = between(motor, profile.pauseBout) * 1.5 }
  } else if (goal.activity === 'fleeing' || far > profile.leash) {
    // Travel: the ecology moved it on (or it is fleeing). Walk there with short stops only when close.
    if ((motor.state !== 'walk' && motor.state !== 'pause') || motor.timer <= 0) {
      motor.state = far > profile.leash * 2 || goal.activity === 'fleeing' ? 'walk' : rand(motor) < 0.25 ? 'pause' : 'walk'
      motor.timer = motor.state === 'walk' ? between(motor, profile.walkBout) : between(motor, profile.pauseBout) * 0.4
    }
    motor.aim = towardGoal + (rand(motor) - 0.5) * profile.wobble * dt * 6
  } else if (goal.activity === 'resting') {
    // Settle at the resting place; woodlice and springtails crowd together, touching.
    const spot = restingSpot(id, kind, goal, profile)
    const sx = spot.x - motor.x, sz = spot.z - motor.z
    if (Math.hypot(sx, sz) > profile.spacing * 0.2) { motor.state = 'walk'; motor.aim = Math.atan2(sx, sz); motor.timer = 0.3 }
    else { motor.state = 'rest'; motor.timer = 1 }
  } else if (goal.activity === 'feeding' && far < profile.wander * 0.5) {
    // At the food: stand and feed, shifting a little now and then.
    if (motor.state !== 'feed' || motor.timer <= 0) {
      motor.state = rand(motor) < 0.85 ? 'feed' : 'walk'
      motor.timer = motor.state === 'feed' ? between(motor, [1.5, 5]) : 0.3
      motor.aim = motor.state === 'walk' ? towardGoal + (rand(motor) - 0.5) * 1.5 : motor.heading + (rand(motor) - 0.5) * 0.6
    }
  } else if (motor.timer <= 0) {
    // Idle or foraging around its spot: stop-go bouts, with probing during some pauses.
    if (motor.state === 'walk') {
      motor.state = rand(motor) < profile.probe ? 'probe' : 'pause'
      motor.timer = between(motor, profile.pauseBout) / pace
      motor.sweep = now
    } else {
      motor.state = 'walk'
      motor.timer = between(motor, profile.walkBout) * pace
      // A new walking direction: mostly onward, pulled back toward the spot when it strays.
      const pull = Math.min(1, far / profile.wander)
      const onward = motor.heading + (rand(motor) - 0.5) * 2.2
      motor.aim = Math.atan2(Math.sin(onward) * (1 - pull) + Math.sin(towardGoal) * pull, Math.cos(onward) * (1 - pull) + Math.cos(towardGoal) * pull)
      if (goal.activity === 'feeding') motor.aim = towardGoal
    }
  }

  // Ants meeting a nestmate stop face to face for a moment of antennal contact.
  if (profile.greet && motor.state === 'walk' && now - motor.greeted > 2.5) for (const [other, at] of drawn) {
    if (other === id || at.kind !== kind || Math.hypot(at.x - motor.x, at.z - motor.z) > profile.spacing * 1.6) continue
    motor.greeted = now; motor.state = 'probe'; motor.sweep = now
    motor.timer = between(motor, [0.35, 0.9]); motor.aim = Math.atan2(at.x - motor.x, at.z - motor.z)
    break
  }

  // Keep apart from same-kind neighbours unless resting together.
  let pushX = 0, pushZ = 0
  if (motor.state !== 'rest') for (const [other, at] of drawn) {
    if (other === id || at.kind !== kind) continue
    const ox = motor.x - at.x, oz = motor.z - at.z, d = Math.hypot(ox, oz)
    if (d > 1e-6 && d < profile.spacing) { pushX += ox / d * (profile.spacing - d); pushZ += oz / d * (profile.spacing - d) }
  }

  // Turn toward the aim at a limited rate; walking adds a wobble so paths curve like real ones.
  const moving = motor.state === 'walk' || motor.state === 'startle'
  if (moving) motor.aim += Math.sin(now * 1.7 + id) * profile.wobble * dt
  if (motor.state === 'probe') motor.heading += Math.sin((now - motor.sweep) * 5) * 0.9 * dt * profile.turn * 0.4
  const turn = wrap(motor.aim - motor.heading)
  const turnRate = profile.turn * (motor.state === 'startle' ? 3 : 1)
  if (moving || motor.state === 'feed' || (profile.greet && motor.state === 'probe')) motor.heading = wrap(motor.heading + Math.sign(turn) * Math.min(Math.abs(turn), turnRate * dt))

  // Speed eases up and down (no instant starts), faster when far behind or startled.
  const catchUp = far > profile.leash ? Math.min(3, far / profile.leash) : 1
  const target = motor.state === 'startle' ? profile.run : motor.state === 'walk' ? profile.walk * pace * catchUp : 0
  motor.speed += (Math.min(target, profile.run * 1.5) - motor.speed) * Math.min(1, dt * 6)
  // Turn on the spot first: barely creep forward until roughly facing the new direction.
  const facing = Math.cos(turn) > 0.3 ? 1 : 0.15
  let nx = motor.x + Math.sin(motor.heading) * motor.speed * facing * dt + pushX * dt * 2
  let nz = motor.z + Math.cos(motor.heading) * motor.speed * facing * dt + pushZ * dt * 2
  // Never into the pond or through the glass, and never far from where the ecology says it is.
  const rim = kind === 'ant' ? 3.79 : 3.3
  if (!isLand(nx, nz, 0, rim) && isLand(motor.x, motor.z, 0, rim)) { nx = motor.x; nz = motor.z; motor.aim = towardGoal; motor.speed *= 0.5 }
  const leashX = nx - goal.x, leashZ = nz - goal.z, leash = Math.hypot(leashX, leashZ), hard = profile.leash * 3
  if (leash > hard) { nx = goal.x + leashX / leash * hard; nz = goal.z + leashZ / leash * hard }
  motor.x = nx; motor.z = nz
  drawn.set(id, { x: motor.x, z: motor.z, kind, resting: motor.state === 'rest' })
  return motor
}

/** Resting animals gather: each settles beside the nearest resting neighbour of its kind, else at its spot. */
function restingSpot(id: number, kind: MotorKind, goal: MotorGoal, profile: MotorProfile) {
  if (!profile.huddle) return goal
  let best: { x: number; z: number } | null = null, bestD = profile.leash * 1.5
  for (const [other, at] of drawn) {
    if (other === id || at.kind !== kind || !at.resting) continue
    const d = Math.hypot(at.x - goal.x, at.z - goal.z)
    if (d < bestD) { bestD = d; best = at }
  }
  if (!best) return goal
  // Touching, on the side facing its own spot.
  const a = Math.atan2(goal.x - best.x, goal.z - best.z)
  return { x: best.x + Math.sin(a) * profile.spacing * 0.55, z: best.z + Math.cos(a) * profile.spacing * 0.55, heading: goal.heading, activity: goal.activity }
}
