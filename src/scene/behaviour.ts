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
 * - Water flea (Daphnia): "hop and sink" swimming, a stroke of the second antennae lifts it and it sinks
 *   between strokes, with short horizontal darts (Dodson & Ramcharan 1991, J Plankton Res 13:1367,
 *   https://doi.org/10.1093/plankt/13.6.1367). The vertical part lives in the scene (flea depth).
 * - Small pond fish: burst-and-coast swimming, a few tail beats then a glide (Videler & Weihs 1982,
 *   J Exp Biol 97:169, https://doi.org/10.1242/jeb.97.1.169); a fast-start dart when startled.
 * - Ramshorn snail: a slow continuous glide on its foot; when disturbed it withdraws and stays still.
 * - Cherry shrimp: short walks and long pauses picking at the film; escapes with a backward tail flip
 *   (caridean escape, Arnott, Neil & Ansell 1998, J Exp Biol 201:1771, https://doi.org/10.1242/jeb.201.11.1771).
 * - Hunting tiger beetle: when the ecology says it is hunting, it sights the nearest prey and closes in
 *   run-stop-run (Gilbert 1997, above); a woodlouse, springtail or caterpillar that sees a running hunter
 *   close by startles away. A chase that ends in a strike is a near miss here: kills stay with the ecology.
 * - Courting woodlice: the male follows his partner closely and taps her with his antennae before mating
 *   (general account of oniscidean courtship, Warburg 1993, Evolutionary Biology of Land Isopods, Springer).
 * - Individuality: animals of one species differ consistently in boldness and activity (animal
 *   personality; Réale et al. 2007, Biol Rev 82:291, https://doi.org/10.1111/j.1469-185X.2007.00010.x).
 *   Woodlice in particular differ in how they meet a threat: some run, others freeze in tonic immobility
 *   (Tuf, Drábková & Šipoš 2015, ZooKeys 515:159). Each animal's temperament comes from its id, so it is
 *   the same every session and needs nothing in the save.
 * - Caterpillar (cabbage white larva): slow crawling with pauses, and side-to-side head casting while it
 *   searches for food (Dethier 1959, Can Entomol 91:554-561, on lepidopteran larval search).
 */
import { isLand } from '../sim/land.ts'
import { pondShape } from '../sim/pondShape.ts'

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
  /** Hunters: running down prey right now, and no new chase before this time. */
  chasing: boolean
  restUntil: number
  /** Prey: last time it fled a hunter. */
  fled: number
  /** This startle is tonic immobility (a shy woodlouse freezing instead of running). */
  frozen: boolean
  temper: Temperament
}

/** Consistent individual differences, 0..1 each, fixed by the animal's id. */
export interface Temperament { bold: number; busy: number; quick: number }
export function temperament(id: number): Temperament {
  let h = (id + 0x9e3779b9) | 0
  const next = () => { h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
  return { bold: next(), busy: next(), quick: next() }
}
/** Words for the animal card. */
export function temperamentWords(id: number) {
  const t = temperament(id)
  return [t.bold > 0.66 ? 'bold' : t.bold < 0.33 ? 'shy' : 'steady', t.busy > 0.66 ? 'restless' : t.busy < 0.33 ? 'unhurried' : 'even-paced', ...(t.quick > 0.8 ? ['quick'] : t.quick < 0.2 ? ['slow'] : [])]
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
  scareStyle: 'bolt' | 'flinch' | 'freeze' | 'backflip'
  /** Distance kept from same-kind neighbours unless resting together. */
  spacing: number
  /** Rest touching others of the same kind. */
  huddle: boolean
  /** Stop for a brief antennal contact on meeting another of its kind (ants). */
  greet?: boolean
  /** Lives in the pond instead of on land. */
  medium?: 'water'
  /** Glides to a stop instead of halting (fish coast between tail-beat bursts): speed decay per second. */
  coast?: number
}

// 1 unit is about 19 mm (SCALE_BIBLE.md), so 1 cm/s is about 0.53 units/s.
export const motorProfiles: Record<'woodlouse' | 'springtail' | 'beetle' | 'grazer' | 'ant' | 'flea' | 'fish' | 'snail' | 'shrimp', MotorProfile> = {
  woodlouse: { walk: 0.5, run: 1.3, turn: 4, walkBout: [1.2, 4], pauseBout: [0.6, 3], probe: 0.55, wander: 0.35, leash: 0.45, wobble: 1.1, scare: 0.9, scareStyle: 'bolt', spacing: 0.32, huddle: true },
  springtail: { walk: 0.05, run: 0.1, turn: 5, walkBout: [0.8, 2.5], pauseBout: [0.8, 3.5], probe: 0.4, wander: 0.08, leash: 0.1, wobble: 2, scare: 0.25, scareStyle: 'flinch', spacing: 0.035, huddle: true },
  beetle: { walk: 0.9, run: 3.2, turn: 7, walkBout: [0.25, 0.7], pauseBout: [0.3, 1.2], probe: 0.3, wander: 0.5, leash: 0.6, wobble: 0.5, scare: 1.1, scareStyle: 'bolt', spacing: 0.45, huddle: false },
  ant: { walk: 1.3, run: 2.4, turn: 9, walkBout: [1.5, 4], pauseBout: [0.15, 0.5], probe: 0.7, wander: 0.1, leash: 0.14, wobble: 1.4, scare: 0.7, scareStyle: 'bolt', spacing: 0.06, huddle: false, greet: true },
  flea: { walk: 0.18, run: 0.5, turn: 6, walkBout: [0.6, 2], pauseBout: [0.3, 1.2], probe: 0, wander: 0.2, leash: 0.3, wobble: 2.5, scare: 0.6, scareStyle: 'bolt', spacing: 0.05, huddle: false, medium: 'water' },
  fish: { walk: 1.2, run: 4, turn: 6, walkBout: [0.15, 0.4], pauseBout: [0.6, 2], probe: 0.2, wander: 0.8, leash: 1, wobble: 0.6, scare: 1.4, scareStyle: 'bolt', spacing: 0.4, huddle: false, medium: 'water', coast: 1.2 },
  snail: { walk: 0.07, run: 0.07, turn: 1.2, walkBout: [4, 10], pauseBout: [1, 4], probe: 0.3, wander: 0.15, leash: 0.25, wobble: 0.3, scare: 0.4, scareStyle: 'freeze', spacing: 0.12, huddle: false, medium: 'water' },
  shrimp: { walk: 0.25, run: 2.5, turn: 5, walkBout: [0.3, 1], pauseBout: [0.5, 2.5], probe: 0.6, wander: 0.3, leash: 0.4, wobble: 1, scare: 0.8, scareStyle: 'backflip', spacing: 0.15, huddle: false, medium: 'water' },
  grazer: { walk: 0.12, run: 0.2, turn: 1.6, walkBout: [2, 5], pauseBout: [1, 4], probe: 0.6, wander: 0.25, leash: 0.35, wobble: 0.4, scare: 0.5, scareStyle: 'flinch', spacing: 0.4, huddle: false },
}

export type MotorKind = keyof typeof motorProfiles

const rand = (motor: Motor) => { motor.seed = (motor.seed * 16807) % 2147483647; return motor.seed / 2147483647 }
const between = (motor: Motor, [a, b]: [number, number]) => a + (b - a) * rand(motor)
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

export function createMotor(id: number, x: number, z: number, heading: number): Motor {
  return { x, z, heading, speed: 0, state: 'pause', timer: 0.2 + (id % 7) * 0.15, aim: heading, seed: 1 + ((id * 7919) % 2147483646), sweep: 0, startled: -Infinity, greeted: -Infinity, chasing: false, restUntil: 0, fled: -Infinity, frozen: false, temper: temperament(id) }
}

/* Taps on the ground disturb nearby animals. Kept outside React so every motor can read it cheaply. */
let disturbance = { x: 0, z: 0, at: -Infinity }
export function disturb(x: number, z: number, at = performance.now() / 1000) { disturbance = { x, z, at } }

/* Where each animal is drawn, so picking and the follow camera aim at the body and not the ecology's point. */
const drawn = new Map<number, { x: number; z: number; heading: number; kind: MotorKind; resting: boolean; hunting?: boolean }>()
const preyKinds: MotorKind[] = ['woodlouse', 'springtail', 'grazer']

/* Behaviour moments worth pointing out to the player (a hunt starting, courtship, a woodlouse freezing).
   At most one of each kind per 90 s, so they stay special. */
export type Moment = { kind: 'chase' | 'courtship' | 'freeze'; id: number; other?: number; otherKind?: MotorKind; at: number }
const momentListeners = new Set<(moment: Moment) => void>()
const lastMoment = new Map<Moment['kind'], number>()
export function onMoment(listener: (moment: Moment) => void) { momentListeners.add(listener); return () => { momentListeners.delete(listener) } }
function emit(moment: Moment) {
  if (moment.at - (lastMoment.get(moment.kind) ?? -Infinity) < 90) return
  lastMoment.set(moment.kind, moment.at)
  for (const listener of momentListeners) listener(moment)
}
export function drawnPosition(id: number) { return drawn.get(id) }
export function forgetMotor(id: number) { drawn.delete(id) }
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __motors: typeof drawn }).__motors = drawn

export interface MotorGoal {
  x: number; z: number; heading: number
  activity: 'feeding' | 'resting' | 'fleeing' | 'active'
  /** 0 damp .. 1 dry: woodlice walk more and faster in dry air (orthokinesis). */
  dryness?: number
  /** Beetles: the ecology says it is hungry and hunting. */
  hunting?: boolean
  /** Courting woodlice: the partner's id, and whether this one is the male (who follows). */
  partner?: number | null
  male?: boolean
}

/** Advances one motor by `dt` seconds toward the ecology's goal. `now` is in seconds. Returns the motor. */
export function stepMotor(motor: Motor, id: number, kind: MotorKind, goal: MotorGoal, dt: number, now: number): Motor {
  const profile = motorProfiles[kind]
  dt = Math.min(dt, 0.1)
  const dx = goal.x - motor.x, dz = goal.z - motor.z, far = Math.hypot(dx, dz)
  const towardGoal = Math.atan2(dx, dz)
  const dry = kind === 'woodlouse' ? goal.dryness ?? 0.3 : 0.3
  const t = motor.temper
  const pace = (0.75 + dry * 0.6) * (0.85 + t.quick * 0.3)
  const scare = profile.scare * (1.35 - t.bold * 0.7)
  const walkBout = profile.walkBout.map((v) => v * (0.7 + t.busy * 0.6)) as [number, number]
  const pauseBout = profile.pauseBout.map((v) => v * (1.3 - t.busy * 0.6)) as [number, number]

  // A tap nearby: bolt away, or flinch and back off. Only once per tap.
  const tapAge = now - disturbance.at
  if (tapAge < 0.4 && disturbance.at !== motor.startled && Math.hypot(disturbance.x - motor.x, disturbance.z - motor.z) < scare) {
    motor.startled = disturbance.at
    motor.state = 'startle'
    motor.aim = Math.atan2(motor.x - disturbance.x, motor.z - disturbance.z) + (rand(motor) - 0.5) * 0.8
    motor.frozen = kind === 'woodlouse' && rand(motor) < (1 - t.bold) * 0.6
    if (motor.frozen) emit({ kind: 'freeze', id, at: now })
    motor.timer = motor.frozen ? between(motor, [2, 6]) : profile.scareStyle === 'bolt' ? between(motor, [0.6, 1.3]) : profile.scareStyle === 'freeze' ? between(motor, [2, 4]) : profile.scareStyle === 'backflip' ? between(motor, [0.2, 0.35]) : between(motor, [0.25, 0.5])
    if (profile.scareStyle === 'flinch') motor.heading = wrap(motor.heading + (rand(motor) - 0.5) * 0.6)
    // A shrimp faces the threat and shoots backwards, away from it.
    if (profile.scareStyle === 'backflip') { motor.heading = wrap(motor.aim + Math.PI); motor.aim = motor.heading }
    if (profile.scareStyle === 'freeze') motor.aim = motor.heading
  }

  // Prey that sees a hunter running at it close by bolts (or flinches) away from it.
  if (preyKinds.includes(kind) && motor.state !== 'startle' && now - motor.fled > 1.5) for (const [, at] of drawn) {
    if (!at.hunting || Math.hypot(at.x - motor.x, at.z - motor.z) > scare * 1.1) continue
    motor.fled = now; motor.state = 'startle'; motor.frozen = false
    motor.aim = Math.atan2(motor.x - at.x, motor.z - at.z) + (rand(motor) - 0.5) * 0.6
    motor.timer = profile.scareStyle === 'bolt' ? between(motor, [0.7, 1.4]) : between(motor, [0.3, 0.6])
    break
  }

  // A hunting beetle sights the nearest prey within reach of its leash and runs it down in bursts.
  let quarry: { x: number; z: number; kind: MotorKind } | null = null, quarryId = -1
  if (kind === 'beetle' && goal.hunting && goal.activity !== 'resting' && motor.state !== 'startle' && now >= motor.restUntil) {
    let best = 1.4
    for (const [other, at] of drawn) {
      // Any prey can be flushed and chased; on screen a chase always ends in a missed lunge, and what is
      // really caught stays with the ecology (which keeps resting and plant-borne prey out of reach).
      if (!preyKinds.includes(at.kind)) continue
      const d = Math.hypot(at.x - motor.x, at.z - motor.z)
      if (d < best && Math.hypot(at.x - goal.x, at.z - goal.z) < profile.leash * 2.5) { best = d; quarry = at; quarryId = other }
    }
  }
  // A courting male keeps close behind his partner, tapping her with his antennae.
  const partner = goal.male && goal.partner != null ? drawn.get(goal.partner) : undefined
  const courting = !!partner && partner.kind === kind && Math.hypot(partner.x - goal.x, partner.z - goal.z) < profile.leash * 3

  if (!quarry) motor.chasing = false
  motor.timer -= dt
  if (quarry && motor.state !== 'startle') {
    const qd = Math.hypot(quarry.x - motor.x, quarry.z - motor.z)
    if (!motor.chasing) emit({ kind: 'chase', id, other: quarryId, otherKind: quarry.kind, at: now })
    motor.chasing = true
    if (qd < 0.14) {
      // Strike: it lunges and bites at nothing; the prey is off. Rest a while before hunting again.
      motor.state = 'feed'; motor.timer = between(motor, [0.8, 1.6]); motor.chasing = false
      motor.restUntil = now + between(motor, [5, 10])
    } else if (motor.timer <= 0 || (motor.state !== 'walk' && motor.state !== 'pause')) {
      // Run-stop-run: a short burst, then a stop to look again.
      motor.state = motor.state === 'walk' ? 'pause' : 'walk'
      motor.timer = motor.state === 'walk' ? between(motor, [0.25, 0.55]) : between(motor, [0.12, 0.35])
    }
    motor.aim = Math.atan2(quarry.x - motor.x, quarry.z - motor.z)
  } else if (courting && motor.state !== 'startle') {
    motor.chasing = false
    const bx = partner!.x - Math.sin(partner!.heading) * profile.spacing * 0.6, bz = partner!.z - Math.cos(partner!.heading) * profile.spacing * 0.6
    if (Math.hypot(bx - motor.x, bz - motor.z) > profile.spacing * 0.25) { motor.state = 'walk'; motor.aim = Math.atan2(bx - motor.x, bz - motor.z); motor.timer = 0.2 }
    else { if (motor.state !== 'probe') emit({ kind: 'courtship', id, other: goal.partner!, at: now }); motor.state = 'probe'; motor.timer = 0.4; motor.sweep = motor.sweep || now; motor.aim = partner!.heading }
  } else if (motor.state === 'startle') {
    motor.chasing = false
    if (motor.timer <= 0) { motor.state = 'pause'; motor.timer = between(motor, pauseBout) * 1.5 }
  } else if (goal.activity === 'fleeing' || far > profile.leash) {
    // Travel: the ecology moved it on (or it is fleeing). Walk there with short stops only when close.
    if ((motor.state !== 'walk' && motor.state !== 'pause') || motor.timer <= 0) {
      motor.state = far > profile.leash * 2 || goal.activity === 'fleeing' ? 'walk' : rand(motor) < 0.25 ? 'pause' : 'walk'
      motor.timer = motor.state === 'walk' ? between(motor, walkBout) : between(motor, pauseBout) * 0.4
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
      motor.timer = between(motor, pauseBout) / pace
      motor.sweep = now
    } else {
      motor.state = 'walk'
      motor.timer = between(motor, walkBout) * pace
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
    if (other === id || at.kind !== kind || (courting && other === goal.partner)) continue
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
  const target = motor.state === 'startle' ? profile.scareStyle === 'freeze' || motor.frozen ? 0 : profile.run : motor.state === 'walk' ? motor.chasing ? profile.run : profile.walk * pace * catchUp : 0
  const ease = profile.coast && target < motor.speed ? profile.coast : (profile.scareStyle === 'freeze' || motor.frozen) && motor.state === 'startle' ? 30 : 6
  motor.speed += (Math.min(target, profile.run * 1.5) - motor.speed) * Math.min(1, dt * ease)
  // Turn on the spot first: barely creep forward until roughly facing the new direction.
  const facing = motor.state === 'startle' && profile.scareStyle === 'backflip' ? -1 : Math.cos(turn) > 0.3 ? 1 : 0.15
  let nx = motor.x + Math.sin(motor.heading) * motor.speed * facing * dt + pushX * dt * 2
  let nz = motor.z + Math.cos(motor.heading) * motor.speed * facing * dt + pushZ * dt * 2
  // Never into the pond or through the glass, and never far from where the ecology says it is.
  const rim = kind === 'ant' ? 3.79 : 3.3
  const inside = profile.medium === 'water' ? (x: number, z: number) => pondShape().signedDistance(x, z) <= -0.05 : (x: number, z: number) => isLand(x, z, 0, rim)
  if (!inside(nx, nz) && inside(motor.x, motor.z)) { nx = motor.x; nz = motor.z; motor.aim = towardGoal; motor.speed *= 0.5 }
  const leashX = nx - goal.x, leashZ = nz - goal.z, leash = Math.hypot(leashX, leashZ), hard = profile.leash * 3
  if (leash > hard) { nx = goal.x + leashX / leash * hard; nz = goal.z + leashZ / leash * hard }
  motor.x = nx; motor.z = nz
  drawn.set(id, { x: motor.x, z: motor.z, heading: motor.heading, kind, resting: motor.state === 'rest', hunting: motor.chasing && motor.state === 'walk' })
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
